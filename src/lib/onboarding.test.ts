import { describe, expect, it } from "vitest";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import {
  CONTROLS_HELP_ROWS,
  emptyAgentListAction,
  isSetupComplete,
  nextSetupTab,
  resolveOnboardingOverlay,
} from "@/lib/onboarding";

describe("isSetupComplete", () => {
  it("is false with no models", () => {
    expect(isSetupComplete([], [sampleAgent()])).toBe(false);
  });

  it("is false when the agent has no model id", () => {
    expect(
      isSetupComplete([sampleModel()], [sampleAgent({ modelConfigId: "" })]),
    ).toBe(false);
  });

  it("is false when the model id is missing", () => {
    expect(
      isSetupComplete(
        [sampleModel({ id: "other" })],
        [sampleAgent({ modelConfigId: "model-1" })],
      ),
    ).toBe(false);
  });

  it("is false when the agent is disabled", () => {
    expect(
      isSetupComplete(
        [sampleModel()],
        [sampleAgent({ enabled: false })],
      ),
    ).toBe(false);
  });

  it("is true for an enabled agent bound to an existing model", () => {
    expect(isSetupComplete([sampleModel()], [sampleAgent()])).toBe(true);
  });
});

describe("nextSetupTab / emptyAgentListAction", () => {
  it("routes to models when there are none", () => {
    expect(nextSetupTab(0)).toBe("models");
    expect(emptyAgentListAction(0)).toEqual({
      tab: "models",
      messageKey: "agentList.emptyNoModel",
    });
  });

  it("routes to agents when a model exists", () => {
    expect(nextSetupTab(1)).toBe("agents");
    expect(emptyAgentListAction(1)).toEqual({
      tab: "agents",
      messageKey: "agentList.empty",
    });
  });
});

describe("resolveOnboardingOverlay", () => {
  const base = {
    settingsOpen: false,
    controlsHelpOpen: false,
    onboardingSeen: false,
    controlsHelpSeen: false,
    controlsHelpAutoDone: false,
    setupComplete: false,
  };

  it("settings suppresses everything", () => {
    expect(
      resolveOnboardingOverlay({ ...base, settingsOpen: true }),
    ).toBeNull();
    expect(
      resolveOnboardingOverlay({
        ...base,
        settingsOpen: true,
        controlsHelpOpen: true,
        setupComplete: true,
      }),
    ).toBeNull();
  });

  it("manual controls help beats the setup guide", () => {
    expect(
      resolveOnboardingOverlay({ ...base, controlsHelpOpen: true }),
    ).toBe("controls");
  });

  it("setup beats auto controls help", () => {
    expect(
      resolveOnboardingOverlay({
        ...base,
        setupComplete: true,
        onboardingSeen: false,
      }),
    ).toBe("setup");
  });

  it("auto-opens controls after setup when not seen", () => {
    expect(
      resolveOnboardingOverlay({
        ...base,
        onboardingSeen: true,
        setupComplete: true,
      }),
    ).toBe("controls");
  });

  it("seen or autoDone cuts auto controls help", () => {
    expect(
      resolveOnboardingOverlay({
        ...base,
        onboardingSeen: true,
        setupComplete: true,
        controlsHelpSeen: true,
      }),
    ).toBeNull();
    expect(
      resolveOnboardingOverlay({
        ...base,
        onboardingSeen: true,
        setupComplete: true,
        controlsHelpAutoDone: true,
      }),
    ).toBeNull();
  });

  it("does not auto-open controls before setup is complete", () => {
    expect(
      resolveOnboardingOverlay({
        ...base,
        onboardingSeen: true,
        setupComplete: false,
      }),
    ).toBeNull();
  });
});

describe("CONTROLS_HELP_ROWS", () => {
  it("has unique ids covering every issue row", () => {
    const ids = CONTROLS_HELP_ROWS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "chat",
      "walk",
      "camera",
      "arena",
      "mention",
      "dayNight",
      "editMap",
      "idle",
    ]);
    expect(CONTROLS_HELP_ROWS.filter((r) => r.split).map((r) => r.id)).toEqual([
      "chat",
      "walk",
      "camera",
    ]);
  });
});
