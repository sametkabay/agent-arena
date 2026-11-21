import { create } from "zustand";
import { setUserPlaceableMetas } from "@/lib/assets/placeableSpec";
import {
  createIdbBackend,
  createUserAssetStore,
  countUsage,
  type PutAssetInput,
  type UsageCount,
  type UserAssetKind,
  type UserAssetMeta,
  type UserAssetStore,
  UserAssetError,
} from "@/lib/userAssets";
import { PersistFailedError } from "@/lib/storage";
import { useArenaStore } from "@/store/arenaStore";
import {
  invalidateAllUserAssets,
  invalidateUserAsset,
} from "@/components/scene/userAssetLoader";

export type UserAssetUiStatus = "loading" | "ready" | "unavailable";

type ImportArgs = {
  name: string;
  files: PutAssetInput["files"];
  targetSize?: number;
  allowExternal?: string[];
  signal?: AbortSignal;
  kind?: UserAssetKind;
};

type ReplaceArgs = {
  id: string;
  files: PutAssetInput["files"];
  allowExternal?: string[];
  signal?: AbortSignal;
};

interface UserAssetState {
  status: UserAssetUiStatus;
  metas: UserAssetMeta[];
  hydrated: boolean;
  lastError: string | null;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  importAsset: (args: ImportArgs) => Promise<UserAssetMeta>;
  renameAsset: (id: string, name: string) => Promise<UserAssetMeta>;
  replaceAsset: (args: ReplaceArgs) => Promise<UserAssetMeta>;
  setTargetSize: (id: string, targetSize: number) => Promise<UserAssetMeta>;
  recordMeasuredBBox: (
    id: string,
    bbox: NonNullable<UserAssetMeta["bbox"]>,
  ) => Promise<UserAssetMeta>;
  /** Returns usage for confirm UI; does not delete. */
  usageOf: (id: string, draft?: Parameters<typeof countUsage>[2]) => UsageCount;
  deleteAsset: (
    id: string,
    draft?: Parameters<typeof countUsage>[2],
  ) => Promise<{ usage: UsageCount }>;
  estimate: () => Promise<{ usage: number | null; quota: number | null } | null>;
  /** Test seam */
  _setStore: (store: UserAssetStore) => void;
}

let libStore: UserAssetStore = createUserAssetStore(createIdbBackend());
let persistTried = false;

const CHANNEL = "user-assets";

function broadcast(type: string, id?: string) {
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ type, id });
    bc.close();
  } catch {
    /* BroadcastChannel missing */
  }
}

function applyMetas(metas: UserAssetMeta[], kind: UserAssetKind = "placeable") {
  const filtered = metas.filter((m) => m.kind === kind);
  if (kind === "placeable") {
    setUserPlaceableMetas(filtered);
  }
  return filtered;
}

async function tryPersistPermission() {
  if (persistTried) return;
  persistTried = true;
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* silent — never prompt ourselves */
  }
}

export const useUserAssetStore = create<UserAssetState>((set, get) => ({
  status: "loading",
  metas: [],
  hydrated: false,
  lastError: null,

  _setStore(store) {
    libStore = store;
  },

  async hydrate() {
    try {
      const metas = await libStore.list();
      const placeables = applyMetas(metas, "placeable");
      set({ status: "ready", metas: placeables, hydrated: true, lastError: null });
    } catch (err) {
      const unavailable =
        err instanceof UserAssetError && err.code === "unavailable";
      set({
        status: unavailable ? "unavailable" : "ready",
        metas: [],
        hydrated: true,
        lastError: err instanceof Error ? err.message : String(err),
      });
      applyMetas([], "placeable");
    }
  },

  async refresh() {
    await get().hydrate();
  },

  async importAsset(args) {
    const kind = args.kind ?? "placeable";
    const meta = await libStore.put(
      {
        kind,
        name: args.name,
        files: args.files,
        targetSize: args.targetSize,
        allowExternal: args.allowExternal,
      },
      { signal: args.signal },
    );
    await tryPersistPermission();
    await get().refresh();
    broadcast("put", meta.id);
    return meta;
  },

  async renameAsset(id, name) {
    const meta = await libStore.rename(id, name);
    await get().refresh();
    broadcast("meta", id);
    return meta;
  },

  async replaceAsset(args) {
    const meta = await libStore.replace(args.id, args.files, {
      signal: args.signal,
      allowExternal: args.allowExternal,
    });
    invalidateUserAsset(args.id);
    await get().refresh();
    broadcast("replace", args.id);
    return meta;
  },

  async setTargetSize(id, targetSize) {
    const meta = await libStore.setTargetSize(id, targetSize);
    await get().refresh();
    broadcast("meta", id);
    return meta;
  },

  async recordMeasuredBBox(id, bbox) {
    const meta = await libStore.recordMeasuredBBox(id, bbox);
    await get().refresh();
    broadcast("meta", id);
    return meta;
  },

  usageOf(id, draft) {
    const { customMaps } = useArenaStore.getState();
    return countUsage(id, customMaps, draft ?? null, "placeable");
  },

  async deleteAsset(id, draft) {
    const arena = useArenaStore.getState();
    const usage = countUsage(id, arena.customMaps, draft ?? null, "placeable");
    // Cascade maps + favorites first (plan §6); IDB last so orphan blob is recoverable.
    const result = arena.purgePlaceableIds([id]);
    if (!result.ok) {
      throw new PersistFailedError(result.reason);
    }
    try {
      window.dispatchEvent(
        new CustomEvent("userAssetDeleted", { detail: { id } }),
      );
    } catch {
      /* ignore */
    }
    try {
      await libStore.delete(id);
    } catch (err) {
      // Maps already purged — still invalidate so UI doesn't keep the mesh.
      invalidateUserAsset(id);
      await get().refresh();
      broadcast("delete", id);
      throw err;
    }
    invalidateUserAsset(id);
    await get().refresh();
    broadcast("delete", id);
    return { usage };
  },

  async estimate() {
    return libStore.estimate();
  },
}));

/** Subscribe to cross-tab invalidation; reload customMaps on purge so a stale
 *  tab cannot resurrect deleted placeables on its next persist. */
export function listenUserAssetBroadcast(): () => void {
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { type?: string; id?: string } | null;
      if (data?.type === "delete" || data?.type === "replace") {
        if (data.id) invalidateUserAsset(data.id);
        else invalidateAllUserAssets();
      }
      if (data?.type === "delete" || data?.type === "purge") {
        // Narrow reload — only customMaps + favoriteAssets. Full hydrate()
        // would wipe runtimeAgents and in-memory chats in this tab.
        useArenaStore.getState().reloadPersistedMaps();
      }
      void useUserAssetStore.getState().refresh();
    };
  } catch {
    return () => {};
  }
  return () => bc?.close();
}

/** Boot helper — call once from app shell. */
export function ensureUserAssetsHydrated(): void {
  const s = useUserAssetStore.getState();
  if (!s.hydrated) void s.hydrate();
}
