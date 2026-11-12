import { create } from "zustand";
import type {
  AgentConfig,
  AiModelConfig,
  AppPersisted,
  ArenaAgent,
  ChatMessage,
  ChatterMode,
  DayNightMode,
  FloatingChatLine,
  GraphicsSettings,
  LanguageCode,
  MapId,
  PlaceableInstance,
} from "@/lib/types";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import {
  buildMapRuntime,
  buildMapImportCopy,
  createBlankCustomMap,
  createCustomMapFromBuiltin,
  listBuiltinMaps,
  parseMapJson,
  prepareMapImport,
  resolveMapDefinition,
  syncRuntimeAgents,
  placeAgentsOnMap,
} from "@/lib/maps";
import type {
  MapImportCommitMode,
  PreparedMapImport,
} from "@/lib/maps";
import {
  loadPersisted,
  sanitizeChats,
  savePersisted,
  uid,
  clampChattiness,
  MAX_ARENA_CHAT_HISTORY,
  PersistFailedError,
  storageFailureMessageKey,
  type StoragePersistResult,
} from "@/lib/storage";
import { createAgentCopy } from "@/lib/agentCopy";
import {
  remapModelIds,
  resolveImportNames,
  type ImportedAgent,
} from "@/lib/agentRoster";
import {
  dedupeImportedModels,
  toAiModelConfigs,
  type ImportedModel,
} from "@/lib/modelConfigIO";
import { isSetupComplete } from "@/lib/onboarding";
import { DEFAULT_CHARACTER_ID, getCharacter } from "@/lib/assets/characters";
import { appConfig, DEFAULT_GRAPHICS } from "@/lib/config";
import { placeableCanWander } from "@/lib/assets/catalog";
import { formatSpeechBubble } from "@/lib/speechBubble";
import i18n from "@/i18n";
import { applyDocumentLang } from "@/i18n/languages";

export const THINKING_BUBBLE = appConfig.defaults.thinkingBubble;

interface ArenaState extends AppPersisted {
  // runtime
  floorSize: number;
  placeables: PlaceableInstance[];
  activeMap: ArenaMapDefinition | null;
  runtimeAgents: ArenaAgent[];
  selectedAgentId: string | null;
  chatOpen: boolean;
  settingsOpen: boolean;
  settingsTab: "general" | "models" | "agents" | "map" | "graphics";
  /** When set, Agents settings tab opens that agent’s editor. */
  settingsFocusAgentId: string | null;
  mapEditorOpen: boolean;
  mapEditorSourceId: string | null;
  chats: Record<string, ChatMessage[]>;
  chatBusyById: Record<string, boolean>;
  /** Persisted shared arena chat (history panel). */
  arenaChatHistory: FloatingChatLine[];
  /** Ephemeral fading feed above the input. */
  floatingChatLog: FloatingChatLine[];
  toast: string | null;
  /** Smooth 0 (day) → 1 (night) blend driven by tick. */
  dayNightBlend: number;
  /** Manual "?" open — not persisted. */
  controlsHelpOpen: boolean;
  /** Session flag: auto controls help already shown this visit. */
  controlsHelpAutoDone: boolean;
  /** Runtime seed for conversation-mode human steering (not persisted). */
  conversationSeed: { seq: number; mentionIds: string[] };
  /** Runtime conversation scheduler status (not persisted). */
  conversationStatus: "inactive" | "running" | "waitingForHuman" | "paused";

  hydrate: () => void;
  /**
   * Writes persisted slice; never throws.
   * Toast modes: `"storage"` (default, 10s throttle), `"map"` / `"explicit"`
   * (always show — user-initiated), `false` (silent).
   */
  persist: (opts?: {
    toast?: "storage" | "map" | "explicit" | false;
  }) => StoragePersistResult;
  setUserName: (name: string) => void;
  setLanguage: (language: LanguageCode) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsTab: (tab: ArenaState["settingsTab"]) => void;
  openAgentSettings: (agentId: string) => void;
  clearSettingsFocusAgent: () => void;
  setGraphics: (partial: Partial<GraphicsSettings>) => void;
  setDayNight: (mode: DayNightMode) => void;
  toggleDayNight: () => void;
  setChatterMode: (mode: ChatterMode) => void;
  seedConversation: (mentionIds: string[]) => void;
  setConversationStatus: (
    status: ArenaState["conversationStatus"],
  ) => void;
  dismissOnboarding: () => void;
  setControlsHelpOpen: (open: boolean) => void;
  closeControlsHelp: (dontShowAgain?: boolean) => void;
  toggleFavoriteAsset: (placeableId: string) => void;
  setMapId: (mapId: MapId) => void;
  applyMapAndAgents: () => void;

  upsertModel: (model: AiModelConfig) => StoragePersistResult;
  deleteModel: (id: string) => void;
  /** Append sanitized models with fresh ids. Rolls back on persist failure. */
  importModels: (
    items: ImportedModel[],
  ) => { models: AiModelConfig[]; result: StoragePersistResult };
  upsertAgent: (agent: AgentConfig) => StoragePersistResult;
  duplicateAgent: (id: string, copyLabel: string) => AgentConfig | null;
  importAgents: (
    items: ImportedAgent[],
    modelIds: string[],
    copyLabel: string,
  ) => { agents: AgentConfig[]; result: StoragePersistResult };
  deleteAgent: (id: string) => void;

  upsertCustomMap: (def: ArenaMapDefinition) => StoragePersistResult;
  deleteCustomMap: (id: string) => void;
  /** Parse/validate map JSON and detect id collision — no side effects. */
  parseMapImport: (raw: string) => PreparedMapImport;
  /**
   * Commit a prepared import. `overwrite` upserts by id; `copy` inserts with a
   * fresh id + localized copy name. On persist failure rolls back and throws
   * PersistFailedError (existing map untouched for overwrite failures).
   * Takes `PreparedMapImport` so id normalization from parse cannot be bypassed.
   */
  commitMapImport: (
    prepared: PreparedMapImport,
    mode: MapImportCommitMode,
    copyLabel: string,
  ) => string;
  openMapEditor: (mapId?: string) => void;
  closeMapEditor: () => void;
  saveMapFromEditor: (
    def: ArenaMapDefinition,
    activate?: boolean,
  ) => StoragePersistResult;
  createNewMap: () => void;
  duplicateActiveMap: () => void;

  selectAgent: (id: string | null) => void;
  commandAgentTo: (agentId: string, pos: [number, number, number]) => void;
  setChatOpen: (open: boolean) => void;
  appendChat: (agentId: string, message: ChatMessage) => void;
  replaceLastAssistant: (agentId: string, content: string) => void;
  setChatBusy: (agentId: string, busy: boolean) => void;
  clearChats: () => StoragePersistResult;
  clearArenaChatHistory: () => StoragePersistResult;
  pushFloatingChatLog: (entry: {
    agentId?: string;
    agentName: string;
    color: string;
    text: string;
    kind?: FloatingChatLine["kind"];
  }) => void;
  removeFloatingChatLog: (id: string) => void;
  clearFloatingChatLog: () => void;
  setAgentSpeech: (agentId: string, text: string | undefined, ms?: number) => void;
  setAgentState: (agentId: string, patch: Partial<ArenaAgent>) => void;
  tick: (dt: number, now: number) => void;
  showToast: (msg: string, ms?: number) => void;
}

function persistSlice(s: ArenaState): AppPersisted {
  return {
    userName: s.userName,
    language: s.language,
    models: s.models,
    agents: s.agents,
    mapId: s.mapId,
    customMaps: s.customMaps,
    graphics: s.graphics,
    dayNight: s.dayNight,
    chatterMode: s.chatterMode,
    onboardingSeen: s.onboardingSeen === true,
    controlsHelpSeen: s.controlsHelpSeen === true,
    favoriteAssets: s.favoriteAssets ?? [],
    chats: sanitizeChats(s.chats),
    arenaChatHistory: s.arenaChatHistory.slice(-MAX_ARENA_CHAT_HISTORY),
  };
}

let arenaChatPersistTimer = 0;
/** Throttle repeated *background* persist-failure toasts (e.g. chat streaming). */
const PERSIST_TOAST_THROTTLE_MS = 10_000;
let lastStoragePersistToastAt = 0;

/** Exposed for unit tests — reset throttle clock between cases. */
export function resetPersistToastThrottle(): void {
  lastStoragePersistToastAt = 0;
}

function scheduleArenaChatPersist(persist: () => void): void {
  window.clearTimeout(arenaChatPersistTimer);
  arenaChatPersistTimer = window.setTimeout(() => persist(), 800);
}

type MapPersistSnapshot = Pick<
  ArenaState,
  | "customMaps"
  | "mapId"
  | "activeMap"
  | "floorSize"
  | "placeables"
  | "runtimeAgents"
>;

type MapImportPersistSnapshot = MapPersistSnapshot &
  Pick<ArenaState, "mapEditorSourceId">;

function snapshotMapPersistState(s: ArenaState): MapPersistSnapshot {
  return {
    customMaps: s.customMaps,
    mapId: s.mapId,
    activeMap: s.activeMap,
    floorSize: s.floorSize,
    placeables: s.placeables,
    runtimeAgents: s.runtimeAgents,
  };
}

function snapshotMapImportPersistState(
  s: ArenaState,
): MapImportPersistSnapshot {
  return {
    ...snapshotMapPersistState(s),
    mapEditorSourceId: s.mapEditorSourceId,
  };
}

function applyMapSlice(
  s: Pick<ArenaState, "agents" | "mapId" | "customMaps" | "runtimeAgents">,
  resetAgentPositions: boolean,
) {
  const def = resolveMapDefinition(s.mapId, s.customMaps);
  const runtime = buildMapRuntime(def);
  const runtimeAgents = resetAgentPositions
    ? placeAgentsOnMap(s.agents, def)
    : syncRuntimeAgents(s.runtimeAgents, s.agents, def);
  return {
    activeMap: def,
    floorSize: runtime.floorSize,
    placeables: runtime.placeables,
    runtimeAgents,
  };
}

export const useArenaStore = create<ArenaState>((set, get) => {
  const initial = loadPersisted();
  return {
  ...initial,
  floorSize: 18,
  placeables: [],
  activeMap: null,
  runtimeAgents: [],
  selectedAgentId: null,
  chatOpen: false,
  settingsOpen: false,
  settingsTab: "general",
  settingsFocusAgentId: null,
  mapEditorOpen: false,
  mapEditorSourceId: null,
  chats: initial.chats ?? {},
  chatBusyById: {},
  arenaChatHistory: initial.arenaChatHistory ?? [],
  floatingChatLog: [],
  toast: null,
  dayNightBlend: 0,
  favoriteAssets: initial.favoriteAssets ?? [],
  controlsHelpOpen: false,
  controlsHelpAutoDone: false,
  conversationSeed: { seq: 0, mentionIds: [] },
  conversationStatus: "inactive",

  hydrate: () => {
    const data = loadPersisted();
    const layout = applyMapSlice(
      { ...data, runtimeAgents: [] },
      true,
    );
    set({
      ...data,
      ...layout,
      chats: data.chats ?? {},
      arenaChatHistory: data.arenaChatHistory ?? [],
      favoriteAssets: data.favoriteAssets ?? [],
      dayNightBlend: data.dayNight === "night" ? 1 : 0,
    });
    void i18n.changeLanguage(data.language);
    applyDocumentLang(data.language);
  },

  persist: (opts) => {
    const result = savePersisted(persistSlice(get()));
    if (!result.ok) {
      const mode = opts?.toast ?? "storage";
      if (mode !== false) {
        const msg = i18n.t(
          storageFailureMessageKey(
            result.reason,
            mode === "map" ? "map" : "storage",
          ),
        );
        // Explicit map/user actions always toast; background writes stay throttled.
        if (mode === "map" || mode === "explicit") {
          get().showToast(msg, 8_000);
        } else {
          const now = Date.now();
          if (now - lastStoragePersistToastAt >= PERSIST_TOAST_THROTTLE_MS) {
            lastStoragePersistToastAt = now;
            // Longer than the default toast — recovery copy is long and easy to miss.
            get().showToast(msg, 8_000);
          }
        }
      }
    }
    return result;
  },

  setUserName: (name) => {
    set({ userName: name.trim() });
    get().persist();
  },

  setLanguage: (language) => {
    set({ language });
    void i18n.changeLanguage(language);
    applyDocumentLang(language);
    get().persist();
  },

  setSettingsOpen: (open) =>
    set(
      open
        ? { settingsOpen: true }
        : { settingsOpen: false, settingsFocusAgentId: null },
    ),
  setSettingsTab: (tab) => set({ settingsTab: tab, settingsOpen: true }),
  openAgentSettings: (agentId) =>
    set({
      settingsOpen: true,
      settingsTab: "agents",
      settingsFocusAgentId: agentId,
    }),
  clearSettingsFocusAgent: () => set({ settingsFocusAgentId: null }),

  setGraphics: (partial) => {
    set((s) => ({ graphics: { ...s.graphics, ...partial } }));
    get().persist();
  },

  setDayNight: (mode) => {
    set({ dayNight: mode });
    get().persist();
  },

  toggleDayNight: () => {
    set((s) => ({ dayNight: s.dayNight === "day" ? "night" : "day" }));
    get().persist();
  },

  setChatterMode: (mode) => {
    set({ chatterMode: mode });
    get().persist();
  },

  seedConversation: (mentionIds) => {
    set((s) => ({
      conversationSeed: {
        seq: s.conversationSeed.seq + 1,
        mentionIds: [...mentionIds],
      },
    }));
  },

  setConversationStatus: (status) => {
    set({ conversationStatus: status });
  },

  dismissOnboarding: () => {
    set({ onboardingSeen: true });
    get().persist();
  },

  setControlsHelpOpen: (open) => {
    set({ controlsHelpOpen: open });
  },

  closeControlsHelp: (dontShowAgain = true) => {
    set((s) => ({
      controlsHelpOpen: false,
      controlsHelpAutoDone: true,
      controlsHelpSeen: dontShowAgain ? true : s.controlsHelpSeen,
    }));
    if (dontShowAgain) get().persist();
  },

  toggleFavoriteAsset: (placeableId) => {
    set((s) => {
      const cur = s.favoriteAssets ?? [];
      const next = cur.includes(placeableId)
        ? cur.filter((id) => id !== placeableId)
        : [...cur, placeableId];
      return { favoriteAssets: next };
    });
    get().persist();
  },

  setMapId: (mapId) => {
    set((s) => {
      const next = { ...s, mapId };
      return { mapId, ...applyMapSlice(next, true) };
    });
    get().persist();
  },

  applyMapAndAgents: () => {
    set((s) => ({ ...applyMapSlice(s, true) }));
  },

  upsertModel: (model) => {
    set((s) => {
      const idx = s.models.findIndex((m) => m.id === model.id);
      const models =
        idx >= 0
          ? s.models.map((m, i) => (i === idx ? model : m))
          : [...s.models, model];
      return { models };
    });
    return get().persist();
  },

  importModels: (items) => {
    if (items.length === 0) return { models: [], result: { ok: true } };

    const state = get();
    const { models: unique } = dedupeImportedModels(items, state.models);
    if (unique.length === 0) return { models: [], result: { ok: true } };

    const created = toAiModelConfigs(unique);

    const snapshot = {
      models: state.models,
      agents: state.agents,
      onboardingSeen: state.onboardingSeen,
    };

    set((s) => {
      const models = [...s.models, ...created];
      return {
        models,
        onboardingSeen:
          s.onboardingSeen || isSetupComplete(models, s.agents),
      };
    });

    // User-initiated import must always surface persist failures (#40 throttle).
    const result = get().persist({ toast: "explicit" });
    if (!result.ok) {
      set(snapshot);
      return { models: [], result };
    }
    return { models: created, result };
  },

  deleteModel: (id) => {
    set((s) => ({
      models: s.models.filter((m) => m.id !== id),
      agents: s.agents.map((a) =>
        a.modelConfigId === id ? { ...a, modelConfigId: "" } : a,
      ),
    }));
    get().persist();
    set((s) => ({
      runtimeAgents: syncRuntimeAgents(
        s.runtimeAgents,
        s.agents,
        resolveMapDefinition(s.mapId, s.customMaps),
      ),
    }));
  },

  upsertAgent: (agent) => {
    const normalized = {
      ...agent,
      enabled: agent.enabled !== false,
      chattiness: clampChattiness(agent.chattiness),
    };
    set((s) => {
      const idx = s.agents.findIndex((a) => a.id === normalized.id);
      const agents =
        idx >= 0
          ? s.agents.map((a, i) => (i === idx ? normalized : a))
          : [...s.agents, normalized];
      const def = resolveMapDefinition(s.mapId, s.customMaps);
      const deselected =
        !normalized.enabled && s.selectedAgentId === normalized.id;
      return {
        agents,
        runtimeAgents: syncRuntimeAgents(s.runtimeAgents, agents, def),
        selectedAgentId: deselected ? null : s.selectedAgentId,
        chatOpen: deselected ? false : s.chatOpen,
        onboardingSeen:
          s.onboardingSeen || isSetupComplete(s.models, agents),
      };
    });
    return get().persist();
  },

  duplicateAgent: (id, copyLabel) => {
    const source = get().agents.find((a) => a.id === id);
    if (!source) return null;
    const copy = createAgentCopy(source, get().agents, copyLabel);
    const result = get().upsertAgent(copy);
    // Null on persist failure so callers skip the success toast (failure toast
    // already shown). The in-memory copy remains for the next successful write.
    if (!result.ok) return null;
    return copy;
  },

  importAgents: (items, modelIds, copyLabel) => {
    if (items.length === 0) return { agents: [], result: { ok: true } };
    const state = get();
    const availableIds = state.models.map((m) => m.id);
    if (availableIds.length === 0) {
      return { agents: [], result: { ok: true } };
    }
    const resolvedModels = remapModelIds(modelIds, availableIds);
    const names = resolveImportNames(
      items.map((item) => item.displayName),
      state.agents.map((a) => a.displayName),
      copyLabel,
    );
    const createdAt = Date.now();
    const created: AgentConfig[] = items.map((item, i) => ({
      ...item,
      id: uid("agent"),
      displayName: names[i] ?? item.displayName,
      modelConfigId: resolvedModels[i] ?? availableIds[0] ?? "",
      enabled: item.enabled !== false,
      thinkingEnabled: item.thinkingEnabled === true,
      chattiness: clampChattiness(item.chattiness),
      skills: item.skills ?? [],
      characterId: item.characterId || DEFAULT_CHARACTER_ID,
      createdAt,
    }));

    set((s) => {
      const agents = [...s.agents, ...created];
      const def = resolveMapDefinition(s.mapId, s.customMaps);
      return {
        agents,
        runtimeAgents: syncRuntimeAgents(s.runtimeAgents, agents, def),
        onboardingSeen:
          s.onboardingSeen || isSetupComplete(s.models, agents),
      };
    });
    return { agents: created, result: get().persist() };
  },

  deleteAgent: (id) => {
    set((s) => {
      const agents = s.agents.filter((a) => a.id !== id);
      const { [id]: _removed, ...chats } = s.chats;
      return {
        agents,
        chats,
        selectedAgentId: s.selectedAgentId === id ? null : s.selectedAgentId,
        chatOpen: s.selectedAgentId === id ? false : s.chatOpen,
        runtimeAgents: s.runtimeAgents.filter((a) => a.id !== id),
      };
    });
    get().persist();
  },

  upsertCustomMap: (def) => {
    const prev = snapshotMapPersistState(get());
    set((s) => {
      const cleaned = { ...def, builtin: false, version: 1 as const };
      const idx = s.customMaps.findIndex((m) => m.id === cleaned.id);
      const customMaps =
        idx >= 0
          ? s.customMaps.map((m, i) => (i === idx ? cleaned : m))
          : [...s.customMaps, cleaned];
      const patch =
        s.mapId === cleaned.id
          ? applyMapSlice({ ...s, customMaps }, true)
          : {};
      return { customMaps, ...patch };
    });
    const result = get().persist({ toast: "map" });
    if (!result.ok) set(prev);
    return result;
  },

  deleteCustomMap: (id) => {
    set((s) => {
      const customMaps = s.customMaps.filter((m) => m.id !== id);
      const mapId = s.mapId === id ? "office" : s.mapId;
      const next = { ...s, customMaps, mapId };
      return {
        customMaps,
        mapId,
        ...applyMapSlice(next, true),
      };
    });
    get().persist();
  },

  parseMapImport: (raw) => {
    const parsed = parseMapJson(raw);
    return prepareMapImport(parsed, get().customMaps);
  },

  commitMapImport: (prepared, mode, copyLabel) => {
    const def = prepared.def;
    const toSave: ArenaMapDefinition =
      mode === "copy"
        ? buildMapImportCopy(
            def,
            get().customMaps,
            copyLabel,
            listBuiltinMaps().map((m) => m.name),
          )
        : { ...def, builtin: false, version: 1 as const };

    const prev = snapshotMapImportPersistState(get());

    set((s) => {
      const idx = s.customMaps.findIndex((m) => m.id === toSave.id);
      const customMaps =
        idx >= 0
          ? s.customMaps.map((m, i) => (i === idx ? toSave : m))
          : [...s.customMaps, toSave];
      const mapId = toSave.id;
      return {
        customMaps,
        mapId,
        mapEditorSourceId: s.mapEditorOpen ? toSave.id : s.mapEditorSourceId,
        ...applyMapSlice({ ...s, customMaps, mapId }, true),
      };
    });

    const result = get().persist({ toast: "map" });
    if (!result.ok) {
      set(prev);
      throw new PersistFailedError();
    }
    return toSave.id;
  },

  openMapEditor: (mapId) => {
    set({
      mapEditorOpen: true,
      mapEditorSourceId: mapId ?? get().mapId,
      settingsOpen: false,
    });
  },

  closeMapEditor: () => {
    set({ mapEditorOpen: false, mapEditorSourceId: null });
  },

  saveMapFromEditor: (def, activate = true) => {
    const name = def.name.trim() || "Untitled map";
    const prev = snapshotMapPersistState(get());

    // Keep the editor open until persist succeeds so a quota failure cannot
    // wipe the draft (closing first used to look like a successful save).
    let saved: ArenaMapDefinition;
    if (def.builtin) {
      const copy = createCustomMapFromBuiltin(def.id, get().customMaps);
      saved = {
        ...def,
        id: copy.id,
        name,
        builtin: false,
        version: 1 as const,
      };
    } else {
      saved = { ...def, name, builtin: false, version: 1 as const };
    }

    set((s) => {
      const idx = s.customMaps.findIndex((m) => m.id === saved.id);
      const customMaps =
        idx >= 0
          ? s.customMaps.map((m, i) => (i === idx ? saved : m))
          : [...s.customMaps, saved];
      const mapId = activate ? saved.id : s.mapId;
      const shouldApply = activate || s.mapId === saved.id;
      return {
        customMaps,
        mapId,
        ...(shouldApply
          ? applyMapSlice({ ...s, customMaps, mapId }, true)
          : {}),
      };
    });

    // Silent toast here — the editor shows a sticky inline saveError banner.
    const result = get().persist({ toast: false });
    if (!result.ok) {
      set(prev);
      return result;
    }

    set({ mapEditorOpen: false, mapEditorSourceId: null });
    return result;
  },

  createNewMap: () => {
    const blank = createBlankCustomMap();
    const result = get().upsertCustomMap(blank);
    if (!result.ok) return;
    set({
      mapEditorOpen: true,
      mapEditorSourceId: blank.id,
      settingsOpen: false,
    });
  },

  duplicateActiveMap: () => {
    const s = get();
    const copy = createCustomMapFromBuiltin(s.mapId, s.customMaps);
    const result = get().upsertCustomMap(copy);
    if (!result.ok) return;
    set({
      mapEditorOpen: true,
      mapEditorSourceId: copy.id,
      settingsOpen: false,
    });
  },

  selectAgent: (id) => {
    set({
      selectedAgentId: id,
      chatOpen: id != null,
    });
  },

  commandAgentTo: (agentId, pos) => {
    set((s) => {
      if (s.chatBusyById[agentId]) return s;
      const half = s.floorSize / 2 - 1.2;
      const x = Math.max(-half, Math.min(half, pos[0]));
      const z = Math.max(-half, Math.min(half, pos[2]));
      const target: [number, number, number] = [x, 0, z];
      return {
        runtimeAgents: s.runtimeAgents.map((a) =>
          a.id === agentId
            ? {
                ...a,
                target,
                commandTarget: target,
                state: "walk" as const,
              }
            : a,
        ),
      };
    });
  },

  setChatOpen: (open) => set({ chatOpen: open }),

  appendChat: (agentId, message) => {
    set((s) => ({
      chats: {
        ...s.chats,
        [agentId]: [...(s.chats[agentId] ?? []), message],
      },
    }));
  },

  replaceLastAssistant: (agentId, content) => {
    set((s) => {
      const list = [...(s.chats[agentId] ?? [])];
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].role === "assistant") {
          list[i] = { role: "assistant", content };
          break;
        }
      }
      return { chats: { ...s.chats, [agentId]: list } };
    });
  },

  setChatBusy: (agentId, busy) => {
    set((s) => ({
      chatBusyById: { ...s.chatBusyById, [agentId]: busy },
    }));
    // Persist once when the model turn finishes (not on each streamed token).
    if (!busy) get().persist();
  },

  clearChats: () => {
    set({ chats: {}, arenaChatHistory: [], floatingChatLog: [] });
    return get().persist();
  },

  clearArenaChatHistory: () => {
    set({ arenaChatHistory: [], floatingChatLog: [] });
    return get().persist();
  },

  pushFloatingChatLog: ({ agentId, agentName, color, text, kind }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const line: FloatingChatLine = {
      id: uid("flog"),
      agentId,
      agentName,
      color: color || "#7a9e7e",
      text: trimmed.length > 220 ? `${trimmed.slice(0, 217)}…` : trimmed,
      createdAt: Date.now(),
      kind: kind ?? (agentId ? "agent" : "user"),
    };
    set((s) => ({
      floatingChatLog: [...s.floatingChatLog, line].slice(-14),
      arenaChatHistory: [...s.arenaChatHistory, line].slice(-MAX_ARENA_CHAT_HISTORY),
    }));
    scheduleArenaChatPersist(() => get().persist());
  },

  removeFloatingChatLog: (id) => {
    set((s) => ({
      floatingChatLog: s.floatingChatLog.filter((l) => l.id !== id),
    }));
  },

  clearFloatingChatLog: () => {
    set({ floatingChatLog: [] });
  },

  setAgentSpeech: (agentId, text, ms = 4000) => {
    const until = text ? Date.now() + ms : 0;
    const speechBubble = text ? formatSpeechBubble(text) : undefined;
    set((s) => ({
      runtimeAgents: s.runtimeAgents.map((a) =>
        a.id === agentId
          ? {
              ...a,
              speechBubble,
              speechBubbleUntil: until,
              state: text ? "talking" : a.state === "talking" ? "idle" : a.state,
            }
          : a,
      ),
    }));
  },

  setAgentState: (agentId, patch) => {
    set((s) => ({
      runtimeAgents: s.runtimeAgents.map((a) =>
        a.id === agentId ? { ...a, ...patch } : a,
      ),
    }));
  },

  tick: (dt, now) => {
    set((s) => {
      const targetBlend = s.dayNight === "night" ? 1 : 0;
      const blendSpeed = 0.55; // ~1.8s full transition
      let dayNightBlend = s.dayNightBlend;
      if (Math.abs(dayNightBlend - targetBlend) > 0.001) {
        const dir = targetBlend > dayNightBlend ? 1 : -1;
        dayNightBlend = Math.min(
          1,
          Math.max(0, dayNightBlend + dir * blendSpeed * dt),
        );
        if (Math.abs(dayNightBlend - targetBlend) < 0.01) dayNightBlend = targetBlend;
      }

      const half = s.floorSize / 2 - 1.2;
      const agents = s.runtimeAgents.map((agent) => {
        let next = { ...agent };
        const radius = getCharacter(agent.characterId).radius;
        const pad = Math.max(0.8, radius + 0.55);
        const inner = s.floorSize / 2 - pad;

        if (next.speechBubbleUntil && now > next.speechBubbleUntil) {
          next.speechBubble = undefined;
          next.speechBubbleUntil = undefined;
          if (next.state === "talking" && !s.chatBusyById[next.id]) {
            next.state = "idle";
          }
        }

        if (s.chatBusyById[next.id]) {
          next.state = "thinking";
          next.thinkingIntensity = 1;
          return next;
        }

        if (!next.target && next.state !== "talking") {
          if (Math.random() < dt * 0.15) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 1.5 + Math.random() * 2.5;
            const hx = next.homePosition[0];
            const hz = next.homePosition[2];
            const tx = Math.max(-inner, Math.min(inner, hx + Math.cos(angle) * dist));
            const tz = Math.max(-inner, Math.min(inner, hz + Math.sin(angle) * dist));
            next.target = [tx, 0, tz];
            next.state = "wander";
          } else if (next.state === "wander") {
            next.state = "idle";
          }
        }

        if (next.target) {
          const [tx, , tz] = next.target;
          const dx = tx - next.position[0];
          const dz = tz - next.position[2];
          const dist = Math.hypot(dx, dz);
          if (dist < 0.08) {
            next.position = [tx, 0, tz];
            next.target = undefined;
            next.commandTarget = undefined;
            next.state = "idle";
          } else {
            const speed =
              next.moveSpeed * (next.commandTarget ? 2 : 1);
            const step = Math.min(dist, speed * dt);
            const nx = Math.max(
              -inner,
              Math.min(inner, next.position[0] + (dx / dist) * step),
            );
            const nz = Math.max(
              -inner,
              Math.min(inner, next.position[2] + (dz / dist) * step),
            );
            next.position = [nx, 0, nz];
            next.rotationY = Math.atan2(dx, dz);
            next.state = next.commandTarget ? "walk" : "wander";
          }
        }

        next.thinkingIntensity = Math.max(0, next.thinkingIntensity - dt * 0.8);
        return next;
      });

      const placeables = s.placeables.map((item) => {
        if (item.behavior !== "wander" || !placeableCanWander(item.placeableId)) {
          if (item.locomotion || item.target) {
            return {
              ...item,
              target: undefined,
              locomotion: undefined,
            };
          }
          return item;
        }

        let next = { ...item };
        const home = next.homePosition ?? next.position;
        if (!next.homePosition) {
          next.homePosition = [home[0], home[1], home[2]];
        }
        const speed = next.moveSpeed ?? 1.1;
        const wanderR = next.wanderRadius ?? 3.4;

        if (!next.target) {
          if (Math.random() < dt * 0.12) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.min(wanderR, 0.8 + Math.random() * wanderR);
            const tx = Math.max(
              -half,
              Math.min(half, home[0] + Math.cos(angle) * dist),
            );
            const tz = Math.max(
              -half,
              Math.min(half, home[2] + Math.sin(angle) * dist),
            );
            next.target = [tx, home[1], tz];
            next.locomotion = "walk";
          } else {
            next.locomotion = "idle";
          }
        }

        if (next.target) {
          const [tx, ty, tz] = next.target;
          const dx = tx - next.position[0];
          const dz = tz - next.position[2];
          const dist = Math.hypot(dx, dz);
          if (dist < 0.08) {
            next.position = [tx, ty, tz];
            next.target = undefined;
            next.locomotion = "idle";
          } else {
            const step = Math.min(dist, speed * dt);
            next.position = [
              next.position[0] + (dx / dist) * step,
              next.position[1],
              next.position[2] + (dz / dist) * step,
            ];
            next.rotationY = Math.atan2(dx, dz);
            next.locomotion = "walk";
          }
        }

        return next;
      });

      return { runtimeAgents: agents, placeables, dayNightBlend };
    });
  },

  showToast: (msg, ms = appConfig.chat.toastMs) => {
    set({ toast: msg });
    window.setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, ms);
  },
  };
});

export function createModelDraft(
  partial?: Partial<AiModelConfig>,
): AiModelConfig {
  const provider = partial?.provider ?? appConfig.defaults.modelProvider;
  const defaults = appConfig.providers[provider];
  return {
    id: uid("model"),
    name: appConfig.defaults.modelName,
    provider,
    baseUrl: defaults.baseUrl,
    apiKey: "",
    modelId: defaults.modelId,
    extraHeaders: [],
    createdAt: Date.now(),
    ...partial,
  };
}

export function createAgentDraft(
  partial?: Partial<AgentConfig>,
): AgentConfig {
  return {
    id: uid("agent"),
    displayName: appConfig.defaults.agentName,
    modelConfigId: "",
    polyPresetId: appConfig.defaults.roleId,
    characterId: DEFAULT_CHARACTER_ID,
    systemPrompt: "",
    enabled: appConfig.defaults.agentEnabled,
    thinkingEnabled: appConfig.defaults.agentThinking,
    chattiness: appConfig.defaults.agentChattiness,
    skills: [],
    color: appConfig.defaults.agentColor,
    bio: "",
    createdAt: Date.now(),
    ...partial,
  };
}

export { DEFAULT_GRAPHICS };
