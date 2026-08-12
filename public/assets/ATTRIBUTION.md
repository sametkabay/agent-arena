# Agent Arena — asset library

Design-language packs live under `public/assets/packs/`.
All were unpacked from Desktop zips (poly.pizza / Kenney-style low-poly).

| Folder | Source zip | Count | Use |
|--------|------------|------:|-----|
| `furniture/` | Furniture Kit-glb.zip | 117 | Office furniture (primary scene props) |
| `furniture/Desk.glb` | Desk by Robbobin (poly.pizza / 58zA8yry4qr) | 1 | Office desk workstation (asset floor + blue wall removed). Kenney: `Desk_Kenney_backup.glb` |
| `furniture/BookcaseWithBooks.glb` | Bookcase with Books by Quaternius (poly.pizza / tACDGJ4CGW) | 1 | Office cabinet (recolored to Kenney office wood) |
| `furniture/PingPongTable.glb` | Ping Pong table by burunduk (poly.pizza / PUbHPqqrWZ) | 1 | Table tennis / ping pong table |
| `furniture/TableJeremy.glb` | Table by jeremy (poly.pizza / 8cnrwlAWqx7) | 1 | Large rectangular table |
| `trees/` | Tree Collection…zip | 4 | Outdoor / corner accents |
| `nature/` | poly.pizza grass props | 3 | Outdoor grass clumps / blades |
| `nature/Grass Green.glb` | grass green by Steve B (poly.pizza / 8q6D0D_SuBE) | 1 | Tall green grass patch |
| `nature/Grass Clump.glb` | Grass #1 by Tomáš Bayer (poly.pizza / 00rprwmzLKP) | 1 | Small grass clump |
| `nature/Grass Blades.glb` | grass blades by Tiff Eidmann (poly.pizza / 7jaHZEe1exG) | 1 | Sparse grass blades |
| `camping/` | Small Camping Bundle | 7 | Future maps / accents |
| `cars/` | Cars Bundle | 7 | Future maps |
| `animals/` | Animals…zip | 64 | Future maps / décor |
| `farm-animals/` | Farm Animal Pack | 7 | Future maps |
| `food/` | Ultimate Food Pack | 50 | Desk décor (later) |
| `cosmetics/` | Cosmetic Pack Two | 7 | Character style (later) |
| `space/` | Ultimate Space Kit-glb (poly.pizza) | 22 | Space map habitats, flora, rover, astronaut |

## Scaling rule

Kenney-style GLBs are **toy-scale** (often 0.1–0.9 m tall).
Always set `scale = targetHeightMeters / nativeAABB.height` in `src/lib/assets/catalog.ts`.

## Orientation rule

Assume kit models face **+Z** (front). Rotate with `rotationY` so seats/screens face their partners.

## Watcher

Vite ignores `public/assets/packs/**` and `*.glb` (Windows EBUSY).
A `serve-pack-assets` middleware still streams pack files from disk so newly
added GLBs work without restarting the dev server.
