# Security policy

## Reporting a vulnerability

Use [GitHub Security Advisories](https://github.com/sametkabay/agent-arena/security/advisories/new) for this repository. Do not open a public issue for a vulnerability that could expose user API keys.

## What this app stores

Agent Arena is a static client. There is no backend and no server-side secret store.

- API keys and settings live in the browser (`localStorage`, key from `agent-arena.yaml` → `storage.key`).
- Keys leave the machine only when the browser calls the LLM provider you configured.
- Prefer **restricted, rotatable** keys. Clear site data on a shared computer.
- Claude in the browser sends `anthropic-dangerous-direct-browser-access`; treat that key as origin-exposed, not a server secret.
- Do not paste keys into unofficial forks or lookalike Pages sites. A custom model `baseUrl` sends your key to that host.

## Out of scope (expected for a BYOK playground)

- Keys readable from `localStorage` by same-origin XSS, extensions, or anyone with the browser profile
- LLM prompt injection and jailbreaks (agents have no tools or code execution)
- Provider CORS limits on the GitHub Pages demo (static hosting has no API proxy)
- Cost / quota burn when many agents share one key
