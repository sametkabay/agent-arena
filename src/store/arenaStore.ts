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
import { buildLayout } from "@/lib/maps";
import { DEFAULT_GRAPHICS, loadPersisted, savePersisted, uid } from "@/lib/storage";
import i18n from "@/i18n";

export const THINKING_BUBBLE = "🤔";

interface ArenaState extends AppPersisted {
  // runtime
  floorSize: number;
  placeables: PlaceableInstance[];
  runtimeAgents: ArenaAgent[];
  selectedAgentId: string | null;
  chatOpen: boolean;
  settingsOpen: boolean;
  settingsTab: "general" | "models" | "agents" | "map" | "graphics";
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
  rebuildLayout: () => void;

  upsertModel: (model: AiModelConfig) => void;
  deleteModel: (id: string) => void;
  upsertAgent: (agent: AgentConfig) => void;
  deleteAgent: (id: string) => void;

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
    graphics: s.graphics,
  };
}

function applyLayout(s: Pick<ArenaState, "agents" | "mapId">) {
  const built = buildLayout(s.mapId, s.agents);
  return {
    floorSize: built.floorSize,
    placeables: built.placeables,
    runtimeAgents: built.agents,
  };
}

export const useArenaStore = create<ArenaState>((set, get) => ({
  ...loadPersisted(),
  floorSize: 12,
  placeables: [],
  runtimeAgents: [],
  selectedAgentId: null,
  chatOpen: false,
  settingsOpen: false,
  settingsTab: "general",
  chats: {},
  chatBusyById: {},
  toast: null,

  hydrate: () => {
    const data = loadPersisted();
    const layout = applyLayout(data);
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
    const metaOk = mapId === "office";
    if (!metaOk) return;
    set((s) => {
      const next = { ...s, mapId };
      return { mapId, ...applyLayout(next) };
    });
    get().persist();
  },

  rebuildLayout: () => {
    set((s) => ({ ...applyLayout(s) }));
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
    get().rebuildLayout();
  },

  upsertAgent: (agent) => {
    set((s) => {
      const idx = s.agents.findIndex((a) => a.id === agent.id);
      const agents =
        idx >= 0
          ? s.agents.map((a, i) => (i === idx ? agent : a))
          : [...s.agents, agent];
      const next = { ...s, agents };
      return { agents, ...applyLayout(next) };
    });
    get().persist();
  },

  deleteAgent: (id) => {
    set((s) => {
      const agents = s.agents.filter((a) => a.id !== id);
      const next = { ...s, agents };
      return {
        agents,
        selectedAgentId: s.selectedAgentId === id ? null : s.selectedAgentId,
        chatOpen: s.selectedAgentId === id ? false : s.chatOpen,
        ...applyLayout(next),
      };
    });
    get().persist();
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

        // Wander AI
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
