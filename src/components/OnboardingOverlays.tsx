import { useArenaStore } from "@/store/arenaStore";
import { isSetupComplete, resolveOnboardingOverlay } from "@/lib/onboarding";
import { SetupGuide } from "@/components/SetupGuide";
import { ControlsHelp } from "@/components/ControlsHelp";

export function OnboardingOverlays() {
  const settingsOpen = useArenaStore((s) => s.settingsOpen);
  const controlsHelpOpen = useArenaStore((s) => s.controlsHelpOpen);
  const onboardingSeen = useArenaStore((s) => s.onboardingSeen);
  const controlsHelpSeen = useArenaStore((s) => s.controlsHelpSeen);
  const controlsHelpAutoDone = useArenaStore((s) => s.controlsHelpAutoDone);
  const models = useArenaStore((s) => s.models);
  const agents = useArenaStore((s) => s.agents);
  const closeControlsHelp = useArenaStore((s) => s.closeControlsHelp);

  const overlay = resolveOnboardingOverlay({
    settingsOpen,
    controlsHelpOpen,
    onboardingSeen,
    controlsHelpSeen,
    controlsHelpAutoDone,
    setupComplete: isSetupComplete(models, agents),
  });

  if (overlay === "setup") return <SetupGuide />;
  if (overlay === "controls") {
    // Manual "?" sets controlsHelpOpen; auto-open leaves it false.
    const auto = !controlsHelpOpen;
    return <ControlsHelp auto={auto} onClose={closeControlsHelp} />;
  }
  return null;
}
