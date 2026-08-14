# Contributing to Agent Arena

Thanks for taking the time to contribute. The [code of conduct](./CODE_OF_CONDUCT.md) applies to this project.

## Setup

1. Fork and clone the repo
2. Use Node **20+** (24 matches CI)
3. `npm install` && `npm run dev`

`npm install` runs `prepare`, which installs a **pre-commit** hook via [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) (`npm run lint && npm test`). The hook does **not** run `npm run build` (Vite + `tsc` is slow; CI still builds).

To skip the hook in an emergency: `git commit --no-verify`. CI on the PR will still run lint, tests, and build.

## Tests and lint

| Command | What it does |
|---------|----------------|
| `npm run lint` | [oxlint](https://oxc.rs/docs/guide/usage/linter.html) over the repo |
| `npm test` | Vitest + v8 coverage on `src/lib/**/*.ts` — **fails below 80%** (lines, functions, branches, statements) |
| `npm run build` | `tsc -b` + Vite production build |

Coverage excludes generated files, `src/lib/three/**`, `src/lib/useStickToBottom.ts`, and `src/lib/types.ts`. UI / R3F components are not in the threshold.

## Pull requests

- Keep PRs focused; match existing TypeScript / React style
- Before opening a PR, run `npm run lint`, `npm test`, and `npm run build`, then smoke-check chat plus at least one map in Chromium
- New GLBs under `public/assets/packs/` → `npm run assets:inventory` + credit in [`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md)
- Discuss larger features in [Issues](https://github.com/sametkabay/agent-arena/issues) first

**Good first contributions:** bug reports, locale translations (`src/i18n/` + `agent-arena.yaml`), new builtin maps, and attributed GLB packs.
