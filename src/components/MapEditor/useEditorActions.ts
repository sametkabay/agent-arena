import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { ArenaMapDefinition, MapSpawnPoint } from "@/lib/maps/schema";
import {
  applyFloorSurface,
  cellsForFloorSize,
  clampFloorSize,
} from "@/lib/maps";
import {
  placeableCanAnimate,
  placeableCanWander,
  type PlaceableId,
} from "@/lib/assets/catalog";
import type { PlaceableInstance } from "@/lib/types";
import { uid } from "@/lib/storage";
import type { ContextMenuState } from "@/components/MapEditor/EditorContextMenu";
import { clampToFloor, rotateXZAround, snapCoord, wrapAngle } from "@/components/MapEditor/geometry";
import type { SnapMode } from "@/components/MapEditor/types";
import type { MapDraftUpdater } from "@/components/MapEditor/useMapHistory";

type UseEditorActionsArgs = {
  draft: ArenaMapDefinition | null;
  commit: (updater: MapDraftUpdater) => void;
  setLive: (updater: MapDraftUpdater) => void;
  snapMode: SnapMode;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPaintId: Dispatch<SetStateAction<PlaceableId | null>>;
  setCtxMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
};

export function useEditorActions({
  draft,
  commit,
  setLive,
  snapMode,
  selectedIds,
  setSelectedIds,
  setPaintId,
  setCtxMenu,
}: UseEditorActionsArgs) {
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
    [commit, setSelectedIds],
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
    [commit, draft, setSelectedIds],
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
    [draft, setSelectedIds, setCtxMenu],
  );

  const alignSelection = useCallback(
    (axis: "x" | "z") => {
      if (!draft) return;
      const selectedPlaceables = draft.placeables.filter((p) =>
        selectedIds.includes(p.id),
      );
      if (selectedPlaceables.length < 2) return;
      const vals = selectedPlaceables.map((p) =>
        axis === "x" ? p.position[0] : p.position[2],
      );
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const snapStep = snapMode === "off" ? 0 : Number(snapMode);
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
    [draft, selectedIds, snapMode, commit],
  );

  const distributeSelection = useCallback(
    (axis: "x" | "z") => {
      if (!draft) return;
      const selectedPlaceables = draft.placeables.filter((p) =>
        selectedIds.includes(p.id),
      );
      if (selectedPlaceables.length < 3) return;
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
    [draft, selectedIds, commit],
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
      const selectedPlaceable =
        draft?.placeables.filter((p) => selectedIds.includes(p.id)).length === 1
          ? draft.placeables.find((p) => selectedIds.includes(p.id))
          : null;
      if (!selectedPlaceable) return;
      setLive((d) => ({
        ...d,
        placeables: d.placeables.map((p) =>
          p.id === selectedPlaceable.id ? { ...p, ...patch } : p,
        ),
      }));
    },
    [draft, selectedIds, setLive],
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
        ...(placeableId.endsWith("_sign") ? { label: "SOCIAL HUB" } : {}),
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
    [commit, setSelectedIds, setPaintId],
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
    [commit, setSelectedIds],
  );

  return {
    rotateTargets,
    deleteTargets,
    scaleTargets,
    duplicateTargets,
    rotateSelected,
    deleteSelected,
    selectInEditor,
    alignSelection,
    distributeSelection,
    updateFloor,
    patchSelectedPlaceableLive,
    movePlaceableLive,
    moveIdsLive,
    placeAsset,
    addSpawnAt,
  };
}
