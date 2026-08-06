import type { AgentConfig, ArenaAgent, BuiltLayout, MapId, PlaceableInstance } from "@/lib/types";
import type { MapTheme } from "@/lib/maps/types";
import { PLACEABLE_SPECS, yawToward } from "@/lib/assets/catalog";

export const FLOOR_BASE = 18;
export const FLOOR_STEP = 4;

export function floorSizeForAgentCount(n: number): number {
  const count = Math.max(0, n);
  if (count <= 1) return FLOOR_BASE;
  return FLOOR_BASE + Math.floor((count - 1) / 2) * FLOOR_STEP;
}

export function agentSlotPositions(
  count: number,
  floorSize: number,
): [number, number, number][] {
  if (count <= 0) return [];

  const spacingX = 4.2;
  const spacingZ = 3.8;
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / cols);
  const half = floorSize / 2 - 2.8;

  const gridW = (cols - 1) * spacingX;
  const startX = -gridW / 2;
  const startZ = Math.max(-half, -3.2 - (rows - 1) * spacingZ * 0.12);

  const slots: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    let x = startX + col * spacingX;
    let z = startZ - row * spacingZ;
    x = Math.max(-half, Math.min(half, x));
    z = Math.max(-half, Math.min(half, z));
    slots.push([x, 0, z]);
  }
  return slots;
}

/** Indoor office décor only — furniture pack props that belong in an office. */
export function buildDecorationPlaceables(floorSize: number): PlaceableInstance[] {
  const half = floorSize / 2 - 1.8;
  const items: PlaceableInstance[] = [];
  let id = 0;

  const push = (
    placeableId: string,
    position: [number, number, number],
    rotationY = 0,
  ) => {
    items.push({
      id: `prop_${id++}`,
      placeableId,
      position,
      rotationY,
    });
  };

  // —— Lounge (south)
  const lounge: [number, number, number] = [0, 0, half * 0.55];
  const [lx, , lz] = lounge;
  push("rug", [lx, 0.01, lz], 0);
  push("coffee_table", lounge, 0);

  const sofaPos: [number, number, number] = [lx, 0, lz + 1.4];
  push("couch", sofaPos, yawToward(sofaPos, lounge));

  const leftChair: [number, number, number] = [lx - 1.5, 0, lz];
  const rightChair: [number, number, number] = [lx + 1.5, 0, lz];
  push("lounge_chair", leftChair, yawToward(leftChair, lounge));
  push("lounge_chair", rightChair, yawToward(rightChair, lounge));

  push("side_table", [lx - 2.35, 0, lz + 1.2], 0);
  push("floor_lamp", [lx + 2.2, 0, lz + 1.35], 0);
  push("plant_small", [lx - 2.35, 0, lz + 0.5]);

  // —— Plants in corners (potted only — no outdoor trees)
  const plantR = Math.min(half - 0.5, 7.0);
  push("plant", [plantR, 0, -plantR]);
  push("plant", [-plantR, 0, plantR]);
  push("plant_small", [-plantR, 0, -plantR]);
  push("plant_small", [plantR, 0, plantR]);

  // —— Storage walls
  push("bookshelf", [-half + 0.45, 0, -2.2], Math.PI / 2);
  push("bookshelf", [half - 0.45, 0, 0.8], -Math.PI / 2);
  push("cabinet", [-half + 0.55, 0, 2.2], Math.PI / 2);
  push("trash", [-half + 1.1, 0, 3.2], 0);
  push("floor_lamp", [half - 1.0, 0, -half + 1.2], 0);

  // —— Small meeting table (north-east), one chair facing table
  const meet: [number, number, number] = [half * 0.35, 0, -half + 1.6];
  push("table", meet, 0);
  const meetChair: [number, number, number] = [meet[0], 0, meet[2] + 1.05];
  push("chair", meetChair, yawToward(meetChair, meet));
  push("plant_small", [meet[0] + 1.2, 0, meet[2]]);

  return items;
}

export function buildOfficeLayout(agentConfigs: AgentConfig[]): BuiltLayout {
  const floorSize = floorSizeForAgentCount(agentConfigs.length);
  const slots = agentSlotPositions(agentConfigs.length, floorSize);
  const placeables = buildDecorationPlaceables(floorSize);
  const deskTop = PLACEABLE_SPECS.desk.topY ?? 0.74;
  /** Sit on the +Z side of the desk (orbit camera), looking −Z at the desk front. */
  const seatDist = 0.92;

  agentConfigs.forEach((cfg, i) => {
    const [ax, , az] = slots[i];
    const deskPos: [number, number, number] = [ax, 0, az];
    const chairPos: [number, number, number] = [ax, 0, az - .6];
    const monitorPos: [number, number, number] = [ax, deskTop, az];

    placeables.push({
      id: `desk_${cfg.id}`,
      placeableId: "desk",
      position: deskPos,
      rotationY: 0,
    });
    placeables.push({
      id: `chair_${cfg.id}`,
      placeableId: "chair",
      position: chairPos,
      // Seat toward desk (−Z)
      rotationY: yawToward(chairPos, deskPos, "negZ"),
    });
    placeables.push({
      id: `monitor_${cfg.id}`,
      placeableId: "monitor",
      position: monitorPos,
      rotationY: yawToward(monitorPos, chairPos, "negZ"),
    });
    placeables.push({
      id: `desk_lamp_${cfg.id}`,
      placeableId: "desk_lamp",
      position: [ax + 0.48, deskTop, az + 0.12],
      rotationY: 0,
    });
    placeables.push({
      id: `trash_${cfg.id}`,
      placeableId: "trash",
      position: [ax - 0.85, 0, az + seatDist - 1.5],
      rotationY: 0,
    });
  });

  const agents: ArenaAgent[] = agentConfigs.map((cfg, i) => {
    const [sx, , sz] = slots[i] ?? ([0, 0, 0] as [number, number, number]);
    const pos: [number, number, number] = [sx, 0, sz + seatDist];
    return {
      id: cfg.id,
      displayName: cfg.displayName,
      modelConfigId: cfg.modelConfigId,
      polyPresetId: cfg.polyPresetId,
      systemPrompt: cfg.systemPrompt,
      color: cfg.color,
      bio: cfg.bio,
      position: [...pos] as [number, number, number],
      homePosition: [...pos] as [number, number, number],
      // Procedural agent faces +Z locally → look at desk (−Z)
      rotationY: Math.PI,
      state: "idle",
      thinkingIntensity: 0,
      moveSpeed: 1.6,
    };
  });

  return { floorSize, placeables, agents };
}

export function buildLayout(mapId: MapId, agentConfigs: AgentConfig[]): BuiltLayout {
  void mapId;
  return buildOfficeLayout(agentConfigs);
}

export const OFFICE_THEME: MapTheme = {
  floor: "#D2C9BB",
  accent: "#4A7566",
  background: "#E4DDD2",
  fog: "#E4DDD2",
  ambient: "#ffffff",
  hemiSky: "#f5f0e6",
  hemiGround: "#c4b8a4",
  sun: "#fff5e6",
};
