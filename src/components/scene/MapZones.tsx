import * as THREE from "three";
import type { MapZone } from "@/lib/maps/mapRegions";
import { isRectZone } from "@/lib/maps/mapRegions";

function zoneColor(kind: MapZone["kind"]): string {
  switch (kind) {
    case "camp":
      return "#ff9944";
    case "yard":
      return "#88aacc";
    case "indoor":
      return "#aacc88";
    case "path":
      return "#c4b090";
    case "platform":
      return "#b090ff";
    default:
      return "#88ccaa";
  }
}

/** Unit-square edges, scaled per rect — avoids allocating EdgesGeometry every slider tick. */
const UNIT_RECT_EDGES = (() => {
  const geo = new THREE.PlaneGeometry(1, 1);
  const edges = new THREE.EdgesGeometry(geo);
  geo.dispose();
  return edges;
})();

function RectZoneMesh({
  zone,
  opacity,
  selected,
}: {
  zone: MapZone & { size: [number, number] };
  opacity: number;
  selected?: boolean;
}) {
  const [w, d] = zone.size;
  const color = zoneColor(zone.kind);
  const y = (zone.height ?? 0) + 0.04;
  const outlineColor = selected ? "#6ecf8a" : color;
  const outlineOpacity = selected
    ? 0.95
    : Math.min(1, opacity + 0.45);

  return (
    <group position={[zone.center[0], y, zone.center[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 0.55}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <lineSegments
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        scale={[w, d, 1]}
        geometry={UNIT_RECT_EDGES}
        raycast={() => null}
      >
        <lineBasicMaterial
          color={outlineColor}
          transparent
          opacity={outlineOpacity}
          depthWrite={false}
          toneMapped={false}
          linewidth={selected ? 2 : 1}
        />
      </lineSegments>
      {(zone.height ?? 0) > 0.05 && (
        <mesh position={[0, (zone.height ?? 0) / 2, 0]} raycast={() => null}>
          <boxGeometry args={[w * 0.92, zone.height ?? 0.2, d * 0.92]} />
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
}

function CircleZoneMesh({
  zone,
  opacity,
  selected,
}: {
  zone: MapZone;
  opacity: number;
  selected?: boolean;
}) {
  const color = zoneColor(zone.kind);
  const y = (zone.height ?? 0) + 0.04;
  const ringColor = selected ? "#6ecf8a" : color;

  return (
    <group position={[zone.center[0], y, zone.center[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry
          args={[Math.max(0.2, zone.radius - 0.15), zone.radius, 48]}
        />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={selected ? Math.min(1, opacity + 0.25) : opacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {(zone.height ?? 0) > 0.05 && (
        <mesh position={[0, (zone.height ?? 0) / 2, 0]} raycast={() => null}>
          <cylinderGeometry
            args={[
              zone.radius * 0.92,
              zone.radius * 0.92,
              zone.height ?? 0.2,
              24,
            ]}
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
}

/** Soft translucent zone rings / rectangles — editor + subtle play hint. */
export function MapZones({
  zones,
  visible = true,
  opacity = 0.12,
  selectedIds,
}: {
  zones: MapZone[];
  visible?: boolean;
  opacity?: number;
  /** When set, matching zone outlines are highlighted (editor selection). */
  selectedIds?: ReadonlySet<string> | string[];
}) {
  if (!visible || !zones.length) return null;

  const selected =
    selectedIds == null
      ? null
      : selectedIds instanceof Set
        ? selectedIds
        : new Set(selectedIds);

  return (
    <group>
      {zones.map((z) => {
        const isSelected = selected?.has(z.id) ?? false;
        return isRectZone(z) ? (
          <RectZoneMesh
            key={z.id}
            zone={z}
            opacity={opacity}
            selected={isSelected}
          />
        ) : (
          <CircleZoneMesh
            key={z.id}
            zone={z}
            opacity={opacity}
            selected={isSelected}
          />
        );
      })}
    </group>
  );
}
