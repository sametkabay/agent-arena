# Agent Arena

Local multi-agent playground. No backend and no login — AI models, agents, and your display name live in the browser (`localStorage`).

## Stack

- Vite + React 19 + TypeScript
- React Three Fiber / Three.js
- Zustand
- i18next (English default, Turkish)

## Run

```bash
npm install
npm run dev
```

Dev server defaults to port **5174**. Ollama is proxied at `/ollama` → `http://127.0.0.1:11434`.

## Maps & atmosphere

- Three builtin maps: **Office**, **Nature**, **Space** (aamf v1 JSON)
- Full-screen map editor: place assets, snap grid, theme colors, zones, import/export
- Day/night with smooth blend, night sky, practical lights (lamps / campfire / map lights)
- Outdoor maps skip floating “room” fill lights; indoor maps keep them

## Phase notes

- Name gate on first visit
- Settings: AI models (OpenAI / Gemini / Claude / Ollama / custom), agents, maps, graphics
- Chat via agent list or clicking an agent on the map
- Floor size comes from the map definition (not agent count)
