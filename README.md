# Agent Arena

**A browser-native multi-agent playground — place AI personas on a 3D map, watch them live, and talk to them.**

[![Deploy](https://github.com/sametkabay/agent-arena/actions/workflows/deploy.yml/badge.svg)](https://github.com/sametkabay/agent-arena/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Live demo](https://img.shields.io/badge/demo-GitHub%20Pages-blue)](https://sametkabay.github.io/agent-arena/)

> **Status:** early preview (`v0.1.0`) — map format and UI may still change.

[Live demo](https://sametkabay.github.io/agent-arena/) · [Issues](https://github.com/sametkabay/agent-arena/issues) · [License](./LICENSE)

![Agent Arena — Office map with side panels and arena chat](docs/screenshot-office.png)

<p align="center">
  <img src="docs/screenshot-nature.png" alt="Nature map" width="48%" />
  <img src="docs/screenshot-map-editor.png" alt="Map editor" width="48%" />
</p>

Agent Arena is a **client-side** sandbox where multiple LLM-powered agents share a low-poly world. Configure each agent’s model, personality, and look; drop them onto an office floor, a nature clearing, or a space map; chat one-on-one or in a shared arena feed; then reshape the entire map in a full-screen editor.

No app backend. No login. Your display name, API keys, agents, maps, graphics prefs, and chat history stay in the browser (`localStorage`). LLM calls go **from your browser** to the providers you configure.

**What this is not:** not a hosted multi-agent orchestration framework, not a Discord bot, and not a server-side agent runtime — it’s a visual playground you run (or host statically) yourself.

---

## Table of contents

- [Why Agent Arena?](#why-agent-arena)
- [Features](#features)
- [Quick start](#quick-start)
  - [First 60 seconds](#first-60-seconds)
- [Configuration & privacy](#configuration--privacy)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Deploy (GitHub Pages)](#deploy-github-pages)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [Credits](#credits)
- [License](#license)

---

## Why Agent Arena?

Most multi-agent demos are terminals, dashboards, or chat bots. Agent Arena treats agents as **characters in a place**:

- They stand on a map, walk to targets, idle-mutter into speech bubbles, and answer when you click them.
- The world (zones, day/night, map description) is fed into their prompts so replies stay grounded in the scene.
- Agents, models, and the map itself are **editable in-app** — no redeploy to try a new persona or layout.

Use it to prototype agent personas, stage small multi-agent scenes, compare LLM providers side by side, or explore a tactile sandbox for agent UX.

**Stack at a glance:** Vite · React 19 · TypeScript · Three.js / React Three Fiber · Zustand · i18next (EN / TR)

---

## Features

### Agent simulation (sandbox)
- Spawn multiple agents on map spawn points with distinct roles, colors, and body presets
- **Idle chatter loop** — short LLM mutters into speech bubbles (rate via *chattiness*); pauses when the tab is hidden or Settings / Map Editor is open
- Click an agent to select; **right-click the floor** to send them walking to a target
- Thinking / talking visual states while replies stream

### Conversation
- **Private chat** — resizable, draggable panel (agent list or scene)
- **Shared arena chat** — floating log with `@mention` targeting
- World context in prompts: your name, UI language, map name/description, zone names, day/night, other agents

### Customizable agents
Each agent includes display name, color, **poly role preset** (explorer, engineer, botanist, scholar, artisan, guardian, scout, muse, or custom), bound AI model, system prompt, optional bio & skills, enabled flag, thinking toggle (when supported), and chattiness (0–100).

### Customizable maps
- **Builtin worlds:** Office, Nature, Space (`aamf` v1 JSON)
- **Map presets** for quick starts (starter camp, space outpost, office lounge, blank concrete, …)
- **Full-screen map editor:** place / move / rotate / scale assets, multi-select, snap grid, spawn points, floor size & surface, theme colors, day/night preview, undo/redo, favorites, import / export (`.aamf.json`)
- Saving a builtin creates a **custom copy** in localStorage
- Day/night blend, night sky, practical lights (lamps, campfire FX, map lights)

### AI providers

| Provider | Notes |
|----------|--------|
| **OpenAI** | Chat Completions–compatible API |
| **Gemini** | Google Generative Language API |
| **Claude** | Anthropic Messages API (browser direct-access header) |
| **Ollama** | Local models (best with `npm run dev` proxy) |
| **Custom** | Any OpenAI-compatible gateway |

Connection test, model list fetch, optional extra headers, per-agent model binding.

### Polish
- English & Turkish UI
- Graphics settings (shadows, quality, contact shadows, lamp / room lights, antialias, max DPR)
- First-visit name gate
- Static deploy (GitHub Pages)

---

## Quick start

### Try the live demo

Open **[https://sametkabay.github.io/agent-arena/](https://sametkabay.github.io/agent-arena/)**, set your display name, add a model under **Settings → AI Models**, bind it on an agent under **Settings → Agents**, then click an agent to chat.

> Cloud providers work on the static demo **subject to provider CORS**. **Ollama / localhost models need the local dev server.**

### Run locally

**Requirements:** Node.js **20+** (CI uses **24**), npm. Modern browser with **WebGL2** (Chromium, Firefox, or Safari).

```bash
git clone https://github.com/sametkabay/agent-arena.git
cd agent-arena
npm install
npm run dev
```

Dev server: **http://localhost:5174/**

#### First 60 seconds

1. Open the URL above  
2. Enter your display name → **Enter Arena**  
3. **Settings → AI Models** → add a provider + API key (or Ollama at `/ollama` in dev — Ollama must already be running locally)  
4. **Settings → Agents** → add or edit an agent and bind a model  
5. Click an agent to chat, or **right-click the floor** to walk them somewhere  
6. Switch maps (Office / Nature / Space) or open **Edit map**

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server (port **5174**) |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run assets:inventory` | Regenerate GLB inventory after adding packs under `public/assets/packs/` |

**Local LLM proxies (dev only):**

- `/ollama` → `http://127.0.0.1:11434`
- `/local-llm/<host>/<port>/...` → local OpenAI-compatible gateways

---

## Configuration & privacy

- **No `.env` required.** Keys and settings are entered in the UI and stored in `localStorage` (`agent-arena-data`).
- Keys leave your machine only when **your browser** calls the provider you configured — there is no Agent Arena backend holding secrets.
- Prefer restricted / rotatable API keys. Clear site data if you share the machine.
- **Claude from the browser** uses Anthropic’s `anthropic-dangerous-direct-browser-access` header; treat that key as **origin-exposed** (not a server secret) and prefer a restricted / rotatable key.
- Browser **CORS** applies. Some self-hosted gateways need CORS headers; `npm run dev` proxies help for Ollama.

---

## How it works

```text
┌─────────────────────────────────────────────────────────┐
│  React UI (settings, chat, agent list, map editor)      │
│                      ↕ Zustand store                     │
│  ArenaScene (React Three Fiber + Three.js)              │
│    · Character agents · placeables · lights · day/night │
│                      ↕                                   │
│  AI layer (providers → chat / arena / idle mutter)      │
│  Maps (aamf v1 JSON) · Asset catalog (GLB packs)        │
│  Persistence → localStorage                             │
└─────────────────────────────────────────────────────────┘
         ▲
         │  fetch (browser → LLM APIs)
         ▼
   OpenAI · Gemini · Claude · Ollama · custom
```

1. **State** — Zustand (`src/store/arenaStore.ts`), hydrated from `localStorage`
2. **Scene** — active `ArenaMapDefinition`: floor, theme, spawns, placeables, zones, lights
3. **Agents** — config (persona + model) + runtime (position, path, speech bubble, state)
4. **Prompts** — private chat, arena broadcast, `@mention`, or idle mutter + shared world context
5. **Providers** — OpenAI-style, Gemini, and Claude behind one chat interface

### Map format (`aamf` v1)

Versioned JSON (`ArenaMapDefinition`): floor, theme, spawn points, placeables, optional zones and lights. Builtins: `src/lib/maps/defs/`. Custom maps and exports use the same schema (`.aamf.json`).

### Assets

Low-poly GLB packs under `public/assets/packs/`. Catalog + generated inventory expose them to the editor and scene. Credits: [`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md).

---

## Project structure

```text
src/
  components/     # UI, SettingsModal, MapEditor, scene/
  lib/
    ai/           # providers, arena chat, chatter, prompt context
    maps/         # aamf schema, builtins, runtime, presets
    assets/       # catalog + generated pack inventory
    poly/         # agent body / role presets
  store/          # Zustand arena store
  i18n/           # en.json, tr.json
public/assets/    # GLB packs + ATTRIBUTION.md
docs/             # README screenshots
scripts/          # pack inventory generator
.github/workflows # GitHub Pages deploy
```

---

## Deploy (GitHub Pages)

Push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

1. Repo **Settings → Pages → Source: GitHub Actions**
2. Push to `main` (or run the workflow manually)
3. Site: **https://sametkabay.github.io/agent-arena/**

Vite `base` is `/` in dev and `/agent-arena/` on production builds so asset URLs match the project Pages path.

---

## Troubleshooting & FAQ

| Problem | What to try |
|---------|-------------|
| Blank page / missing assets on Pages | Open the deployed app under `/agent-arena/`; local dev uses `/` |
| Ollama fails on GitHub Pages | Expected — use `npm run dev` (proxies are **dev-only**) |
| CORS errors on custom gateway | Enable CORS on the gateway, or call it through a local proxy |
| Claude browser calls rejected | Needs Anthropic browser/CORS-allowed setup + the direct-browser-access header the app sends; use a restricted key |
| Stale agents / maps | Clear site data for the origin, or reset from Settings where available |
| Huge PR with new GLBs | Update [`ATTRIBUTION.md`](public/assets/ATTRIBUTION.md) and run `npm run assets:inventory` |

**Do I need a backend?** No — only the LLM providers you choose.

**Are my keys uploaded to Agent Arena?** No. They stay in `localStorage` and are sent only to the provider endpoints you configure.

**Can I run only on Ollama?** Yes, locally with `npm run dev`.

**Is `aamf` stable?** Versioned as v1 in early preview — expect additive changes; pin exports if you depend on them.

---

## Contributing

1. Fork and clone  
2. Use Node **20+** (24 matches CI)  
3. `npm install` && `npm run dev`  
4. Keep PRs focused; match existing TypeScript / React style  
5. Before opening a PR, run `npm run build`  
6. New GLBs under `public/assets/packs/` → `npm run assets:inventory` + credit in `ATTRIBUTION.md`  
7. Discuss larger features in [Issues](https://github.com/sametkabay/agent-arena/issues) first  

There is no separate test suite yet — production build + manual UI check is the current bar. For UI changes, smoke-check chat and at least one map in Chromium.

---

## Roadmap

- Richer zone / light editing in the map editor UI  
- Deeper agent behaviors and multi-agent tasks  
- Export / import of full arena setups (agents + models + map)  
- More builtins and polished demo scenes  

Ideas and PRs welcome.

---

## Credits

- 3D packs: poly.pizza / Kenney-style kits — [`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md)  
- [Vite](https://vitejs.dev/) · [React](https://react.dev/) · [Three.js](https://threejs.org/) / [R3F](https://docs.pmnd.rs/react-three-fiber) · [Zustand](https://zustand-demo.pmnd.rs/) · [i18next](https://www.i18next.com/)

---

## License

[MIT](./LICENSE) © 2026 Samet Kabay
