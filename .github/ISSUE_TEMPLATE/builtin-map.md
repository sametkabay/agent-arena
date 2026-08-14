---
name: Builtin map
about: Propose a new shipped world — good first issue
title: "[Map] "
labels: ["good first issue", "help wanted"]
---

**Map name** (id in `snake` or `kebab`, e.g. `harbor`):


**Theme**
Indoor office / outdoor camp / other — lighting, mood, day vs night:

**How to add it**
1. Build the layout in **Edit map** (or duplicate a builtin)
2. Export `.aamf.json`
3. Drop the file in `data/maps/` (aamf v1: `id`, `name`, `description`, floor, theme, spawn points, placeables)
4. Smoke-check day and night in Chromium

**Assets**
- [ ] Uses only GLBs already in `public/assets/` (or a follow-up [assets issue](https://github.com/sametkabay/agent-arena/issues/new?template=assets.md) credits new files)
- [ ] `public/assets/ATTRIBUTION.md` is unchanged **or** updated in the same PR

Shipped builtins: `office`, `nature`, `space`.
