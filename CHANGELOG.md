# Changelog

All notable changes to Agent Arena are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the project is in `0.x` preview, minor versions may include breaking changes
to the map format, YAML config and UI.

Release tags use a `v` prefix and a `-preview` pre-release suffix (for example
`v0.2.0-preview`). The `version` field in `package.json` matches the latest
tag without the `v`.

## [Unreleased]

### Added

- This changelog.

### Changed

- Agents are addressed by their given name instead of their role ([#74]).
- README refreshed for v0.2.0-preview and the Mars night orbit clip is sharper ([#66], [#72]).
- Bumped react to 19.3.1, @react-three/fiber to 9.8.2, vitest and @vitest/coverage-v8 to 5.1.2,
  zustand to 5.1.0 and @vitejs/plugin-react to 6.3.0 ([#75], [#76], [#79], [#80]).
- `package.json` `version` now matches the latest release tag (`0.2.0-preview`).

### Fixed

- `@mention` hand-off now works when punctuation follows the name ([#69]).
- Saved models without `extraHeaders` no longer fail silently, and a toast is shown
  when a model call fails ([#73]).

## [0.2.0-preview] - 2026-11-18

### Added

- Custom map assets: import glTF/GLB models in the map editor, stored locally in IndexedDB,
  with rename, replace, delete and a placeholder for missing files ([#58]).
- Conversation mode: agents take turns talking to each other within a turn and time budget
  ([#46]).
- Per-agent personality (temperament) slider ([#55]).
- Duplicate an agent in one click ([#43]).
- Export and import the agent roster with model remapping ([#49]).
- Export and import AI model configs; API keys are excluded unless explicitly included ([#52]).
- Edit zones and point lights in the map editor with undo/redo ([#56]).
- Map preset gallery in Settings → Map ([#54]).
- First-run setup guide and an in-app controls overlay ([#42]).
- Reset playground in Settings → General, with backup shortcuts ([#53]).
- Localized loading screen ([#48]).

### Changed

- Ambient talk (idle chatter) is off by default, so no model calls happen until it is
  turned on ([#38]).
- Built-in library objects, zone names, light names and built-in map text are translated
  in all 10 UI languages ([#62], [#64]).
- Mobile and map editor UI polish ([#45], [#48], [#60], [#62]).
- Bumped i18next to 26.4.0, react-i18next to 17.0.12, vite to 8.2.2,
  @vitejs/plugin-react to 6.1.0 and zustand to 5.0.15 ([#32]–[#36]).

### Fixed

- Importing a map whose id already exists asks to overwrite, import as a copy or cancel
  instead of replacing it ([#51]).
- Map edits are kept and the error is shown when browser storage is full ([#50]).
- Speech bubbles no longer cover agent name labels ([#48]).

## [0.1.1-preview] - 2026-09-02

### Added

- Mobile-friendly playground: touch walk-to and responsive HUD, chat and modals ([#30]).
- Good-first-issue templates and better crawler discoverability ([#14]).

### Changed

- Bumped three to 0.185.1, typescript to 7.0.2, @types/node to 26.2.0, js-yaml to 5.3.0,
  vitest to 4.1.11, actions/checkout to v7 and actions/setup-node to v7
  ([#1]–[#5], [#17], [#18]).

### Security

- Updated locked dependencies to fix a reported vulnerability ([#19]).

## [0.1.0-preview] - 2026-08-14

### Added

- First tagged preview of Agent Arena: a browser-native multi-agent playground with no backend.
- Agents on a 3D map with character looks, role presets, pathfinding and thinking/talking states.
- Private chat, arena chat with `@mention`, and idle mutter.
- Built-in Office, Nature and Space maps in the `aamf` v1 format, day/night lighting
  and a full-screen map editor with `.aamf.json` import/export.
- OpenAI, Gemini, Claude, Ollama and custom OpenAI-compatible providers (bring your own key;
  keys stay in the browser).
- 10 UI languages and YAML/JSON configuration for forks.

[Unreleased]: https://github.com/sametkabay/agent-arena/compare/v0.2.0-preview...HEAD
[0.2.0-preview]: https://github.com/sametkabay/agent-arena/compare/v0.1.1-preview...v0.2.0-preview
[0.1.1-preview]: https://github.com/sametkabay/agent-arena/compare/v0.1.0-preview...v0.1.1-preview
[0.1.0-preview]: https://github.com/sametkabay/agent-arena/releases/tag/v0.1.0-preview
[#1]: https://github.com/sametkabay/agent-arena/pull/1
[#5]: https://github.com/sametkabay/agent-arena/pull/5
[#14]: https://github.com/sametkabay/agent-arena/pull/14
[#17]: https://github.com/sametkabay/agent-arena/pull/17
[#18]: https://github.com/sametkabay/agent-arena/pull/18
[#19]: https://github.com/sametkabay/agent-arena/pull/19
[#30]: https://github.com/sametkabay/agent-arena/pull/30
[#32]: https://github.com/sametkabay/agent-arena/pull/32
[#36]: https://github.com/sametkabay/agent-arena/pull/36
[#38]: https://github.com/sametkabay/agent-arena/pull/38
[#42]: https://github.com/sametkabay/agent-arena/pull/42
[#43]: https://github.com/sametkabay/agent-arena/pull/43
[#45]: https://github.com/sametkabay/agent-arena/pull/45
[#46]: https://github.com/sametkabay/agent-arena/pull/46
[#48]: https://github.com/sametkabay/agent-arena/pull/48
[#49]: https://github.com/sametkabay/agent-arena/pull/49
[#50]: https://github.com/sametkabay/agent-arena/pull/50
[#51]: https://github.com/sametkabay/agent-arena/pull/51
[#52]: https://github.com/sametkabay/agent-arena/pull/52
[#53]: https://github.com/sametkabay/agent-arena/pull/53
[#54]: https://github.com/sametkabay/agent-arena/pull/54
[#55]: https://github.com/sametkabay/agent-arena/pull/55
[#56]: https://github.com/sametkabay/agent-arena/pull/56
[#58]: https://github.com/sametkabay/agent-arena/pull/58
[#60]: https://github.com/sametkabay/agent-arena/pull/60
[#62]: https://github.com/sametkabay/agent-arena/pull/62
[#64]: https://github.com/sametkabay/agent-arena/pull/64
[#66]: https://github.com/sametkabay/agent-arena/pull/66
[#69]: https://github.com/sametkabay/agent-arena/pull/69
[#72]: https://github.com/sametkabay/agent-arena/pull/72
[#73]: https://github.com/sametkabay/agent-arena/pull/73
[#74]: https://github.com/sametkabay/agent-arena/pull/74
[#75]: https://github.com/sametkabay/agent-arena/pull/75
[#76]: https://github.com/sametkabay/agent-arena/pull/76
[#79]: https://github.com/sametkabay/agent-arena/pull/79
[#80]: https://github.com/sametkabay/agent-arena/pull/80
