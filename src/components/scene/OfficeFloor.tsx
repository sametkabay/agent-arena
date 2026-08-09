import { useMemo } from "react";
import type { MapFloor } from "@/lib/maps/schema";
import { getFloorSurface, cellsForFloorSize, FLOOR_BORDER_METERS, FLOOR_TOP_Y, type FloorPattern } from "@/lib/maps/floorSurfaces";

/** Physical tile board — surface preset drives pattern/colors. */
export function ArenaFloor({ floor }: { floor: MapFloor }) {
  const size = floor.size;
  const surface = getFloorSurface(floor.surface);
  const pattern: FloorPattern =
    floor.style === "solid"
      ? "solid"
      : floor.style === "surface" || !floor.style
        ? surface.pattern
        : floor.style;
  const borderW = FLOOR_BORDER_METERS;
  const cells = cellsForFloorSize(size, floor.surface);
  const tileH = 0.05;
  // Local tile tops sit at y=tileH; shift group so world top is FLOOR_TOP_Y
  const floorY = FLOOR_TOP_Y - tileH;
  const base = floor.color || surface.color;
  const alt = surface.alt;
  const borderColor = surface.border;
  const roughness = surface.roughness;
  const metalness = surface.metalness;

  const { tiles, frame } = useMemo(() => {
    // Playable area = size×size meters; 0.5 m border sits outside
    const inner = size;
    const outer = size + borderW * 2;
    const cell = inner / cells;
    const origin = -inner / 2 + cell / 2;
    // Tiny epsilon only — kills hairline z-gaps without stacking tiles
    const seam = 0.002;
    // Slabs: subtle groove, still flush to fill (no negative / overlap mess)
    const slabInset = Math.min(0.02, cell * 0.02);

    const tileItems: Array<{
      key: string;
      position: [number, number, number];
      args: [number, number, number];
      color: string;
    }> = [];

    if (pattern === "solid") {
      tileItems.push({
        key: "solid",
        position: [0, tileH / 2, 0],
        args: [inner, tileH, inner],
        color: base,
      });
    } else if (pattern === "checker" || pattern === "patches") {
      for (let z = 0; z < cells; z++) {
        for (let x = 0; x < cells; x++) {
          let color: string;
          if (pattern === "checker") {
            const odd = (x + z) % 2 === 0;
            color = odd ? shade(base, 0.04) : shade(alt, -0.02);
          } else {
            // Soft mottling — avoid board-game checker contrast
            const n = hash2(x, z);
            const mix = n * 0.55 + 0.22;
            color = shade(n > 0.62 ? alt : base, mix * 0.05 - 0.025);
          }
          tileItems.push({
            key: `${pattern}-${x}-${z}`,
            position: [origin + x * cell, tileH / 2, origin + z * cell],
            args: [cell + seam, tileH, cell + seam],
            color,
          });
        }
      }
    } else {
      for (let z = 0; z < cells; z++) {
        for (let x = 0; x < cells; x++) {
          tileItems.push({
            key: `s-${x}-${z}`,
            position: [origin + x * cell, tileH / 2 + 0.001, origin + z * cell],
            args: [Math.max(0.05, cell - slabInset), tileH, Math.max(0.05, cell - slabInset)],
            color: (x + z) % 2 === 0 ? shade(base, 0.03) : shade(alt, -0.02),
          });
        }
      }
    }

    const frameMid = inner / 2 + borderW / 2;
    const frameItems: Array<{
      key: string;
      position: [number, number, number];
      args: [number, number, number];
    }> = [
      { key: "n", position: [0, tileH / 2, -frameMid], args: [outer, tileH, borderW] },
      { key: "s", position: [0, tileH / 2, frameMid], args: [outer, tileH, borderW] },
      {
        key: "w",
        position: [-frameMid, tileH / 2, 0],
        args: [borderW, tileH, inner],
      },
      {
        key: "e",
        position: [frameMid, tileH / 2, 0],
        args: [borderW, tileH, inner],
      },
    ];

    return { tiles: tileItems, frame: frameItems };
  }, [size, pattern, cells, base, alt, borderW, tileH]);

  const inner = size;
  const outer = size + borderW * 2;

  return (
    <group position={[0, floorY, 0]}>
      <mesh position={[0, -0.09, 0]} receiveShadow>
        <boxGeometry args={[outer + 0.35, 0.18, outer + 0.35]} />
        <meshStandardMaterial
          color={shade(borderColor, -0.08)}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Continuous fill under tiles — hides any microscopic seams */}
      <mesh position={[0, tileH / 2 - 0.01, 0]} receiveShadow>
        <boxGeometry args={[inner, tileH * 0.85, inner]} />
        <meshStandardMaterial
          color={base}
          roughness={roughness}
          metalness={metalness * 0.5}
        />
      </mesh>

      {frame.map((f) => (
        <mesh key={f.key} position={f.position} receiveShadow>
          <boxGeometry args={f.args} />
          <meshStandardMaterial
            color={borderColor}
            roughness={Math.min(1, roughness + 0.05)}
            metalness={metalness * 0.5}
          />
        </mesh>
      ))}

      {tiles.map((t) => (
        <mesh key={t.key} position={t.position} receiveShadow>
          <boxGeometry args={t.args} />
          <meshStandardMaterial
            color={t.color}
            roughness={roughness}
            metalness={metalness}
          />
        </mesh>
      ))}
    </group>
  );
}

function shade(hex: string, amount: number): string {
  const c = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(c)) return hex;
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) + amount * 255));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) + amount * 255));
  const b = Math.min(255, Math.max(0, (c & 255) + amount * 255));
  return `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b))
    .toString(16)
    .slice(1)}`;
}

function hash2(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
