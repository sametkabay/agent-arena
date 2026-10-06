import type { AiModelConfig, AiProviderKind } from "@/lib/types";

function catalogRowId(modelId: string): string {
  return `zibby-${modelId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

/** Zibby catalog text models (CONTRACT.md — image models are omitted). */
export type ZibbyTextModel = {
  id: string;
  /** Wire `provider` for POST /api/ai. */
  zibbyProvider: "anthropic" | "openai";
  /** Local settings grouping. */
  kind: AiProviderKind;
  label: string;
};

export const ZIBBY_TEXT_MODELS: ZibbyTextModel[] = [
  {
    id: "claude-haiku-4-5-20251001",
    zibbyProvider: "anthropic",
    kind: "claude",
    label: "Claude Haiku",
  },
  {
    id: "claude-sonnet-5",
    zibbyProvider: "anthropic",
    kind: "claude",
    label: "Claude Sonnet",
  },
  {
    id: "claude-opus-5",
    zibbyProvider: "anthropic",
    kind: "claude",
    label: "Claude Opus",
  },
  { id: "gpt-5", zibbyProvider: "openai", kind: "openai", label: "GPT-5" },
  {
    id: "x-ai/grok-4",
    zibbyProvider: "openai",
    kind: "openai",
    label: "Grok 4",
  },
  {
    id: "z-ai/glm-4.6",
    zibbyProvider: "openai",
    kind: "openai",
    label: "GLM 4.6",
  },
  {
    id: "moonshotai/kimi-k2",
    zibbyProvider: "openai",
    kind: "openai",
    label: "Kimi K2",
  },
];

const BY_ID = new Map(ZIBBY_TEXT_MODELS.map((m) => [m.id, m]));

export function zibbyTextModel(id: string): ZibbyTextModel | undefined {
  return BY_ID.get(id);
}

/** Map a stored / legacy model id onto a catalog text model. */
export function resolveZibbyTextModel(modelId: string): ZibbyTextModel {
  const exact = BY_ID.get(modelId);
  if (exact) return exact;
  const id = modelId.toLowerCase();
  if (id.includes("opus")) return BY_ID.get("claude-opus-5")!;
  if (id.includes("haiku")) return BY_ID.get("claude-haiku-4-5-20251001")!;
  if (id.includes("sonnet") || id.includes("claude")) {
    return BY_ID.get("claude-sonnet-5")!;
  }
  if (id.includes("grok")) return BY_ID.get("x-ai/grok-4")!;
  if (id.includes("kimi") || id.includes("moonshot")) {
    return BY_ID.get("moonshotai/kimi-k2")!;
  }
  if (id.includes("glm") || id.includes("z-ai")) return BY_ID.get("z-ai/glm-4.6")!;
  return BY_ID.get("gpt-5")!;
}

export function defaultZibbyModels(): AiModelConfig[] {
  return ZIBBY_TEXT_MODELS.map((m, i) => ({
    id: catalogRowId(m.id),
    name: m.label,
    provider: m.kind,
    baseUrl: "",
    modelId: m.id,
    extraHeaders: [],
    createdAt: i,
  }));
}
