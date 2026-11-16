import { useEffect, useRef, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import type { ArenaMapDefinition, MapSpawnPoint } from "@/lib/maps/schema";
import type { MapLightPoint, MapZone } from "@/lib/maps";
import {
  cellsForFloorSize,
  clampFloorSize,
  clampRegionsToFloor,
  type LightPatch,
  type ZonePatch,
} from "@/lib/maps";
import type { PlaceableInstance } from "@/lib/types";
import { MultiSelectCard } from "@/components/MapEditor/inspector/MultiSelectCard";
import { PlaceableCard } from "@/components/MapEditor/inspector/PlaceableCard";
import { SpawnCard } from "@/components/MapEditor/inspector/SpawnCard";
import { ZoneCard } from "@/components/MapEditor/inspector/ZoneCard";
import { LightCard } from "@/components/MapEditor/inspector/LightCard";
import { MapSettingsCard } from "@/components/MapEditor/inspector/MapSettingsCard";
import type { MapDraftUpdater } from "@/components/MapEditor/useMapHistory";

export function InspectorPanel({
  draft,
  selectedPlaceables,
  selectedSpawn,
  selectedZone,
  selectedLight,
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
  patchZoneLive,
  patchLightLive,
  commitZone,
  commitLight,
  selectInEditor,
  pendingFocusRef,
}: {
  draft: ArenaMapDefinition;
  selectedPlaceables: PlaceableInstance[];
  selectedSpawn: MapSpawnPoint | undefined;
  selectedZone: MapZone | undefined;
  selectedLight: MapLightPoint | undefined;
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
  patchZoneLive: (id: string, patch: ZonePatch) => void;
  patchLightLive: (id: string, patch: LightPatch) => void;
  commitZone: (id: string, patch: ZonePatch) => void;
  commitLight: (id: string, patch: LightPatch) => void;
  selectInEditor: (
    id: string | null,
    opts?: { additive?: boolean },
  ) => void;
  pendingFocusRef: MutableRefObject<string | null>;
}) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardHostRef = useRef<HTMLDivElement>(null);
  const prevHadSelection = useRef(false);
  const multiPlaceable = selectedPlaceables.length > 1;
  const selectedPlaceable =
    selectedPlaceables.length === 1 ? selectedPlaceables[0] : null;
  const hasSelection =
    Boolean(selectedPlaceable || selectedSpawn || selectedZone || selectedLight) ||
    multiPlaceable;

  // Restore focus to the inspector heading only when selection clears AND focus
  // was lost (body) or lived inside the removed card — not on mount / every Esc.
  useEffect(() => {
    const had = prevHadSelection.current;
    prevHadSelection.current = hasSelection;
    if (hasSelection || !had) return;

    const active = document.activeElement;
    const lost =
      !active ||
      active === document.body ||
      (cardHostRef.current != null && !document.body.contains(active));
    if (lost) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [hasSelection]);

  // Only list picks set pendingFocusRef — canvas/placement/undo must not move focus.
  const focusCardId = selectedZone?.id ?? selectedLight?.id ?? null;
  useEffect(() => {
    if (!focusCardId) return;
    if (pendingFocusRef.current !== focusCardId) return;
    pendingFocusRef.current = null;
    const root = cardHostRef.current;
    if (!root) return;
    const target = root.querySelector(
      "[data-inspector-card-heading]",
    ) as HTMLElement | null;
    target?.focus({ preventScroll: true });
  }, [focusCardId, pendingFocusRef]);

  return (
    <aside className="map-editor__inspector">
      <h3 ref={headingRef} tabIndex={-1}>
        {t("mapEditor.inspector")}
      </h3>

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

      {hasSelection && <div className="map-editor__divider" />}

      <div ref={cardHostRef}>
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
        ) : selectedZone ? (
          <ZoneCard
            key={selectedZone.id}
            zone={selectedZone}
            floorSize={draft.floor.size}
            onPatchLive={(patch) => patchZoneLive(selectedZone.id, patch)}
            onCommit={(patch) => commitZone(selectedZone.id, patch)}
            onMoveLive={(pos) => movePlaceableLive(selectedZone.id, pos)}
            onDelete={deleteSelected}
            beginGesture={beginGesture}
            endGesture={endGesture}
          />
        ) : selectedLight ? (
          <LightCard
            key={selectedLight.id}
            light={selectedLight}
            onPatchLive={(patch) => patchLightLive(selectedLight.id, patch)}
            onCommit={(patch) => commitLight(selectedLight.id, patch)}
            onMoveLive={(pos) => movePlaceableLive(selectedLight.id, pos)}
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
              setLive((d) =>
                clampRegionsToFloor({
                  ...d,
                  floor: {
                    ...d.floor,
                    size: next,
                    cells: cellsForFloorSize(next, d.floor.surface),
                  },
                }),
              );
            }}
            onUpdateFloor={updateFloor}
            onTheme={(patch) =>
              commit({
                ...draft,
                theme: { ...draft.theme, ...patch },
              })
            }
            onSelectRegion={selectInEditor}
            beginGesture={beginGesture}
            endGesture={endGesture}
          />
        )}
      </div>

      <p className="map-editor__hint">{t("mapEditor.hotkeys")}</p>
    </aside>
  );
}
