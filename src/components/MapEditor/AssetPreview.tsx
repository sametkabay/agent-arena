import { useEffect, useRef, useState } from "react";
import type { PlaceableId } from "@/lib/assets/catalog";
import { PLACEABLE_SPECS } from "@/lib/assets/catalog";
import {
  getCachedThumb,
  requestThumb,
  subscribeThumb,
} from "@/components/MapEditor/thumbnailCache";

/**
 * Asset library thumb — shared offscreen WebGL renderer → cached PNG.
 * Loads only when the card scrolls into view (IntersectionObserver).
 */
export function AssetPreview({ placeableId }: { placeableId: PlaceableId }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(() => getCachedThumb(placeableId));
  const label = PLACEABLE_SPECS[placeableId]?.label ?? placeableId;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const scrollRoot =
      el.closest(".map-editor__library") ??
      el.closest(".map-editor__asset-groups");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      {
        root: scrollRoot instanceof Element ? scrollRoot : null,
        rootMargin: "160px 0px",
        threshold: 0.01,
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [placeableId]);

  useEffect(() => {
    if (!visible) return;
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
  }, [placeableId, visible]);

  return (
    <div className="asset-preview" ref={rootRef} aria-hidden>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
      ) : (
        <div className="asset-preview__loading" title={label} />
      )}
    </div>
  );
}
