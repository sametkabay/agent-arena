import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { PlaceableId } from "@/lib/assets/catalog";

const MAT = {
  wood: "#C4A484",
  woodDark: "#A67C52",
  cream: "#EDE6D9",
  seat: "#6B8F71",
  seatAlt: "#5A7A8A",
  metal: "#8A8F96",
  screen: "#2C3540",
  leaf: "#6B9B5A",
  leafDark: "#4F7A42",
  pot: "#B07A5A",
  soil: "#5C4636",
};

function Box({
  args,
  position,
  color,
  rotation,
}: {
  args: [number, number, number];
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.82} metalness={0.02} />
    </mesh>
  );
}

function Cylinder({
  args,
  position,
  color,
}: {
  args: [number, number, number, number?];
  position: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

/** Flat-color blocky desk — low-poly prop style. */
export function PropDesk() {
  return (
    <group>
      <Box args={[1.35, 0.07, 0.68]} position={[0, 0.72, 0]} color={MAT.wood} />
      <Box args={[0.08, 0.68, 0.08]} position={[-0.58, 0.34, -0.26]} color={MAT.woodDark} />
      <Box args={[0.08, 0.68, 0.08]} position={[0.58, 0.34, -0.26]} color={MAT.woodDark} />
      <Box args={[0.08, 0.68, 0.08]} position={[-0.58, 0.34, 0.26]} color={MAT.woodDark} />
      <Box args={[0.08, 0.68, 0.08]} position={[0.58, 0.34, 0.26]} color={MAT.woodDark} />
      <Box args={[0.5, 0.04, 0.05]} position={[0.25, 0.78, -0.28]} color={MAT.metal} />
    </group>
  );
}

/** Front faces −Z (matches Kenney seating). */
export function PropChair() {
  return (
    <group>
      <Cylinder args={[0.08, 0.1, 0.08, 8]} position={[0, 0.06, 0]} color={MAT.metal} />
      <Cylinder args={[0.04, 0.04, 0.42, 6]} position={[0, 0.28, 0]} color={MAT.metal} />
      <Box args={[0.48, 0.08, 0.48]} position={[0, 0.5, 0]} color={MAT.seat} />
      <Box args={[0.48, 0.45, 0.08]} position={[0, 0.76, 0.2]} color={MAT.seat} />
      <Box args={[0.42, 0.06, 0.08]} position={[0, 0.56, -0.18]} color={MAT.woodDark} />
    </group>
  );
}

export function PropLoungeChair() {
  return (
    <group>
      <Box args={[0.62, 0.12, 0.58]} position={[0, 0.32, 0]} color={MAT.seatAlt} />
      <Box args={[0.62, 0.42, 0.1]} position={[0, 0.58, 0.26]} color={MAT.seatAlt} />
      <Box args={[0.1, 0.28, 0.55]} position={[-0.28, 0.48, -0.02]} color={MAT.seatAlt} />
      <Box args={[0.1, 0.28, 0.55]} position={[0.28, 0.48, -0.02]} color={MAT.seatAlt} />
      <Box args={[0.08, 0.28, 0.08]} position={[-0.24, 0.14, 0.2]} color={MAT.woodDark} />
      <Box args={[0.08, 0.28, 0.08]} position={[0.24, 0.14, 0.2]} color={MAT.woodDark} />
      <Box args={[0.08, 0.28, 0.08]} position={[-0.24, 0.14, -0.2]} color={MAT.woodDark} />
      <Box args={[0.08, 0.28, 0.08]} position={[0.24, 0.14, -0.2]} color={MAT.woodDark} />
    </group>
  );
}

export function PropCoffeeTable() {
  return (
    <group>
      <Box args={[0.85, 0.06, 0.48]} position={[0, 0.38, 0]} color={MAT.wood} />
      <Box args={[0.06, 0.35, 0.06]} position={[-0.34, 0.175, -0.16]} color={MAT.woodDark} />
      <Box args={[0.06, 0.35, 0.06]} position={[0.34, 0.175, -0.16]} color={MAT.woodDark} />
      <Box args={[0.06, 0.35, 0.06]} position={[-0.34, 0.175, 0.16]} color={MAT.woodDark} />
      <Box args={[0.06, 0.35, 0.06]} position={[0.34, 0.175, 0.16]} color={MAT.woodDark} />
    </group>
  );
}

/** Front faces −Z (matches Kenney seating). */
export function PropCouch({ color = MAT.seatAlt }: { color?: string }) {
  return (
    <group>
      <Box args={[1.3, 0.28, 0.55]} position={[0, 0.22, 0]} color={color} />
      <Box args={[1.3, 0.42, 0.12]} position={[0, 0.45, 0.22]} color={color} />
      <Box args={[0.12, 0.32, 0.55]} position={[-0.59, 0.4, 0]} color={color} />
      <Box args={[0.12, 0.32, 0.55]} position={[0.59, 0.4, 0]} color={color} />
      <Box args={[0.08, 0.12, 0.08]} position={[-0.52, 0.06, 0.2]} color={MAT.woodDark} />
      <Box args={[0.08, 0.12, 0.08]} position={[0.52, 0.06, 0.2]} color={MAT.woodDark} />
      <Box args={[0.08, 0.12, 0.08]} position={[-0.52, 0.06, -0.2]} color={MAT.woodDark} />
      <Box args={[0.08, 0.12, 0.08]} position={[0.52, 0.06, -0.2]} color={MAT.woodDark} />
    </group>
  );
}

function PropBooth({ upholstery, metal = false }: { upholstery: string; metal?: boolean }) {
  const frame = metal ? "#9AA2A8" : "#5B3825";
  return (
    <group>
      <Box args={[1.8, 0.26, 0.72]} position={[0, 0.34, 0]} color={upholstery} />
      <Box args={[1.8, 0.72, 0.16]} position={[0, 0.7, 0.29]} color={upholstery} />
      <Box args={[1.94, 0.12, 0.82]} position={[0, 0.08, 0]} color={frame} />
      <Box args={[1.9, 0.06, 0.08]} position={[0, 1.02, 0.3]} color={frame} />
    </group>
  );
}

function PropDistrictRug({ color, border }: { color: string; border: string }) {
  return (
    <group>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.2, 3.2]} />
        <meshStandardMaterial color={border} roughness={0.98} />
      </mesh>
      <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.82, 2.82]} />
        <meshStandardMaterial color={color} roughness={0.96} />
      </mesh>
    </group>
  );
}

function PropPlankFloor({ base, alt, border }: { base: string; alt: string; border: string }) {
  return (
    <group>
      <Box args={[4.35, 0.04, 3.35]} position={[0, 0.02, 0]} color={border} />
      {Array.from({ length: 8 }, (_, index) => (
        <Box
          key={index}
          args={[0.49, 0.035, 3.05]}
          position={[-1.715 + index * 0.49, 0.045, 0]}
          color={index % 2 === 0 ? base : alt}
        />
      ))}
    </group>
  );
}

function PropCheckerFloor() {
  return (
    <group>
      <Box args={[4.35, 0.04, 3.35]} position={[0, 0.02, 0]} color="#D7D0B6" />
      {Array.from({ length: 8 }, (_, z) =>
        Array.from({ length: 10 }, (_, x) => (
          <Box
            key={`${x}-${z}`}
            args={[0.38, 0.025, 0.36]}
            position={[-1.71 + x * 0.38, 0.047, -1.26 + z * 0.36]}
            color={(x + z) % 2 === 0 ? "#F2E8CC" : "#4D9893"}
          />
        )),
      )}
    </group>
  );
}

function PropPlazaPaving({ path = false }: { path?: boolean }) {
  const cols = path ? 6 : 8;
  const rows = path ? 3 : 8;
  const width = path ? 6 : 10;
  const depth = path ? 2.4 : 10;
  const cellW = width / cols;
  const cellD = depth / rows;
  return (
    <group>
      <Box args={[width + 0.15, 0.035, depth + 0.15]} position={[0, 0.018, 0]} color="#786F65" />
      {Array.from({ length: rows }, (_, z) =>
        Array.from({ length: cols }, (_, x) => (
          <Box
            key={`${x}-${z}`}
            args={[cellW - 0.04, 0.03, cellD - 0.04]}
            position={[
              -width / 2 + cellW / 2 + x * cellW,
              0.045,
              -depth / 2 + cellD / 2 + z * cellD,
            ]}
            color={(x + z) % 3 === 0 ? "#C6B79F" : (x + z) % 2 === 0 ? "#B2A58F" : "#A69984"}
          />
        )),
      )}
    </group>
  );
}

function Shade({
  args,
  position,
}: {
  args: [number, number, number, number?];
  position: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={args} />
      <meshStandardMaterial
        color={MAT.cream}
        roughness={0.55}
        emissive="#ffc988"
        emissiveIntensity={0.45}
      />
    </mesh>
  );
}

export function PropFloorLamp() {
  return (
    <group>
      <Cylinder args={[0.12, 0.14, 0.04, 8]} position={[0, 0.02, 0]} color={MAT.metal} />
      <Cylinder args={[0.03, 0.03, 1.35, 6]} position={[0, 0.7, 0]} color={MAT.metal} />
      <Shade args={[0.18, 0.22, 0.28, 8]} position={[0, 1.45, 0]} />
    </group>
  );
}

export function PropDeskLamp() {
  return (
    <group>
      <Cylinder args={[0.08, 0.1, 0.03, 8]} position={[0, 0.02, 0]} color={MAT.metal} />
      <Cylinder args={[0.02, 0.02, 0.28, 6]} position={[0, 0.16, 0]} color={MAT.metal} />
      <Shade args={[0.1, 0.12, 0.12, 8]} position={[0, 0.34, 0]} />
    </group>
  );
}

export function PropTrash() {
  return (
    <group>
      <Cylinder args={[0.14, 0.12, 0.42, 8]} position={[0, 0.21, 0]} color={MAT.metal} />
      <Cylinder args={[0.15, 0.15, 0.04, 8]} position={[0, 0.42, 0]} color="#6B7280" />
    </group>
  );
}

export function PropSideTable() {
  return (
    <group>
      <Box args={[0.55, 0.05, 0.35]} position={[0, 0.48, 0]} color={MAT.wood} />
      <Box args={[0.05, 0.45, 0.05]} position={[-0.2, 0.225, -0.12]} color={MAT.woodDark} />
      <Box args={[0.05, 0.45, 0.05]} position={[0.2, 0.225, -0.12]} color={MAT.woodDark} />
      <Box args={[0.05, 0.45, 0.05]} position={[-0.2, 0.225, 0.12]} color={MAT.woodDark} />
      <Box args={[0.05, 0.45, 0.05]} position={[0.2, 0.225, 0.12]} color={MAT.woodDark} />
    </group>
  );
}

export function PropCabinet() {
  return (
    <group>
      <Box args={[0.55, 0.7, 0.4]} position={[0, 0.35, 0]} color={MAT.wood} />
      <Box args={[0.5, 0.02, 0.36]} position={[0, 0.35, 0.02]} color={MAT.woodDark} />
      <Box args={[0.04, 0.08, 0.02]} position={[0.18, 0.48, 0.21]} color={MAT.metal} />
      <Box args={[0.04, 0.08, 0.02]} position={[0.18, 0.22, 0.21]} color={MAT.metal} />
    </group>
  );
}

export function PropPlant({ small = false }: { small?: boolean }) {
  const s = small ? 0.72 : 1;
  return (
    <group scale={s}>
      <Cylinder args={[0.16, 0.13, 0.22, 8]} position={[0, 0.11, 0]} color={MAT.pot} />
      <Cylinder args={[0.12, 0.12, 0.04, 8]} position={[0, 0.23, 0]} color={MAT.soil} />
      <mesh position={[0, 0.42, 0]} castShadow>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={MAT.leaf} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[0.12, 0.52, 0.05]} castShadow>
        <icosahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color={MAT.leafDark} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[-0.1, 0.5, -0.08]} castShadow>
        <icosahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial color={MAT.leaf} roughness={0.7} flatShading />
      </mesh>
    </group>
  );
}

/** Screen faces −Z (matches Kenney Computer Screen toward the seat). */
export function PropMonitor() {
  return (
    <group>
      <Box args={[0.52, 0.34, 0.04]} position={[0, 0.32, 0]} color={MAT.metal} />
      <Box args={[0.46, 0.28, 0.02]} position={[0, 0.32, -0.02]} color={MAT.screen} />
      <Box args={[0.08, 0.18, 0.06]} position={[0, 0.12, 0]} color={MAT.metal} />
      <Box args={[0.24, 0.03, 0.16]} position={[0, 0.02, 0]} color={MAT.metal} />
    </group>
  );
}

export function PropBookshelf() {
  return (
    <group>
      <Box args={[0.9, 1.2, 0.32]} position={[0, 0.6, 0]} color={MAT.wood} />
      <Box args={[0.82, 0.04, 0.28]} position={[0, 0.3, 0.01]} color={MAT.woodDark} />
      <Box args={[0.82, 0.04, 0.28]} position={[0, 0.6, 0.01]} color={MAT.woodDark} />
      <Box args={[0.82, 0.04, 0.28]} position={[0, 0.9, 0.01]} color={MAT.woodDark} />
      <Box args={[0.18, 0.2, 0.12]} position={[-0.25, 0.42, 0.05]} color={MAT.seat} />
      <Box args={[0.16, 0.22, 0.12]} position={[-0.05, 0.43, 0.05]} color={MAT.seatAlt} />
      <Box args={[0.2, 0.18, 0.12]} position={[0.2, 0.41, 0.05]} color={MAT.cream} />
    </group>
  );
}

const SPACE = {
  rock: "#B06A48",
  rockDark: "#8A4E32",
  rockLite: "#C8845C",
  metal: "#7A828A",
  metalDark: "#4E555C",
  stripe: "#D4783A",
  glow: "#66BBFF",
  dish: "#9AA3AC",
};

function RockMesh({
  args,
  position,
  color,
  rotation,
}: {
  args: [number, number];
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <dodecahedronGeometry args={args} />
      <meshStandardMaterial
        color={color}
        roughness={0.92}
        metalness={0.04}
        flatShading
      />
    </mesh>
  );
}

/** Irregular space boulder — no vegetation, warm oxidized stone. */
export function PropSpaceBoulder() {
  return (
    <group>
      <RockMesh args={[0.72, 0]} position={[0, 0.48, 0]} color={SPACE.rock} rotation={[0.2, 0.4, 0.1]} />
      <RockMesh args={[0.42, 0]} position={[0.45, 0.28, 0.15]} color={SPACE.rockDark} rotation={[0.5, -0.3, 0.2]} />
      <RockMesh args={[0.34, 0]} position={[-0.4, 0.22, -0.2]} color={SPACE.rockLite} rotation={[-0.2, 0.6, 0.15]} />
      <RockMesh args={[0.22, 0]} position={[0.1, 0.78, -0.25]} color={SPACE.rockDark} rotation={[0.3, 0.1, -0.4]} />
    </group>
  );
}

export function PropSpaceRock() {
  return (
    <group>
      <RockMesh args={[0.38, 0]} position={[0, 0.26, 0]} color={SPACE.rock} rotation={[0.15, 0.5, 0.08]} />
      <RockMesh args={[0.2, 0]} position={[0.22, 0.14, 0.1]} color={SPACE.rockDark} rotation={[0.4, -0.2, 0.3]} />
      <RockMesh args={[0.16, 0]} position={[-0.18, 0.12, -0.12]} color={SPACE.rockLite} rotation={[-0.3, 0.4, 0.1]} />
    </group>
  );
}

/** Metal supply crate — fits factory floors and space outposts. */
export function PropSupplyCrate() {
  return (
    <group>
      <Box args={[0.78, 0.52, 0.58]} position={[0, 0.26, 0]} color={SPACE.metal} />
      <Box args={[0.82, 0.06, 0.62]} position={[0, 0.52, 0]} color={SPACE.metalDark} />
      <Box args={[0.82, 0.04, 0.62]} position={[0, 0.04, 0]} color={SPACE.metalDark} />
      <Box args={[0.78, 0.08, 0.04]} position={[0, 0.3, 0.3]} color={SPACE.stripe} />
      <Box args={[0.06, 0.1, 0.04]} position={[0.28, 0.38, 0.3]} color={SPACE.metalDark} />
    </group>
  );
}

/** Outpost navigation pylon — cool sci-fi marker (not a streetlamp). */
export function PropBeacon() {
  return (
    <group>
      <Cylinder args={[0.22, 0.26, 0.1, 6]} position={[0, 0.05, 0]} color={SPACE.metalDark} />
      <Cylinder args={[0.1, 0.14, 0.35, 6]} position={[0, 0.28, 0]} color={SPACE.metal} />
      <Cylinder args={[0.06, 0.08, 1.15, 6]} position={[0, 1.0, 0]} color={SPACE.metal} />
      <Cylinder args={[0.14, 0.08, 0.22, 6]} position={[0, 1.68, 0]} color={SPACE.metalDark} />
      <mesh position={[0, 1.92, 0]} castShadow>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color={SPACE.glow}
          emissive={SPACE.glow}
          emissiveIntensity={1.05}
          roughness={0.28}
          metalness={0.15}
          toneMapped={false}
        />
      </mesh>
      <Box args={[0.28, 0.025, 0.035]} position={[0, 1.35, 0]} color={SPACE.glow} />
      <Box args={[0.035, 0.025, 0.28]} position={[0, 1.35, 0]} color={SPACE.glow} />
    </group>
  );
}

/** Compact dish antenna for research outposts. */
export function PropAntenna() {
  return (
    <group>
      <Cylinder args={[0.14, 0.16, 0.06, 8]} position={[0, 0.03, 0]} color={SPACE.metalDark} />
      <Cylinder args={[0.04, 0.045, 1.4, 6]} position={[0, 0.72, 0]} color={SPACE.metal} />
      <mesh position={[0.05, 1.55, 0]} rotation={[0.55, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.05, 16]} />
        <meshStandardMaterial color={SPACE.dish} roughness={0.45} metalness={0.35} />
      </mesh>
      <Cylinder args={[0.02, 0.02, 0.35, 6]} position={[0.18, 1.72, 0.12]} color={SPACE.metalDark} />
    </group>
  );
}

/** Solid office wall segment (~2 m wide) — matches Kenney wall module span. */
export function PropWallSolid() {
  const w = 2.0;
  const h = 2.6;
  const d = 0.18;
  return (
    <group>
      <Box args={[w, h, d]} position={[0, h / 2, 0]} color="#E8E2D6" />
      <Box args={[w, 0.14, d + 0.04]} position={[0, 0.07, 0]} color="#BFAF9A" />
      <Box args={[w, 0.08, d + 0.03]} position={[0, h - 0.04, 0]} color="#D2C8B8" />
    </group>
  );
}

function PropBrickWall() {
  const bricks = Array.from({ length: 7 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => ({
      key: `${row}-${col}`,
      x: -0.73 + col * 0.49 + (row % 2 ? 0.24 : 0),
      y: 0.22 + row * 0.35,
    })).filter((b) => b.x < 0.95),
  ).flat();
  return (
    <group>
      <Box args={[2, 2.6, 0.2]} position={[0, 1.3, 0]} color="#7D3F31" />
      {bricks.map((brick, index) => (
        <Box
          key={brick.key}
          args={[0.44, 0.3, 0.035]}
          position={[brick.x, brick.y, 0.115]}
          color={index % 3 === 0 ? "#A5533D" : index % 2 === 0 ? "#914632" : "#82402F"}
        />
      ))}
      <Box args={[2.04, 0.1, 0.24]} position={[0, 0.05, 0]} color="#553027" />
    </group>
  );
}

function PropPanelWall({
  body,
  trim,
  creamTop = false,
}: {
  body: string;
  trim: string;
  creamTop?: boolean;
}) {
  return (
    <group>
      <Box
        args={[2, 2.6, 0.2]}
        position={[0, 1.3, 0]}
        color={creamTop ? "#D8C9AE" : body}
      />
      <Box args={[2.04, 1.18, 0.06]} position={[0, 0.64, 0.13]} color={body} />
      {[-0.74, -0.25, 0.25, 0.74].map((x) => (
        <Box key={x} args={[0.06, 1.06, 0.045]} position={[x, 0.64, 0.18]} color={trim} />
      ))}
      <Box args={[2.04, 0.08, 0.06]} position={[0, 1.24, 0.15]} color={trim} />
      <Box args={[2.04, 0.1, 0.24]} position={[0, 0.05, 0]} color={trim} />
      <Box args={[2.04, 0.08, 0.23]} position={[0, 2.56, 0]} color={trim} />
    </group>
  );
}

function PropDinerWindow() {
  return (
    <group>
      <Box args={[2, 0.72, 0.2]} position={[0, 0.36, 0]} color="#E6D8BD" />
      <Box args={[2, 0.18, 0.2]} position={[0, 2.51, 0]} color="#D7C7AA" />
      <Box args={[0.14, 1.72, 0.2]} position={[-0.93, 1.64, 0]} color="#91A3A5" />
      <Box args={[0.14, 1.72, 0.2]} position={[0.93, 1.64, 0]} color="#91A3A5" />
      <Box args={[0.1, 1.72, 0.2]} position={[0, 1.64, 0]} color="#AAB5B5" />
      <mesh position={[-0.46, 1.64, 0]} receiveShadow>
        <planeGeometry args={[0.82, 1.58]} />
        <meshStandardMaterial color="#9BC4C7" transparent opacity={0.42} roughness={0.25} metalness={0.08} />
      </mesh>
      <mesh position={[0.46, 1.64, 0]} receiveShadow>
        <planeGeometry args={[0.82, 1.58]} />
        <meshStandardMaterial color="#9BC4C7" transparent opacity={0.42} roughness={0.25} metalness={0.08} />
      </mesh>
      <Box args={[2.05, 0.1, 0.26]} position={[0, 0.72, 0]} color="#97A4A3" />
    </group>
  );
}

function PropPastryDisplay() {
  return (
    <group>
      <Box args={[1.2, 0.16, 0.56]} position={[0, 0.08, 0]} color="#75452D" />
      <Box args={[1.15, 0.05, 0.5]} position={[0, 0.68, 0]} color="#C79B64" />
      <Box args={[0.06, 0.52, 0.5]} position={[-0.55, 0.42, 0]} color="#B8C8C5" />
      <Box args={[0.06, 0.52, 0.5]} position={[0.55, 0.42, 0]} color="#B8C8C5" />
      <mesh position={[0, 0.42, 0.255]}>
        <planeGeometry args={[1.04, 0.5]} />
        <meshStandardMaterial color="#CDE1DE" transparent opacity={0.35} roughness={0.2} />
      </mesh>
      {[-0.32, 0, 0.32].map((x, i) => (
        <Cylinder
          key={x}
          args={[0.1, 0.12, 0.12, 10]}
          position={[x, 0.26, 0.08]}
          color={i === 1 ? "#E6A857" : "#C96F4D"}
        />
      ))}
    </group>
  );
}

function PropMicrophoneStand() {
  return (
    <group>
      <Cylinder args={[0.18, 0.22, 0.05, 10]} position={[0, 0.025, 0]} color="#4F5156" />
      <Cylinder args={[0.025, 0.025, 1.35, 8]} position={[0, 0.7, 0]} color="#73777D" />
      <mesh position={[0.07, 1.41, 0]} rotation={[0, 0, -0.35]} castShadow>
        <capsuleGeometry args={[0.07, 0.18, 4, 8]} />
        <meshStandardMaterial color="#303236" roughness={0.45} metalness={0.55} />
      </mesh>
    </group>
  );
}

function PropFramedArt() {
  return (
    <group>
      <Box args={[0.9, 0.72, 0.08]} position={[0, 0.36, 0]} color="#583A2A" />
      <Box args={[0.74, 0.56, 0.035]} position={[0, 0.36, 0.058]} color="#D99A58" />
      <Box args={[0.25, 0.5, 0.02]} position={[-0.18, 0.36, 0.08]} color="#637A58" />
      <Box args={[0.3, 0.22, 0.02]} position={[0.2, 0.48, 0.08]} color="#C35F4B" />
    </group>
  );
}

function PropBottleShelf() {
  return (
    <group>
      <Box args={[1.7, 1.45, 0.28]} position={[0, 0.73, 0]} color="#54331F" />
      {[0.35, 0.78, 1.2].map((y) => (
        <Box key={y} args={[1.56, 0.06, 0.32]} position={[0, y, 0.02]} color="#9A6B3C" />
      ))}
      {[0.35, 0.78, 1.2].flatMap((y, row) =>
        [-0.58, -0.28, 0.02, 0.32, 0.62].map((x, col) => (
          <Cylinder
            key={`${row}-${col}`}
            args={[0.045, 0.06, 0.26, 8]}
            position={[x, y + 0.16, 0.09]}
            color={(row + col) % 3 === 0 ? "#6F2731" : (row + col) % 2 === 0 ? "#31583D" : "#B6873D"}
          />
        )),
      )}
    </group>
  );
}

function PropDartboard() {
  return (
    <group>
      <mesh position={[0, 0.42, 0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.08, 24]} />
        <meshStandardMaterial color="#2E4734" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.42, 0.091]}>
        <circleGeometry args={[0.25, 24]} />
        <meshStandardMaterial color="#D1B478" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.42, 0.105]}>
        <circleGeometry args={[0.08, 20]} />
        <meshStandardMaterial color="#A5423A" roughness={0.68} />
      </mesh>
    </group>
  );
}

function PropMenuBoard() {
  return (
    <group>
      <Box args={[1.5, 0.92, 0.1]} position={[0, 0.46, 0]} color="#BFC4BF" />
      <Box args={[1.34, 0.76, 0.035]} position={[0, 0.46, 0.07]} color="#284D4D" />
      {[-0.22, 0, 0.22].map((y, i) => (
        <Box key={y} args={[i === 1 ? 0.9 : 1.05, 0.035, 0.018]} position={[0, 0.46 + y, 0.095]} color="#F5E9C8" />
      ))}
    </group>
  );
}

function PropWallClock() {
  return (
    <group>
      <mesh position={[0, 0.34, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.1, 28]} />
        <meshStandardMaterial color="#AEB5B6" roughness={0.4} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.34, 0.108]}>
        <circleGeometry args={[0.25, 28]} />
        <meshStandardMaterial color="#F4EEDB" roughness={0.72} />
      </mesh>
      <Box args={[0.025, 0.16, 0.018]} position={[0, 0.4, 0.125]} color="#333638" rotation={[0, 0, 0.45]} />
      <Box args={[0.025, 0.12, 0.018]} position={[0.04, 0.31, 0.125]} color="#333638" rotation={[0, 0, -0.9]} />
    </group>
  );
}

function PropCondimentSet() {
  return (
    <group>
      <Box args={[0.32, 0.04, 0.18]} position={[0, 0.02, 0]} color="#90999C" />
      <Cylinder args={[0.035, 0.045, 0.18, 8]} position={[-0.08, 0.11, 0]} color="#B84B3E" />
      <Cylinder args={[0.035, 0.045, 0.18, 8]} position={[0.02, 0.11, 0]} color="#D9B44A" />
      <Box args={[0.08, 0.16, 0.1]} position={[0.11, 0.1, 0]} color="#F0E4C7" />
    </group>
  );
}

function PropBrassRail() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 2, 12]} />
        <meshStandardMaterial color="#B78935" roughness={0.28} metalness={0.72} />
      </mesh>
      <Cylinder args={[0.035, 0.035, 0.25, 10]} position={[-0.78, 0.13, 0]} color="#B78935" />
      <Cylinder args={[0.035, 0.035, 0.25, 10]} position={[0.78, 0.13, 0]} color="#B78935" />
    </group>
  );
}

function wrapSignLabel(label: string): string[] {
  const clean = label.trim().replace(/\s+/g, " ") || "SOCIAL HUB";
  if (clean.length <= 16) return [clean];
  const words = clean.split(" ");
  let first = "";
  let second = "";
  for (const word of words) {
    if (!second && `${first} ${word}`.trim().length <= Math.ceil(clean.length / 2) + 2) {
      first = `${first} ${word}`.trim();
    } else {
      second = `${second} ${word}`.trim();
    }
  }
  return second ? [first, second] : [clean];
}

type SignStyle = "cafe" | "pub" | "diner" | "tavern" | "neutral";

const SIGN_STYLES: Record<
  SignStyle,
  { background: string; border: string; text: string; body: string; post: string; font: string }
> = {
  cafe: {
    background: "#75412C",
    border: "#E3B86E",
    text: "#FFF0CE",
    body: "#A75A32",
    post: "#68402B",
    font: "Georgia, serif",
  },
  pub: {
    background: "#173A2A",
    border: "#C39A4A",
    text: "#F5DEAA",
    body: "#294C37",
    post: "#4E3322",
    font: "Georgia, serif",
  },
  diner: {
    background: "#EAE6D8",
    border: "#63A9A7",
    text: "#B64F45",
    body: "#98A8AA",
    post: "#7B8A8C",
    font: "Arial, sans-serif",
  },
  tavern: {
    background: "#6B292A",
    border: "#C6A052",
    text: "#FFE8B2",
    body: "#4C2D21",
    post: "#593720",
    font: "Georgia, serif",
  },
  neutral: {
    background: "#3C241D",
    border: "#C99752",
    text: "#FFF1CF",
    body: "#5A3425",
    post: "#6F452C",
    font: "system-ui, sans-serif",
  },
};

function useSignTexture(label: string, signStyle: SignStyle) {
  const style = SIGN_STYLES[signStyle];
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 320;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 22;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    const lines = wrapSignLabel(label);
    const fontSize = lines.length === 1 ? 116 : 88;
    ctx.font = `800 ${fontSize}px ${style.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = style.text;
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 8;
    const yPositions = lines.length === 1 ? [160] : [108, 216];
    lines.forEach((line, index) => {
      let size = fontSize;
      ctx.font = `800 ${size}px ${style.font}`;
      while (ctx.measureText(line).width > 900 && size > 48) {
        size -= 4;
        ctx.font = `800 ${size}px ${style.font}`;
      }
      ctx.fillText(line, 512, yPositions[index]!);
    });

    const next = new CanvasTexture(canvas);
    next.colorSpace = SRGBColorSpace;
    next.needsUpdate = true;
    return next;
  }, [label, style.background, style.border, style.font, style.text]);

  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** Editable in-world district title board; text comes from PlaceableInstance.label. */
export function PropRegionSign({
  label = "SOCIAL HUB",
  signStyle = "neutral",
}: {
  label?: string;
  signStyle?: SignStyle;
}) {
  const style = SIGN_STYLES[signStyle];
  const texture = useSignTexture(label, signStyle);
  return (
    <group>
      <Box args={[4.2, 1.35, 0.18]} position={[0, 1.65, 0]} color={style.body} />
      <Box args={[0.18, 1.25, 0.18]} position={[-1.72, 0.63, 0]} color={style.post} />
      <Box args={[0.18, 1.25, 0.18]} position={[1.72, 0.63, 0]} color={style.post} />
      {texture && (
        <>
          <mesh position={[0, 1.65, 0.096]}>
            <planeGeometry args={[3.92, 1.08]} />
            <meshBasicMaterial map={texture} toneMapped={false} />
          </mesh>
          <mesh position={[0, 1.65, -0.096]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[3.92, 1.08]} />
            <meshBasicMaterial map={texture} toneMapped={false} />
          </mesh>
        </>
      )}
      {signStyle === "diner" &&
        [-1.55, -0.78, 0, 0.78, 1.55].map((x) => (
          <mesh key={x} position={[x, 2.42, 0.13]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial
              color="#FFF4BF"
              emissive="#FFD978"
              emissiveIntensity={0.8}
              toneMapped={false}
            />
          </mesh>
        ))}
    </group>
  );
}

export function PolyProp({ id, label }: { id: PlaceableId; label?: string }) {
  switch (id) {
    case "desk":
      return <PropDesk />;
    case "chair":
      return <PropChair />;
    case "lounge_chair":
      return <PropLoungeChair />;
    case "coffee_table":
      return <PropCoffeeTable />;
    case "couch":
      return <PropCouch />;
    case "social_sofa_orange":
      return <PropCouch color="#C86632" />;
    case "pub_booth_green":
      return <PropBooth upholstery="#315B43" />;
    case "diner_booth_teal":
      return <PropBooth upholstery="#4A9693" metal />;
    case "tavern_booth_red":
      return <PropBooth upholstery="#7A3434" />;
    case "plant":
      return <PropPlant />;
    case "plant_small":
      return <PropPlant small />;
    case "monitor":
      return <PropMonitor />;
    case "bookshelf":
      return <PropBookshelf />;
    case "table":
      return <PropCoffeeTable />;
    case "cabinet":
      return <PropCabinet />;
    case "rug":
      return (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[2.2, 1.3]} />
          <meshStandardMaterial color="#C4A484" roughness={0.95} />
        </mesh>
      );
    case "floor_lamp":
    case "lamp_square":
      return <PropFloorLamp />;
    case "desk_lamp":
      return <PropDeskLamp />;
    case "trash":
      return <PropTrash />;
    case "side_table":
      return <PropSideTable />;
    case "space_boulder":
      return <PropSpaceBoulder />;
    case "space_rock":
      return <PropSpaceRock />;
    case "supply_crate":
      return <PropSupplyCrate />;
    case "beacon":
      return <PropBeacon />;
    case "antenna":
      return <PropAntenna />;
    case "wall_solid":
      return <PropWallSolid />;
    case "wall_brick":
      return <PropBrickWall />;
    case "wall_pub_panel":
      return <PropPanelWall body="#3C2B20" trim="#B08442" />;
    case "wall_diner_window":
      return <PropDinerWindow />;
    case "wall_tavern_panel":
      return <PropPanelWall body="#543124" trim="#A47C3C" creamTop />;
    case "region_sign":
      return <PropRegionSign label={label} />;
    case "cafe_sign":
      return <PropRegionSign label={label} signStyle="cafe" />;
    case "pub_sign":
      return <PropRegionSign label={label} signStyle="pub" />;
    case "diner_sign":
      return <PropRegionSign label={label} signStyle="diner" />;
    case "tavern_sign":
      return <PropRegionSign label={label} signStyle="tavern" />;
    case "rug_coffeehouse":
      return <PropDistrictRug color="#B95832" border="#704232" />;
    case "rug_pub":
      return <PropPlankFloor base="#4B3426" alt="#3B2A20" border="#2B211A" />;
    case "rug_diner":
      return <PropCheckerFloor />;
    case "rug_tavern":
      return <PropPlankFloor base="#633C2A" alt="#4F3024" border="#8D6539" />;
    case "plaza_paving":
      return <PropPlazaPaving />;
    case "path_paving":
      return <PropPlazaPaving path />;
    case "pastry_display":
      return <PropPastryDisplay />;
    case "microphone_stand":
      return <PropMicrophoneStand />;
    case "framed_art":
      return <PropFramedArt />;
    case "bottle_shelf":
      return <PropBottleShelf />;
    case "dartboard":
      return <PropDartboard />;
    case "menu_board":
      return <PropMenuBoard />;
    case "wall_clock":
      return <PropWallClock />;
    case "condiment_set":
      return <PropCondimentSet />;
    case "brass_rail":
      return <PropBrassRail />;
    default:
      return (
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={MAT.wood} roughness={0.85} />
        </mesh>
      );
  }
}
