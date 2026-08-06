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

## Phase 1

- Name gate on first visit
- Settings: AI models (OpenAI / Gemini / Claude / Ollama / custom), agents with low-poly character presets, map & graphics
- Office map only (no walls); floor grows with agent count
- Chat via agent list or clicking an agent on the map
