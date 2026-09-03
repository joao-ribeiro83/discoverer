# Codebase Inventory — ground truth as of 2026-09-02

Established by direct filesystem and git inspection, not from documentation.
Every phase prompt in `docs/master-plan/prompts/` may cite paths from this file.

Repository root: `E:\claude\discoverer` · Active code: `discoverer-neo/`
Git root is the repository root, so all paths below appear in git as
`discoverer-neo/<path>`.

---

## 1. Repository state (CRITICAL — DOC-04 confirmed still true)

| Fact | Value |
| ---- | ----- |
| Branch | `master` |
| Git remotes | **none** |
| Untracked paths | **70** |
| Deleted-in-worktree (the `.claude` MegaPack) | **2 706** |
| Modified | **142** |
| CI workflow location | `discoverer-neo/.github/workflows/{ci.yml,docker.yml}` |
| CI trigger branches | `[main]` — **the repo is on `master`, so CI has never run** (INF-04) |

**Untracked files that are irreplaceable work:**

```
discoverer-neo/backend/src/lib/sql/totals.ts
discoverer-neo/backend/src/scripts/dump-eul-functions.ts        ← EUL function table tool
discoverer-neo/backend/src/scripts/dump-condition-tokens.ts
discoverer-neo/backend/src/scripts/dump-eul-columns.ts
discoverer-neo/backend/src/scripts/probe-eul-workbooks.ts
discoverer-neo/backend/src/scripts/list-eul-documents.ts
discoverer-neo/backend/src/scripts/reimport-maps.ts
discoverer-neo/backend/src/scripts/diagnose-reimport.ts
discoverer-neo/backend/src/services/credential-file.service.ts
discoverer-neo/backend/src/__tests__/test-database-guard.test.ts
discoverer-neo/backend/src/__tests__/identifiers.test.ts
discoverer-neo/backend/drizzle/0005..0009*.sql  + meta/0005..0009_snapshot.json
discoverer-neo/frontend/src/components/data-table/CrosstabTable.tsx
discoverer-neo/frontend/src/components/data-table/worksheet-rows.ts
discoverer-neo/frontend/src/components/admin/FolderSharingDialog.tsx
discoverer-neo/frontend/src/__tests__/{worksheet-rendering,palette,map-builder-parameters}.test.*
discoverer-neo/docs/decisions/                                  ← EUL fidelity decisions
discoverer-neo/docs/migration/user-credentials.md
```

Plus a junk path that must never be committed:
`discoverer-neo/frontend/[A-Z][a-z][a-zA-Z` (a botched glob written as a filename),
and large dumps: `backup-before-reset.sql` (20 MB), `map_tables_backup.sql` (18 MB),
`backups/`, `storage/`, `credentials/`.

> `migrate/src/services/workbook-parser.ts` (3 179 lines) is **tracked but modified** —
> it is not in the untracked list. The audit's "128 KB parser never committed" refers to
> its current uncommitted *state*. Either way: **commit before anything else.**

---

## 2. Workspaces

Three npm workspaces from `discoverer-neo/package.json`.
Root scripts: `dev`, `build`, `lint`, `typecheck` (all `--workspaces`).

### 2.1 `backend/` — Fastify 5 + TypeScript

**Routes** (`backend/src/routes/`, 19):
`audit` `auth` `business-areas` `custom-functions` `data-sources` `export` `folders`
`health` `hierarchies` `items` `joins` `map-execution` `map-shares` `maps` `migration`
`schedules` `security` `user-preferences` `users`

**Services** (`backend/src/services/`, 23):
`audit` `business-area` `calculated-field-evaluator` `credential-file` `custom-function`
`data-source` `export` `folder` `hierarchy` `item` `join` `map-execution` `map`
`migration` `oracle-connection-pool` `oracle-driver` `oracle-introspection`
`parameter-resolver` `scheduler` `security` `sql-generator` `user-preferences` `user`
plus `exporters/` (3 files)

**SQL engine** (`backend/src/lib/sql/`, 11):
`context` `formula-parser` `from-clause` `group-by-clause` `identifiers`
`order-by-clause` `pagination` `security-predicates` `select-clause` `totals`
`where-clause`

**Other lib**: `encryption.ts` `metadata-cache.ts` `password.ts`
**Plugins** (8): `audit` `auth` `cors` `helmet` `metrics` `redis` `sensible` `swagger`
**Workers** (4) · **Queues** (2) · **Middleware** (2) · **Scripts** (8) · **db/** (3)

**Tests**: 31 files in `__tests__/` + 15 in `__tests__/integration/`

Key file sizes: `db/schema.ts` **1 748 lines** · `services/sql-generator.ts` **266 lines**

Backend npm scripts of note:
`test` (jest, with `pretest` → `db:test:setup`) · `test:integration` ·
`typecheck` · `db:generate|migrate|push|seed` · `worker` · `worker:scheduler` ·
`generate-spec`

### 2.2 `migrate/` — `@discoverer-neo/migrate` (imported by backend)

```
src/bin.ts  src/cli.ts  src/index.ts
src/db/{client,schema}.ts
src/types/eul-versions.ts
src/services/
  assessment.ts            eul-reader.ts            migration-runner.ts
  d4wkdmp-differ.ts        eul-schema-adapter.ts    migration-writer.ts
  d4wkdmp-dump-parser.ts   eul-version-detector.ts  oracle-client.ts
  map-reimport.ts          temporary-password.ts    workbook-parser.ts   (3 179 lines)
  transformers/{index,transform,types}.ts           (transform.ts = 1 703 lines)
src/scripts/diff-corpus.ts        ← the d4wkdmp differ harness driver (dev-only, not in CI)
src/testing/{fake-writer,index,mock-eul,workbook-fixture}.ts
src/__tests__/  (14 files, 463 tests, all passing)
```

**Reference doc:** `migrate/EUL_SCHEMA_GROUND_TRUTH.md` — the ONLY trustworthy EUL schema
reference in this repository.

### 2.3 `frontend/` — React 19 + Vite

**19 pages** (`frontend/src/pages/`):
`AuditLog` `BusinessAreas` `ChangePassword` `CustomFunctions` `Dashboard` `DataSources`
`Folders` `Hierarchies` `Items` `Joins` `Login` `MapBuilder` `MapViewer`
**`MapsList` (22 lines — the placeholder, F-06)** `Migration` `Schedules` `Security`
`Settings` `Users`

**Component dirs:** `admin/` `auth/` `data-table/` `layout/` `map-builder/`
`parameters/` `ui/`
**Other src dirs:** `__tests__/` `hooks/` `i18n/` `lib/` `locales/` `providers/`
`store/` `styles/` `test/`

**E2E** (`frontend/e2e/`, 10): `accessibility` `admin-business-areas`
`admin-data-sources` `export` `i18n-theming` `login` `map-builder` `map-viewer`
`visual` + `fixtures.ts` + `screenshots/`

---

## 3. Database schema — and the drift hazard (BE-10 confirmed)

Two independent Drizzle schema definitions exist. **They are not the same size.**

| Workspace | File | Lines | Tables |
| --------- | ---- | ----- | ------ |
| backend | `backend/src/db/schema.ts` | 1 748 | **30** |
| migrate | `migrate/src/db/schema.ts` | 539 | **19** |

**Backend tables (30):**
`audit_log` `business_areas` `custom_functions` `data_sources` `export_jobs`
`folder_business_areas` `folders` `hierarchies` `hierarchy_levels` `items` `joins`
`map_calculated_fields` `map_conditional_formats` `map_conditions` `map_items`
`map_layouts` `map_page_setup` `map_parameters` `map_shares` `map_totals` `maps`
`query_execution_log` `schedule_parameters` `scheduled_results` `schedules`
`security_policies` `security_policy_assignments` `security_policy_rules`
`user_business_area_grants` `users`

**Migrate tables (19):** `business_areas` `custom_functions` `folder_business_areas`
`folders` `hierarchies` `hierarchy_levels` `items` `joins` `map_calculated_fields`
`map_conditional_formats` `map_conditions` `map_items` `map_layouts` `map_page_setup`
`map_parameters` `map_totals` `maps` `user_business_area_grants` `users`

**Migrate is missing 11 backend tables** — chiefly the runtime ones it never writes
(`audit_log`, `data_sources`, `export_jobs`, `map_shares`, `query_execution_log`,
`schedule*`, `scheduled_results`, `security_*`). That subset is *defensible*; the hazard
is that the 19 shared tables must stay column-identical and nothing enforces it.

**29 pgEnums** in the backend schema, including the ones that carry Discoverer semantics:
`map_type` `map_axis_type` `map_axis_edge` `map_alignment` `map_total_kind`
`map_total_placement` `map_format_target` `map_orientation` `folder_type` `item_type`
`join_type` `logic_operator` `map_operator` `condition_type` `policy_type`
`locale` `theme` `color_palette`

**Drizzle migrations:** `backend/drizzle/0000..0009` — `0005`–`0009` are **untracked**
(`0008_bind_safe_parameter_names`, `0009_worksheet_layout_model`).

---

## 4. Documentation tree (`discoverer-neo/docs/`)

`admin-guide/` (7) · `api/` (`authentication.md`, `endpoints.md`, `openapi.yaml`) ·
`decisions/eul-fidelity-decisions.md` (untracked) · `deployment/` (5) ·
`developer-guide/` (6) · `migration/user-credentials.md` (untracked) ·
`user-guide/` · full `es-ES/`, `fr-FR/`, `pt-PT/` translations of the admin and user
guides.

`docs/api/endpoints.md` is **51 % accurate** — 23 phantom endpoints, 56 real ones
undocumented (DOC-05). Swagger is live and correct at `/api/docs`.

---

## 5. Infrastructure

`docker-compose.yml` (titled "Production", publishes Postgres+Redis to `0.0.0.0` —
INF-12) · `docker-compose.dev.yml` (**the overlay actually audited**) ·
`docker-compose.prod.yml` (multi-stage, non-root, resource-limited, healthchecked —
never run: INF-03) · `nginx/` (solid TLS config; `/metrics` public on 443 — INF-09) ·
`scripts/` (`backup.sh`, `restore.sh` — real and good, INF-17) · `eslint.config.js` ·
`.env` (present) · `.env.example` (5 118 B — **`ENCRYPTION_KEY` appears in neither**, F-03)

---

## 6. Reference material outside `discoverer-neo/`

| Path | Trust |
| ---- | ----- |
| `discoverer10g/sql/` | **Highest** — Oracle's own shipped EUL SQL scripts |
| `discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md` | **High** — distilled from the above |
| `Discoverer 4.1 EUL Metadata Reference Guide.md` / ` 2.md` | **High** — user-authored, agrees with shipped SQL |
| `discoverer_4_1_eul_migration_reference.md` | **High** — same |
| `DISCVR4/` | Oracle Discoverer 4 binaries + `VIDSTR4.DIS` sample (crosstab positive control) |
| `d4dumps/` | Sample `.DIS` workbooks |
| `4.1/ 9.0.4/ 10.1.2/ 10.1.2.1/ 11.1.1/` | Vendor PDFs by version |
| `oracle_discoverer_complete_reference.md` §8 | **FABRICATED — do not use** |
| `EUL_VERSION_REFERENCE.md` | **FABRICATED — do not use** |

---

## 7. Live environment (from the audit, 2026-09-01)

Oracle `10.236.141.201:1530` SID `COSEC`, owner `SIID_TESTES`, server **12.2.0.1.0**,
EUL4 schema `4.1.11.0.0`, 61 `EUL4_*` tables, **thick mode mandatory** (pre-11g password
verifier — thin mode fails `NJS-116`).
Backend `http://localhost:3000` · frontend `http://localhost:5173` ·
login `admin@discoverer.local` / `admin123` (seed, `backend/src/db/seed.ts:20`).
PostgreSQL via `docker -c default exec discoverer-neo-postgres psql -U discoverer -d discoverer_neo`.

Estate: 564 workbooks → **923 worksheets**, 9 626 items, 25 960 map_items,
49 819 calculated fields, 19 632 totals, 5 605 conditions, 7 521 parameters,
0 hierarchies (508 in source), 60 grants (138 in source).
