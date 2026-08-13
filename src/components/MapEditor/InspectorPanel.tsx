import { useTranslation } from "react-i18next";
import type { ArenaMapDefinition, MapSpawnPoint } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import { cellsForFloorSize, clampFloorSize } from "@/lib/maps";
import { MultiSelectCard } from "@/components/MapEditor/inspector/MultiSelectCard";
import { PlaceableCard } from "@/components/MapEditor/inspector/PlaceableCard";
import { SpawnCard } from "@/components/MapEditor/inspector/SpawnCard";
import { MapSettingsCard } from "@/components/MapEditor/inspector/MapSettingsCard";
import type { MapDraftUpdater } from "@/components/MapEditor/useMapHistory";

export function InspectorPanel({
  draft,
  selectedPlaceables,
  selectedSpawn,
  commit,
  setLive,
  beginGesture,
  endGesture,
  rotateSelected,
  scaleTargets,
  alignSelection,
  distributeSelection,
  duplicateTargets,
  deleteSelected,
  patchSelectedPlaceableLive,
  movePlaceableLive,
  updateFloor,
}: {
  draft: ArenaMapDefinition;
  selectedPlaceables: PlaceableInstance[];
  selectedSpawn: MapSpawnPoint | undefined;
  commit: (updater: MapDraftUpdater) => void;
  setLive: (updater: MapDraftUpdater) => void;
  beginGesture: () => void;
  endGesture: () => void;
  rotateSelected: (delta?: number) => void;
  scaleTargets: (ids: string[], factor: number) => void;
  alignSelection: (axis: "x" | "z") => void;
  distributeSelection: (axis: "x" | "z") => void;
  duplicateTargets: (ids: string[]) => void;
  deleteSelected: () => void;
  patchSelectedPlaceableLive: (patch: Partial<PlaceableInstance>) => void;
  movePlaceableLive: (
    id: string,
    pos: [number, number, number],
    preserveY?: boolean,
  ) => void;
  updateFloor: (patch: Partial<ArenaMapDefinition["floor"]>) => void;
}) {
  const { t } = useTranslation();
  const multiPlaceable = selectedPlaceables.length > 1;
  const selectedPlaceable =
    selectedPlaceables.length === 1 ? selectedPlaceables[0] : null;

  return (
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
          onChange={(e) => setLive((d) => ({ ...d, name: e.target.value }))}
        />
      </label>

      {(selectedPlaceable || selectedSpawn || multiPlaceable) && (
        <div className="map-editor__divider" />
      )}

      {multiPlaceable ? (
        <MultiSelectCard
          count={selectedPlaceables.length}
          onRotate={rotateSelected}
          onScaleUp={() =>
            scaleTargets(
              selectedPlaceables.map((p) => p.id),
              1.15,
            )
          }
          onScaleDown={() =>
            scaleTargets(
              selectedPlaceables.map((p) => p.id),
              1 / 1.15,
            )
          }
          onAlignX={() => alignSelection("x")}
          onAlignZ={() => alignSelection("z")}
          onDistributeX={() => distributeSelection("x")}
          onDistributeZ={() => distributeSelection("z")}
          onDuplicate={() =>
            duplicateTargets(selectedPlaceables.map((p) => p.id))
          }
          onDelete={deleteSelected}
        />
      ) : selectedPlaceable ? (
        <PlaceableCard
          placeable={selectedPlaceable}
          commit={commit}
          onPatchLive={patchSelectedPlaceableLive}
          onMoveLive={(pos) => movePlaceableLive(selectedPlaceable.id, pos)}
          onRotate={rotateSelected}
          onDelete={deleteSelected}
          beginGesture={beginGesture}
          endGesture={endGesture}
        />
      ) : selectedSpawn ? (
        <SpawnCard
          spawn={selectedSpawn}
          onMoveLive={(pos) => movePlaceableLive(selectedSpawn.id, pos)}
          onRotate={rotateSelected}
          onDelete={deleteSelected}
          beginGesture={beginGesture}
          endGesture={endGesture}
        />
      ) : (
        <MapSettingsCard
          draft={draft}
          onDescription={(value) =>
            setLive((d) => ({ ...d, description: value }))
          }
          onFloorSizeLive={(size) => {
            const next = clampFloorSize(size);
            setLive((d) => ({
              ...d,
              floor: {
                ...d.floor,
                size: next,
                cells: cellsForFloorSize(next, d.floor.surface),
              },
            }));
          }}
          onUpdateFloor={updateFloor}
          onTheme={(patch) =>
            commit({
              ...draft,
              theme: { ...draft.theme, ...patch },
            })
          }
          beginGesture={beginGesture}
          endGesture={endGesture}
        />
      )}

      <p className="map-editor__hint">{t("mapEditor.hotkeys")}</p>
    </aside>
  );
}
