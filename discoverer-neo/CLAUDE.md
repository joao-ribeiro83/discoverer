# CLAUDE.md — Discoverer Neo

An open-source replacement for Oracle Discoverer 4. npm-workspaces monorepo,
TypeScript throughout.

## Layout

| Workspace | What it is | Test runner |
|---|---|---|
| `backend/` | Fastify API, Drizzle ORM on Postgres, Redis, BullMQ workers | jest |
| `frontend/` | React + Vite | vitest, playwright |
| `migrate/` | Reads an Oracle EUL and imports it | jest |

## Commands

Run from this directory. `--workspaces` fans out to all three.

```bash
npm run typecheck --workspaces && npm run lint --workspaces
```

Per workspace: `npm test -w backend`, `npm test -w frontend`,
`npm test -w migrate`. Backend `pretest` provisions its own test database, so
Docker must be up (`docker compose -f docker-compose.dev.yml up -d`).

Database: `npm run db:generate -w backend` writes a migration,
`db:migrate` applies it, `db:seed` loads fixtures.

Translations: `node scripts/i18n-check.mjs pt-PT fr-FR es-ES` diffs each locale's
namespaces against `en` and exits non-zero on any missing key or placeholder
mismatch. CI runs it.

## Port 5173 is not safe — use 5174 for frontend verification

A Docker nginx container serves a stale `dist/` build on :5173. Playwright's
`reuseExistingServer` treats it as a live dev server and skips launching Vite,
so a bare `npx playwright test` silently tests an old bundle.

Always verify the frontend against port 5174:

```bash
FRONTEND_PORT=5174 VITE_BACKEND_URL=http://localhost:3001 npx playwright test
```

This matches the `discoverer-neo-frontend-verify` config in
`../.claude/launch.json`, which exists for exactly this collision. If a test
result looks impossible, check which port it ran against before believing it.

## EUL schema

`migrate/EUL_SCHEMA_GROUND_TRUTH.md` is the only trustworthy schema reference.
It was rebuilt from Oracle's shipped SQL in `../discoverer10g/sql/`. The
markdown guides in the parent directory carry retraction headers — do not take
table or column names from them. Details in `../CLAUDE.md`.

## Plan

`../DISCOVERER_NEO_SESSION_PLAN.md` holds the phased session plan;
`../DISCOVERER_NEO_ARCHITECTURE.md` the architecture. Both are large — read the
section you need, not the whole file.
