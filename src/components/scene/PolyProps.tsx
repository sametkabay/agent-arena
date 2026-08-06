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
export function PropCouch() {
  return (
    <group>
      <Box args={[1.3, 0.28, 0.55]} position={[0, 0.22, 0]} color={MAT.seatAlt} />
      <Box args={[1.3, 0.42, 0.12]} position={[0, 0.45, 0.22]} color={MAT.seatAlt} />
      <Box args={[0.12, 0.32, 0.55]} position={[-0.59, 0.4, 0]} color={MAT.seatAlt} />
      <Box args={[0.12, 0.32, 0.55]} position={[0.59, 0.4, 0]} color={MAT.seatAlt} />
      <Box args={[0.08, 0.12, 0.08]} position={[-0.52, 0.06, 0.2]} color={MAT.woodDark} />
      <Box args={[0.08, 0.12, 0.08]} position={[0.52, 0.06, 0.2]} color={MAT.woodDark} />
      <Box args={[0.08, 0.12, 0.08]} position={[-0.52, 0.06, -0.2]} color={MAT.woodDark} />
      <Box args={[0.08, 0.12, 0.08]} position={[0.52, 0.06, -0.2]} color={MAT.woodDark} />
    </group>
  );
}

export function PropFloorLamp() {
  return (
    <group>
      <Cylinder args={[0.12, 0.14, 0.04, 8]} position={[0, 0.02, 0]} color={MAT.metal} />
      <Cylinder args={[0.03, 0.03, 1.35, 6]} position={[0, 0.7, 0]} color={MAT.metal} />
      <Cylinder args={[0.18, 0.22, 0.28, 8]} position={[0, 1.45, 0]} color={MAT.cream} />
    </group>
  );
}

export function PropDeskLamp() {
  return (
    <group>
      <Cylinder args={[0.08, 0.1, 0.03, 8]} position={[0, 0.02, 0]} color={MAT.metal} />
      <Cylinder args={[0.02, 0.02, 0.28, 6]} position={[0, 0.16, 0]} color={MAT.metal} />
      <Cylinder args={[0.1, 0.12, 0.12, 8]} position={[0, 0.34, 0]} color={MAT.cream} />
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

export function PolyProp({ id }: { id: PlaceableId }) {
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
      return <PropFloorLamp />;
    case "desk_lamp":
      return <PropDeskLamp />;
    case "trash":
      return <PropTrash />;
    case "side_table":
      return <PropSideTable />;
    default:
      return null;
  }
}
