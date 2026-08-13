import { useEffect, useState } from "react";
import { getCharacter } from "@/lib/assets/characters";
import {
  getCachedThumb,
  requestThumb,
  subscribeThumb,
} from "@/components/MapEditor/thumbnailCache";

/** Character picker thumb — same offscreen GLB renderer as the map library. */
export function CharacterPreview({ characterId }: { characterId: string }) {
  const [src, setSrc] = useState<string | null>(() => getCachedThumb(characterId));
  const label = getCharacter(characterId).id;

  useEffect(() => {
    const cached = getCachedThumb(characterId);
    if (cached) {
      setSrc(cached);
      return;
    }
    setSrc(null);
    const unsub = subscribeThumb(characterId, () => {
      setSrc(getCachedThumb(characterId));
    });
    void requestThumb(characterId);
    return unsub;
  }, [characterId]);

  return (
    <div className="asset-preview character-preview" aria-hidden>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
      ) : (
        <div className="asset-preview__loading" title={label} />
      )}
    </div>
  );
}
