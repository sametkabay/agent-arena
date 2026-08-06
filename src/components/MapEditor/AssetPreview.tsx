import { useEffect, useState } from "react";
import type { PlaceableId } from "@/lib/assets/catalog";
import { PLACEABLE_SPECS } from "@/lib/assets/catalog";
import {
  getCachedThumb,
  requestThumb,
  subscribeThumb,
} from "@/components/MapEditor/thumbnailCache";

/**
 * Asset library thumb — shared offscreen WebGL renderer → cached PNG.
 * Avoids one WebGL context per card (browser limit was killing furniture thumbs).
 */
export function AssetPreview({ placeableId }: { placeableId: PlaceableId }) {
  const [src, setSrc] = useState<string | null>(() => getCachedThumb(placeableId));
  const label = PLACEABLE_SPECS[placeableId]?.label ?? placeableId;

  useEffect(() => {
    const cached = getCachedThumb(placeableId);
    if (cached) {
      setSrc(cached);
      return;
    }
    setSrc(null);
    const unsub = subscribeThumb(placeableId, () => {
      setSrc(getCachedThumb(placeableId));
    });
    void requestThumb(placeableId);
    return unsub;
  }, [placeableId]);

  return (
    <div className="asset-preview" aria-hidden>
      {src ? (
        <img src={src} alt="" draggable={false} />
      ) : (
        <div className="asset-preview__loading" title={label} />
      )}
    </div>
  );
}
