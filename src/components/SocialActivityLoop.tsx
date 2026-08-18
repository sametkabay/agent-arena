import { useEffect, useRef } from "react";
import { resolveSocialParticipants, startAutomaticSocialSpotChat } from "@/lib/ai/socialChat";
import { useArenaStore } from "@/store/arenaStore";

type ArenaSnapshot = ReturnType<typeof useArenaStore.getState>;
type Formation = { key: string; signature: string; spotId: string };

function socialFormations(state: ArenaSnapshot): Formation[] {
  const spots = state.activeMap?.interactionSpots ?? [];
  return spots.flatMap((spot) => {
    const ids = resolveSocialParticipants(
      spot.id,
      state.runtimeAgents,
      state.agents,
      state.models,
    )
      .map(({ config }) => config.id)
      .sort();
    if (ids.length < 2) return [];
    return [
      {
        key: `${state.activeMap?.id ?? state.mapId}:${spot.id}`,
        signature: ids.join(","),
        spotId: spot.id,
      },
    ];
  });
}
function formationVersion(state: ArenaSnapshot): string {
  return socialFormations(state)
    .map((formation) => `${formation.key}=${formation.signature}`)
    .join("|");
}

/** Starts one group-chat round when a new two-plus-agent seating forms. */
export function SocialActivityLoop() {
  const version = useArenaStore(formationVersion);
  const scheduled = useRef(new Map<string, { signature: string; timer: number }>());

  useEffect(() => {
    const current = socialFormations(useArenaStore.getState());
    const liveKeys = new Set(current.map((formation) => formation.key));

    for (const [key, pending] of scheduled.current) {
      if (liveKeys.has(key)) continue;
      window.clearTimeout(pending.timer);
      scheduled.current.delete(key);
    }

    for (const formation of current) {
      const prior = scheduled.current.get(formation.key);
      if (prior?.signature === formation.signature) continue;
      if (prior) window.clearTimeout(prior.timer);

      const attempt = () => {
        const state = useArenaStore.getState();
        const live = socialFormations(state).find(
          (item) => item.key === formation.key,
        );
        if (!live || live.signature !== formation.signature) {
          scheduled.current.delete(formation.key);
          return;
        }
        const ids = live.signature.split(",");
        if (ids.some((id) => state.chatBusyById[id])) {
          const timer = window.setTimeout(attempt, 1000);
          scheduled.current.set(formation.key, {
            signature: formation.signature,
            timer,
          });
          return;
        }
        // Keep the completed signature recorded so a stable group fires once.
        scheduled.current.set(formation.key, {
          signature: formation.signature,
          timer: 0,
        });
        void startAutomaticSocialSpotChat(formation.spotId);
      };

      const timer = window.setTimeout(attempt, 1400);
      scheduled.current.set(formation.key, {
        signature: formation.signature,
        timer,
      });
    }
  }, [version]);

  useEffect(
    () => () => {
      for (const { timer } of scheduled.current.values()) {
        window.clearTimeout(timer);
      }
      scheduled.current.clear();
    },
    [],
  );

  return null;
}
