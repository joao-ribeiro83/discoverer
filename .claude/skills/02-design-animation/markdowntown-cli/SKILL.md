---
name: markdowntown-cli
description: Repo workflow for markdowntown CLI development and scans.
allowed-tools: Read, Grep, Glob
model: fable
version: 1.0.0
category: 02-design-animation
tags: []
harness:
- claude-code
- opencode
---

# markdowntown-cli

- Build the scan CLI per `cli/docs/scan-spec-v1.md` and `cli/docs/audit-spec-v1.md`.
- Prefer `rg` for search and keep changes small and deterministic.
- Run `cd cli && make lint` and `cd cli && make test`; CI must be green before finishing.
- Avoid destructive git commands unless explicitly asked.
- For web app changes, follow `apps/web/AGENTS.md`.
- For CLI-only model guidance, see `cli/CLAUDE.md` and `cli/GEMINI.md`.
