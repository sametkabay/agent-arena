import { describe, expect, it } from "vitest";
import {
  agentsAssignedToSpot,
  findAvailableInteractionSeat,
  seatedAgentsAtSpot,
} from "@/lib/maps/interactions";
import type { ArenaAgent } from "@/lib/types";
import type { MapInteractionSpot } from "@/lib/maps/schema";

const spot: MapInteractionSpot = {
  id: "table",
  name: "Table",
  kind: "table_chat",
  position: [0, 0, 0],
  seats: [
    { id: "seat_a", position: [-1, 0, 0], rotationY: 1 },
    { id: "seat_b", position: [1, 0, 0], rotationY: -1 },
  ],
};

function agent(partial: Partial<ArenaAgent>): ArenaAgent {
  return {
    id: "agent",
    displayName: "Agent",
    modelConfigId: "model",
    polyPresetId: "default",
    characterId: "default",
    systemPrompt: "",
    color: "#fff",
    position: [0, 0, 0],
    rotationY: 0,
    homePosition: [0, 0, 0],
    state: "idle",
    thinkingIntensity: 0,
    moveSpeed: 1,
    ...partial,
  };
}

describe("map interactions", () => {
  it("reserves the first free seat and lets a moving agent change its own seat", () => {
    const agents = [
      agent({ id: "a", interactionSpotId: "table", interactionSeatId: "seat_a" }),
    ];
    expect(findAvailableInteractionSeat(spot, agents)?.id).toBe("seat_b");
    expect(findAvailableInteractionSeat(spot, agents, "a")?.id).toBe("seat_a");
  });

  it("separates reserved participants from agents who have arrived", () => {
    const agents = [
      agent({ id: "a", interactionSpotId: "table", interactionSeatId: "seat_a" }),
      agent({ id: "b", interactionSpotId: "table", interactionSeatId: "seat_b", seated: true }),
      agent({ id: "c", interactionSpotId: "other", seated: true }),
    ];
    expect(agentsAssignedToSpot(agents, "table").map((a) => a.id)).toEqual(["a", "b"]);
    expect(seatedAgentsAtSpot(agents, "table").map((a) => a.id)).toEqual(["b"]);
  });
});
