---
name: Translation
about: Add or fix a UI locale — good first issue
title: "[Locale] "
labels: ["good first issue", "help wanted"]
---

**Language**
- Code (`xx`):
- Endonym (label in that language):
- English name:

**Scope**
- [ ] New locale (copy `src/i18n/en.json` → `src/i18n/xx.json`)
- [ ] Fix / complete an existing locale

**Checklist for a new locale**
- [ ] `src/i18n/xx.json` has every key from `en.json` (same nesting)
- [ ] `agent-arena.yaml` → `languages` includes `{ code, label, englishName }`
- [ ] UI language picker shows the new locale after `npm run dev`

Shipped today: `en`, `tr`, `es`, `zh`, `pt`, `fr`, `de`, `ja`, `ko`, `ru`.
