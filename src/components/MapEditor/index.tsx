import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useTranslation } from "react-i18next";
import type { ArenaMapDefinition, MapSpawnPoint } from "@/lib/maps/schema";
import {
  FLOOR_SIZE_MAX,
  FLOOR_SIZE_MIN,
  FLOOR_SURFACE_IDS,
  FLOOR_STYLES,
  applyFloorSurface,
  cellsForFloorSize,
  clampFloorSize,
  cloneMap,
  exportMapJson,
  type FloorSurfaceId,
  type FloorStyle,
} from "@/lib/maps";
import { resolveMapDefinition } from "@/lib/maps/runtime";
import {
  idsFromIntersections,
  pickStackedId,
} from "@/lib/three/pickAgents";
import {
  ASSET_CATEGORIES,
  ASSET_PACKS,
  PLACEABLE_SPECS,
  listPlaceables,
  placeableCanWander,
  placeableCanAnimate,
  type AssetCategory,
  type PlaceableId,
} from "@/lib/assets/catalog";
import type { PlaceableInstance } from "@/lib/types";
import { ArenaFloor } from "@/components/scene/OfficeFloor";
import { Placeables } from "@/components/scene/Placeables";
import { MapZones } from "@/components/scene/MapZones";
import { NightGlow, NightSky } from "@/components/scene/NightSky";
import { AssetPreview } from "@/components/MapEditor/AssetPreview";
import { ColorField } from "@/components/ui/ColorField";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { DayNightSwitch } from "@/components/ui/DayNightSwitch";
import {
  EditorContextMenu,
  type ContextMenuState,
} from "@/components/MapEditor/EditorContextMenu";
import { useMapHistory } from "@/components/MapEditor/useMapHistory";
import { disposeThumbRenderer } from "@/components/MapEditor/thumbnailCache";
import { CANVAS_SHADOWS, onCanvasCreated } from "@/lib/three/canvasConfig";
import { lerpSceneLighting } from "@/lib/dayNight";
import { AMBIENCE_IDS, type AmbienceId } from "@/lib/maps/ambience";
import { useArenaStore } from "@/store/arenaStore";
import { uid } from "@/lib/storage";

type EditorTool = "select" | "spawn";
type LibraryScope = "all" | "favorites" | "used";
type SnapMode = "off" | "0.5" | "1";

const DRAG_THRESHOLD = 4;

function snapCoord(v: number, step: number): number {
  if (step <= 0) return v;
  return Math.round(v / step) * step;
}

function clampToFloor(
  x: number,
  z: number,
  floorSize: number,
  snapStep = 0,
): [number, number, number] {
  // Playable grid is size×size; keep a tiny inset from the tile edge
  const half = floorSize / 2 - 0.05;
  let sx = Math.max(-half, Math.min(half, x));
  let sz = Math.max(-half, Math.min(half, z));
  if (snapStep > 0) {
    sx = Math.max(-half, Math.min(half, snapCoord(sx, snapStep)));
    sz = Math.max(-half, Math.min(half, snapCoord(sz, snapStep)));
  }
  return [sx, 0, sz];
}

function hitFloor(
  event: ThreeEvent<PointerEvent>,
  floorSize: number,
  snapStep = 0,
): [number, number, number] | null {
  return clampToFloor(event.point.x, event.point.z, floorSize, snapStep);
}

/** Map a DOM pointer (e.g. library drag-drop) onto the y=0 floor plane. */
function screenToFloor(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  floorSize: number,
  snapStep = 0,
): [number, number, number] | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  return clampToFloor(hit.x, hit.z, floorSize, snapStep);
}

function footprintSize(placeableId: string): [number, number, number] {
  const spec = PLACEABLE_SPECS[placeableId as PlaceableId];
  if (!spec) return [1.2, 1.2, 1.2];
  const [w, d] = spec.footprint;
  return [Math.max(0.8, w * 1.15), 1.4, Math.max(0.8, d * 1.15)];
}

/** Hit volume for picking — respects visual scale but never shrinks below a clickable size. */
function hitboxSize(
  placeableId: string,
  scale = 1,
): [number, number, number] {
  const [sx, sy, sz] = footprintSize(placeableId);
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const MIN_XZ = 0.6;
  const MIN_Y = 0.75;
  return [
    Math.max(MIN_XZ, sx * s),
    Math.max(MIN_Y, sy * s),
    Math.max(MIN_XZ, sz * s),
  ];
}

/** Rotate (x,z) around (cx,cz) by delta radians (Three.js +Y). */
function rotateXZAround(
  x: number,
  z: number,
  cx: number,
  cz: number,
  delta: number,
): [number, number] {
  const dx = x - cx;
  const dz = z - cz;
  const c = Math.cos(delta);
  const s = Math.sin(delta);
  return [cx + dx * c + dz * s, cz - dx * s + dz * c];
}

function wrapAngle(rad: number): number {
  return ((rad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function EditorWorld({
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
          <group
            key={`hit_${p.id}`}
            position={p.position}
            rotation={[0, p.rotationY, 0]}
            userData={{ editorTargetId: p.id }}
          >
            <mesh
              position={[0, sy / 2, 0]}
              onPointerDown={beginSelect}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => openCtx("placeable", e)}
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
      })}

      {draft.spawnPoints.map((sp) => {
        const selected = selectedSet.has(sp.id);
        const tint = selected ? "#5BA8BC" : "#E8A87C";
        return (
          <group
            key={sp.id}
            position={sp.position}
            rotation={[0, sp.rotationY, 0]}
            userData={{ editorTargetId: sp.id }}
          >
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.03, 0]}
              onPointerDown={beginSelect}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => openCtx("spawn", e)}
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
      })}

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

export function MapEditor() {
  const { t } = useTranslation();
  const open = useArenaStore((s) => s.mapEditorOpen);
  const sourceId = useArenaStore((s) => s.mapEditorSourceId);
  const dayNight = useArenaStore((s) => s.dayNight);
  const toggleDayNight = useArenaStore((s) => s.toggleDayNight);
  const closeMapEditor = useArenaStore((s) => s.closeMapEditor);
  const saveMapFromEditor = useArenaStore((s) => s.saveMapFromEditor);
  const showToast = useArenaStore((s) => s.showToast);

  const {
    draft,
    commit,
    setLive,
    reset,
    undo,
    redo,
    beginGesture,
    endGesture,
    canUndo,
    canRedo,
  } = useMapHistory(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<EditorTool>("select");
  const [category, setCategory] = useState<AssetCategory | "all">("all");
  const [packFilter, setPackFilter] = useState<string>("all");
  const [libraryScope, setLibraryScope] = useState<LibraryScope>("all");
  const [snapMode, setSnapMode] = useState<SnapMode>("0.5");
  const [assetQuery, setAssetQuery] = useState("");
  const [paintId, setPaintId] = useState<PlaceableId | null>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const favoriteAssets = useArenaStore((s) => s.favoriteAssets ?? []);
  const toggleFavoriteAsset = useArenaStore((s) => s.toggleFavoriteAsset);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewportApi = useRef<{
    camera: THREE.Camera;
    gl: THREE.WebGLRenderer;
  } | null>(null);

  useEffect(() => {
    if (!open || !sourceId) {
      reset(null);
      return;
    }
    // Read customs from the store at load time only — do NOT depend on
    // `customMaps` or every upsert/import while editing will wipe the draft
    // (and unknown custom ids fall back to office).
    const customs = useArenaStore.getState().customMaps;
    const def = resolveMapDefinition(sourceId, customs);
    if (def.id !== sourceId) {
      showToast(t("mapEditor.loadError"));
      closeMapEditor();
      return;
    }
    reset(cloneMap(def));
    setSelectedIds([]);
    setPaintId(null);
    setTool("select");
    setCtxMenu(null);
  }, [open, sourceId, reset, closeMapEditor, showToast, t]);

  // Always export/save the latest draft (avoids stale closures).
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!open) {
      disposeThumbRenderer();
    }
    return () => {
      disposeThumbRenderer();
    };
  }, [open]);

  const rotateTargets = useCallback(
    (ids: string[], delta = Math.PI / 2) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      commit((d) => {
        const selectedPlaceables = d.placeables.filter((p) => idSet.has(p.id));

        // Multi placeable selection: orbit as one rigid group around centroid
        const groupRotate = selectedPlaceables.length > 1;
        let cx = 0;
        let cz = 0;
        if (groupRotate) {
          for (const p of selectedPlaceables) {
            cx += p.position[0];
            cz += p.position[2];
          }
          cx /= selectedPlaceables.length;
          cz /= selectedPlaceables.length;
        }

        return {
          ...d,
          placeables: d.placeables.map((p) => {
            if (!idSet.has(p.id)) return p;
            const rotationY = wrapAngle(p.rotationY + delta);
            if (!groupRotate) return { ...p, rotationY };
            const [x, z] = rotateXZAround(
              p.position[0],
              p.position[2],
              cx,
              cz,
              delta,
            );
            const [nx, , nz] = clampToFloor(
              x,
              z,
              d.floor.size,
              snapMode === "off" ? 0 : Number(snapMode),
            );
            return {
              ...p,
              rotationY,
              position: [nx, p.position[1], nz] as [number, number, number],
            };
          }),
          spawnPoints: d.spawnPoints.map((s) => {
            if (!idSet.has(s.id)) return s;
            return { ...s, rotationY: wrapAngle(s.rotationY + delta) };
          }),
        };
      });
    },
    [commit, snapMode],
  );

  const deleteTargets = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      commit((d) => ({
        ...d,
        placeables: d.placeables.filter((p) => !idSet.has(p.id)),
        spawnPoints: d.spawnPoints.filter((s) => !idSet.has(s.id)),
      }));
      setSelectedIds((cur) => cur.filter((id) => !idSet.has(id)));
    },
    [commit],
  );

  const scaleTargets = useCallback(
    (ids: string[], factor: number) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      commit((d) => ({
        ...d,
        placeables: d.placeables.map((p) => {
          if (!idSet.has(p.id)) return p;
          const next = Math.min(3, Math.max(0.25, (p.scale ?? 1) * factor));
          return { ...p, scale: Math.round(next * 100) / 100 };
        }),
      }));
    },
    [commit],
  );

  const duplicateTargets = useCallback(
    (ids: string[]) => {
      if (!draft || ids.length === 0) return;
      const idSet = new Set(ids);
      const copies: PlaceableInstance[] = draft.placeables
        .filter((p) => idSet.has(p.id))
        .map((src) => {
          const position: [number, number, number] = [
            src.position[0] + 0.6,
            src.position[1],
            src.position[2] + 0.6,
          ];
          return {
            ...src,
            id: uid("prop"),
            position,
            homePosition: src.behavior === "wander" ? position : src.homePosition,
            target: undefined,
            locomotion: src.behavior === "wander" ? ("idle" as const) : undefined,
          };
        });
      if (copies.length === 0) return;
      commit((d) => ({ ...d, placeables: [...d.placeables, ...copies] }));
      setSelectedIds(copies.map((c) => c.id));
    },
    [commit, draft],
  );

  const rotateSelected = useCallback(
    (delta = Math.PI / 2) => {
      rotateTargets(selectedIds, delta);
    },
    [selectedIds, rotateTargets],
  );

  const deleteSelected = useCallback(() => {
    deleteTargets(selectedIds);
  }, [selectedIds, deleteTargets]);

  const selectInEditor = useCallback(
    (id: string | null, opts?: { additive?: boolean }) => {
      if (id == null) {
        setSelectedIds([]);
        setCtxMenu(null);
        return;
      }
      if (!draft) {
        setSelectedIds([id]);
        return;
      }
      const isSpawn = draft.spawnPoints.some((s) => s.id === id);
      if (opts?.additive && !isSpawn) {
        setSelectedIds((cur) => {
          const placeableOnly = cur.filter((x) =>
            draft.placeables.some((p) => p.id === x),
          );
          return placeableOnly.includes(id)
            ? placeableOnly.filter((x) => x !== id)
            : [...placeableOnly, id];
        });
      } else {
        setSelectedIds([id]);
      }
    },
    [draft],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!draft) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        setCtxMenu(null);
        return;
      }
      if (
        mod &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        setCtxMenu(null);
        return;
      }

      if (e.key === "Escape") {
        setSelectedIds([]);
        setPaintId(null);
        setCtxMenu(null);
        return;
      }
      if ((e.key === "r" || e.key === "R") && selectedIds.length) {
        e.preventDefault();
        rotateSelected();
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length
      ) {
        e.preventDefault();
        deleteSelected();
      }
      if ((e.key === "d" || e.key === "D") && mod && selectedIds.length) {
        e.preventDefault();
        duplicateTargets(selectedIds);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    open,
    draft,
    selectedIds,
    rotateSelected,
    deleteSelected,
    undo,
    redo,
    duplicateTargets,
  ]);

  const snapStep = snapMode === "off" ? 0 : Number(snapMode);

  const usedPlaceableIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of draft?.placeables ?? []) set.add(p.placeableId);
    return set;
  }, [draft?.placeables]);

  const libraryGroups = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    const fav = new Set(favoriteAssets);
    const cats =
      category === "all" ? ASSET_CATEGORIES : ([category] as AssetCategory[]);
    return cats
      .map((cat) => {
        const ids = listPlaceables(cat).filter((id) => {
          const spec = PLACEABLE_SPECS[id];
          if (packFilter !== "all" && spec?.pack !== packFilter) return false;
          if (libraryScope === "favorites" && !fav.has(id)) return false;
          if (libraryScope === "used" && !usedPlaceableIds.has(id)) return false;
          if (!q) return true;
          const label = (spec?.label ?? "").toLowerCase();
          return label.includes(q) || id.toLowerCase().includes(q);
        });
        return { category: cat, ids };
      })
      .filter((g) => g.ids.length > 0);
  }, [
    category,
    assetQuery,
    packFilter,
    libraryScope,
    favoriteAssets,
    usedPlaceableIds,
  ]);

  const libraryMatchCount = useMemo(
    () => libraryGroups.reduce((n, g) => n + g.ids.length, 0),
    [libraryGroups],
  );

  const selectedPlaceables = useMemo(
    () => draft?.placeables.filter((p) => selectedIds.includes(p.id)) ?? [],
    [draft, selectedIds],
  );
  const multiPlaceable = selectedPlaceables.length > 1;
  const selectedPlaceable =
    selectedPlaceables.length === 1 ? selectedPlaceables[0] : null;
  const selectedSpawn =
    selectedIds.length === 1
      ? draft?.spawnPoints.find((s) => s.id === selectedIds[0])
      : undefined;

  const alignSelection = useCallback(
    (axis: "x" | "z") => {
      if (!draft || selectedPlaceables.length < 2) return;
      const vals = selectedPlaceables.map((p) =>
        axis === "x" ? p.position[0] : p.position[2],
      );
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const snapped = snapStep > 0 ? snapCoord(avg, snapStep) : avg;
      commit((d) => ({
        ...d,
        placeables: d.placeables.map((p) => {
          if (!selectedIds.includes(p.id)) return p;
          const position: [number, number, number] =
            axis === "x"
              ? [snapped, p.position[1], p.position[2]]
              : [p.position[0], p.position[1], snapped];
          return { ...p, position };
        }),
      }));
    },
    [draft, selectedPlaceables, selectedIds, snapStep, commit],
  );

  const distributeSelection = useCallback(
    (axis: "x" | "z") => {
      if (!draft || selectedPlaceables.length < 3) return;
      const sorted = [...selectedPlaceables].sort((a, b) =>
        axis === "x"
          ? a.position[0] - b.position[0]
          : a.position[2] - b.position[2],
      );
      const first = axis === "x" ? sorted[0]!.position[0] : sorted[0]!.position[2];
      const last =
        axis === "x"
          ? sorted[sorted.length - 1]!.position[0]
          : sorted[sorted.length - 1]!.position[2];
      const step = (last - first) / (sorted.length - 1);
      const byId = new Map<string, number>();
      sorted.forEach((p, i) => byId.set(p.id, first + step * i));
      commit((d) => ({
        ...d,
        placeables: d.placeables.map((p) => {
          const v = byId.get(p.id);
          if (v == null) return p;
          const position: [number, number, number] =
            axis === "x"
              ? [v, p.position[1], p.position[2]]
              : [p.position[0], p.position[1], v];
          return { ...p, position };
        }),
      }));
    },
    [draft, selectedPlaceables, commit],
  );

  const updateFloor = useCallback(
    (patch: Partial<ArenaMapDefinition["floor"]>) => {
      commit((d) => {
        let floor = { ...d.floor, ...patch };
        if (patch.size != null) floor.size = clampFloorSize(patch.size);
        if (patch.surface) {
          floor = {
            ...floor,
            ...applyFloorSurface(floor.size, patch.surface),
          };
        } else {
          // Keep cells in sync with size for export / inspector
          floor.cells = cellsForFloorSize(floor.size, floor.surface);
        }
        const themeFloor = patch.color ?? (patch.surface ? floor.color : d.theme.floor);
        return {
          ...d,
          floor,
          theme: { ...d.theme, floor: themeFloor },
        };
      });
    },
    [commit],
  );

  const patchSelectedPlaceableLive = useCallback(
    (patch: Partial<PlaceableInstance>) => {
      if (!selectedPlaceable) return;
      setLive((d) => ({
        ...d,
        placeables: d.placeables.map((p) =>
          p.id === selectedPlaceable.id ? { ...p, ...patch } : p,
        ),
      }));
    },
    [selectedPlaceable, setLive],
  );

  const movePlaceableLive = useCallback(
    (id: string, pos: [number, number, number], preserveY = false) => {
      setLive((d) => {
        if (d.spawnPoints.some((s) => s.id === id)) {
          return {
            ...d,
            spawnPoints: d.spawnPoints.map((s) => {
              if (s.id !== id) return s;
              const position: [number, number, number] = preserveY
                ? [pos[0], s.position[1], pos[2]]
                : pos;
              return { ...s, position };
            }),
          };
        }
        return {
          ...d,
          placeables: d.placeables.map((p) => {
            if (p.id !== id) return p;
            const position: [number, number, number] = preserveY
              ? [pos[0], p.position[1], pos[2]]
              : pos;
            return { ...p, position };
          }),
        };
      });
    },
    [setLive],
  );

  const moveIdsLive = useCallback(
    (moves: { id: string; position: [number, number, number] }[]) => {
      if (moves.length === 0) return;
      const byId = new Map(moves.map((m) => [m.id, m.position]));
      setLive((d) => ({
        ...d,
        placeables: d.placeables.map((p) => {
          const pos = byId.get(p.id);
          if (!pos) return p;
          return {
            ...p,
            position: pos,
            ...(p.behavior === "wander"
              ? {
                  homePosition: pos,
                  target: undefined,
                  locomotion: "idle" as const,
                }
              : {}),
          };
        }),
        spawnPoints: d.spawnPoints.map((s) => {
          const pos = byId.get(s.id);
          return pos ? { ...s, position: pos } : s;
        }),
      }));
    },
    [setLive],
  );

  const placeAsset = useCallback(
    (placeableId: PlaceableId, pos: [number, number, number]) => {
      const canWander = placeableCanWander(placeableId);
      const canAnimate = placeableCanAnimate(placeableId);
      const item: PlaceableInstance = {
        id: uid("prop"),
        placeableId,
        position: pos,
        rotationY: 0,
        scale: 1,
        ...(canWander
          ? {
              behavior: "wander" as const,
              homePosition: pos,
              moveSpeed: 1.1,
              locomotion: "idle" as const,
            }
          : canAnimate
            ? { behavior: "animated" as const }
            : {}),
      };
      commit((d) => ({ ...d, placeables: [...d.placeables, item] }));
      setSelectedIds([item.id]);
      setPaintId(null);
    },
    [commit],
  );

  const addSpawnAt = useCallback(
    (pos: [number, number, number]) => {
      const sp: MapSpawnPoint = {
        id: uid("spawn"),
        position: pos,
        rotationY: Math.PI,
      };
      commit((d) => ({ ...d, spawnPoints: [...d.spawnPoints, sp] }));
      setSelectedIds([sp.id]);
    },
    [commit],
  );

  const onCanvasDrop = (e: DragEvent) => {
    e.preventDefault();
    const placeableId = e.dataTransfer.getData("text/placeable-id") as PlaceableId;
    if (!placeableId || !PLACEABLE_SPECS[placeableId] || !draft) return;
    const api = viewportApi.current;
    const pos =
      api != null
        ? screenToFloor(
            e.clientX,
            e.clientY,
            api.camera,
            api.gl.domElement,
            draft.floor.size,
            snapStep,
          )
        : null;
    placeAsset(placeableId, pos ?? [0, 0, 0]);
    showToast(t("mapEditor.placed"));
  };

  const onSave = () => {
    const current = draftRef.current;
    if (!current) return;
    const name = current.name.trim() || t("mapEditor.untitled");
    saveMapFromEditor({ ...current, name }, true);
    showToast(t("mapEditor.saved"));
  };

  const onExport = () => {
    const current = draftRef.current;
    if (!current) return;
    const blob = new Blob([exportMapJson(current)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName =
      current.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || current.id;
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const id = useArenaStore.getState().importMapJson(text);
      // Point the editor at the imported map so a later customMaps-driven
      // reload (if any) cannot snap back to the previous source / office.
      useArenaStore.setState({ mapEditorSourceId: id });
      const def = resolveMapDefinition(id, useArenaStore.getState().customMaps);
      reset(cloneMap(def));
      showToast(t("mapEditor.imported"));
    } catch {
      showToast(t("mapEditor.importError"));
    }
  };

  if (!open || !draft) return null;

  const scaleValue = selectedPlaceable?.scale ?? 1;
  const ctxPlaceableIds =
    ctxMenu?.kind === "placeable"
      ? selectedPlaceables.length > 0 &&
        selectedIds.includes(ctxMenu.targetId)
        ? selectedPlaceables.map((p) => p.id)
        : [ctxMenu.targetId]
      : [];
  const ctxOpIds =
    ctxMenu?.kind === "spawn"
      ? [ctxMenu.targetId]
      : ctxPlaceableIds;

  return (
    <div className="map-editor" onContextMenu={(e) => e.preventDefault()}>
      <header className="map-editor__toolbar">
        <div className="map-editor__brand">
          <strong>{t("mapEditor.title")}</strong>
          <span>{draft.name}</span>
          {draft.builtin && (
            <em className="map-editor__badge">{t("mapEditor.builtinHint")}</em>
          )}
        </div>
        <div className="map-editor__toolbar-actions">
          <button
            type="button"
            disabled={!canUndo}
            title={`${t("mapEditor.undo")} (Ctrl/⌘Z)`}
            onClick={() => {
              undo();
              setCtxMenu(null);
            }}
          >
            {t("mapEditor.undo")}
          </button>
          <button
            type="button"
            disabled={!canRedo}
            title={`${t("mapEditor.redo")} (Ctrl/⌘⇧Z)`}
            onClick={() => {
              redo();
              setCtxMenu(null);
            }}
          >
            {t("mapEditor.redo")}
          </button>
          <span className="map-editor__toolbar-sep" />
          <button
            type="button"
            className={tool === "select" ? "is-active" : ""}
            onClick={() => setTool("select")}
          >
            {t("mapEditor.toolSelect")}
          </button>
          <button
            type="button"
            className={tool === "spawn" ? "is-active" : ""}
            onClick={() => {
              setTool("spawn");
              setPaintId(null);
            }}
          >
            {t("mapEditor.toolSpawn")}
          </button>
          <button type="button" onClick={onExport}>
            {t("mapEditor.export")}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            {t("mapEditor.import")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = "";
            }}
          />
          <DayNightSwitch mode={dayNight} onToggle={toggleDayNight} />
          <button type="button" className="map-editor__primary" onClick={onSave}>
            {t("mapEditor.save")}
          </button>
          <button type="button" onClick={closeMapEditor}>
            {t("mapEditor.close")}
          </button>
        </div>
      </header>

      <div className="map-editor__body">
        <aside className="map-editor__library">
          <h3>{t("mapEditor.library")}</h3>
          <label className="map-editor__search">
            <span className="map-editor__sr-only">{t("mapEditor.searchAssets")}</span>
            <input
              type="search"
              value={assetQuery}
              onChange={(e) => setAssetQuery(e.target.value)}
              placeholder={t("mapEditor.searchAssets")}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="map-editor__filter-row">
            <Select
              variant="dark"
              value={snapMode}
              onChange={(v) => setSnapMode(v as SnapMode)}
              options={[
                { value: "off", label: t("mapEditor.snapOff") },
                { value: "0.5", label: t("mapEditor.snap05") },
                { value: "1", label: t("mapEditor.snap1") },
              ]}
            />
            <Select
              variant="dark"
              value={packFilter}
              onChange={setPackFilter}
              options={[
                { value: "all", label: t("mapEditor.packAll") },
                ...ASSET_PACKS.map((p) => ({
                  value: p,
                  label: t(`mapEditor.packs.${p}`, { defaultValue: p }),
                })),
              ]}
            />
          </div>
          <div className="map-editor__cats">
            <button
              type="button"
              className={libraryScope === "all" ? "is-active" : ""}
              onClick={() => setLibraryScope("all")}
            >
              {t("mapEditor.scopeAll")}
            </button>
            <button
              type="button"
              className={libraryScope === "favorites" ? "is-active" : ""}
              onClick={() => setLibraryScope("favorites")}
            >
              {t("mapEditor.scopeFavorites")}
            </button>
            <button
              type="button"
              className={libraryScope === "used" ? "is-active" : ""}
              onClick={() => setLibraryScope("used")}
            >
              {t("mapEditor.scopeUsed")}
            </button>
          </div>
          <div className="map-editor__cats">
            <button
              type="button"
              className={category === "all" ? "is-active" : ""}
              onClick={() => setCategory("all")}
            >
              {t("mapEditor.catAll")}
            </button>
            {ASSET_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={category === c ? "is-active" : ""}
                onClick={() => setCategory(c)}
              >
                {t(`mapEditor.cat.${c}`)}
              </button>
            ))}
          </div>
          <div className="map-editor__asset-groups">
            {libraryGroups.map((group) => (
              <section key={group.category} className="map-editor__asset-group">
                <h4 className="map-editor__asset-group-title">
                  {t(`mapEditor.cat.${group.category}`)}
                  <span>{group.ids.length}</span>
                </h4>
                <div className="map-editor__asset-grid">
                  {group.ids.map((id) => {
                    const spec = PLACEABLE_SPECS[id];
                    const fav = favoriteAssets.includes(id);
                    return (
                      <div
                        key={id}
                        className={
                          "map-editor__asset-wrap" +
                          (paintId === id ? " is-active" : "")
                        }
                      >
                        <button
                          type="button"
                          draggable
                          title={spec.label}
                          className={
                            "map-editor__asset" + (paintId === id ? " is-active" : "")
                          }
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/placeable-id", id);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onClick={() => {
                            setPaintId((prev) => (prev === id ? null : id));
                            setTool("select");
                            setSelectedIds([]);
                            setCtxMenu(null);
                          }}
                        >
                          <AssetPreview placeableId={id} />
                          <span className="map-editor__asset-name">{spec.label}</span>
                        </button>
                        <button
                          type="button"
                          className={
                            "map-editor__fav" + (fav ? " is-on" : "")
                          }
                          title={t("mapEditor.favorite")}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteAsset(id);
                          }}
                        >
                          ★
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            {libraryMatchCount === 0 && (
              <p className="map-editor__hint">{t("mapEditor.searchEmpty")}</p>
            )}
          </div>
          <p className="map-editor__hint">{t("mapEditor.libraryHint")}</p>
        </aside>

        <div
          className="map-editor__viewport"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onCanvasDrop}
        >
          <Canvas
            shadows={CANVAS_SHADOWS}
            dpr={[1, 1.5]}
            camera={{ position: [14, 16, 18], fov: 42, near: 0.1, far: 280 }}
            gl={{ antialias: true, powerPreference: "default" }}
            onCreated={(state) => {
              onCanvasCreated(state);
              viewportApi.current = { camera: state.camera, gl: state.gl };
            }}
            onPointerMissed={() => setCtxMenu(null)}
          >
            <EditorWorld
              draft={draft}
              selectedIds={selectedIds}
              tool={tool}
              paintPlaceableId={paintId}
              onSelect={selectInEditor}
              onMoveIds={moveIdsLive}
              onPlaceAsset={placeAsset}
              onPlaceSpawn={addSpawnAt}
              onDragGestureStart={beginGesture}
              onDragGestureEnd={endGesture}
              onContextMenu={setCtxMenu}
              snapStep={snapStep}
            />
          </Canvas>
          {tool === "spawn" && (
            <div className="map-editor__mode-banner">{t("mapEditor.spawnMode")}</div>
          )}
          {paintId && tool === "select" && (
            <div className="map-editor__mode-banner">
              {t("mapEditor.paintMode", { name: PLACEABLE_SPECS[paintId].label })}
            </div>
          )}
          {multiPlaceable && !paintId && !ctxMenu && (
            <div className="map-editor__mode-banner map-editor__mode-banner--select">
              {t("mapEditor.multiSelectedBanner", {
                count: selectedPlaceables.length,
              })}
            </div>
          )}
          {selectedPlaceable && !paintId && !ctxMenu && (
            <div className="map-editor__mode-banner map-editor__mode-banner--select">
              {t("mapEditor.selectedBanner", {
                name:
                  PLACEABLE_SPECS[selectedPlaceable.placeableId as PlaceableId]
                    ?.label ?? selectedPlaceable.placeableId,
              })}
            </div>
          )}
          {ctxMenu && ctxOpIds.length > 0 && (
            <EditorContextMenu
              menu={ctxMenu}
              onClose={() => setCtxMenu(null)}
              onRotate={(delta) => rotateTargets(ctxOpIds, delta)}
              onScale={(factor) => scaleTargets(ctxOpIds, factor)}
              onDuplicate={() => duplicateTargets(ctxOpIds)}
              onDelete={() => deleteTargets(ctxOpIds)}
            />
          )}
        </div>

        <aside className="map-editor__inspector">
          <h3>{t("mapEditor.inspector")}</h3>

          <label className="map-editor__field">
            <span>{t("mapEditor.mapName")}</span>
            <input
              type="text"
              value={draft.name}
              maxLength={64}
              onFocus={beginGesture}
              onBlur={() => {
                setLive((d) => ({
                  ...d,
                  name: d.name.trim() || t("mapEditor.untitled"),
                }));
                endGesture();
              }}
              onChange={(e) =>
                setLive((d) => ({ ...d, name: e.target.value }))
              }
            />
          </label>

          {(selectedPlaceable || selectedSpawn || multiPlaceable) && (
            <div className="map-editor__divider" />
          )}

          {multiPlaceable ? (
            <div className="map-editor__selection-card">
              <h4>{t("mapEditor.multiSelected", { count: selectedPlaceables.length })}</h4>
              <p className="map-editor__hint" style={{ marginTop: 0 }}>
                {t("mapEditor.multiHint")}
              </p>
              <div className="map-editor__inline-actions">
                <button type="button" onClick={() => rotateSelected(-Math.PI / 2)}>
                  ↺ 90°
                </button>
                <button type="button" onClick={() => rotateSelected(Math.PI / 2)}>
                  ↻ 90°
                </button>
              </div>
              <div className="map-editor__inline-actions">
                <button
                  type="button"
                  onClick={() =>
                    scaleTargets(
                      selectedPlaceables.map((p) => p.id),
                      1.15,
                    )
                  }
                >
                  {t("mapEditor.ctx.scaleUp")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    scaleTargets(
                      selectedPlaceables.map((p) => p.id),
                      1 / 1.15,
                    )
                  }
                >
                  {t("mapEditor.ctx.scaleDown")}
                </button>
              </div>
              <div className="map-editor__inline-actions">
                <button type="button" onClick={() => alignSelection("x")}>
                  {t("mapEditor.alignX")}
                </button>
                <button type="button" onClick={() => alignSelection("z")}>
                  {t("mapEditor.alignZ")}
                </button>
              </div>
              {selectedPlaceables.length >= 3 && (
                <div className="map-editor__inline-actions">
                  <button type="button" onClick={() => distributeSelection("x")}>
                    {t("mapEditor.distributeX")}
                  </button>
                  <button type="button" onClick={() => distributeSelection("z")}>
                    {t("mapEditor.distributeZ")}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  duplicateTargets(selectedPlaceables.map((p) => p.id))
                }
              >
                {t("mapEditor.ctx.duplicate")}
              </button>
              <button
                type="button"
                className="map-editor__danger"
                onClick={deleteSelected}
              >
                {t("mapEditor.deleteSelected", {
                  count: selectedPlaceables.length,
                })}
              </button>
            </div>
          ) : selectedPlaceable ? (
            <div className="map-editor__selection-card">
              <div className="map-editor__selection-preview">
                <AssetPreview
                  placeableId={selectedPlaceable.placeableId as PlaceableId}
                />
              </div>
              <h4>
                {PLACEABLE_SPECS[selectedPlaceable.placeableId as PlaceableId]?.label ??
                  selectedPlaceable.placeableId}
              </h4>

              {placeableCanWander(selectedPlaceable.placeableId) && (
                <>
                  <label className="map-editor__field">
                    <span>{t("mapEditor.behavior")}</span>
                    <Select
                      variant="dark"
                      value={selectedPlaceable.behavior ?? "static"}
                      onChange={(v) => {
                        const behavior = v as "static" | "wander";
                        commit((d) => ({
                          ...d,
                          placeables: d.placeables.map((p) => {
                            if (p.id !== selectedPlaceable.id) return p;
                            if (behavior === "wander") {
                              return {
                                ...p,
                                behavior,
                                homePosition: [...p.position] as [
                                  number,
                                  number,
                                  number,
                                ],
                                moveSpeed: p.moveSpeed ?? 1.1,
                                wanderRadius: p.wanderRadius ?? 3.4,
                                target: undefined,
                                locomotion: "idle",
                              };
                            }
                            return {
                              ...p,
                              behavior: "static",
                              target: undefined,
                              locomotion: undefined,
                            };
                          }),
                        }));
                      }}
                      options={[
                        { value: "static", label: t("mapEditor.behaviorStatic") },
                        { value: "wander", label: t("mapEditor.behaviorWander") },
                      ]}
                    />
                  </label>
                  {(selectedPlaceable.behavior ?? "static") === "wander" && (
                    <>
                      <label className="map-editor__field">
                        <span>
                          {t("mapEditor.wanderRadius")}:{" "}
                          {(selectedPlaceable.wanderRadius ?? 3.4).toFixed(1)}m
                        </span>
                        <Slider
                          variant="dark"
                          min={1}
                          max={10}
                          step={0.5}
                          value={selectedPlaceable.wanderRadius ?? 3.4}
                          onPointerDown={beginGesture}
                          onPointerUp={endGesture}
                          onChange={(v) =>
                            patchSelectedPlaceableLive({
                              wanderRadius: v,
                            })
                          }
                        />
                      </label>
                      <label className="map-editor__field">
                        <span>
                          {t("mapEditor.moveSpeed")}:{" "}
                          {(selectedPlaceable.moveSpeed ?? 1.1).toFixed(1)}
                        </span>
                        <Slider
                          variant="dark"
                          min={0.4}
                          max={2.5}
                          step={0.1}
                          value={selectedPlaceable.moveSpeed ?? 1.1}
                          onPointerDown={beginGesture}
                          onPointerUp={endGesture}
                          onChange={(v) =>
                            patchSelectedPlaceableLive({
                              moveSpeed: v,
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                </>
              )}

              {placeableCanAnimate(selectedPlaceable.placeableId) && (
                <label className="map-editor__field">
                  <span>{t("mapEditor.behavior")}</span>
                  <Select
                    variant="dark"
                    value={
                      selectedPlaceable.behavior === "static"
                        ? "static"
                        : "animated"
                    }
                    onChange={(v) => {
                      const behavior = v as "static" | "animated";
                      commit((d) => ({
                        ...d,
                        placeables: d.placeables.map((p) =>
                          p.id === selectedPlaceable.id
                            ? { ...p, behavior }
                            : p,
                        ),
                      }));
                    }}
                    options={[
                      { value: "static", label: t("mapEditor.behaviorStatic") },
                      {
                        value: "animated",
                        label: t("mapEditor.behaviorAnimated"),
                      },
                    ]}
                  />
                </label>
              )}

              <label className="map-editor__field">
                <span>X</span>
                <input
                  type="number"
                  step={0.1}
                  value={Number(selectedPlaceable.position[0].toFixed(2))}
                  onFocus={beginGesture}
                  onBlur={endGesture}
                  onChange={(e) =>
                    movePlaceableLive(selectedPlaceable.id, [
                      Number(e.target.value),
                      selectedPlaceable.position[1],
                      selectedPlaceable.position[2],
                    ])
                  }
                />
              </label>
              <label className="map-editor__field">
                <span>Y ({t("mapEditor.axisUp")})</span>
                <input
                  type="number"
                  step={0.05}
                  value={Number(selectedPlaceable.position[1].toFixed(2))}
                  onFocus={beginGesture}
                  onBlur={endGesture}
                  onChange={(e) =>
                    movePlaceableLive(selectedPlaceable.id, [
                      selectedPlaceable.position[0],
                      Number(e.target.value),
                      selectedPlaceable.position[2],
                    ])
                  }
                />
              </label>
              <label className="map-editor__field">
                <span>
                  Y ({t("mapEditor.axisUp")}):{" "}
                  {selectedPlaceable.position[1].toFixed(2)}
                </span>
                <Slider
                  variant="dark"
                  min={-0.5}
                  max={4}
                  step={0.05}
                  value={selectedPlaceable.position[1]}
                  onPointerDown={beginGesture}
                  onPointerUp={endGesture}
                  onChange={(v) =>
                    movePlaceableLive(selectedPlaceable.id, [
                      selectedPlaceable.position[0],
                      v,
                      selectedPlaceable.position[2],
                    ])
                  }
                />
              </label>
              <label className="map-editor__field">
                <span>Z</span>
                <input
                  type="number"
                  step={0.1}
                  value={Number(selectedPlaceable.position[2].toFixed(2))}
                  onFocus={beginGesture}
                  onBlur={endGesture}
                  onChange={(e) =>
                    movePlaceableLive(selectedPlaceable.id, [
                      selectedPlaceable.position[0],
                      selectedPlaceable.position[1],
                      Number(e.target.value),
                    ])
                  }
                />
              </label>
              <label className="map-editor__field">
                <span>
                  {t("mapEditor.rotation")}:{" "}
                  {Math.round((selectedPlaceable.rotationY * 180) / Math.PI)}°
                </span>
                <Slider
                  variant="dark"
                  min={0}
                  max={Math.PI * 2}
                  step={0.01}
                  value={selectedPlaceable.rotationY}
                  onPointerDown={beginGesture}
                  onPointerUp={endGesture}
                  onChange={(v) =>
                    patchSelectedPlaceableLive({
                      rotationY: v,
                    })
                  }
                />
              </label>
              <div className="map-editor__inline-actions">
                <button type="button" onClick={() => rotateSelected(-Math.PI / 2)}>
                  ↺ 90°
                </button>
                <button type="button" onClick={() => rotateSelected(Math.PI / 2)}>
                  ↻ 90°
                </button>
              </div>
              <label className="map-editor__field">
                <span>
                  {t("mapEditor.scale")}: {scaleValue.toFixed(2)}×
                </span>
                <Slider
                  variant="dark"
                  min={0.25}
                  max={3}
                  step={0.05}
                  value={scaleValue}
                  onPointerDown={beginGesture}
                  onPointerUp={endGesture}
                  onChange={(v) =>
                    patchSelectedPlaceableLive({ scale: v })
                  }
                />
              </label>
              <button
                type="button"
                className="map-editor__danger"
                onClick={deleteSelected}
              >
                {t("mapEditor.deleteObject")}
              </button>
            </div>
          ) : selectedSpawn ? (
            <div className="map-editor__selection-card">
              <h4>{t("mapEditor.spawnPoint")}</h4>
              <label className="map-editor__field">
                <span>X</span>
                <input
                  type="number"
                  step={0.1}
                  value={Number(selectedSpawn.position[0].toFixed(2))}
                  onFocus={beginGesture}
                  onBlur={endGesture}
                  onChange={(e) =>
                    movePlaceableLive(selectedSpawn.id, [
                      Number(e.target.value),
                      selectedSpawn.position[1],
                      selectedSpawn.position[2],
                    ])
                  }
                />
              </label>
              <label className="map-editor__field">
                <span>Y ({t("mapEditor.axisUp")})</span>
                <input
                  type="number"
                  step={0.05}
                  value={Number(selectedSpawn.position[1].toFixed(2))}
                  onFocus={beginGesture}
                  onBlur={endGesture}
                  onChange={(e) =>
                    movePlaceableLive(selectedSpawn.id, [
                      selectedSpawn.position[0],
                      Number(e.target.value),
                      selectedSpawn.position[2],
                    ])
                  }
                />
              </label>
              <label className="map-editor__field">
                <span>Z</span>
                <input
                  type="number"
                  step={0.1}
                  value={Number(selectedSpawn.position[2].toFixed(2))}
                  onFocus={beginGesture}
                  onBlur={endGesture}
                  onChange={(e) =>
                    movePlaceableLive(selectedSpawn.id, [
                      selectedSpawn.position[0],
                      selectedSpawn.position[1],
                      Number(e.target.value),
                    ])
                  }
                />
              </label>
              <div className="map-editor__inline-actions">
                <button type="button" onClick={() => rotateSelected(-Math.PI / 2)}>
                  ↺ 90°
                </button>
                <button type="button" onClick={() => rotateSelected(Math.PI / 2)}>
                  ↻ 90°
                </button>
              </div>
              <button
                type="button"
                className="map-editor__danger"
                onClick={deleteSelected}
              >
                {t("mapEditor.deleteSpawn")}
              </button>
            </div>
          ) : (
            <>
              <label className="map-editor__field">
                <span>{t("mapEditor.description")}</span>
                <textarea
                  rows={2}
                  value={draft.description ?? ""}
                  onFocus={beginGesture}
                  onBlur={endGesture}
                  onChange={(e) =>
                    setLive((d) => ({ ...d, description: e.target.value }))
                  }
                />
              </label>

              <label className="map-editor__field">
                <span>
                  {t("mapEditor.floorSize")}: {draft.floor.size}m ·{" "}
                  {cellsForFloorSize(draft.floor.size, draft.floor.surface)}×
                  {cellsForFloorSize(draft.floor.size, draft.floor.surface)}
                </span>
                <Slider
                  variant="dark"
                  min={FLOOR_SIZE_MIN}
                  max={FLOOR_SIZE_MAX}
                  step={1}
                  value={draft.floor.size}
                  onPointerDown={beginGesture}
                  onPointerUp={endGesture}
                  onChange={(v) => {
                    const size = clampFloorSize(v);
                    setLive((d) => ({
                      ...d,
                      floor: {
                        ...d.floor,
                        size,
                        cells: cellsForFloorSize(size, d.floor.surface),
                      },
                    }));
                  }}
                />
              </label>

              <label className="map-editor__field">
                <span>{t("mapEditor.floorSurface")}</span>
                <Select
                  variant="dark"
                  value={draft.floor.surface ?? "office"}
                  onChange={(v) => updateFloor({ surface: v as FloorSurfaceId })}
                  options={FLOOR_SURFACE_IDS.map((id) => ({
                    value: id,
                    label: t(`mapEditor.surfaces.${id}`),
                  }))}
                />
              </label>

              <div className="map-editor__surface-swatches">
                {FLOOR_SURFACE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    title={t(`mapEditor.surfaces.${id}`)}
                    className={
                      "map-editor__surface-swatch" +
                      ((draft.floor.surface ?? "office") === id ? " is-active" : "")
                    }
                    style={{
                      background:
                        id === "grass"
                          ? "linear-gradient(135deg,#6B9B4A,#5A8A3C)"
                          : id === "dirt"
                            ? "linear-gradient(135deg,#8B6A4A,#7A5A3C)"
                            : id === "concrete"
                              ? "linear-gradient(135deg,#A8A9AB,#96989A)"
                              : id === "factory"
                                ? "linear-gradient(135deg,#3A3D42,#2E3136)"
                                : "linear-gradient(135deg,#D2C9BB,#C4B8A6)",
                    }}
                    onClick={() => updateFloor({ surface: id })}
                  />
                ))}
              </div>

              <label className="map-editor__field">
                <span>{t("mapEditor.floorStyle")}</span>
                <Select
                  variant="dark"
                  value={draft.floor.style}
                  onChange={(v) => updateFloor({ style: v as FloorStyle })}
                  options={FLOOR_STYLES.map((style) => ({
                    value: style,
                    label: t(`mapEditor.styles.${style}`),
                  }))}
                />
              </label>

              <label className="map-editor__field">
                <span>{t("mapEditor.floorColor")}</span>
                <ColorField
                  variant="dark"
                  value={draft.floor.color}
                  onChange={(v) => updateFloor({ color: v })}
                />
              </label>

              <label className="map-editor__field">
                <span>{t("mapEditor.bgColor")}</span>
                <ColorField
                  variant="dark"
                  value={draft.theme.background}
                  onChange={(v) =>
                    commit({
                      ...draft,
                      theme: {
                        ...draft.theme,
                        background: v,
                        fog: v,
                      },
                    })
                  }
                />
              </label>

              <label className="map-editor__field">
                <span>{t("mapEditor.themeFog")}</span>
                <ColorField
                  variant="dark"
                  value={draft.theme.fog}
                  onChange={(v) =>
                    commit({
                      ...draft,
                      theme: { ...draft.theme, fog: v },
                    })
                  }
                />
              </label>

              <label className="map-editor__field">
                <span>{t("mapEditor.themeAmbient")}</span>
                <ColorField
                  variant="dark"
                  value={draft.theme.ambient}
                  onChange={(v) =>
                    commit({
                      ...draft,
                      theme: { ...draft.theme, ambient: v },
                    })
                  }
                />
              </label>

              <label className="map-editor__field">
                <span>{t("mapEditor.themeHemiSky")}</span>
                <ColorField
                  variant="dark"
                  value={draft.theme.hemiSky}
                  onChange={(v) =>
                    commit({
                      ...draft,
                      theme: { ...draft.theme, hemiSky: v },
                    })
                  }
                />
              </label>

              <label className="map-editor__field">
                <span>{t("mapEditor.themeHemiGround")}</span>
                <ColorField
                  variant="dark"
                  value={draft.theme.hemiGround}
                  onChange={(v) =>
                    commit({
                      ...draft,
                      theme: { ...draft.theme, hemiGround: v },
                    })
                  }
                />
              </label>

              <label className="map-editor__field">
                <span>{t("mapEditor.themeSun")}</span>
                <ColorField
                  variant="dark"
                  value={draft.theme.sun}
                  onChange={(v) =>
                    commit({
                      ...draft,
                      theme: { ...draft.theme, sun: v },
                    })
                  }
                />
              </label>

              <label className="map-editor__field">
                <span>{t("mapEditor.themeAccent")}</span>
                <ColorField
                  variant="dark"
                  value={draft.theme.accent}
                  onChange={(v) =>
                    commit({
                      ...draft,
                      theme: { ...draft.theme, accent: v },
                    })
                  }
                />
              </label>

              <label className="map-editor__field">
                <span>{t("mapEditor.ambience")}</span>
                <Select
                  variant="dark"
                  value={draft.ambience ?? "none"}
                  onChange={(v) =>
                    commit({
                      ...draft,
                      ambience: v as AmbienceId,
                    })
                  }
                  options={AMBIENCE_IDS.map((id) => ({
                    value: id,
                    label: t(`mapEditor.ambienceIds.${id}`),
                  }))}
                />
              </label>

              <p className="map-editor__hint">{t("mapEditor.selectHint")}</p>
            </>
          )}

          <p className="map-editor__hint">{t("mapEditor.hotkeys")}</p>
        </aside>
      </div>
    </div>
  );
}
