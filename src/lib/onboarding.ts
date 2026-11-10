import type { AgentConfig, AiModelConfig } from "@/lib/types";

export type SetupTab = "models" | "agents";
export type OnboardingOverlay = "setup" | "controls" | null;

export type ControlsHelpRow = {
  id: string;
  /** When true, row uses .mouse / .touch keys; otherwise .how. */
  split: boolean;
};

/** Rows shown in the in-app controls help overlay (order matches the issue). */
export const CONTROLS_HELP_ROWS: readonly ControlsHelpRow[] = [
  { id: "chat", split: true },
  { id: "walk", split: true },
  { id: "camera", split: true },
  { id: "arena", split: false },
  { id: "mention", split: false },
  { id: "dayNight", split: false },
  { id: "editMap", split: false },
  { id: "idle", split: false },
];

/** At least one enabled agent bound to an existing model. */
export function isSetupComplete(
  models: AiModelConfig[],
  agents: AgentConfig[],
): boolean {
  const modelIds = new Set(models.map((m) => m.id));
  return agents.some(
    (a) =>
      a.enabled !== false &&
      typeof a.modelConfigId === "string" &&
      a.modelConfigId.length > 0 &&
      modelIds.has(a.modelConfigId),
  );
}

export function nextSetupTab(modelCount: number): SetupTab {
  return modelCount === 0 ? "models" : "agents";
}

export function emptyAgentListAction(modelCount: number): {
  tab: SetupTab;
  messageKey: "agentList.emptyNoModel" | "agentList.empty";
} {
  return modelCount === 0
    ? { tab: "models", messageKey: "agentList.emptyNoModel" }
    : { tab: "agents", messageKey: "agentList.empty" };
}

export type ResolveOnboardingOverlayInput = {
  settingsOpen: boolean;
  controlsHelpOpen: boolean;
  onboardingSeen: boolean;
  controlsHelpSeen: boolean;
  controlsHelpAutoDone: boolean;
  setupComplete: boolean;
};

/**
 * Single arbiter for setup guide vs controls help.
 * Only one overlay can show; no effects or races.
 */
export function resolveOnboardingOverlay(
  input: ResolveOnboardingOverlayInput,
): OnboardingOverlay {
  if (input.settingsOpen) return null;
  if (input.controlsHelpOpen) return "controls";
  if (!input.onboardingSeen) return "setup";
  if (
    input.setupComplete &&
    !input.controlsHelpSeen &&
    !input.controlsHelpAutoDone
  ) {
    return "controls";
  }
  return null;
}
