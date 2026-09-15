# Discoverer Neo — Plan Review & Status Assessment

> **Version:** 1.0
> **Date:** 2026-07-12
> **Reviewed by:** Claude Fable 5
> **Scope:** Verification of actual project status against the planning documents, critique of the plan, and recommended course corrections.

---

## 1. Current Status (verified against the code, not the docs)

| Phase | Sessions | Planned Deliverable | Actual Status |
|---|---|---|---|
| **Phase 0** — Setup & Infrastructure | 0.1–0.6 (6) | Docker stack, scaffolding, DB schema | ✅ **Complete** (verified by `INTEGRATION_TEST_REPORT.md`, 2026-06-24 — all services ran, 25 tables migrated, seed applied) |
| **Phase 1** — Metadata Backend | 1.1–1.7 (7) | Auth, data sources, business areas, folders, items, joins, hierarchies, custom functions, Swagger, tests | ✅ **Complete in code** — 8 route modules, 8 services, RBAC middleware, 9 unit + 9 integration test files. `tsc --noEmit` passes (verified 2026-07-12) |
| **Phase 2** — Query Engine | 2.1–2.5 (5) | Maps CRUD, SQL generator, execution service | ❌ **Not started** |
| **Phase 3** — Map Builder UI | 3.1–3.6 (6) | React admin + map builder | ❌ **Not started** (only a 2-file health-check placeholder in `discoverer-neo/frontend/src/`) |
| **Phase 4** — Export & Scheduling | 4.1–4.3 (3) | ExcelJS/CSV export, BullMQ schedules | ❌ Not started |
| **Phase 5** — Security & Migration | 5.1–5.7 (7) | Row security, EUL migration tool | ❌ Not started (`migrate/` contains only Dockerfiles + empty package) |
| **Phase 6** — Polish & Deploy | 6.1–6.4 (4) | Tests, docs, production readiness | ❌ Not started |

**Overall: 13 of 38 sessions complete (~34%).** The project is **not finished** — the two completed phases are foundation work; the application's core value (map builder + SQL engine + UI) has not been built yet.

> Note: `DISCOVERER_NEO_SESSION_PLAN.md` claims "Total Sessions: 28" in its header but actually defines 38.

## 2. Structural Defects Found

### 2.1 The Session 0.4 frontend was created in the wrong directory (HIGH)
The full frontend scaffolding (40 files: shadcn/ui components, layout, 12 placeholder pages, auth store, API client, Vite/Tailwind config) was created at **`E:\claude\discoverer\frontend\`** (the knowledge-base repo root) instead of **`E:\claude\discoverer\discoverer-neo\frontend\`**. During Session 0.6 integration testing, the (empty) monorepo frontend was "fixed" with a minimal placeholder (`App.tsx` + `main.tsx`) — the misplacement went unnoticed. The stray root `package-lock.json` is fallout from the same accident.

**Fix:** move the scaffolding into `discoverer-neo/frontend/`, rename the package to `@discoverer-neo/frontend`, and verify build.

### 2.2 Zero git commits (HIGH)
The repository has **no commits at all** — roughly two weeks of planning documents and working code exist only on disk. One `rm -rf`, disk failure, or misdirected cleanup destroys everything. The session plan never mandated commit checkpoints.

**Fix:** commit an initial baseline immediately; from then on, one commit per session minimum.

### 2.3 Oracle Instant Client is silently broken (MEDIUM)
The Docker build's Instant Client download 404s and was patched to be "best-effort" (Issue 5 in the integration report). Consequence: **thick-mode `node-oracledb` will not work at runtime**, and nothing in the code calls `initOracleClient` anyway. The problem is deferred, not solved — it will resurface the first time a real Oracle data source is tested.

**Fix (better design):** default to node-oracledb **thin mode** — pure JS driver, no Instant Client, no special Docker layers. It supports Oracle DB 12.1+. Keep thick mode as an opt-in env flag (`ORACLE_THICK_MODE=true` + `ORACLE_CLIENT_PATH`) for older databases.

**Caveat that the plan never addresses:** Discoverer 4-era source databases can be Oracle 9i/10g. Thin mode needs 12.1+; thick mode with a 19c client needs 11.2+. **Determine the actual Oracle DB version of the legacy EUL host before Phase 5** — if it is older than 11.2, the migration tool needs a different extraction path (e.g., DB export/upgrade or a JDBC-based extractor).

### 2.4 Tests require a live database but nothing manages that (MEDIUM)
Even the "unit" tests insert rows into a real PostgreSQL (`app.inject` + Drizzle against `localhost:5432`). With Docker Desktop stopped (as found today), the entire suite hangs. There is no CI, no testcontainers, no documented precondition.

**Fix:** document `docker compose up -d postgres redis` as a test precondition in the README, and add a CI workflow (GitHub Actions with a `postgres:16` + `redis:7` service container) running typecheck + lint + tests on every push.

## 3. Could the plan be improved? — Yes, in these specific ways

The existing plan is genuinely good: self-contained session prompts, correct Discoverer 4 → Neo concept mapping, a risk register, and an EUL3/4/5 version adapter (Session 5.3 + `EUL_VERSION_REFERENCE.md`). The technology choices (Fastify, Drizzle, React 19, BullMQ, ExcelJS streaming) are sound and current. **It should be amended, not rewritten.** The amendments:

### 3.1 Compile calculated fields into SQL — don't re-implement SQL in JavaScript
Session 2.4 as written evaluates calculated-field formulas **in JavaScript over the result rows**. That means re-implementing Oracle's `SUBSTR`/`TRUNC`/`CASE` semantics in JS — a permanent source of subtle divergence, and aggregates over calculated fields become impossible. Discoverer itself compiled calculations into the query.

**Better:** parse formulas with a small, strict expression grammar (tokenizer → AST → validation against an allowlisted function set + item references resolved from metadata) and **emit them as SQL expressions inside the generated SELECT**. One evaluation engine (Oracle's), correct aggregation, and the AST doubles as the injection-safety gate.

### 3.2 Harden the SQL generation contract
The plan says "bind variables for user values" (good) but also "static values (properly escaped)" (bad — escaping is how injections happen). Amended contract:
- **Every** runtime value — static or parameter — becomes a bind variable. No exceptions.
- Identifiers (owners, tables, columns) are never taken from request input; they are resolved from the metadata tables and validated against `^[A-Za-z][A-Za-z0-9_#$]*$` before being quoted into SQL.
- Formulas/custom SQL pass the AST allowlist described above; `COMPLEX` folder SQL is validated to be a single SELECT statement.

### 3.3 Deliver a vertical slice before finishing Phase 2/3 breadth
The plan builds the whole backend engine (Phase 2), then the whole UI (Phase 3). That is ~8 weeks with no user-visible product. Amended ordering: after Sessions 2.1–2.3, build a **minimal end-to-end slice** — login → pick a saved map → execute → results grid → CSV download. This de-risks the full stack integration early and gives the stakeholder something to react to.

### 3.4 Pull the EUL migration spike forward
The risk register itself rates "Complex EUL parsing" **High impact / High probability**, yet the migration tool is scheduled last (Phase 5). Amended: build the read-only `analyze` command (connect, detect EUL version, dump counts of business areas/folders/items/workbooks) as a spike right after the vertical slice. If the real EUL has surprises, better to learn while the schema can still adapt.

### 3.5 Engineering discipline additions
- Git: initial baseline commit now; a commit per session; move to the `main` branch.
- CI: GitHub Actions running typecheck + lint + tests with service containers.
- Secrets: the seed admin password (`admin123`) and JWT secret defaults must be flagged as dev-only; production checklist item to rotate.
- Session plan header corrected (38 sessions, not 28).

## 4. Work completed in the 2026-07-12 session

1. ✅ **Backend health verified** — `tsc --noEmit` clean; full unit suite run against Docker Postgres/Redis.
2. ✅ **Frontend consolidated** — the misplaced scaffolding moved into `discoverer-neo/frontend/` (package renamed `@discoverer-neo/frontend`, Vite config merged: Tailwind + `@/` alias + Docker-aware proxy without the `/api`-stripping rewrite, since the backend serves `/api/*` natively). Typecheck and production build verified. Stray root `frontend/`, `package-lock.json`, and an empty mangled-name directory removed. Backend now also serves `/api/health` alongside `/health`.
3. ✅ **Session 2.1 implemented** — `map.service.ts` (CRUD with items/conditions/parameters/calculated fields, duplicate, XML export, `canAccessMap` owner/share/public/grant logic), `routes/maps.ts` + `routes/map-shares.ts`, `maps.is_active` migration (0002). 24 new tests, all passing.
4. ✅ **Session 2.2 implemented** — SQL generation engine in `lib/sql/` (identifiers, AST-based formula parser with function allowlist, select/from/where/group-by/order-by/pagination builders, `GenerationContext`) + `services/sql-generator.ts` (pure `generateSql` + DB-backed `generateSqlForMap`). Hardened contract from §3.2: every runtime value is a bind variable, identifiers validated+quoted, formulas re-emitted from a parsed AST, join paths computed via BFS over join metadata with LEFT/RIGHT flipping. Calculated fields compile into SQL (§3.1) rather than being evaluated in JS. 32 new tests, all passing — including injection-attempt, circular-formula, and disconnected-join cases.
5. ✅ **Pre-existing defects fixed** (found while verifying):
   - Global Fastify error handler was registered **after** routes, so it never applied (routes snapshot their error handler at registration time). Moved before registrations; validation errors now return descriptive messages instead of "Bad Request".
   - `custom-function.service.getById` and `hierarchy.service.getById` returned soft-deleted rows (DELETE→GET gave 200).
   - COMPLEX folders with empty custom SQL were accepted.
   - Creating a TABLE folder with Oracle unreachable returned 500 instead of 400.
   - Strict-null compile errors in two test suites; three auth tests registered routes on an already-listening app; folders suite left `Other BA` residue breaking reruns.
   - (Separately, via user-launched background task: entity-scoped route auth now resolves the owning business area — `business-area-entity-auth.test.ts`.)

   **Final result: 273/273 backend unit tests passing** (was 141/150 at session start; 56 tests added for the new map + SQL-generator code, plus the auth-fix regression suite).
6. ⬜ **Still recommended:** initial git baseline commit (repo has zero commits — awaiting owner approval), CI workflow, EUL assessment spike (§3.4), Oracle DB version check for the legacy source (§2.3), Session 2.3+ (map execution service — use node-oracledb thin mode).

---

*End of review.*
