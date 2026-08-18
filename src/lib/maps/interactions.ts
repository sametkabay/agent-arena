import type { ArenaAgent } from "@/lib/types";
import type {
  MapInteractionSeat,
  MapInteractionSpot,
} from "@/lib/maps/schema";

/** Agents reserve a seat as soon as they start walking toward it. */
export function agentsAssignedToSpot(
  agents: ArenaAgent[],
  spotId: string,
): ArenaAgent[] {
  return agents.filter((agent) => agent.interactionSpotId === spotId);
}
export function seatedAgentsAtSpot(
  agents: ArenaAgent[],
  spotId: string,
): ArenaAgent[] {
  return agentsAssignedToSpot(agents, spotId).filter((agent) => agent.seated);
}

export function findAvailableInteractionSeat(
  spot: MapInteractionSpot,
  agents: ArenaAgent[],
  movingAgentId?: string,
): MapInteractionSeat | null {
  const used = new Set(
    agents
      .filter((agent) => agent.id !== movingAgentId)
      .map((agent) => agent.interactionSeatId)
      .filter((id): id is string => Boolean(id)),
  );
  return spot.seats.find((seat) => !used.has(seat.id)) ?? null;
}
