import { useMemo } from "react";
import { getMap } from "@/lib/maps";
import type { MapId } from "@/lib/types";

/**
 * Physical tile board flush — no gap underlay, no texture plane.
 */
export function OfficeFloor({
  size,
  mapId,
}: {
  size: number;
  mapId: MapId;
}) {
  const theme = getMap(mapId).theme;
  const cells = 8;
  const tileH = 0.05;
  const borderW = Math.max(0.32, size * 0.05);

  const { tiles, frame } = useMemo(() => {
    const inner = size - borderW * 2;
    // Tiny overlap kills hairline seams without visible gaps
    const overlap = 0.01;
    const cell = inner / cells;
    const origin = -inner / 2 + cell / 2;

    const tileItems: Array<{
      key: string;
      position: [number, number, number];
      args: [number, number, number];
      color: string;
    }> = [];

    for (let z = 0; z < cells; z++) {
      for (let x = 0; x < cells; x++) {
        const odd = (x + z) % 2 === 0;
        tileItems.push({
          key: `${x}-${z}`,
          position: [origin + x * cell, tileH / 2, origin + z * cell],
          args: [cell + overlap, tileH, cell + overlap],
          color: odd ? shade(theme.floor, 0.045) : shade(theme.floor, -0.04),
        });
      }
    }

    const mid = (size - borderW) / 2;
    const frameItems: Array<{
      key: string;
      position: [number, number, number];
      args: [number, number, number];
    }> = [
      { key: "n", position: [0, tileH / 2, -mid], args: [size, tileH, borderW] },
      { key: "s", position: [0, tileH / 2, mid], args: [size, tileH, borderW] },
      {
        key: "w",
        position: [-mid, tileH / 2, 0],
        args: [borderW, tileH, size - borderW * 2],
      },
      {
        key: "e",
        position: [mid, tileH / 2, 0],
        args: [borderW, tileH, size - borderW * 2],
      },
    ];

    return { tiles: tileItems, frame: frameItems };
  }, [size, theme.floor, borderW]);

  return (
    <group>
      <mesh position={[0, -0.09, 0]} receiveShadow>
        <boxGeometry args={[size + 0.35, 0.18, size + 0.35]} />
        <meshStandardMaterial color={shade(theme.floor, -0.15)} roughness={1} />
      </mesh>

      {frame.map((f) => (
        <mesh key={f.key} position={f.position} receiveShadow>
          <boxGeometry args={f.args} />
          <meshStandardMaterial color={shade(theme.floor, -0.1)} roughness={0.95} />
        </mesh>
      ))}

      {tiles.map((t) => (
        <mesh key={t.key} position={t.position} receiveShadow>
          <boxGeometry args={t.args} />
          <meshStandardMaterial color={t.color} roughness={0.92} />
        </mesh>
      ))}
    </group>
  );
}

function shade(hex: string, amount: number): string {
  const c = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) + amount * 255));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) + amount * 255));
  const b = Math.min(255, Math.max(0, (c & 255) + amount * 255));
  return `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b))
    .toString(16)
    .slice(1)}`;
}
