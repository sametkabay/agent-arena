import { beforeEach, describe, expect, it } from "vitest";
import { useArenaStore } from "@/store/arenaStore";
import { placeAgentsOnMap } from "@/lib/maps/runtime";
import { sampleAgent, sampleMap } from "@/test/fixtures";

const spot = {
  id: "table",
  name: "Table",
  kind: "table_chat" as const,
  position: [1, 0, 0] as [number, number, number],
  seats: [
    { id: "seat_a", position: [1, 0, 0] as [number, number, number], rotationY: 1.5 },
    { id: "seat_b", position: [-1, 0, 0] as [number, number, number], rotationY: -1.5 },
  ],
};

describe("arena interaction commands", () => {
  beforeEach(() => {
    const configs = [sampleAgent({ id: "a" }), sampleAgent({ id: "b" })];
    const map = sampleMap({ interactionSpots: [spot] });
    useArenaStore.setState({
      activeMap: map,
      floorSize: 18,
      agents: configs,
      runtimeAgents: placeAgentsOnMap(configs, map).map((agent) => ({
        ...agent,
        position: [0, 0, 0],
        homePosition: [0, 0, 0],
        moveSpeed: 10,
      })),
      chatBusyById: {},
      dayNight: "day",
      dayNightBlend: 0,
      placeables: [],
    });
  });

  it("reserves different seats and settles agents into the authored rotation", () => {
    const store = useArenaStore.getState();
    store.commandAgentToInteraction("a", "table");
    store.commandAgentToInteraction("b", "table");
    expect(
      useArenaStore.getState().runtimeAgents.map((agent) => agent.interactionSeatId),
    ).toEqual(["seat_a", "seat_b"]);

    store.tick(1, 1);
    store.tick(1, 2);
    const [a, b] = useArenaStore.getState().runtimeAgents;
    expect(a).toMatchObject({ seated: true, state: "sitting", rotationY: 1.5 });
    expect(b).toMatchObject({ seated: true, state: "sitting", rotationY: -1.5 });
  });

  it("stands up and clears a social assignment on a normal move command", () => {
    const store = useArenaStore.getState();
    store.commandAgentToInteraction("a", "table");
    store.tick(1, 1);
    store.tick(1, 2);
    store.leaveInteraction("a");
    expect(useArenaStore.getState().runtimeAgents[0]).toMatchObject({
      seated: false,
      state: "idle",
    });

    store.commandAgentToInteraction("a", "table");
    store.commandAgentTo("a", [3, 0, 3]);
    expect(useArenaStore.getState().runtimeAgents[0]).toMatchObject({
      seated: false,
      interactionSpotId: undefined,
      interactionSeatId: undefined,
      state: "walk",
    });
  });
});
