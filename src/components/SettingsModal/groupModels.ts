import type { AiModelConfig, AiProviderKind } from "@/lib/types";

export type ProviderGroup = {
  key: string;
  provider: AiProviderKind;
  baseUrl: string;
  models: AiModelConfig[];
};

function groupKey(m: AiModelConfig): string {
  return `${m.provider}\0${m.baseUrl}\0${m.apiKey ?? ""}`;
}

export function groupModels(models: AiModelConfig[]): ProviderGroup[] {
  const map = new Map<string, AiModelConfig[]>();
  for (const m of models) {
    const k = groupKey(m);
    const list = map.get(k);
    if (list) list.push(m);
    else map.set(k, [m]);
  }
  return [...map.entries()].map(([key, items]) => ({
    key,
    provider: items[0].provider,
    baseUrl: items[0].baseUrl,
    models: items,
  }));
}
