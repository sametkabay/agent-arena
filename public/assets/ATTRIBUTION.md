# Agent Arena — asset library

Design-language packs live under `public/assets/packs/`.
All were unpacked from Desktop zips (poly.pizza / Kenney-style low-poly).

| Folder | Source zip | Count | Use |
|--------|------------|------:|-----|
| `furniture/` | Furniture Kit-glb.zip | 117 | Office furniture (primary scene props) |
| `trees/` | Tree Collection…zip | 4 | Outdoor / corner accents |
| `camping/` | Small Camping Bundle | 7 | Future maps / accents |
| `cars/` | Cars Bundle | 7 | Future maps |
| `animals/` | Animals…zip | 64 | Future maps / décor |
| `farm-animals/` | Farm Animal Pack | 7 | Future maps |
| `food/` | Ultimate Food Pack | 50 | Desk décor (later) |
| `cosmetics/` | Cosmetic Pack Two | 7 | Character style (later) |

## Scaling rule

Kenney-style GLBs are **toy-scale** (often 0.1–0.9 m tall).
Always set `scale = targetHeightMeters / nativeAABB.height` in `src/lib/assets/catalog.ts`.

## Orientation rule

Assume kit models face **+Z** (front). Rotate with `rotationY` so seats/screens face their partners.

## Watcher

Vite ignores `public/assets/packs/**` and `*.glb` (Windows EBUSY).
