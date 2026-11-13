import type { AppPersisted } from "@/lib/types";
import { defaultPersisted } from "@/lib/storage";

export type ResetOptions = { keepModels: boolean };

/**
 * Pure factory-reset of persisted playground state.
 * Keeps identity / prefs that avoid name-gate and onboarding surprise.
 */
export function resetPersisted(
  cur: AppPersisted,
  opts: ResetOptions,
): AppPersisted {
  const base = defaultPersisted();
  return {
    ...base,
    userName: cur.userName,
    language: cur.language,
    dayNight: cur.dayNight,
    chatterMode: cur.chatterMode,
    onboardingSeen: cur.onboardingSeen,
    controlsHelpSeen: cur.controlsHelpSeen,
    models: opts.keepModels ? cur.models : [],
  };
}
