import { Html } from "@react-three/drei";
import { useTranslation } from "react-i18next";
import { agentsAssignedToSpot } from "@/lib/maps/interactions";
import type { MapInteractionSpot } from "@/lib/maps/schema";
import { useArenaStore } from "@/store/arenaStore";

export function InteractionSpotMarkers({
  spots,
}: {
  spots: MapInteractionSpot[];
}) {
  const { t } = useTranslation();
  const selectedAgentId = useArenaStore((s) => s.selectedAgentId);
  const runtimeAgents = useArenaStore((s) => s.runtimeAgents);
  const commandAgentToInteraction = useArenaStore(
    (s) => s.commandAgentToInteraction,
  );

  if (!selectedAgentId) return null;

  return (
    <>
      {spots.map((spot) => {
        const assigned = agentsAssignedToSpot(runtimeAgents, spot.id);
        const selected = assigned.find((agent) => agent.id === selectedAgentId);
        const full = assigned.length >= spot.seats.length && !selected;
        return (
          <group key={spot.id} position={spot.position}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
              <ringGeometry args={[0.46, 0.62, 28]} />
              <meshBasicMaterial
                color={full ? "#9b6a62" : selected ? "#d4a95f" : "#6fa384"}
                transparent
                opacity={0.72}
                depthWrite={false}
              />
            </mesh>
            <Html
              position={[0, 0.38, 0]}
              center
              distanceFactor={18}
              zIndexRange={[35, 5]}
              className="interaction-marker-overlay"
            >
              <button
                type="button"
                className={
                  "interaction-marker" +
                  (selected ? " is-selected" : "") +
                  (full ? " is-full" : "")
                }
                disabled={full || Boolean(selected)}
                title={
                  selected
                    ? t("social.alreadyHere")
                    : full
                      ? t("social.full")
                      : t("social.sendTo", {
                          name: t(`social.spots.${spot.id}`, {
                            defaultValue: spot.name,
                          }),
                        })
                }
                onClick={(event) => {
                  event.stopPropagation();
                  commandAgentToInteraction(selectedAgentId, spot.id);
                }}
              >
                <span>
                  {t(`social.spots.${spot.id}`, { defaultValue: spot.name })}
                </span>
                <strong>{assigned.length}/{spot.seats.length}</strong>
              </button>
            </Html>
          </group>
        );
      })}
    </>
  );
}
