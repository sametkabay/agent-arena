import type { MapZone } from "@/lib/maps/ambience";

/** Soft translucent zone rings — editor + subtle play hint. */
export function MapZones({
  zones,
  visible = true,
  opacity = 0.12,
}: {
  zones: MapZone[];
  visible?: boolean;
  opacity?: number;
}) {
  if (!visible || !zones.length) return null;

  return (
    <group>
      {zones.map((z) => {
        const color =
          z.kind === "camp"
            ? "#ff9944"
            : z.kind === "yard"
              ? "#88aacc"
              : z.kind === "indoor"
                ? "#aacc88"
                : z.kind === "path"
                  ? "#c4b090"
                  : z.kind === "platform"
                    ? "#b090ff"
                    : "#88ccaa";
        const y = (z.height ?? 0) + 0.04;
        return (
          <group key={z.id} position={[z.center[0], y, z.center[2]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[Math.max(0.2, z.radius - 0.15), z.radius, 48]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={opacity}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            {(z.height ?? 0) > 0.05 && (
              <mesh position={[0, (z.height ?? 0) / 2, 0]}>
                <cylinderGeometry
                  args={[z.radius * 0.92, z.radius * 0.92, z.height ?? 0.2, 24]}
                />
                <meshStandardMaterial
                  color="#8a8070"
                  roughness={0.92}
                  metalness={0.05}
                  transparent
                  opacity={0.55}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
