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
  glowRadius: number;
  glowPosition: [number, number, number];
};

const PROFILES: Record<LampKind, LampProfile> = {
  floor: {
    color: "#ffd8a8",
    fillColor: "#ffc98a",
    position: [0, 1.32, 0],
    fillOffset: [0, -0.35, 0],
    intensity: 1.05,
    fillIntensity: 0.34,
    distance: 10.5,
    fillDistance: 6.8,
    glowRadius: 0.14,
    glowPosition: [0, 1.32, 0],
  },
  desk: {
    color: "#ffe4b8",
    fillColor: "#ffd6a0",
    position: [0, 0.34, 0],
    fillOffset: [0, -0.12, 0.04],
    intensity: 0.78,
    fillIntensity: 0.26,
    distance: 5.2,
    fillDistance: 3.4,
    glowRadius: 0.07,
    glowPosition: [0, 0.34, 0],
  },
  ceiling: {
    color: "#fff2d6",
    fillColor: "#ffe8c0",
    position: [0, -0.12, 0],
    fillOffset: [0, -0.55, 0],
    intensity: 1.15,
    fillIntensity: 0.4,
    distance: 12,
    fillDistance: 7.5,
    glowRadius: 0.12,
    glowPosition: [0, -0.08, 0],
  },
  wall: {
    color: "#ffd6a0",
    fillColor: "#ffc888",
    position: [0, 0.22, 0.12],
    fillOffset: [0, -0.08, 0.28],
    intensity: 0.85,
    fillIntensity: 0.28,
    distance: 7.2,
    fillDistance: 4.6,
    glowRadius: 0.08,
    glowPosition: [0, 0.22, 0.1],
  },
  beacon: {
    color: "#88c8ff",
    fillColor: "#5a9dff",
    position: [0, 1.92, 0],
    fillOffset: [0, -0.45, 0],
    intensity: 1.15,
    fillIntensity: 0.38,
    distance: 13,
    fillDistance: 8.5,
    glowRadius: 0.16,
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
  const dayNight = useArenaStore((s) => s.dayNight);
  const profile = PROFILES[kind];

  const { nightBoost, strength, glowOpacity, distMul } = useMemo(() => {
    const night = dayNight === "night";
    return {
      nightBoost: night ? 1.65 : 1,
      // Setting off still keeps a dim practical glow (same idea as campfire).
      strength: lampLights ? 1 : 0.55,
      glowOpacity: night
        ? lampLights
          ? 0.55
          : 0.38
        : lampLights
          ? 0.42
          : 0.28,
      distMul: lampLights ? 1 : 0.78,
    };
  }, [dayNight, lampLights]);

  const mainI = profile.intensity * strength * nightBoost;
  const fillI = profile.fillIntensity * strength * nightBoost;

  return (
    <group>
      <pointLight
        color={profile.color}
        intensity={mainI}
        distance={profile.distance * distMul}
        decay={2}
        position={profile.position}
      />
      <pointLight
        color={profile.fillColor}
        intensity={fillI}
        distance={profile.fillDistance * distMul}
        decay={2}
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
