# Agent Arena — third-party 3D assets

Code is MIT (see [`LICENSE`](../../LICENSE)). **GLBs in this folder are not MIT.** Each file stays under its original license. Do not treat a fork of this repo as a relicensed asset dump.

Kenney kits: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Attribution is optional; do not use the Kenney logo. poly.pizza models: the Creative Commons license on the model page at download time ([ToS](https://poly.pizza/docs/tos)).

## Packs (Kenney, CC0 1.0)

| Folder | Kit | Source | License |
|--------|-----|--------|---------|
| `packs/furniture/` | Furniture Kit (except named poly.pizza files below) | [kenney.nl/assets/furniture-kit](https://kenney.nl/assets/furniture-kit) | CC0 1.0 |
| `packs/food/` | Food Kit | [kenney.nl](https://kenney.nl/) / [Food Kit on itch.io](https://kenney-assets.itch.io/food-kit) | CC0 1.0 |
| `packs/space/` | Space Kit | [Space Kit on itch.io](https://kenney-assets.itch.io/space-kit) | CC0 1.0 |
| `packs/trees/` | Nature-style tree kit (Kenney naming) | Kenney | CC0 1.0 |
| `packs/camping/` | Camping kit (Kenney naming) | Kenney | CC0 1.0 |
| `packs/cars/` | Car kit (Kenney naming) | Kenney | CC0 1.0 |

## Named poly.pizza props (used in builtin maps)

Keep these. Credit the author if you redistribute.

| File | Author | Source | Notes |
|------|--------|--------|-------|
| `packs/furniture/Desk.glb` | Robbobin | [poly.pizza/m/58zA8yry4qr](https://poly.pizza/m/58zA8yry4qr) | Floor + blue wall removed |
| `packs/furniture/BookcaseWithBooks.glb` | Quaternius | [poly.pizza/m/tACDGJ4CGW](https://poly.pizza/m/tACDGJ4CGW) | Recolored to office wood |
| `packs/furniture/PingPongTable.glb` | burunduk | [poly.pizza/m/PUbHPqqrWZ](https://poly.pizza/m/PUbHPqqrWZ) | |
| `packs/furniture/TableJeremy.glb` | jeremy | [poly.pizza/m/8cnrwlAWqx7](https://poly.pizza/m/8cnrwlAWqx7) | |
| `packs/nature/Grass Green.glb` | Steve B | [poly.pizza/m/8q6D0D_SuBE](https://poly.pizza/m/8q6D0D_SuBE) | |
| `packs/nature/Grass Clump.glb` | Tomáš Bayer | [poly.pizza/m/00rprwmzLKP](https://poly.pizza/m/00rprwmzLKP) | |
| `packs/nature/Grass Blades.glb` | Tiff Eidmann | [poly.pizza/m/7jaHZEe1exG](https://poly.pizza/m/7jaHZEe1exG) | |

License on each page is Creative Commons (typically CC BY 3.0 or CC0). Check the live page before a commercial redistribution.

## Characters (used — playable looks)

All 13 shipped looks are **in use** (`data/characters.yaml`). They are J-Toastie’s [CUTES Part One](https://poly.pizza/bundle/CUTES-Part-One-WD91WrT0gx) set on poly.pizza, **CC BY 3.0**. Texture atlas: modified from [Kay Lousberg](https://www.kaylousberg.com/) (credited by J-Toastie).

| File | Model | Source |
|------|-------|--------|
| `characters/generic-male.glb` | Generic Male | [poly.pizza/m/jNp6bjMW9a](https://poly.pizza/m/jNp6bjMW9a) |
| `characters/generic-female.glb` | Generic Female | CUTES Part One bundle |
| `characters/citizen-1.glb` | Citizen 1 | [poly.pizza/m/sYl7E9whZH](https://poly.pizza/m/sYl7E9whZH) |
| `characters/citizen-2.glb` | Citizen 2 | [poly.pizza/m/M37AwJwOzy](https://poly.pizza/m/M37AwJwOzy) |
| `characters/citizen-3.glb` | Citizen 3 | [poly.pizza/m/26UC5iU4Fk](https://poly.pizza/m/26UC5iU4Fk) |
| `characters/retail-worker.glb` | Retail Worker | [poly.pizza/m/kpw4fiF8St](https://poly.pizza/m/kpw4fiF8St) |
| `characters/food-worker.glb` | Food Worker | [poly.pizza/m/6cjgeTS8Pl](https://poly.pizza/m/6cjgeTS8Pl) |
| `characters/male-officer.glb` | Male Officer | [poly.pizza/m/ipEgtSYI8u](https://poly.pizza/m/ipEgtSYI8u) |
| `characters/female-officer.glb` | Female Officer | [poly.pizza/m/g6Pu2llnES](https://poly.pizza/m/g6Pu2llnES) |
| `characters/crypto-bro.glb` | Crypto Bro | [poly.pizza/m/zGOWefrMDQ](https://poly.pizza/m/zGOWefrMDQ) |
| `characters/prisoner.glb` | Prisoner | [poly.pizza/m/5X70x024kR](https://poly.pizza/m/5X70x024kR) |
| `characters/chicken-guy.glb` | Chicken Guy | [poly.pizza/m/b2hbNsaTN0](https://poly.pizza/m/b2hbNsaTN0) |
| `characters/rubber-duck.glb` | Rubber Duck | CUTES Part One bundle (animated character look) |

## License-unverified — used (keep)

Builtin maps place these animal GLBs. Per-file CC0 vs CC-BY is not recorded. They stay as live décor until sourced.

| File | Builtin map |
|------|-------------|
| `packs/animals/Cat.glb` | office |
| `packs/animals/Spider.glb` | nature |
| `packs/animals/Turkey vulture.glb` | nature |

Unused unverified animals and the entire `farm-animals` pack were removed from the repo.

Unused Kenney furniture / food / space / car GLBs stay as editor fill (CC0).

## Scaling / orientation

Kenney-style GLBs are often toy-scale (0.1–0.9 m). Scene code uses `scale = targetHeightMeters / nativeAABB.height` in `src/lib/assets/catalog.ts`. Assume kit models face **+Z**; rotate with `rotationY`.

## Dev watcher

Vite ignores `public/assets/packs/**` and `*.glb` (Windows EBUSY). `serve-pack-assets` still streams pack files from disk so new GLBs work without a restart.
