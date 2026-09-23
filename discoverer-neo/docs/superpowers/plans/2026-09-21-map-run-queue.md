# Map Run Queue, Cached Results and Retention Sweeper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every map run (live or scheduled) goes through one background queue, runs one-at-a-time per user, and lands its rows in Postgres with a lifecycle; the UI shows a run history, re-uses a still-valid result instead of hitting Oracle again, and exports are built from the stored rows; a sweeper deletes expired runs.

**Architecture:** One new BullMQ queue `map-runs` fed by a `map_runs` table (metadata + lifecycle) and a `map_run_batches` table (rows in JSONB batches of 1000). The worker claims a run only when the same user has nothing running and nothing older queued (per-user FIFO, enforced by one Postgres `UPDATE … WHERE NOT EXISTS`), streams Oracle rows into batches with the existing `openRowStream`, and stamps `expires_at`. The scheduler and the export worker stop talking to Oracle: the scheduler enqueues a run, the export worker reads batches. The sweeper is a `setInterval` in the map-run worker, same pattern as `cleanupOldExports`.

**Tech Stack:** Fastify 5, Drizzle ORM 0.45 on Postgres 16, BullMQ 5 on Redis 7, oracledb 6 thick mode, React + Vite + TanStack Query, Jest (backend), Vitest + Playwright (frontend).

**Spec:** the *Spec* section below (this file). No separate spec document exists.

## Global Constraints

- Node `>=22`, TypeScript `~5.8.3`. Run `npm run typecheck --workspaces && npm run lint --workspaces` from `discoverer-neo/` before every commit.
- Backend tests need Docker up: `docker compose -f docker-compose.dev.yml up -d` (pretest provisions the test DB). BullMQ tests use real Redis, never a mock.
- Frontend verification only on port 5174: `FRONTEND_PORT=5174 VITE_BACKEND_URL=http://localhost:3001 npx playwright test`.
- Every new UI string exists in `frontend/src/locales/{en,pt-PT,fr-FR,es-ES}/<ns>.json`; `node scripts/i18n-check.mjs pt-PT fr-FR es-ES` must exit 0.
- No new npm dependency. Everything needed (bullmq, ioredis, drizzle, exceljs, fast-csv, pdfkit, zod) is installed.
- No raw Oracle driver text in a client-visible message (SEC-07). Access checks reuse `loadMapWithAccess` / `canAccessMap`; never a new permission model.
- Live results never outlive 24 h, whatever the config says (`MAP_RUN_LIVE_TTL_HOURS` is clamped to 24).
- One feature branch `feat/map-run-queue`, one commit per task, merged to `master` only after Stage 6. Stages 1–5 are not individually deployable because Stage 4 changes the export contract that Stage 5 consumes.
- One model and one effort per session (CLAUDE.md token guard). Do not switch mid-session. Start each stage in a fresh session (`/clear`).

---

## Spec

### What exists today (verified 2026-09-21)

| Thing | Where | Behaviour now |
|---|---|---|
| Live run | `POST /api/maps/:id/execute` → `executeMap()` in `backend/src/services/map-execution.service.ts:794` | Sync, capped at 1 000 rows, rows only in the HTTP body. Only metadata goes to `query_execution_log`. |
| Async run | `POST /api/maps/:id/execute-async`, `GET /api/maps/:id/executions/:jobId` | In-process `Map` registry (`map-execution.service.ts:927`), 30 min TTL, lost on restart. The file comment names it as "the seam to move onto a durable queue". |
| Scheduled run | `processScheduleRun()` in `scheduler.service.ts:706`, queue `scheduler` | Re-runs Oracle, writes an `.xlsx`/`.csv` file under `SCHEDULE_RESULT_DIR`, inserts `scheduled_results`. **No retention, no sweeper.** |
| Export | `POST /api/maps/:id/export` → `processExportJob()` in `export.service.ts:350`, queue `exports` | **Re-runs Oracle** with no row cap, writes a file, `cleanupOldExports()` sweeps files older than `EXPORT_RETENTION_DAYS`. |
| Exporters | `exporters/{csv,excel,pdf}-exporter.ts` | All take `ExportSource { columns: ResultColumn[]; batches: AsyncIterable<Record<string, unknown>[]> }`. This shape is exactly what reading JSONB batches from Postgres produces. |
| Retention in the EUL | `EUL4_BATCH_REPORTS.BR_EXPIRY` (values 1, 4, 10, 30 seen live) | Result-retention days. **Not migrated today** — `schedules` has no such column. |

### Lifecycles

| Kind | `expires_at` | Source of the number |
|---|---|---|
| `LIVE` | `completed_at + min(MAP_RUN_LIVE_TTL_HOURS, 24) h` | config, default 24 |
| `SCHEDULED` | `completed_at + schedules.result_retention_days d` | `BR_EXPIRY` on import, default 30, editable in the schedule form |
| Any failed run | `completed_at + 24 h` | fixed; failures are history, not data |
| Queued but never claimed for 24 h | marked `FAILED` by the sweeper | safety net after a worker crash |

### Re-use rule ("same map, same conditions")

`run_key = sha256(mapId + '|' + userId + '|' + stableJson(parameters) + '|' + stableJson(calculatedFields) + '|' + map.updatedAt.toISOString())`.

`requestRun()` returns an existing run when one with the same `run_key` is `COMPLETED` and `expires_at > now()`, or is `QUEUED`/`RUNNING` (dedupe). `force: true` skips the lookup. The user id is part of the key on purpose: row-level security (Phase 6.3) means two users can get different rows for the same SQL. `map.updatedAt` is in the key so an edited map never serves stale rows.

### Per-user sequential execution

BullMQ 5 (non-Pro) has no per-key concurrency. The worker runs with `concurrency = MAP_RUN_WORKER_CONCURRENCY` (default 3) across users, and inside the processor claims the run with one statement:

```sql
UPDATE map_runs r SET status = 'RUNNING', started_at = now()
WHERE r.id = $1 AND r.status = 'QUEUED'
  AND NOT EXISTS (SELECT 1 FROM map_runs o WHERE o.requested_by = r.requested_by AND o.status = 'RUNNING')
  AND NOT EXISTS (SELECT 1 FROM map_runs o WHERE o.requested_by = r.requested_by AND o.status = 'QUEUED' AND o.created_at < r.created_at)
RETURNING r.id;
```

If nothing is returned the processor calls `await job.moveToDelayed(Date.now() + 2000, token)` and throws BullMQ's `DelayedError` (the documented manual-rate-limit pattern). The second `NOT EXISTS` keeps strict FIFO per user. `// ponytail: 2 s re-poll; move to a per-user BullMQ group if the queue ever holds thousands of waiting runs`.

### Row storage

`map_run_batches(run_id, seq, rows jsonb)`, 1 000 rows per batch (`MAP_RUN_BATCH_SIZE`). One JSONB value per batch keeps the row count small and streams straight into `ExportSource.batches`. Cap `MAP_RUN_MAX_ROWS` (default 100 000) sets `truncated = true`, same semantics as the async path today. Dates, numbers and nulls are stored as the driver returns them after `buildColumns` typing; the viewer already renders `ExecuteResult.rows` of that shape.

### API surface (final)

| Method + URL | Purpose |
|---|---|
| `POST /api/maps/:id/runs` | Request a run. Body `{ parameters?, calculatedFields?, force? }`. `200 { data: run }` on re-use, `202 { data: run }` when queued. |
| `GET /api/runs` | My runs (`?mapId=&status=&kind=&limit=`). Admin may pass `?all=true`. |
| `GET /api/runs/:id` | One run (status, counts, timings, `expiresAt`, `columns`, decoration). |
| `GET /api/runs/:id/rows?offset=&limit=` | Page of stored rows, `limit ≤ 1000`. |
| `DELETE /api/runs/:id` | Cancel if `QUEUED`; otherwise delete the run and its batches. |
| `POST /api/maps/:id/export` | **Now requires `runId`.** Reads batches, never Oracle. |
| `POST /api/maps/:id/execute-async`, `GET/DELETE …/executions/:jobId` | **Removed.** Replaced by runs. |
| `POST /api/maps/:id/execute` | Kept for the builder's 1 000-row preview only. |

### What is deliberately not built

- No fair-share scheduling between users, no priorities. FIFO per user, first-come across users.
- No result diffing, no notifications on completion (poll every second, like exports do today).
- No compression of JSONB batches. Postgres TOAST already compresses them.
- No separate worker container. Same in-process pattern as the two existing workers, with a standalone entry for later.

---

## Stage overview, models and skills

| Stage | Scope | Session model / effort | Implementer sub-agents | Reviewer sub-agents | Skills |
|---|---|---|---|---|---|
| 1 | Schema + run store | Opus 5 / medium | `general-purpose` on **Sonnet 5** (1 per task) | `feature-dev:code-reviewer` on **Opus 5** | superpowers:test-driven-development, superpowers:subagent-driven-development, superpowers:verification-before-completion |
| 2 | Queue, worker, service, sweeper | Opus 5 / **high** (claim logic and DelayedError are the subtle part) | `general-purpose` on **Sonnet 5** | `feature-dev:code-reviewer` on **Opus 5**, then `ponytail:ponytail-review` | same + context7 for BullMQ `moveToDelayed`/`DelayedError` |
| 3 | HTTP API + authz | Opus 5 / medium | `general-purpose` on **Sonnet 5** | `code-modernization:security-auditor` on **Opus 5 high** (authz), `feature-dev:code-reviewer` on **Opus 5** | same + `security-review` |
| 4 | Scheduler + export on the store, BR_EXPIRY import | Opus 5 / medium | `general-purpose` on **Sonnet 5**; `Explore` on **Haiku 4.5** for lookups | `feature-dev:code-reviewer` on **Opus 5** | same |
| 5 | Frontend: hook, viewer, Runs page, export gating, i18n | Opus 5 / medium | `general-purpose` on **Sonnet 5** with `frontend-design`; locale JSON copies via `general-purpose` on **Haiku 4.5** | `feature-dev:code-reviewer` on **Opus 5**; gstack `/qa` on **Sonnet 5** | frontend-design, superpowers:test-driven-development, `/qa` |
| 6 | Ship: docs, compose env, live migration, verify, memory | **Sonnet 5** / medium | docs translations via **Haiku 4.5** | `code-review` skill at effort high | superpowers:finishing-a-development-branch, `/ship`, `/document-release`, `/canary` |

Rules for every sub-agent dispatch: pass `model` explicitly, give the task text verbatim from this file, tell it the branch is `feat/map-run-queue`, and tell it not to run `/compact`.

### How to use the prompts in this file

- Each stage has a **Stage session prompt**. Open a fresh Claude Code session in `E:\claude\discoverer` (`/clear` first), pick the model and effort in the app's model picker **before** the first message, then paste the block. Do not change model or effort later in that session.
- Each task has a **Task prompt**. The stage session pastes it into the `Agent` tool as the sub-agent's full prompt, with `model` set as the block says. Running inline instead of a sub-agent is fine: paste it as the next user message.
- Every prompt names the plan file. The worker reads only its own task section, not the whole plan.
- Plan path used in every prompt: `discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md`.

---

## Stage 1 — Run store (schema + data access)

Session: Opus 5, effort medium. Start: `git checkout -b feat/map-run-queue` from `master`.

**Stage 1 session prompt** (model: Opus 5, effort: medium):

```text
Stage 1 of discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md: run store (schema + data access).
Use superpowers:subagent-driven-development. Read only the "Global Constraints", "Spec" and "Stage 1" sections of the plan.
Branch: create feat/map-run-queue from master in discoverer-neo/. Docker dev stack must be up (docker compose -f docker-compose.dev.yml up -d).
For each of Tasks 1.1, 1.2, 1.3 in order: dispatch one general-purpose sub-agent with model "sonnet" using the task's "Task prompt" block verbatim; after it reports, dispatch feature-dev:code-reviewer with model "opus" on the task's diff; apply findings; commit.
Stage exit: npm run typecheck -w backend && npm run lint -w backend && npm test -w backend all green; paste the tails. Do not run /compact. Do not start Stage 2.
```

### Task 1.1: Schema and migration 0028

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 1.1 "Schema and migration 0028" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section and the "Spec > Row storage" and "Lifecycles" parts only.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Use superpowers:test-driven-development where a test applies (here: typecheck + migrate are the check).
Do: add runKindEnum, runStatusEnum, mapRuns, mapRunBatches, mapRunsRelations, schedules.resultRetentionDays (integer not null default 30) and scheduledResults.runId (uuid null, FK map_runs on delete set null) to backend/src/db/schema.ts exactly as the task shows. Run npm run db:generate -w backend, rename the file to 0028_map_runs.sql and fix drizzle/meta/_journal.json, run npm run db:migrate -w backend, then npm run typecheck -w backend.
Commit: git add backend/src/db/schema.ts backend/drizzle && git commit -m "feat(runs): map_runs and map_run_batches tables, schedule retention column".
Report: the migration file name, the DDL statements it contains, and the exact output tails of migrate and typecheck. Do not touch any other file.
```

**Files:**
- Modify: `backend/src/db/schema.ts` (after `scheduledResults`, line ~252; add enum near line 66)
- Create: `backend/drizzle/0028_map_runs.sql` via `npm run db:generate -w backend`
- Test: `backend/src/__tests__/integration/map-run-store.test.ts` (created in 1.2; this task only needs typecheck + migrate)

**Interfaces — Produces:**

```ts
export const runKindEnum = pgEnum('run_kind', ['LIVE', 'SCHEDULED']);
export const runStatusEnum = pgEnum('run_status', ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);

export const mapRuns = pgTable('map_runs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mapId: uuid('map_id').notNull().references(() => maps.id, { onDelete: 'cascade' }),
  requestedBy: uuid('requested_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: runKindEnum('kind').notNull(),
  scheduleId: uuid('schedule_id').references(() => schedules.id, { onDelete: 'set null' }),
  runKey: varchar('run_key', { length: 64 }).notNull(),
  parameters: jsonb('parameters').notNull().default(sql`'{}'::jsonb`),
  calculatedFields: jsonb('calculated_fields').notNull().default(sql`'[]'::jsonb`),
  status: runStatusEnum('status').notNull().default('QUEUED'),
  columns: jsonb('columns'),            // ResultColumn[]
  decoration: jsonb('decoration'),      // { groupBreakAliases?, totals?, conditionalFormats?, warnings? }
  rowCount: integer('row_count'),
  truncated: boolean('truncated').notNull().default(false),
  executionTimeMs: integer('execution_time_ms'),
  sqlText: text('sql_text'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('map_runs_user_status_created_idx').on(t.requestedBy, t.status, t.createdAt),
  index('map_runs_key_idx').on(t.runKey, t.status),
  index('map_runs_expires_idx').on(t.expiresAt),
  index('map_runs_map_idx').on(t.mapId),
]);

export const mapRunBatches = pgTable('map_run_batches', {
  runId: uuid('run_id').notNull().references(() => mapRuns.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  rows: jsonb('rows').notNull(),        // Record<string, unknown>[]
}, (t) => [primaryKey({ columns: [t.runId, t.seq] })]);
```

Also in this migration: `schedules.result_retention_days integer NOT NULL DEFAULT 30` and `scheduled_results.run_id uuid NULL REFERENCES map_runs(id) ON DELETE SET NULL`. Both are used in Stage 4 but ship in one migration so live has one DDL step.

- [ ] **Step 1: Add the enums, tables and two columns to `schema.ts`** (copy the block above; add `scheduledResults.runId` and `schedules.resultRetentionDays`; add `mapRunsRelations` next to `scheduledResultsRelations` at line ~637).
- [ ] **Step 2: Generate the migration** — Run: `npm run db:generate -w backend`. Expected: `drizzle/0028_*.sql` with two `CREATE TYPE`, two `CREATE TABLE`, two `ALTER TABLE ADD COLUMN`. Rename the file to `0028_map_runs.sql` and fix `meta/_journal.json` tag to match.
- [ ] **Step 3: Apply to the dev DB** — Run: `npm run db:migrate -w backend`. Expected: exit 0. Then `npm run typecheck -w backend` exit 0.
- [ ] **Step 4: Commit** — `git add backend/src/db/schema.ts backend/drizzle && git commit -m "feat(runs): map_runs and map_run_batches tables, schedule retention column"`.

### Task 1.2: Run key and lifecycle helpers (pure)

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 1.2 "Run key and lifecycle helpers" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section and "Spec > Re-use rule" and "Spec > Lifecycles".
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Use superpowers:test-driven-development: write backend/src/__tests__/map-run-key.test.ts exactly as the task shows, run it and confirm it fails, then create backend/src/lib/map-run-key.ts exporting stableJson, buildRunKey, liveExpiry, scheduledExpiry with the signatures in the task. Use node:crypto sha256. No new dependency.
Run: npx jest src/__tests__/map-run-key.test.ts from backend/ until green, then npm run lint -w backend.
Commit: git commit -m "feat(runs): run key hash and expiry helpers".
Report: test output tail and the exported function signatures.
```

**Files:**
- Create: `backend/src/lib/map-run-key.ts`
- Test: `backend/src/__tests__/map-run-key.test.ts`

**Interfaces — Produces:**

```ts
export function stableJson(value: unknown): string;      // keys sorted recursively, undefined dropped
export function buildRunKey(input: { mapId: string; userId: string; parameters: Record<string, unknown>; calculatedFields: unknown[]; mapUpdatedAt: Date }): string; // sha256 hex, 64 chars
export function liveExpiry(completedAt: Date, ttlHours: number): Date;   // ttl clamped to [1, 24]
export function scheduledExpiry(completedAt: Date, retentionDays: number): Date; // clamped to [1, 3650]
```

- [ ] **Step 1: Write the failing tests**

```ts
import { buildRunKey, liveExpiry, scheduledExpiry, stableJson } from '../lib/map-run-key.js';

describe('map-run-key', () => {
  const base = { mapId: 'm', userId: 'u', parameters: { b: 1, a: 'x' }, calculatedFields: [], mapUpdatedAt: new Date('2026-09-21T00:00:00Z') };
  it('ignores parameter key order', () => {
    expect(buildRunKey(base)).toBe(buildRunKey({ ...base, parameters: { a: 'x', b: 1 } }));
  });
  it('changes when the map changes, the user changes, or a calc field is added', () => {
    expect(buildRunKey({ ...base, mapUpdatedAt: new Date('2026-09-22T00:00:00Z') })).not.toBe(buildRunKey(base));
    expect(buildRunKey({ ...base, userId: 'v' })).not.toBe(buildRunKey(base));
    expect(buildRunKey({ ...base, calculatedFields: [{ name: 'c', formula: '1' }] })).not.toBe(buildRunKey(base));
  });
  it('is 64 hex chars', () => expect(buildRunKey(base)).toMatch(/^[0-9a-f]{64}$/));
  it('clamps live TTL to 24 h', () => {
    const t = new Date('2026-09-21T10:00:00Z');
    expect(liveExpiry(t, 72).toISOString()).toBe('2026-09-22T10:00:00.000Z');
    expect(liveExpiry(t, 0).toISOString()).toBe('2026-09-21T11:00:00.000Z');
  });
  it('scheduled expiry uses days', () => {
    expect(scheduledExpiry(new Date('2026-09-21T10:00:00Z'), 30).toISOString()).toBe('2026-10-21T10:00:00.000Z');
  });
  it('stableJson drops undefined', () => expect(stableJson({ a: undefined, b: null })).toBe('{"b":null}'));
});
```

- [ ] **Step 2: Run** `npx jest src/__tests__/map-run-key.test.ts -w backend` → FAIL (module not found).
- [ ] **Step 3: Implement** with `node:crypto` `createHash('sha256')`; no dependency.
- [ ] **Step 4: Run again** → PASS. Lint clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(runs): run key hash and expiry helpers"`.

### Task 1.3: Run store

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 1.3 "Run store" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section, "Spec > Per-user sequential execution" (the claim SQL) and "Spec > Lifecycles".
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Docker dev stack is up; backend tests use the real test Postgres (pretest provisions it).
Use superpowers:test-driven-development: write backend/src/__tests__/integration/map-run-store.test.ts covering every case listed in the task's Step 1 (seed one user and one map the way schedules.test.ts does), run npm test -w backend -- map-run-store and confirm it fails, then create backend/src/services/map-run.store.ts with exactly the exported names and signatures in the task's "Produces" block. claimRun and cleanupExpiredRuns use db.execute(sql`...`) with the SQL from the spec verbatim. readBatches is an async generator; never load all batches at once.
Run the test file until green, then npm run typecheck -w backend && npm run lint -w backend.
Commit: git commit -m "feat(runs): map run store with per-user FIFO claim and expiry sweep".
Report: test output tail, and confirm the claim SQL in the file matches the spec character for character.
```

**Files:**
- Create: `backend/src/services/map-run.store.ts`
- Test: `backend/src/__tests__/integration/map-run-store.test.ts` (real test Postgres, like `schedules.test.ts`; seed one user and one map with the fixtures those tests use)

**Interfaces — Produces:**

```ts
export type RunKind = 'LIVE' | 'SCHEDULED';
export type RunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export interface MapRunRow { /* = typeof mapRuns.$inferSelect */ }

export interface CreateRunInput { mapId: string; requestedBy: string; kind: RunKind; scheduleId?: string; runKey: string; parameters: Record<string, unknown>; calculatedFields: unknown[]; expiresAt: Date; }
export async function createRun(input: CreateRunInput): Promise<MapRunRow>;
export async function findReusableRun(runKey: string, now?: Date): Promise<MapRunRow | null>; // COMPLETED & not expired, or QUEUED/RUNNING; newest first
export async function claimRun(runId: string): Promise<boolean>;                // the UPDATE … NOT EXISTS from the spec; true when claimed
export async function appendBatch(runId: string, seq: number, rows: Record<string, unknown>[]): Promise<void>;
export async function completeRun(runId: string, r: { columns: ResultColumn[]; decoration: Record<string, unknown>; rowCount: number; truncated: boolean; executionTimeMs: number; sqlText: string | null; expiresAt: Date }): Promise<void>;
export async function failRun(runId: string, r: { status: 'FAILED' | 'CANCELLED'; errorMessage: string | null; expiresAt: Date }): Promise<void>;
export async function cancelIfQueued(runId: string): Promise<boolean>;
export async function getRun(runId: string): Promise<MapRunRow | null>;
export async function listRuns(f: { requestedBy?: string; mapId?: string; status?: RunStatus; kind?: RunKind; limit: number }): Promise<MapRunRow[]>;
export async function readRows(runId: string, offset: number, limit: number): Promise<Record<string, unknown>[]>; // slices across batches by MAP_RUN_BATCH_SIZE
export function readBatches(runId: string): AsyncIterable<Record<string, unknown>[]>;                                // ORDER BY seq, one batch at a time
export async function deleteRun(runId: string): Promise<boolean>;
export async function cleanupExpiredRuns(now?: Date): Promise<{ deleted: number; staleFailed: number }>;  // DELETE expires_at < now (terminal); QUEUED/RUNNING older than 24 h → FAILED 'stale'
```

- [ ] **Step 1: Write the failing integration tests** — cover: create + get; `findReusableRun` returns COMPLETED unexpired, ignores expired, returns QUEUED; `claimRun` refuses when the same user has a RUNNING run, refuses when an older QUEUED run exists for the same user, allows a different user; `appendBatch` + `readRows(1500, 700)` spanning two batches; `readBatches` order; `cleanupExpiredRuns` deletes expired and cascades batches, marks a 25 h-old QUEUED run FAILED, leaves a fresh one alone; `deleteRun` cascades.
- [ ] **Step 2: Run** `npm test -w backend -- map-run-store` → FAIL.
- [ ] **Step 3: Implement** with Drizzle; `claimRun` and `cleanupExpiredRuns` use `db.execute(sql\`...\`)` verbatim from the spec. `readBatches` is an `async function*` selecting `seq, rows` with `orderBy(seq)`; do not load all batches at once.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(runs): map run store with per-user FIFO claim and expiry sweep"`.

**Stage 1 exit:** `npm test -w backend` green, typecheck + lint green. Reviewer (`feature-dev:code-reviewer`, Opus 5) reads the three new files and the migration; fix findings; commit.

---

## Stage 2 — Queue, worker, service and sweeper

Session: Opus 5, effort high. Before writing the worker, fetch BullMQ docs through context7 (`resolve-library-id` "bullmq", `query-docs` "moveToDelayed DelayedError manual rate limit in processor") so the token argument and the throw are correct for `bullmq ^5.80`.

**Stage 2 session prompt** (model: Opus 5, effort: high):

```text
Stage 2 of discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md: queue, worker, service and sweeper.
Use superpowers:subagent-driven-development. Read "Global Constraints", "Spec" and "Stage 2" of the plan. Branch feat/map-run-queue (Stage 1 is committed there). Docker dev stack up.
First, with context7: resolve-library-id "bullmq", then query-docs for "moveToDelayed DelayedError manual rate limit inside processor" and "Worker concurrency option". Paste the exact snippet into the Task 2.4 prompt before dispatching it.
For Tasks 2.1, 2.2, 2.3, 2.4 in order: dispatch one general-purpose sub-agent, model "sonnet", with the task's "Task prompt" verbatim; then feature-dev:code-reviewer, model "opus", on the diff; apply findings; commit.
After 2.4: run ponytail:ponytail-review on the Stage 2 diff and remove anything speculative.
Stage exit: full backend suite, typecheck and lint green; grep for "ORA-" in map-run.runner.ts must show only the sanitising code. Do not run /compact. Do not start Stage 3.
```

### Task 2.1: Config keys

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 2.1 "Config keys" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task's table only.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue.
Add the seven MAP_RUN_* keys to backend/src/config.ts next to the EXPORT_* keys, same zod style as EXPORT_WORKER_CONCURRENCY (MAP_RUN_WORKER_ENABLED follows the same NODE_ENV !== 'test' rule as EXPORT_WORKER_ENABLED). Add them with their defaults to backend/.env.example and to the backend environment block of docker-compose.yml and docker-compose.prod.yml.
Run npm run typecheck -w backend. Commit: git commit -m "feat(runs): config keys".
Report: the seven names with defaults as they appear in config.ts.
```

**Files:** Modify `backend/src/config.ts` (next to the `EXPORT_*` keys, ~line 254), `backend/.env.example`, `docker-compose.yml`, `docker-compose.prod.yml` (backend `environment:` blocks).

| Key | Default | Note |
|---|---|---|
| `MAP_RUN_WORKER_ENABLED` | `NODE_ENV !== 'test'` | same rule as the other two |
| `MAP_RUN_WORKER_CONCURRENCY` | 3 (max 8) | across users |
| `MAP_RUN_LIVE_TTL_HOURS` | 24 | clamped to 24 by `liveExpiry` |
| `MAP_RUN_MAX_ROWS` | 100000 | truncation cap |
| `MAP_RUN_BATCH_SIZE` | 1000 | rows per JSONB batch |
| `MAP_RUN_CLEANUP_INTERVAL_MINUTES` | 15 | sweeper |
| `MAP_RUN_STALE_HOURS` | 24 | QUEUED/RUNNING older than this → FAILED |

- [ ] **Step 1:** add the zod entries with the same style as `EXPORT_WORKER_CONCURRENCY`. Typecheck. Commit `feat(runs): config keys`.

### Task 2.2: Queue module

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 2.2 "Queue module" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue.
Create backend/src/queues/map-run.queue.ts mirroring backend/src/queues/export.queue.ts: MAP_RUN_QUEUE_NAME = 'map-runs', RUN_MAP_JOB = 'run-map', MapRunJobData { runId }, lazy singleton mapRunQueue(), enqueueRun(runId) with jobId = runId, attempts 1, removeOnComplete {age: 3600, count: 1000}, removeOnFail {age: 86400, count: 1000}. Add a queue-depth gauge for it in backend/src/plugins/metrics.ts beside the export and scheduler gauges.
Run npm run typecheck -w backend && npm run lint -w backend. Commit: git commit -m "feat(runs): map-runs queue".
Report: the exported names and the job options object.
```

**Files:** Create `backend/src/queues/map-run.queue.ts` (mirror `export.queue.ts`).

```ts
export const MAP_RUN_QUEUE_NAME = 'map-runs';
export const RUN_MAP_JOB = 'run-map';
export interface MapRunJobData { runId: string }
export function mapRunQueue(): Queue<MapRunJobData>;   // lazy singleton like exportQueue()
export async function enqueueRun(runId: string): Promise<void>; // jobId = runId (dedupes re-enqueue), attempts 1, removeOnComplete {age: 3600, count: 1000}, removeOnFail {age: 86400, count: 1000}
```

`attempts: 1` on purpose: a retry would re-run Oracle for a user who may already have hit Cancel; failures are recorded on the run row instead.

- [ ] **Step 1:** write it. Add its name to the queue-depth metrics in `plugins/metrics.ts` beside the export and scheduler gauges. Typecheck. Commit `feat(runs): map-runs queue`.

### Task 2.3: Run service (request, cancel)

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 2.3 "Run service" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section and "Spec > Re-use rule".
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue.
Use superpowers:test-driven-development: write backend/src/__tests__/map-run.service.test.ts as a hermetic test with a MapRunServiceDeps fake (same style as backend/src/__tests__/integration/scheduler.test.ts, no Postgres, no Redis), covering the six cases in the task's Step 1. Confirm it fails. Then create backend/src/services/map-run.service.ts exporting requestRun and cancelRun with the signatures in the task; deps default to the Stage 1 store, buildRunKey/liveExpiry/scheduledExpiry from lib/map-run-key.ts, loadMapDefinition from services/sql-generator.ts (for updatedAt) and enqueueRun from queues/map-run.queue.ts. Initial expiresAt on create is now + 24 h.
Run the test file until green; npm run typecheck -w backend && npm run lint -w backend.
Commit: git commit -m "feat(runs): requestRun with result re-use and cancel".
Report: test output tail and the RequestRunInput fields.
```

**Files:**
- Create: `backend/src/services/map-run.service.ts`
- Test: `backend/src/__tests__/map-run.service.test.ts` (hermetic with a `MapRunServiceDeps` fake, same style as `scheduler.test.ts`)

**Interfaces — Consumes:** Stage 1 store, `buildRunKey`, `liveExpiry`, `scheduledExpiry`, `loadMapDefinition(mapId)` from `sql-generator.ts:318` (for `updatedAt`), `enqueueRun`.

**Produces:**

```ts
export interface RequestRunInput { mapId: string; userId: string; kind: RunKind; parameters?: Record<string, unknown>; calculatedFields?: CalculatedFieldInput[]; scheduleId?: string; retentionDays?: number; force?: boolean }
export interface RequestRunResult { run: MapRunRow; reused: boolean }
export async function requestRun(input: RequestRunInput, deps?: MapRunServiceDeps): Promise<RequestRunResult>;
export async function cancelRun(runId: string, deps?: MapRunServiceDeps): Promise<'cancelled' | 'not_queued' | 'not_found'>; // cancelIfQueued + queue.remove(jobId)
```

Initial `expiresAt` on create is `now + 24 h` for both kinds (a placeholder until completion stamps the real one, so the sweeper's stale rule still applies).

- [ ] **Step 1: Failing tests** — reuse hit returns `reused: true` and does not enqueue; expired hit creates + enqueues; `force` creates even when a hit exists; QUEUED hit is returned (dedupe); SCHEDULED passes `scheduleId` and `kind`; `cancelRun` outcomes.
- [ ] **Step 2:** FAIL → implement → PASS → commit `feat(runs): requestRun with result re-use and cancel`.

### Task 2.4: Worker with per-user FIFO claim, streaming and sweeper

**Task prompt** (sub-agent model: Sonnet 5; the stage session pastes the BullMQ `moveToDelayed`/`DelayedError` snippet from context7 at the end of this prompt):

```text
Task 2.4 "Worker with per-user FIFO claim, streaming and sweeper" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section, "Spec > Per-user sequential execution" and "Spec > Row storage".
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Docker dev stack up (workers.test.ts uses real Redis).
Use superpowers:test-driven-development in this order:
1. backend/src/__tests__/map-run.runner.test.ts (hermetic fakes) with the five cases in Step 1; confirm it fails; create backend/src/services/map-run.runner.ts exporting processMapRun(runId, deps) returning 'ran' | 'busy' | 'gone' with the flow described in the task (claimRun → prepareQuery with MAP_RUN_MAX_ROWS + 1 → openRowStream → appendBatch per MAP_RUN_BATCH_SIZE → buildColumns → completeRun with liveExpiry or scheduledExpiry → recordExecution; failRun with a sanitised message and expiresAt now + 24 h; release the Oracle connection in finally). Reuse the FORBIDDEN/timeout message constants already in map-execution.service.ts. Green.
2. backend/src/workers/map-run.worker.ts: startMapRunWorker(logger) with Worker concurrency config.MAP_RUN_WORKER_CONCURRENCY; on 'busy' call await job.moveToDelayed(Date.now() + 2000, token) then throw new DelayedError(); sweeper setInterval(cleanupExpiredRuns, MAP_RUN_CLEANUP_INTERVAL_MINUTES * 60_000).unref() cleared in close(); metrics like export.worker.ts. Add backend/src/workers/map-run.standalone.ts (copy scheduler.standalone.ts) and the "worker:map-runs" script in backend/package.json. Start it from backend/src/app.ts next to the other two workers behind config.MAP_RUN_WORKER_ENABLED.
3. Extend backend/src/__tests__/integration/workers.test.ts: obliterate the map-runs queue in beforeAll like the others; startMapRunWorker returns close(); close() resolves within 1 s.
4. Delete executeMapAsync, AsyncJob, pruneJobs and the ASYNC_* constants from backend/src/services/map-execution.service.ts and their tests in map-execution.test.ts. Make the three async routes in backend/src/routes/map-execution.ts reply 410 for now (Stage 3 removes them).
Run npm test -w backend, npm run typecheck -w backend, npm run lint -w backend until green.
Commit: git commit -m "feat(runs): map-run worker with per-user FIFO claim, batch streaming and expiry sweeper".
Report: test tails; the exact lines where moveToDelayed and DelayedError are used; confirm grep "ORA-" in map-run.runner.ts only hits the sanitising code.
```

**Files:**
- Create: `backend/src/workers/map-run.worker.ts`, `backend/src/workers/map-run.standalone.ts` (copy of `scheduler.standalone.ts` shape)
- Create: `backend/src/services/map-run.runner.ts` — the processor body, testable without BullMQ
- Modify: `backend/src/app.ts:137-147` (start the worker like the other two), `backend/package.json` scripts (`"worker:map-runs": "tsx src/workers/map-run.standalone.ts"`)
- Test: `backend/src/__tests__/map-run.runner.test.ts` (hermetic fakes), extend `backend/src/__tests__/integration/workers.test.ts` for wiring (obliterate `map-runs` queue in `beforeAll` like the others)

**Produces:**

```ts
// map-run.runner.ts
export type ClaimOutcome = 'ran' | 'busy' | 'gone';
export interface RunnerDeps { claimRun; getRun; prepareQuery; getConnection; openRowStream; buildColumns; appendBatch; completeRun; failRun; recordExecution; loadSchedule?; insertScheduledResult?; now: () => Date }
export async function processMapRun(runId: string, deps?: RunnerDeps): Promise<ClaimOutcome>;
```

Processor flow: `claimRun` false → return `'busy'`. Otherwise: `getRun` (status must still be RUNNING, else `'gone'`); `prepareQuery(mapId, parameters, requestedBy, MAP_RUN_MAX_ROWS + 1, undefined)` with `calculatedFields` exactly as `executeMap` passes them; `openRowStream`; loop rows into batches of `MAP_RUN_BATCH_SIZE`, `appendBatch` each; stop at cap and set `truncated`; `buildColumns`; `completeRun` with `expiresAt = kind === 'LIVE' ? liveExpiry(now, cfg) : scheduledExpiry(now, retentionDays)`; `recordExecution` into `query_execution_log` as `executeMap` does (SEC-07 message rule). On error: `failRun` with a sanitised message (reuse the refusal/timeout mapping already in `map-execution.service.ts`, the `FORBIDDEN`/timeout constants near line 709) and `expiresAt = now + 24 h`. Wrap in `try/finally` releasing the Oracle connection.

Worker: `Worker<MapRunJobData>(MAP_RUN_QUEUE_NAME, async (job, token) => { const o = await processMapRun(job.data.runId); if (o === 'busy') { await job.moveToDelayed(Date.now() + 2000, token); throw new DelayedError(); } }, { concurrency: config.MAP_RUN_WORKER_CONCURRENCY })`. Sweeper: `setInterval(() => cleanupExpiredRuns().then(log).catch(log), MAP_RUN_CLEANUP_INTERVAL_MINUTES * 60_000).unref()`, cleared in `close()` — copy the shape of `export.worker.ts:118-132`.

- [ ] **Step 1: Failing runner tests** — busy claim returns `'busy'` and touches no Oracle dep; happy path writes N batches (2 500 rows → seq 0,1,2 with 1000/1000/500) and completes with `truncated:false`; cap at `MAP_RUN_MAX_ROWS` sets `truncated:true`; Oracle throw → `failRun` called with a message that contains no `ORA-` text and the connection is released; SCHEDULED run gets `scheduledExpiry` with the schedule's retention.
- [ ] **Step 2:** FAIL → implement runner → PASS.
- [ ] **Step 3: Worker wiring test** in `workers.test.ts`: `startMapRunWorker(logger)` returns an object with `close()`, emits metrics, and the sweep timer is unref'd (assert `close()` resolves within 1 s).
- [ ] **Step 4: Delete the in-memory async registry** — remove `executeMapAsync`, `AsyncJob`, `pruneJobs`, `ASYNC_*` constants from `map-execution.service.ts:918-1000` and their unit tests in `map-execution.test.ts`. Leave the three routes in place for Stage 3 to replace (they will fail typecheck until then, so do this step and Task 3.1 in the same commit if you prefer; otherwise stub the routes to `410 Gone` now).
- [ ] **Step 5:** typecheck, lint, `npm test -w backend` green. Commit `feat(runs): map-run worker with per-user FIFO claim, batch streaming and expiry sweeper`.

**Stage 2 exit:** Reviewer on Opus 5 checks: claim SQL matches spec verbatim; `DelayedError` is thrown after `moveToDelayed` with the token; connection released on every path; no ORA text in stored messages. Then `ponytail:ponytail-review` on the diff to strip anything speculative.

---

## Stage 3 — HTTP API and authorisation

Session: Opus 5, effort medium.

**Stage 3 session prompt** (model: Opus 5, effort: medium):

```text
Stage 3 of discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md: HTTP API and authorisation.
Use superpowers:subagent-driven-development. Read "Global Constraints", "Spec > API surface" and "Stage 3". Branch feat/map-run-queue (Stages 1–2 committed). Docker dev stack up.
Dispatch one general-purpose sub-agent, model "sonnet", with the Task 3.1 "Task prompt" verbatim. Then dispatch code-modernization:security-auditor, model "opus", with the "Stage 3 review prompt". Then feature-dev:code-reviewer, model "opus", on the diff. Apply findings, commit.
Stage exit: backend suite, typecheck, lint green; docs/api/endpoints.md regenerated and committed. Do not run /compact. Do not start Stage 4.
```

**Stage 3 review prompt** (security-auditor, model: Opus 5, effort: high):

```text
Review backend/src/routes/map-runs.ts and backend/src/__tests__/integration/map-runs-routes.test.ts on branch feat/map-run-queue in E:\claude\discoverer\discoverer-neo against "Stage 3 > Authz" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md.
Check: (1) every /runs/:id route returns 404, not 403, for another user's run; (2) the admin-only all=true flag cannot be reached by a plain user; (3) rows of a run are hidden once canAccessMap(user, map, 'VIEW') is false, even for the run's owner; (4) a GET-by-id scan across users exists in the test file, the same pattern as Phase 6.2's object authz tests (grep for "scan" in backend/src/__tests__/integration/security.test.ts for the shape); (5) no raw Oracle or driver text reaches a response.
Report only confirmed findings with file:line and a one-line fix each. Do not edit files.
```

### Task 3.1: Routes

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 3.1 "Routes" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section and "Spec > API surface".
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Docker dev stack up.
Use superpowers:test-driven-development: write backend/src/__tests__/integration/map-runs-routes.test.ts (build the app with buildApp(), log in with the fixture users as map-execution-routes.test.ts does, inject fake prepareQuery/openRowStream the way export-routes.test.ts does) covering all ten cases in the task's Step 1. Confirm it fails. Then create backend/src/routes/map-runs.ts with the five routes, the zod schemas and the authz rules written in the task (loadMapWithAccess from routes/maps.ts, canAccessMap and isAdmin as export.ts uses them), register it in backend/src/app.ts next to map-execution, and delete the /execute-async and /executions/:jobId routes from backend/src/routes/map-execution.ts. Add the toRunDto shape from the task; sql only for admins.
Then run npm run generate-spec -w backend and rebuild docs/api/endpoints.md the way docs/api/README.md describes.
Run npm test -w backend, typecheck, lint until green.
Commit: git commit -m "feat(runs): run request, list, rows and cancel routes; drop in-memory async execution" (include the regenerated docs).
Report: test tail, the route table (method, URL, preHandler, status codes), and the endpoints.md diff summary.
```

**Files:**
- Create: `backend/src/routes/map-runs.ts`; register in `backend/src/app.ts` next to `map-execution` routes
- Modify: `backend/src/routes/map-execution.ts` — delete `/execute-async`, `/executions/:jobId` GET and DELETE (lines 286–420 region), keep `/execute`, `/explain`, `/history`
- Modify: `frontend/src/lib/api.ts` only in Stage 5; do not touch now
- Test: `backend/src/__tests__/integration/map-runs-routes.test.ts` (build app with `buildApp()`, log in with the fixture users as `map-execution-routes.test.ts:20` does, mock nothing but Oracle — inject a fake `prepareQuery`/`openRowStream` the way `export-routes.test.ts` does)

**Zod bodies:**

```ts
const RequestRunBodySchema = z.object({
  parameters: z.record(z.unknown()).optional(),
  calculatedFields: ExecuteBodySchema.shape.calculatedFields,   // reuse, max 50
  force: z.boolean().optional(),
});
const RowsQuerySchema = z.object({ offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(1000).default(200) });
const ListQuerySchema = z.object({ mapId: z.string().uuid().optional(), status: z.enum([...]).optional(), kind: z.enum(['LIVE','SCHEDULED']).optional(), limit: z.coerce.number().int().min(1).max(200).default(50), all: z.coerce.boolean().optional() });
```

**Authz (no new model):**
- `POST /api/maps/:id/runs` → `loadMapWithAccess(request, reply, 'VIEW')` then `requestRun({ kind: 'LIVE', userId: user.sub, … })`. Reply `200` when `reused`, else `202`.
- `GET /api/runs` → own runs; `all=true` only when `isAdmin(request)`, else `403`.
- `GET /api/runs/:id`, `GET /api/runs/:id/rows`, `DELETE /api/runs/:id` → `404` unless `run.requestedBy === user.sub || isAdmin(request)`; additionally `canAccessMap(user, map, 'VIEW')` must still hold (a revoked grant must hide old rows — same rule `export.ts:85-114` applies to downloads).
- Rows of a run that is not `COMPLETED` → `409 { error: 'RUN_NOT_COMPLETED' }`. Expired run → `410`.

Response shape for a run (`toRunDto`): `{ id, mapId, mapName, kind, scheduleId, status, parameters, calculatedFields, columns, decoration, rowCount, truncated, executionTimeMs, errorMessage, createdAt, startedAt, completedAt, expiresAt, sql? (admin only) }`.

- [ ] **Step 1: Failing route tests** — 202 on a new run and 200 on the identical second request; other user cannot see the run (404); admin can; rows pagination (offset 1500 limit 700 returns 700 rows across two batches, seeded via the store); `409` before completion; `410` after expiry; `DELETE` on QUEUED returns `{ cancelled: true }`; `all=true` as non-admin → 403; removed async routes return 404.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Regenerate the API doc** — Run: `npm run generate-spec -w backend` and rebuild `docs/api/endpoints.md` the way Phase 8.4 does (the generator writes the OpenAPI YAML; check `docs/api/README.md` for the endpoints.md command). Commit the doc with the routes.
- [ ] **Step 4:** Commit `feat(runs): run request, list, rows and cancel routes; drop in-memory async execution`.

**Stage 3 exit:** `code-modernization:security-auditor` (Opus 5, effort high) reviews `map-runs.ts` for IDOR (`/runs/:id` scan across users), the admin `all` flag, and rows leakage after a grant is revoked — the same GET-by-id scan test pattern from Phase 6.2 must exist in the new test file. Fix, commit.

---

## Stage 4 — Scheduler and export on the store

Session: Opus 5, effort medium. Use `Explore` on Haiku 4.5 for "where is X" questions; do not read `scheduler.service.ts` whole.

**Stage 4 session prompt** (model: Opus 5, effort: medium):

```text
Stage 4 of discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md: scheduler and export read from the run store; import BR_EXPIRY.
Use superpowers:subagent-driven-development. Read "Global Constraints", "Spec > What exists today", "Spec > Lifecycles" and "Stage 4". Branch feat/map-run-queue (Stages 1–3 committed). Docker dev stack up.
For "where is X" questions use the Explore agent with model "haiku"; never read scheduler.service.ts or export.service.ts whole.
For Tasks 4.1, 4.2, 4.3, 4.4 in order: dispatch one general-purpose sub-agent, model "sonnet", with the task's "Task prompt" verbatim; then feature-dev:code-reviewer, model "opus", on the diff; apply findings; commit.
Stage exit: backend suite, typecheck, lint green; `grep -rn "openRowStream(" backend/src --include=*.ts` lists only its definition, map-run.runner.ts and executeMap in map-execution.service.ts. Do not run /compact. Do not start Stage 5.
```

### Task 4.1: Import `BR_EXPIRY` as `result_retention_days`

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 4.1 "Import BR_EXPIRY as result_retention_days" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Ground truth for the EUL column: migrate/EUL_SCHEMA_GROUND_TRUTH.md line ~502 (BR_EXPIRY, values 1/4/10/30 seen live, retention days).
Use superpowers:test-driven-development: add to backend/src/__tests__/schedule-import.test.ts the cases BR_EXPIRY = 10 → resultRetentionDays 10 and null → 30; add to backend/src/__tests__/integration/schedules.test.ts create with resultRetentionDays 45 → read back 45 and 0 → 400. Confirm they fail. Then: add BR_EXPIRY to the EUL4_BATCH_REPORTS read in backend/src/services/schedule-import.service.ts (the BR_* column list near lines 208–233) and write it to schedules.result_retention_days; add resultRetentionDays (z.number().int().min(1).max(3650).optional()) to the create/update bodies and the DTO in backend/src/routes/schedules.ts; update migrate/EUL_SCHEMA_GROUND_TRUTH.md line ~502 to say "→ schedules.result_retention_days".
Run the two test files, then typecheck and lint. Commit: git commit -m "feat(schedules): import BR_EXPIRY as result_retention_days".
Report: test tails and the exact mapping line in schedule-import.service.ts.
```

**Files:**
- Modify: `backend/src/services/schedule-import.service.ts` (the row read at ~line 208–233 lists `BR_*` columns; add `BR_EXPIRY`)
- Modify: `backend/src/routes/schedules.ts` create/update zod bodies: `resultRetentionDays: z.number().int().min(1).max(3650).optional()`; include the field in the schedule DTO
- Modify: `migrate/EUL_SCHEMA_GROUND_TRUTH.md:502` — change "Not migrated" to "→ `schedules.result_retention_days`"
- Test: `backend/src/__tests__/schedule-import.test.ts` (add a case: `BR_EXPIRY = 10` → `resultRetentionDays: 10`; null → 30), `schedules.test.ts` (create with 45 → read back 45; 0 → 400)

- [ ] Steps: failing tests → implement → pass → commit `feat(schedules): import BR_EXPIRY as result_retention_days`.

### Task 4.2: Scheduler enqueues a run instead of writing a file

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 4.2 "Scheduler enqueues a run instead of writing a file" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Docker dev stack up.
Read only these ranges first: backend/src/services/scheduler.service.ts around processScheduleRun (line ~706 to the end of the function) and defaultInsertResult (~419) and recordScheduleFailure (~804); backend/src/services/map-run.runner.ts whole (it is new and small).
Use superpowers:test-driven-development: in backend/src/__tests__/integration/scheduler.test.ts replace the "writes a result file" expectations with "calls requestRun with kind 'SCHEDULED', force true, scheduleId, retentionDays = schedule.resultRetentionDays, userId = schedule.createdBy"; in backend/src/__tests__/map-run.runner.test.ts add "a SCHEDULED run inserts a scheduled_results row with runId, rowCount, executionTimeMs, status SUCCESS, filePath null on complete; and status FAILED + errorMessage on failure". Confirm they fail. Then change processScheduleRun to keep its guards and call requestRun; delete writeResultFile, buildScheduleResultFilePath, SCHEDULE_RESULT_DIR and the openRowStream import from scheduler.service.ts; add insertScheduledResult to RunnerDeps and call it in map-run.runner.ts when run.scheduleId is set. Delete recordScheduleFailure if it has no caller left.
Run npm test -w backend, typecheck, lint until green. Commit: git commit -m "feat(scheduler): scheduled runs go through the map-run queue and keep rows in Postgres".
Report: test tails and `grep -n "openRowStream\|writeResultFile" backend/src/services/scheduler.service.ts` (must be empty).
```

**Files:**
- Modify: `backend/src/services/scheduler.service.ts` — `processScheduleRun` keeps its guard logic (missing/disabled/validity window) then calls `requestRun({ mapId, userId: schedule.createdBy, kind: 'SCHEDULED', scheduleId, parameters: fromScheduleParameters(rows), retentionDays: schedule.resultRetentionDays, force: true })`. Remove `writeResultFile`, `openRowStream`, `buildScheduleResultFilePath` and `SCHEDULE_RESULT_DIR` from this file (leave the download route's file branch for migrated rows, Task 4.4).
- Modify: `backend/src/services/map-run.runner.ts` — when `run.scheduleId` is set, on complete insert `scheduled_results { scheduleId, executedAt: completedAt, rowCount, executionTimeMs, status: 'SUCCESS', runId, filePath: null }`; on fail insert with the failure status and `errorMessage` (this replaces `recordScheduleFailure`'s insert; keep `recordScheduleFailure` only for the queue-level exhaust path if it still has a caller, else delete it).
- Test: `backend/src/__tests__/integration/scheduler.test.ts` — replace the "writes a file" expectations with "calls requestRun with kind SCHEDULED, force true, retentionDays from the schedule"; `map-run.runner.test.ts` — SCHEDULED complete inserts a `scheduled_results` row with `runId`.

- [ ] Steps: failing tests → implement → pass → commit `feat(scheduler): scheduled runs go through the map-run queue and keep rows in Postgres`.

### Task 4.3: Export reads stored batches

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 4.3 "Export reads stored batches" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section and "Spec > What exists today" (Exporters row).
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Docker dev stack up.
Read only: backend/src/queues/export.queue.ts whole; backend/src/services/export.service.ts lines 340–420 (processExportJob) and its ExportDeps type; backend/src/routes/export.ts lines 80–175.
Use superpowers:test-driven-development: in backend/src/__tests__/integration/export.test.ts replace the Oracle fake with a seeded run (createRun + appendBatch from services/map-run.store.ts) and assert the file rows equal the stored rows; in export-routes.test.ts add: missing runId → 400; run of another user → 409 RUN_NOT_EXPORTABLE; run for a different map → 409; QUEUED run → 409; expired run → 409; COMPLETED own run → 202. Confirm they fail. Then: ExportJobData gains runId and loses parameters/calculatedFields; processExportJob builds source = { columns: run.columns, batches: readBatches(runId) } and the heading from the map plus run.parameters; remove prepareQuery/openRowStream/Oracle connection from ExportDeps; ExportBodySchema gains runId: z.string().uuid() and the route validates the run as the task says before enqueueing.
Run npm test -w backend, typecheck, lint until green. Commit: git commit -m "feat(export): exports are built from stored run rows, never from Oracle".
Report: test tails and `grep -n "openRowStream\|prepareQuery" backend/src/services/export.service.ts` (must be empty).
```

**Files:**
- Modify: `backend/src/queues/export.queue.ts` — `ExportJobData` gains `runId: string`; drop `parameters` and `calculatedFields` (they live on the run)
- Modify: `backend/src/services/export.service.ts:350-420` — `processExportJob` builds `source = { columns: run.columns, batches: readBatches(runId) }`; remove `prepareQuery`/`openRowStream`/Oracle connection from `ExportDeps`. Heading still comes from the map + run parameters (the export header shipped 2026-09-21 reads parameters; pass `run.parameters`).
- Modify: `backend/src/routes/export.ts:140-170` — `ExportBodySchema` gains `runId: z.string().uuid()`; before enqueueing: `getRun(runId)`, must belong to `user.sub` (or admin), `mapId` must equal `:id`, status `COMPLETED`, not expired; else `409 RUN_NOT_EXPORTABLE`.
- Test: `export.test.ts`, `export-routes.test.ts` — swap the Oracle fake for a store seed; add the 409 cases.

- [ ] Steps: failing tests → implement → pass → commit `feat(export): exports are built from stored run rows, never from Oracle`.

### Task 4.4: Scheduled result download for new rows

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 4.4 "Scheduled result download for new rows" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Docker dev stack up.
Read only the GET /schedules/:id/results/:resultId/download handler in backend/src/routes/schedules.ts (grep "results/:resultId/download").
Use superpowers:test-driven-development: in backend/src/__tests__/integration/schedules.test.ts add: result row with filePath → 200 file stream (existing behaviour); row with runId and no filePath → 409 { error: 'USE_EXPORT', runId }; row with neither → 404. Confirm the new cases fail. Implement the rule in the handler. Do not add a synchronous export path.
Run the test file, typecheck, lint. Commit: git commit -m "feat(schedules): result download points new results at the export flow".
Report: test tail and the handler's three branches.
```

**Files:** Modify `backend/src/routes/schedules.ts` (`GET /schedules/:id/results/:resultId/download`).

Rule: if `result.filePath` → stream the file as today (migrated EUL batch results and pre-upgrade rows). Else if `result.runId` → respond `409 { error: 'USE_EXPORT', runId }`; the frontend (Stage 5) turns that into a normal export job. No synchronous export path — keeps one export code path.

- [ ] Steps: failing route test (file row → 200 stream; run row → 409 with runId; neither → 404) → implement → pass → commit `feat(schedules): result download points new results at the export flow`.

**Stage 4 exit:** full backend suite green. Reviewer (Opus 5) checks no code path opens an Oracle connection outside `map-run.runner.ts` and the builder preview `executeMap`. `grep -rn "openRowStream(" backend/src --include=*.ts` must list only those two callers plus its definition.

---

## Stage 5 — Frontend

Session: Opus 5, effort medium. Implementers: Sonnet 5 with the `frontend-design` skill loaded for the Runs page. Locale copies: Haiku 4.5.

**Stage 5 session prompt** (model: Opus 5, effort: medium):

```text
Stage 5 of discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md: frontend.
Use superpowers:subagent-driven-development. Read "Global Constraints", "Spec > API surface" and "Stage 5". Branch feat/map-run-queue (Stages 1–4 committed). Docker dev stack up; frontend verification only on port 5174 (see discoverer-neo/CLAUDE.md).
For Tasks 5.1, 5.2, 5.3, 5.4, 5.5, 5.6 in order: dispatch one general-purpose sub-agent, model "sonnet", with the task's "Task prompt" verbatim (Task 5.4 also has a "Translation prompt" for a second sub-agent with model "haiku"); then feature-dev:code-reviewer, model "opus", on the diff; apply findings; commit.
Stage exit: npm test -w frontend, npm run typecheck -w frontend, npm run lint -w frontend, node scripts/i18n-check.mjs pt-PT fr-FR es-ES and the playwright run on 5174 all green; use superpowers:verification-before-completion and paste the tails. Do not run /compact. Do not start Stage 6.
```

### Task 5.1: API client and types

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 5.1 "API client and types" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section and "Spec > API surface".
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue.
Read only frontend/src/lib/api.ts lines 400–510 and the ExecuteResult/ResultColumn types in frontend/src/lib/types.ts.
Add the MapRun type to types.ts and the six client functions from the task to api.ts (maps.requestRun derives reused from HTTP 200 vs 202; maps.createExport body gains runId). Delete maps.executeAsync, maps.getExecutionStatus, maps.cancelExecution and every caller (grep the frontend for them).
Use superpowers:test-driven-development for one vitest: requestRun maps a 200 reply to reused:true and a 202 reply to reused:false.
Run npm run typecheck -w frontend && npm run lint -w frontend && npx vitest run <that test> from frontend/. Commit: git commit -m "feat(frontend): runs API client".
Report: the function list with URLs and the removed callers.
```

**Files:** Modify `frontend/src/lib/api.ts` (near line 410–431, 480–505), `frontend/src/lib/types.ts`.

```ts
export interface MapRun { id: string; mapId: string; mapName: string; kind: 'LIVE' | 'SCHEDULED'; scheduleId: string | null; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; parameters: Record<string, unknown>; calculatedFields: CalculatedFieldInput[]; columns: ResultColumn[] | null; decoration: ResultDecoration | null; rowCount: number | null; truncated: boolean; executionTimeMs: number | null; errorMessage: string | null; createdAt: string; startedAt: string | null; completedAt: string | null; expiresAt: string }
apiClient.maps.requestRun(id, body: { parameters?, calculatedFields?, force? }) → POST /maps/${id}/runs, returns { data: MapRun, reused: boolean } (derive `reused` from HTTP 200 vs 202)
apiClient.runs.list(q: { mapId?, status?, kind?, limit?, all? }) → GET /runs
apiClient.runs.get(id) → GET /runs/${id}
apiClient.runs.rows(id, offset, limit) → GET /runs/${id}/rows
apiClient.runs.cancel(id) → DELETE /runs/${id}
apiClient.maps.createExport(id, body) — body now includes runId
```

Remove `executeAsync`, `getExecutionStatus`, `cancelExecution` and their callers.

- [ ] Steps: add types + functions; vitest unit for `requestRun` mapping 200→`reused:true`; typecheck; commit `feat(frontend): runs API client`.

### Task 5.2: `useMapRun` hook

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 5.2 "useMapRun hook" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue.
Read frontend/src/hooks/useMapExport.ts whole (it is the pattern: polling with refetchInterval and a TERMINAL set) and its test if one exists under frontend/src/hooks/__tests__.
Use superpowers:test-driven-development: write frontend/src/hooks/__tests__/useMapRun.test.tsx with renderHook and a QueryClient wrapper, mocking apiClient, for: queued → polls every 1 s → completed → first 500 rows loaded; reused → no polling and rows loaded at once; cancel → status CANCELLED; open(runId) loads an existing run. Confirm it fails. Then create frontend/src/hooks/useMapRun.ts with exactly the return shape in the task, building an ExecuteResult from columns + decoration + rows so ExecutionPanel needs no change to row rendering.
Run npx vitest run src/hooks/__tests__/useMapRun.test.tsx from frontend/, then typecheck and lint. Commit: git commit -m "feat(frontend): useMapRun hook".
Report: test tail and the hook's return type.
```

**Files:** Create `frontend/src/hooks/useMapRun.ts`; test `frontend/src/hooks/__tests__/useMapRun.test.tsx` (pattern from `useMapExport` tests if present, else `renderHook` with a QueryClient wrapper).

```ts
export function useMapRun(mapId: string | undefined): {
  run: MapRun | null; rows: Record<string, unknown>[]; isQueued: boolean; isRunning: boolean; isReused: boolean; error: string | null;
  request(body: { parameters?; calculatedFields?; force? }): Promise<void>;
  open(runId: string): Promise<void>;       // load an existing run (from the Runs page or ?run=)
  cancel(): Promise<void>;
  loadMore(): Promise<void>;                // next page of rows, 500 at a time
}
```

Poll `runs.get` with `refetchInterval: 1000` while status is QUEUED/RUNNING (copy the `TERMINAL` idea from `useMapExport.ts:15`). When COMPLETED, fetch the first 500 rows. Build the `ExecuteResult` the viewer already understands from `columns + decoration + rows` so `ExecutionPanel` does not change its row rendering.

- [ ] Steps: failing hook tests (queued → polls → completed → rows loaded; reused → no polling; cancel → status CANCELLED) → implement → pass → commit.

### Task 5.3: Viewer and builder use runs; export buttons gated

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 5.3 "Viewer and builder use runs; export buttons gated" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue.
Read only: frontend/src/pages/MapViewerPage.tsx lines 1–60; frontend/src/components/map-builder/ExecutionPanel.tsx lines 270–330 (the export buttons); frontend/src/hooks/useMapExport.ts whole; the Run action in MapBuilderPage.tsx / MapToolbar.tsx (grep "execute").
Use superpowers:test-driven-development: vitest for ExecutionPanel gating — no run → no export buttons; run COMPLETED but expiresAt in the past → none; run COMPLETED and valid → XLSX, CSV, PDF buttons. Confirm it fails. Then: MapViewerPage uses useMapRun(id).request({ parameters }) instead of maps.execute, calls open(id) when ?run= is present, shows the status line and the "Run again" (force: true) button described in the task; ExecutionPanel takes a run prop and gates the buttons; useMapExport takes runId and sends it in createExport. The builder preview keeps maps.execute and shows no export buttons.
Add the new strings to frontend/src/locales/en/<the viewer's namespace>.json only (Task 5.4 handles the other locales).
Run npx vitest run for the touched files, typecheck, lint. Commit: git commit -m "feat(frontend): viewer runs through the queue; export needs a stored run".
Report: test tail, and the exact gating condition as written in ExecutionPanel.
```

**Files:** Modify `frontend/src/pages/MapViewerPage.tsx:23-40`, `frontend/src/components/map-builder/ExecutionPanel.tsx:279-320`, `frontend/src/hooks/useMapExport.ts`, `MapBuilderPage.tsx` (only the toolbar's Run action if it uses `execute`; the builder preview keeps `maps.execute`).

- Viewer: `runMutation` → `useMapRun(id).request({ parameters })`. On mount, if `?run=<id>` is present call `open(id)`. Show a small status line: "Queued (position unknown)", "Running…", "Result from 14:03, valid until tomorrow 14:03" (use `reused` and `expiresAt`), with a "Run again" button that calls `request({ parameters, force: true })`.
- `ExecutionPanel`: export buttons render only when `run?.status === 'COMPLETED' && new Date(run.expiresAt) > new Date()`; `useMapExport` gets `runId` and sends it in `createExport`. In the builder (preview via `/execute`, no run) the buttons are hidden — that is the requested behaviour: no stored table, no export buttons.
- [ ] Steps: vitest for the gating (no run → no buttons; expired run → no buttons; completed → three buttons) → implement → pass → commit `feat(frontend): viewer runs through the queue; export needs a stored run`.

### Task 5.4: Runs page (history) and navigation

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 5.4 "Runs page (history) and navigation" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue.
Load the frontend-design skill before laying out the page. Read frontend/src/pages/ExportsPage.tsx whole (match its components and spacing), frontend/src/components/layout/Sidebar.tsx lines 40–60, and the /exports route in frontend/src/App.tsx.
Use superpowers:test-driven-development: write frontend/src/pages/__tests__/RunsPage.test.tsx (mock apiClient.runs.list) for: renders rows with map name, kind, status, expires-in; export buttons hidden on an expired run and on a QUEUED run; "Run again" calls maps.requestRun with the row's parameters and calculatedFields and force false; Cancel visible only on QUEUED. Confirm it fails. Then create frontend/src/pages/RunsPage.tsx with the columns, actions, filters, 2 s polling while any row is QUEUED/RUNNING, admin "all users" toggle and empty state from the task; add the /runs route in App.tsx and the sidebar item { to: '/runs', labelKey: 'items.runs', icon: History } between schedules and exports; create frontend/src/locales/en/runs.json and the sidebar key in the en common/nav namespace.
Run vitest for the page, typecheck, lint. Do NOT translate; leave i18n-check failing for the Haiku task. Commit: git commit -m "feat(frontend): Runs history page".
Report: test tail and the list of new en keys (namespace + key).
```

**Translation prompt** (second sub-agent, model: Haiku 4.5; run after the task prompt above):

```text
Repo E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Translate the new frontend strings for the Runs feature.
Source of truth: frontend/src/locales/en/runs.json (whole file) plus any en keys added in this branch to other namespaces (run: git diff master --name-only -- frontend/src/locales/en, then git diff master -- <each file>).
Write the same keys, same placeholders ({{name}} etc. unchanged), into frontend/src/locales/pt-PT, fr-FR and es-ES. Portuguese is European Portuguese. Keep existing keys untouched.
Verify: node scripts/i18n-check.mjs pt-PT fr-FR es-ES exits 0 (run from discoverer-neo/). Fix until it does.
Commit: git add frontend/src/locales && git commit -m "i18n(runs): pt-PT, fr-FR, es-ES strings".
Report: the i18n-check output and the number of keys per locale.
```

**Files:** Create `frontend/src/pages/RunsPage.tsx`; modify `frontend/src/App.tsx` (add `/runs`), `frontend/src/components/layout/Sidebar.tsx:46-49` (`{ to: '/runs', labelKey: 'items.runs', icon: History }` between schedules and exports); locale namespace `runs.json` in all four locales; `frontend/src/pages/__tests__/RunsPage.test.tsx`.

Content: table of my runs (admin toggle "all users"): map name (link), kind, parameters summary (first three `key=value`, tooltip with all), status chip, rows, duration, ran at, expires in (relative), actions: **Open** (`/maps/:mapId/view?run=:id`), **Run again** (`requestRun` with the same parameters + calculatedFields, `force:false` so a valid result is reused; toast "Result reused" vs "Queued"), **XLSX / CSV / PDF** (only when COMPLETED and not expired; calls `useMapExport` with the run), **Cancel** (QUEUED only), **Delete** (terminal only). Filters: map, status, kind. Poll every 2 s while any row is QUEUED/RUNNING (same as `ExportsPage`). Empty state text. Load the `frontend-design` skill before laying it out; match `ExportsPage.tsx` spacing and components.

- [ ] Steps: failing vitest (renders rows, hides export on expired, Run again calls API with same params) → implement → pass. Haiku sub-agent copies `runs.json` to pt-PT, fr-FR, es-ES with translations; run `node scripts/i18n-check.mjs pt-PT fr-FR es-ES` → exit 0. Commit `feat(frontend): Runs history page`.

### Task 5.5: Schedules history uses the export flow

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 5.5 "Schedules history uses the export flow" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Docker dev stack up (one small backend change is included).
Read only: frontend/src/pages/SchedulesPage.tsx lines 650–700 (ScheduleHistoryDialog); the GET /schedules/:id/history handler in backend/src/routes/schedules.ts (grep "history").
Backend first, with superpowers:test-driven-development: in backend/src/__tests__/integration/schedules.test.ts assert the history DTO includes runId and expiresAt (joined from map_runs, null when there is no run). Implement, run the file.
Frontend, with TDD: vitest for ScheduleHistoryDialog — a row with runId shows XLSX/CSV/PDF buttons and an Open link to /maps/:mapId/view?run=:runId; a row with only filePath shows the existing Download; an expired run shows no export buttons. Implement using useMapExport(schedule.mapId, …) with that runId. Add en strings only.
Run vitest, backend test file, typecheck and lint in both workspaces. Commit: git commit -m "feat(frontend): schedule history exports from stored runs".
Report: test tails and the DTO fields added.
```

**Files:** Modify `frontend/src/pages/SchedulesPage.tsx:662-680` (`ScheduleHistoryDialog`).

For a history row with `runId`: show XLSX/CSV/PDF buttons via `useMapExport(schedule.mapId, …)` with that `runId` and an **Open** link to the viewer; for a row with only a file (migrated) keep the existing download. Show "expires <relative>" from the run when available (extend `GET /schedules/:id/history` DTO to include `runId` and `expiresAt` by joining `map_runs` — small backend change in `routes/schedules.ts`, add to the same commit).

- [ ] Steps: vitest → implement → pass → commit `feat(frontend): schedule history exports from stored runs`.

### Task 5.6: End-to-end and QA

**Task prompt** (sub-agent model: Sonnet 5):

```text
Task 5.6 "End-to-end and QA" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task section and discoverer-neo/CLAUDE.md ("Port 5173 is not safe").
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Docker dev stack up.
Read frontend/e2e/map-viewer.spec.ts and frontend/e2e/fixtures.ts for the API-mock pattern, and the catch-all API mock in the builder screenshot test (grep "route('**/api" in frontend/e2e).
Write frontend/e2e/runs.spec.ts: log in; open a map; click Run; the status shows Queued or Running then rows appear; open /runs and the run is listed; click Run again and the toast says the result was reused; XLSX, CSV and PDF buttons are visible on the completed row; Cancel is absent after completion.
Run: FRONTEND_PORT=5174 VITE_BACKEND_URL=http://localhost:3001 npx playwright test e2e/runs.spec.ts from frontend/, then the full playwright run and npm test -w frontend. If the run touched 5173, stop and fix the port first.
Commit: git commit -m "test(frontend): runs e2e".
Report: the playwright summary line, the port it ran on, and any flake you saw.
```

**QA prompt** (gstack `/qa`, model: Sonnet 5; run in the stage session after the e2e commit):

```text
/qa Target http://localhost:5174 (Vite dev server, backend on :3001). Log in with the seeded admin from backend/src/db/seed (grep "password" there). Test: the map viewer Run flow (Queued → Running → rows; "Run again" reuses; Cancel while queued), the /runs page (filters, Open, Run again, XLSX/CSV/PDF only on completed unexpired rows, Delete), and the schedules history dialog export buttons. Fix bugs you find in frontend/src only, one commit per fix, and report what you changed.
```

- [ ] Add `frontend/e2e/runs.spec.ts`: log in, open a map, Run → sees "Queued"/"Running" then rows; Runs page lists it; "Run again" shows "Result reused"; export buttons visible; Cancel disappears after completion. Use the API mocks pattern from `map-viewer.spec.ts` and the catch-all mock from the builder screenshot test.
- [ ] Run: `FRONTEND_PORT=5174 VITE_BACKEND_URL=http://localhost:3001 npx playwright test` → green. Run the whole `npm test -w frontend` → green.
- [ ] Run gstack `/qa` (Sonnet 5) against the dev stack on 5174 for the viewer and Runs page; fix what it finds; commit.

**Stage 5 exit:** `feature-dev:code-reviewer` (Opus 5) on the frontend diff; `superpowers:verification-before-completion` before claiming done (paste the three test commands' tails).

---

## Stage 6 — Ship

Session: Sonnet 5, effort medium. Skills: `superpowers:finishing-a-development-branch`, `/ship`, `/document-release`, `/canary`.

**Stage 6 session prompt** (model: Sonnet 5, effort: medium):

```text
Stage 6 of discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md: ship.
Read "Global Constraints" and "Stage 6". Branch feat/map-run-queue (Stages 1–5 committed). Docker dev stack up.
Task 6.1: dispatch one general-purpose sub-agent, model "sonnet", with the "Task 6.1 prompt"; then one with model "haiku" with the "Task 6.1 translation prompt". Commit.
Task 6.2: run the five test/lint commands yourself and paste the tails; run the code-review skill at effort high on the branch and fix findings; then use superpowers:finishing-a-development-branch and /ship to open the PR. Stop and tell me before merging to master and before the live migration — those two steps need my yes.
Task 6.3: after I confirm the deploy, run the live checks in the task, /canary for 30 minutes, then write the memory file. Do not run /compact.
```

### Task 6.1: Docs and translations

**Task 6.1 prompt** (sub-agent model: Sonnet 5):

```text
Task 6.1 "Docs and translations" in discoverer-neo/docs/superpowers/plans/2026-09-21-map-run-queue.md. Read that task, "Spec > Lifecycles", "Spec > API surface" and the Task 2.1 config table.
Repo: E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Use /document-release if it fits; otherwise edit by hand.
Write or update, in English only: docs/user-guide (running a map: queued/running/reused states, the Runs page, result validity of one day, why export buttons appear only after a run), docs/admin-guide (the MAP_RUN_* keys with defaults, live vs scheduled retention, BR_EXPIRY import, the sweeper), docs/deployment (both compose files' new keys, the optional npm run worker:map-runs standalone process). Confirm docs/api/endpoints.md already lists /api/runs routes; if not, regenerate it as Task 3.1 did.
Commit: git commit -m "docs(runs): user, admin, deployment pages".
Report: the exact list of docs/*.md files you changed (needed by the translation task).
```

**Task 6.1 translation prompt** (sub-agent model: Haiku 4.5):

```text
Repo E:\claude\discoverer\discoverer-neo, branch feat/map-run-queue. Translate these English docs pages into docs/pt-PT, docs/fr-FR and docs/es-ES, keeping the same relative path and file name under each locale folder: <paste the file list reported by Task 6.1>.
Keep headings, code blocks, env key names, URLs and tables intact; translate prose only. Portuguese is European Portuguese. i18n-check does not cover docs, so diff each pair yourself and confirm every section exists in all three locales.
Commit: git add docs && git commit -m "docs(runs): pt-PT, fr-FR, es-ES translations".
Report: file list per locale.
```

**Task 6.2 and 6.3** are run by the stage session itself (see the stage prompt). The live migration and the merge need the user's explicit yes in chat.

- Modify `docs/user-guide/` (running a map, the Runs page, result validity, export buttons), `docs/admin-guide/` (new env keys table, retention semantics, `BR_EXPIRY`), `docs/api/endpoints.md` (already regenerated in 3.1; verify), `docs/deployment/` (the `MAP_RUN_*` keys in both compose files, `npm run worker:map-runs` standalone option).
- Haiku 4.5 sub-agent translates each changed page into `docs/pt-PT`, `docs/fr-FR`, `docs/es-ES` (memory note: doc translations are not checked by i18n-check, so list the files explicitly in the task text).
- Commit `docs(runs): user, admin, deployment pages`.

### Task 6.2: Merge and deploy

- [ ] `npm run typecheck --workspaces && npm run lint --workspaces && npm test -w backend && npm test -w frontend && npm test -w migrate` → all green; paste tails.
- [ ] Run the `code-review` skill at effort high on the branch; fix findings; commit.
- [ ] `/ship` (bumps VERSION, CHANGELOG, opens PR) → merge to `master` after the PR checks pass.
- [ ] Live migration on the prod compose stack with the psql recipe recorded in memory (`builder-export-folders-2026-09-21.md`): apply `0028_map_runs.sql`, then rebuild the backend container. Confirm `docker compose logs backend | grep map-runs` shows the worker started and the sweeper interval.
- [ ] Re-import schedules once so `result_retention_days` picks up `BR_EXPIRY` (the Migration page's re-import-everything job, live). Spot-check three schedules with observed values 1, 4, 10, 30.

### Task 6.3: Live verification and memory

- [ ] In the live UI: run a map twice (second returns instantly with "Result reused"); export XLSX from the Runs page; trigger one schedule with "Run now" and confirm a `scheduled_results` row with `run_id`; wait for one sweeper tick and check `SELECT count(*) FROM map_runs WHERE expires_at < now()` is 0.
- [ ] `/canary` for 30 minutes on the backend health and queue-depth metrics.
- [ ] Write the memory file `map-run-queue.md` (what shipped, the per-user claim trick, the 24 h clamp, where retention comes from) and add its index line to `MEMORY.md`.

---

## Self-review against the spec

- Queue receiving all executions, sequential per user → Task 2.4 (claim) + 4.2 (scheduler enters the queue). Builder preview stays sync by design and is named in the spec.
- Results in Postgres with lifecycles → 1.1, 1.2, 2.4 (`expiresAt` stamping), 4.1 (schedule retention from `BR_EXPIRY`).
- Live valid max one day → `liveExpiry` clamp, tested in 1.2.
- History window, re-run same conditions, instant return if valid → 2.3 (`requestRun` reuse), 3.1 (routes), 5.4 (Runs page "Run again").
- Exports from stored tables, buttons only when they exist → 4.3, 5.3, 5.5.
- Periodic validity check and deletion → 1.3 (`cleanupExpiredRuns`), 2.4 (sweeper timer).
- Type names used consistently: `MapRunRow`, `RunKind`, `RunStatus`, `requestRun`, `claimRun`, `readBatches`, `cleanupExpiredRuns`, `MapRunJobData`, `useMapRun` — same spelling in every stage.
