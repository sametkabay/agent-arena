import { useMemo, useRef } from "react";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import {
  idsFromIntersections,
  pickStackedId,
} from "@/lib/three/pickAgents";
import type { PlaceableId } from "@/lib/assets/catalog";
import { ArenaFloor } from "@/components/scene/OfficeFloor";
import { Placeables } from "@/components/scene/Placeables";
import { MapZones } from "@/components/scene/MapZones";
import { NightGlow, NightSky } from "@/components/scene/NightSky";
import type { ContextMenuState } from "@/components/MapEditor/EditorContextMenu";
import { clampToFloor, hitboxSize, hitFloor } from "@/components/MapEditor/geometry";
import { DRAG_THRESHOLD, type EditorTool } from "@/components/MapEditor/types";
import { lerpSceneLighting } from "@/lib/dayNight";
import { useArenaStore } from "@/store/arenaStore";
import { FitCameraToFloor } from "@/components/scene/FitCameraToFloor";

export function EditorWorld({
  draft,
  selectedIds,
  tool,
  onSelect,
  onMoveIds,
  onPlaceAsset,
  onPlaceSpawn,
  paintPlaceableId,
  onDragGestureStart,
  onDragGestureEnd,
  onContextMenu,
  snapStep,
}: {
  draft: ArenaMapDefinition;
  selectedIds: string[];
  tool: EditorTool;
  onSelect: (id: string | null, opts?: { additive?: boolean }) => void;
  onMoveIds: (
    moves: { id: string; position: [number, number, number] }[],
  ) => void;
  onPlaceAsset: (placeableId: PlaceableId, pos: [number, number, number]) => void;
  onPlaceSpawn: (pos: [number, number, number]) => void;
  paintPlaceableId: PlaceableId | null;
  onDragGestureStart: () => void;
  onDragGestureEnd: () => void;
  onContextMenu: (menu: ContextMenuState) => void;
  snapStep: number;
}) {
  const drag = useRef<{
    ids: string[];
    startX: number;
    startY: number;
    moved: boolean;
    pivot: [number, number] | null;
    origins: Record<string, [number, number, number]>;
  } | null>(null);
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null;
  const floorSize = draft.floor.size;
  const dayNightBlend = useArenaStore((s) => s.dayNightBlend);
  const lighting = useMemo(
    () => lerpSceneLighting(draft.theme, dayNightBlend),
    [draft.theme, dayNightBlend],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const primaryId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;

  const beginSelect = (e: ThreeEvent<PointerEvent>) => {
    if (e.button === 2) return;
    e.stopPropagation();
    const stack = idsFromIntersections(e.intersections, "editorTargetId");
    const additive = e.nativeEvent.shiftKey;
    const picked = additive
      ? stack[0]
      : pickStackedId(stack, primaryId);
    if (!picked) return;

    const isSpawn = draft.spawnPoints.some((s) => s.id === picked);
    const isPlaceable = draft.placeables.some((p) => p.id === picked);

    if (additive && isPlaceable) {
      onSelect(picked, { additive: true });
    } else {
      onSelect(picked);
    }

    if (tool !== "select") return;

    // Compute drag set from the selection that will result (state not flushed yet)
    let dragIds: string[];
    if (additive && isPlaceable) {
      const placeableSel = selectedIds.filter((id) =>
        draft.placeables.some((p) => p.id === id),
      );
      dragIds = placeableSel.includes(picked)
        ? placeableSel.filter((id) => id !== picked)
        : [...placeableSel, picked];
      if (dragIds.length === 0) {
        drag.current = null;
        return;
      }
    } else {
      dragIds = [picked];
    }

    // Spawns never multi-drag with placeables
    if (isSpawn) dragIds = [picked];

    const origins: Record<string, [number, number, number]> = {};
    for (const id of dragIds) {
      const p = draft.placeables.find((x) => x.id === id);
      const s = draft.spawnPoints.find((x) => x.id === id);
      const pos = p?.position ?? s?.position;
      if (pos) origins[id] = [pos[0], pos[1], pos[2]];
    }

    drag.current = {
      ids: dragIds,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pivot: null,
      origins,
    };
  };

  const openCtx = (
    kind: "placeable" | "spawn",
    e: ThreeEvent<MouseEvent>,
  ) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    const stack = idsFromIntersections(e.intersections, "editorTargetId");
    const id = stack[0];
    if (!id) return;

    if (kind === "placeable" && selectedSet.has(id)) {
      // Keep multi-selection; operate on all selected placeables
    } else {
      onSelect(id);
    }

    onContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetId: id,
      kind,
    });
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || tool !== "select") return;
    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (!d.moved && dist < DRAG_THRESHOLD) return;
    const pos = hitFloor(e, floorSize, snapStep);
    if (!pos) return;

    if (!d.moved) {
      d.moved = true;
      d.pivot = [pos[0], pos[2]];
      onDragGestureStart();
      if (controls) controls.enabled = false;
    }
    if (!d.pivot) return;
    e.stopPropagation();

    const dx = pos[0] - d.pivot[0];
    const dz = pos[2] - d.pivot[1];
    const moves = d.ids
      .map((id) => {
        const o = d.origins[id];
        if (!o) return null;
        const next = clampToFloor(o[0] + dx, o[2] + dz, floorSize, snapStep);
        return {
          id,
          position: [next[0], o[1], next[2]] as [number, number, number],
        };
      })
      .filter((m): m is { id: string; position: [number, number, number] } =>
        Boolean(m),
      );
    if (moves.length) onMoveIds(moves);
  };

  const endDrag = () => {
    const d = drag.current;
    if (d?.moved) onDragGestureEnd();
    if (controls) controls.enabled = true;
    drag.current = null;
  };

  const onFloorPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button === 2) return;
    if (tool === "spawn") {
      e.stopPropagation();
      const pos = hitFloor(e, floorSize, snapStep);
      if (pos) onPlaceSpawn(pos);
      return;
    }
    if (paintPlaceableId) {
      e.stopPropagation();
      const pos = hitFloor(e, floorSize, snapStep);
      if (pos) onPlaceAsset(paintPlaceableId, pos);
      return;
    }
    if (tool === "select") {
      onSelect(null);
    }
  };

  return (
    <>
      <color attach="background" args={[lighting.background]} />
      <fog
        attach="fog"
        args={[lighting.fog, floorSize * 2.8, floorSize * 6]}
      />
      <NightSky
        nightAmount={lighting.nightAmount}
        radius={Math.max(70, floorSize * 3.2)}
      />
      <NightGlow nightAmount={lighting.nightAmount} color={lighting.hemiSky} />
      <ambientLight
        intensity={lighting.ambientIntensity}
        color={lighting.ambient}
      />
      <hemisphereLight
        args={[lighting.hemiSky, lighting.hemiGround, lighting.hemiIntensity]}
      />
      <directionalLight
        position={lighting.sunPosition}
        intensity={lighting.sunIntensity}
        color={lighting.sun}
        castShadow
      />
      {lighting.fillIntensity > 0.01 && (
        <pointLight
          position={lighting.fillPosition}
          intensity={lighting.fillIntensity}
          color={lighting.fillColor}
          distance={floorSize * 1.8}
          decay={2}
        />
      )}
      {(draft.lights ?? []).map((L) => (
        <pointLight
          key={L.id}
          position={L.position}
          intensity={L.intensity}
          color={L.color}
          distance={L.distance}
          decay={2}
        />
      ))}

      <ArenaFloor floor={draft.floor} />
      <FitCameraToFloor
        floorSize={floorSize}
        viewKey={draft.id}
        basePosition={[14, 16, 18]}
      />
      <MapZones zones={draft.zones ?? []} visible opacity={0.16} />
      <gridHelper
        args={[
          floorSize,
          Math.max(8, Math.round(floorSize / (snapStep || 2))),
          lighting.nightAmount > 0.5 ? "#4a5568" : "#b0a090",
          lighting.nightAmount > 0.5 ? "#2d3748" : "#d8d0c4",
        ]}
        position={[0, 0.02, 0]}
      />

      <Placeables items={draft.placeables} />

      {draft.placeables.map((p) => {
        const [sx, sy, sz] = hitboxSize(p.placeableId, p.scale ?? 1);
        const selected = selectedSet.has(p.id);
        const ringR = Math.max(sx, sz);
        return (
          <PlaceableHitMesh
            key={`hit_${p.id}`}
            id={p.id}
            position={p.position}
            rotationY={p.rotationY}
            size={[sx, sy, sz]}
            ringR={ringR}
            selected={selected}
            onPointerDown={beginSelect}
            onContextMenu={(e) => openCtx("placeable", e)}
          />
        );
      })}

      {draft.spawnPoints.map((sp) => (
        <SpawnGizmo
          key={sp.id}
          id={sp.id}
          position={sp.position}
          rotationY={sp.rotationY}
          selected={selectedSet.has(sp.id)}
          onPointerDown={beginSelect}
          onContextMenu={(e) => openCtx("spawn", e)}
        />
      ))}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        onPointerDown={onFloorPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent.preventDefault();
        }}
      >
        <planeGeometry args={[floorSize * 2, floorSize * 2]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.16}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={4}
        maxDistance={Math.max(40, floorSize * 2.2)}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: -1 as unknown as THREE.MOUSE,
        }}
      />
    </>
  );
}

function PlaceableHitMesh({
  id,
  position,
  rotationY,
  size,
  ringR,
  selected,
  onPointerDown,
  onContextMenu,
}: {
  id: string;
  position: [number, number, number];
  rotationY: number;
  size: [number, number, number];
  ringR: number;
  selected: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onContextMenu: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const [sx, sy, sz] = size;
  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      userData={{ editorTargetId: id }}
    >
      <mesh
        position={[0, sy / 2, 0]}
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={onContextMenu}
      >
        <boxGeometry args={[sx, sy, sz]} />
        <meshBasicMaterial
          transparent
          opacity={selected ? 0.2 : 0}
          color={selected ? "#4A7566" : "#000"}
          depthWrite={false}
        />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[ringR * 0.55, ringR * 0.72, 40]} />
          <meshBasicMaterial color="#4A7566" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}

function SpawnGizmo({
  id,
  position,
  rotationY,
  selected,
  onPointerDown,
  onContextMenu,
}: {
  id: string;
  position: [number, number, number];
  rotationY: number;
  selected: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onContextMenu: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const tint = selected ? "#5BA8BC" : "#E8A87C";
  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      userData={{ editorTargetId: id }}
    >
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={onContextMenu}
      >
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial
          color={tint}
          transparent
          opacity={selected ? 0.45 : 0.28}
          depthWrite={false}
          roughness={0.9}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[0.48, 0.58, 40]} />
        <meshBasicMaterial
          color={tint}
          transparent
          opacity={selected ? 0.7 : 0.4}
          depthWrite={false}
        />
      </mesh>
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.55, 0]}>
          <capsuleGeometry args={[0.14, 0.35, 6, 12]} />
          <meshStandardMaterial
            color={tint}
            transparent
            opacity={selected ? 0.55 : 0.38}
            depthWrite={false}
            roughness={0.7}
          />
        </mesh>
        <mesh position={[0, 1.0, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial
            color={tint}
            transparent
            opacity={selected ? 0.55 : 0.38}
            depthWrite={false}
            roughness={0.7}
          />
        </mesh>
        <mesh position={[0, 0.04, 0.38]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.1, 3]} />
          <meshBasicMaterial
            color={tint}
            transparent
            opacity={selected ? 0.75 : 0.5}
            depthWrite={false}
          />
        </mesh>
      </group>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.62, 0.72, 40]} />
          <meshBasicMaterial color="#4A90A4" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
