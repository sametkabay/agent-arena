import { useMemo } from "react";
import { PLACEABLE_SPECS } from "@/lib/assets/catalog";
import { useArenaStore } from "@/store/arenaStore";

export type LampKind = "floor" | "desk" | "ceiling" | "wall" | "beacon";

type LampProfile = {
  /** Warm bulb color. */
  color: string;
  /** Soft fill spill. */
  fillColor: string;
  /** Local bulb position (meters, prop space). */
  position: [number, number, number];
  /** Secondary soft fill offset from bulb. */
  fillOffset: [number, number, number];
  intensity: number;
  fillIntensity: number;
  distance: number;
  fillDistance: number;
  /** Point-light falloff; lower = softer / wider. Default 1. */
  decay?: number;
  glowRadius: number;
  glowPosition: [number, number, number];
};

const PROFILES: Record<LampKind, LampProfile> = {
  floor: {
    color: "#ffe6c4",
    fillColor: "#ffd9a8",
    position: [0, 1.32, 0],
    fillOffset: [0, -0.55, 0],
    intensity: 0.62,
    fillIntensity: 0.48,
    distance: 17,
    fillDistance: 13,
    glowRadius: 0.12,
    glowPosition: [0, 1.32, 0],
  },
  desk: {
    color: "#ffe8c8",
    fillColor: "#ffdcb0",
    position: [0, 0.34, 0],
    fillOffset: [0, -0.18, 0.04],
    intensity: 0.5,
    fillIntensity: 0.34,
    distance: 8.5,
    fillDistance: 6.2,
    glowRadius: 0.06,
    glowPosition: [0, 0.34, 0],
  },
  ceiling: {
    color: "#fff4e0",
    fillColor: "#ffe9c8",
    position: [0, -0.12, 0],
    fillOffset: [0, -0.7, 0],
    intensity: 0.72,
    fillIntensity: 0.52,
    distance: 18,
    fillDistance: 13,
    glowRadius: 0.11,
    glowPosition: [0, -0.08, 0],
  },
  wall: {
    color: "#ffe0b8",
    fillColor: "#ffd29a",
    position: [0, 0.22, 0.12],
    fillOffset: [0, -0.12, 0.35],
    intensity: 0.55,
    fillIntensity: 0.38,
    distance: 11,
    fillDistance: 8,
    glowRadius: 0.07,
    glowPosition: [0, 0.22, 0.1],
  },
  beacon: {
    color: "#9ad4ff",
    fillColor: "#6eb0ff",
    position: [0, 1.92, 0],
    fillOffset: [0, -0.65, 0],
    intensity: 1.45,
    fillIntensity: 0.95,
    distance: 30,
    fillDistance: 24,
    decay: 0.65,
    glowRadius: 0.2,
    glowPosition: [0, 1.92, 0],
  },
};

/** Resolve lamp type from curated id or pack GLB name. */
export function getLampKind(placeableId: string): LampKind | null {
  if (placeableId === "floor_lamp" || placeableId === "lamp_square") return "floor";
  if (placeableId === "desk_lamp") return "desk";
  if (placeableId === "beacon") return "beacon";

  const glb = PLACEABLE_SPECS[placeableId]?.glb ?? "";
  const decoded = decodeURIComponent(glb).toLowerCase();
  const id = placeableId.toLowerCase();
  if (/beacon/.test(id)) return "beacon";
  if (!/lamp/.test(decoded) && !/lamp/.test(id)) return null;

  if (/ceiling/.test(decoded) || /ceiling/.test(id)) return "ceiling";
  if (/wall/.test(decoded) || /wall/.test(id)) return "wall";
  if (/floor/.test(decoded) || /floor/.test(id)) return "floor";
  if (/table|desk/.test(decoded) || /table|desk/.test(id)) return "desk";
  return "desk";
}

export function isLampPlaceable(placeableId: string): boolean {
  return getLampKind(placeableId) != null;
}

/** Warm point lights + soft shade glow for floor / desk / wall / ceiling lamps. */
export function LampFx({ kind }: { kind: LampKind }) {
  const lampLights = useArenaStore((s) => s.graphics.lampLights);
  const dayNightBlend = useArenaStore((s) => s.dayNightBlend);
  const profile = PROFILES[kind];

  const { nightBoost, strength, glowOpacity, distMul } = useMemo(() => {
    const night = dayNightBlend;
    return {
      // Day keeps a soft pool; night brings lamps up so they read as practicals.
      nightBoost: 0.55 + night * 0.73,
      // Setting off still keeps a dim practical glow (same idea as campfire).
      strength: lampLights ? 1 : 0.55,
      glowOpacity: (lampLights ? 0.22 : 0.16) + night * (lampLights ? 0.16 : 0.12),
      distMul: lampLights ? 1.12 : 0.85,
    };
  }, [dayNightBlend, lampLights]);

  const mainI = profile.intensity * strength * nightBoost;
  const fillI = profile.fillIntensity * strength * nightBoost;
  const decay = profile.decay ?? 1;

  return (
    <group>
      <pointLight
        color={profile.color}
        intensity={mainI}
        distance={profile.distance * distMul}
        decay={decay}
        position={profile.position}
      />
      <pointLight
        color={profile.fillColor}
        intensity={fillI}
        distance={profile.fillDistance * distMul}
        decay={decay}
        position={[
          profile.position[0] + profile.fillOffset[0],
          profile.position[1] + profile.fillOffset[1],
          profile.position[2] + profile.fillOffset[2],
        ]}
      />
      <mesh position={profile.glowPosition}>
        <sphereGeometry args={[profile.glowRadius, 12, 12]} />
        <meshBasicMaterial
          color={profile.color}
          transparent
          opacity={glowOpacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
