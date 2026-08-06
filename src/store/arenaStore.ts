import { create } from "zustand";
import type {
  AgentConfig,
  AiModelConfig,
  AppPersisted,
  ArenaAgent,
  ChatMessage,
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
import { DEFAULT_GRAPHICS, loadPersisted, savePersisted, uid } from "@/lib/storage";
import i18n from "@/i18n";

export const THINKING_BUBBLE = "🤔";

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
  mapEditorOpen: boolean;
  mapEditorSourceId: string | null;
  chats: Record<string, ChatMessage[]>;
  chatBusyById: Record<string, boolean>;
  toast: string | null;

  hydrate: () => void;
  persist: () => void;
  setUserName: (name: string) => void;
  setLanguage: (language: LanguageCode) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsTab: (tab: ArenaState["settingsTab"]) => void;
  setGraphics: (partial: Partial<GraphicsSettings>) => void;
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
  setChatOpen: (open: boolean) => void;
  appendChat: (agentId: string, message: ChatMessage) => void;
  replaceLastAssistant: (agentId: string, content: string) => void;
  setChatBusy: (agentId: string, busy: boolean) => void;
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

export const useArenaStore = create<ArenaState>((set, get) => ({
  ...loadPersisted(),
  floorSize: 18,
  placeables: [],
  activeMap: null,
  runtimeAgents: [],
  selectedAgentId: null,
  chatOpen: false,
  settingsOpen: false,
  settingsTab: "general",
  mapEditorOpen: false,
  mapEditorSourceId: null,
  chats: {},
  chatBusyById: {},
  toast: null,

  hydrate: () => {
    const data = loadPersisted();
    const layout = applyMapSlice(
      { ...data, runtimeAgents: [] },
      true,
    );
    set({ ...data, ...layout });
    void i18n.changeLanguage(data.language);
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
    get().persist();
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setSettingsTab: (tab) => set({ settingsTab: tab, settingsOpen: true }),

  setGraphics: (partial) => {
    set((s) => ({ graphics: { ...s.graphics, ...partial } }));
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
    set((s) => {
      const idx = s.agents.findIndex((a) => a.id === agent.id);
      const agents =
        idx >= 0
          ? s.agents.map((a, i) => (i === idx ? agent : a))
          : [...s.agents, agent];
      const def = resolveMapDefinition(s.mapId, s.customMaps);
      return {
        agents,
        runtimeAgents: syncRuntimeAgents(s.runtimeAgents, agents, def),
      };
    });
    get().persist();
  },

  deleteAgent: (id) => {
    set((s) => {
      const agents = s.agents.filter((a) => a.id !== id);
      return {
        agents,
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
    if (def.builtin) {
      // Builtin edits must become a custom copy
      const copy = createCustomMapFromBuiltin(def.id, get().customMaps);
      const saved: ArenaMapDefinition = {
        ...def,
        id: copy.id,
        name: def.name.endsWith("(copy)") ? def.name : `${def.name} (edited)`,
        builtin: false,
      };
      get().upsertCustomMap(saved);
      if (activate) get().setMapId(saved.id);
    } else {
      get().upsertCustomMap({ ...def, builtin: false });
      if (activate) get().setMapId(def.id);
    }
    set({ mapEditorOpen: false, mapEditorSourceId: null });
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
  },

  setAgentSpeech: (agentId, text, ms = 4000) => {
    const until = text ? Date.now() + ms : 0;
    set((s) => ({
      runtimeAgents: s.runtimeAgents.map((a) =>
        a.id === agentId
          ? {
              ...a,
              speechBubble: text,
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
      const half = s.floorSize / 2 - 1.2;
      const agents = s.runtimeAgents.map((agent) => {
        let next = { ...agent };

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
            const tx = Math.max(-half, Math.min(half, hx + Math.cos(angle) * dist));
            const tz = Math.max(-half, Math.min(half, hz + Math.sin(angle) * dist));
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
            next.state = "idle";
          } else {
            const step = Math.min(dist, next.moveSpeed * dt);
            const nx = next.position[0] + (dx / dist) * step;
            const nz = next.position[2] + (dz / dist) * step;
            next.position = [nx, 0, nz];
            next.rotationY = Math.atan2(dx, dz);
            next.state = "wander";
          }
        }

        next.thinkingIntensity = Math.max(0, next.thinkingIntensity - dt * 0.8);
        return next;
      });
      return { runtimeAgents: agents };
    });
  },

  showToast: (msg) => {
    set({ toast: msg });
    window.setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 2200);
  },
}));

export function createModelDraft(
  partial?: Partial<AiModelConfig>,
): AiModelConfig {
  return {
    id: uid("model"),
    name: "New model",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    modelId: "gpt-4o-mini",
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
    displayName: "New agent",
    modelConfigId: "",
    polyPresetId: "explorer",
    systemPrompt: "",
    color: "#4A90A4",
    bio: "",
    createdAt: Date.now(),
    ...partial,
  };
}

export { DEFAULT_GRAPHICS };
