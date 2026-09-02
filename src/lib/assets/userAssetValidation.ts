import type { AssetCategory, PlaceableSpec } from "@/lib/assets/catalog";
import { appConfig } from "@/lib/config";
import type { UserAssetMeta } from "@/lib/types";

const GLB_EXTENSIONS = [".glb", ".gltf"];

export interface ImportAssetForm {
  label: string;
  category: AssetCategory;
  autoFit: "height" | "xz";
  targetSize: number;
}

export function hasGlbExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return GLB_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Pure validation so it's testable without touching IndexedDB or the DOM. */
export function validateGlbImport(
  file: { name: string; size: number },
  currentCount: number,
): string | null {
  if (!hasGlbExtension(file.name)) return "invalidType";
  if (file.size <= 0) return "empty";
  if (file.size > appConfig.userAssets.maxFileBytes) return "tooLarge";
  if (currentCount >= appConfig.userAssets.maxCount) return "tooMany";
  return null;
}

export function specFromMeta(meta: UserAssetMeta, glb: string): PlaceableSpec {
  return {
    label: meta.label,
    category: meta.category,
    pack: "user",
    footprint: meta.footprint,
    glb,
    scale: meta.scale,
    autoFit: meta.autoFit,
    targetSize: meta.targetSize,
  };
}
