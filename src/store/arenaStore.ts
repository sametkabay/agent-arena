import { create } from "zustand";
import type {
  AgentConfig,
  AiModelConfig,
  AppPersisted,
  ArenaAgent,
  ChatMessage,
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
  createBlankCustomMap,
  createCustomMapFromBuiltin,
  parseMapJson,
  resolveMapDefinition,
  syncRuntimeAgents,
  placeAgentsOnMap,
} from "@/lib/maps";
import { loadPersisted, sanitizeChats, savePersisted, uid, clampChattiness, MAX_ARENA_CHAT_HISTORY } from "@/lib/storage";
import { DEFAULT_CHARACTER_ID, getCharacter } from "@/lib/assets/characters";
import { appConfig, DEFAULT_GRAPHICS } from "@/lib/config";
import { placeableCanWander } from "@/lib/assets/catalog";
import {
  hydrateUserAssets,
  importUserAsset as importUserAssetFile,
  removeUserAsset as removeUserAssetFile,
  type ImportAssetForm,
} from "@/lib/assets/userAssets";
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

  hydrate: () => void;
  persist: () => void;
  setUserName: (name: string) => void;
  setLanguage: (language: LanguageCode) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsTab: (tab: ArenaState["settingsTab"]) => void;
  openAgentSettings: (agentId: string) => void;
  clearSettingsFocusAgent: () => void;
  setGraphics: (partial: Partial<GraphicsSettings>) => void;
  setDayNight: (mode: DayNightMode) => void;
  toggleDayNight: () => void;
  toggleFavoriteAsset: (placeableId: string) => void;
  /** True once IndexedDB-backed GLBs have been loaded and registered. */
  userAssetsHydrated: boolean;
  hydrateUserAssetsFromDb: () => Promise<void>;
  importUserAsset: (
    file: File,
    form: ImportAssetForm,
  ) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  removeUserAsset: (id: string) => Promise<void>;
  setMapId: (mapId: MapId) => void;
  applyMapAndAgents: () => void;

  upsertModel: (model: AiModelConfig) => void;
  deleteModel: (id: string) => void;
  upsertAgent: (agent: AgentConfig) => void;
  deleteAgent: (id: string) => void;

  upsertCustomMap: (def: ArenaMapDefinition) => void;
  deleteCustomMap: (id: string) => void;
  importMapJson: (raw: string) => string;
  openMapEditor: (mapId?: string) => void;
  closeMapEditor: () => void;
  saveMapFromEditor: (def: ArenaMapDefinition, activate?: boolean) => void;
  createNewMap: () => void;
  duplicateActiveMap: () => void;

  selectAgent: (id: string | null) => void;
  commandAgentTo: (agentId: string, pos: [number, number, number]) => void;
  setChatOpen: (open: boolean) => void;
  appendChat: (agentId: string, message: ChatMessage) => void;
  replaceLastAssistant: (agentId: string, content: string) => void;
  setChatBusy: (agentId: string, busy: boolean) => void;
  clearChats: () => void;
  clearArenaChatHistory: () => void;
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
  showToast: (msg: string) => void;
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
    favoriteAssets: s.favoriteAssets ?? [],
    userAssets: s.userAssets ?? [],
    chats: sanitizeChats(s.chats),
    arenaChatHistory: s.arenaChatHistory.slice(-MAX_ARENA_CHAT_HISTORY),
  };
}

let arenaChatPersistTimer = 0;

function scheduleArenaChatPersist(persist: () => void): void {
  window.clearTimeout(arenaChatPersistTimer);
  arenaChatPersistTimer = window.setTimeout(() => persist(), 800);
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
  userAssets: initial.userAssets ?? [],
  userAssetsHydrated: false,

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
      userAssets: data.userAssets ?? [],
      dayNightBlend: data.dayNight === "night" ? 1 : 0,
    });
    void i18n.changeLanguage(data.language);
    applyDocumentLang(data.language);
  },

  persist: () => {
    savePersisted(persistSlice(get()));
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

  hydrateUserAssetsFromDb: async () => {
    const metas = await hydrateUserAssets();
    // IndexedDB is the source of truth: a record whose blob couldn't be read
    // (evicted storage, corrupt entry) is dropped here too, so a stale entry
    // doesn't linger in the library forever.
    set({ userAssets: metas, userAssetsHydrated: true });
    get().persist();
  },

  importUserAsset: async (file, form) => {
    const result = await importUserAssetFile(file, form, (get().userAssets ?? []).length);
    if ("error" in result) return { ok: false, error: result.error };
    set((s) => ({ userAssets: [...(s.userAssets ?? []), result.meta] }));
    get().persist();
    return { ok: true, id: result.meta.id };
  },

  removeUserAsset: async (id) => {
    await removeUserAssetFile(id);
    set((s) => ({
      userAssets: (s.userAssets ?? []).filter((a) => a.id !== id),
      favoriteAssets: (s.favoriteAssets ?? []).filter((a) => a !== id),
    }));
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
    get().persist();
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
      };
    });
    get().persist();
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
    get().persist();
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

  importMapJson: (raw) => {
    const parsed = parseMapJson(raw);
    const id = parsed.id.startsWith("custom_")
      ? parsed.id
      : `custom_${Math.random().toString(36).slice(2, 10)}`;
    const def: ArenaMapDefinition = {
      ...parsed,
      id,
      builtin: false,
      name: parsed.name || "Imported map",
    };
    get().upsertCustomMap(def);
    get().setMapId(def.id);
    if (get().mapEditorOpen) {
      set({ mapEditorSourceId: def.id });
    }
    return def.id;
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
    // Close first so the editor's load effect cannot reset the draft when
    // customMaps updates (that path used to fall back to the office builtin).
    set({ mapEditorOpen: false, mapEditorSourceId: null });
    if (def.builtin) {
      // Builtin edits must become a custom copy; keep the name the user set
      const copy = createCustomMapFromBuiltin(def.id, get().customMaps);
      const saved: ArenaMapDefinition = {
        ...def,
        id: copy.id,
        name,
        builtin: false,
      };
      get().upsertCustomMap(saved);
      if (activate) get().setMapId(saved.id);
    } else {
      get().upsertCustomMap({ ...def, name, builtin: false });
      if (activate) get().setMapId(def.id);
    }
  },

  createNewMap: () => {
    const blank = createBlankCustomMap();
    get().upsertCustomMap(blank);
    set({
      mapEditorOpen: true,
      mapEditorSourceId: blank.id,
      settingsOpen: false,
    });
  },

  duplicateActiveMap: () => {
    const s = get();
    const copy = createCustomMapFromBuiltin(s.mapId, s.customMaps);
    get().upsertCustomMap(copy);
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
    get().persist();
  },

  clearArenaChatHistory: () => {
    set({ arenaChatHistory: [], floatingChatLog: [] });
    get().persist();
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

  showToast: (msg) => {
    set({ toast: msg });
    window.setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, appConfig.chat.toastMs);
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
