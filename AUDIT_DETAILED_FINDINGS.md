# Discoverer Neo — Detailed Audit Findings

**Audit date:** 2026-09-01
**Companion documents:** [Executive Summary](AUDIT_EXECUTIVE_SUMMARY.md) ·
[Architecture](AUDIT_ARCHITECTURE_ASSESSMENT.md) ·
[Legacy Matrix](AUDIT_LEGACY_COMPATIBILITY_MATRIX.md) ·
[Migration](AUDIT_MIGRATION_ASSESSMENT.md) · [UI/UX](AUDIT_UI_UX_ASSESSMENT.md) ·
[Testing](AUDIT_TESTING_ASSESSMENT.md) · [Tooling](AUDIT_TOOLING_REQUIREMENTS.md)

## How to read this document

Findings are prefixed by origin: `F-*` were established directly by the lead auditor;
`INF-*` come from the infrastructure specialist auditor; `SEC-*` from the security
specialist auditor. Each carries a confidence label:

- **verified** — reproduced live, or read at the exact cited line.
- **inferred** — follows necessarily from verified facts, but the final step was not executed.
- **speculative** — plausible, flagged for investigation.

Environment for every reproduction below:

```bash
docker -c default exec discoverer-neo-postgres psql -U discoverer -d discoverer_neo -c "<SQL>"
```

Backend `http://localhost:3000`, frontend `http://localhost:5173`, login
`admin@discoverer.local` / `admin123` (seed value, `backend/src/db/seed.ts:20`).

---

# CRITICAL

---

## F-01 — No migrated worksheet can be executed. None. Zero of 923.

- **Severity:** CRITICAL · **Area:** backend / query engine + migration
- **Confidence:** verified · **Blocks production:** YES

### Evidence

```
POST /api/maps/5b73118c-52e0-486b-9f75-885c17507371/execute
→ 400 {"error":"Item \"fa66cd7a-…\" not found in the map's business area","kind":"CONFIG"}

POST /api/maps/adcd7606-7494-49cb-94ea-e943dbf447bb/execute   (a map with NO calculated fields)
→ 400 {"error":"Item \"1e1adeac-…\" not found in the map's business area","kind":"CONFIG"}
```

```sql
select b.name, count(*) from maps m join business_areas b on b.id=m.business_area_id group by 1;
--  Migrated Workbooks | 923          ← every map, one synthetic BA

select business_area_id, count(*) from folders group by 1;
--  6 rows, none of them "Migrated Workbooks"   ← that BA contains ZERO folders

select count(*) from map_items mi
  join maps m on m.id=mi.map_id
  join items i on i.id=mi.item_id
  join folders f on f.id=i.folder_id
 where f.business_area_id is distinct from m.business_area_id;
--  25960          ← 100% of map_items are cross-business-area
```

The mechanism is `backend/src/services/sql-generator.ts`, in `loadMapDefinition()`:

```ts
const folderRows = await db.select().from(folders)
  .where(eq(folders.businessAreaId, map.businessAreaId));
```

For a map in `Migrated Workbooks` this returns the empty set, so `itemWithFolder()`
throws on the first item it is asked to resolve.

The synthetic business area is created at `migrate/src/services/migration-runner.ts:586`:

```ts
name: uniquify('Migrated Workbooks', usedBaNames),
```

### Why it matters

This is the whole product. 923 migrated worksheets, 25 960 columns, 5 605 conditions,
7 521 parameters and 19 632 totals were imported faithfully and **not one of them can
produce a row.** Every downstream feature — export, schedule, share, row-level security —
is dead behind this single defect. It also explains why `export_jobs`,
`query_execution_log` and `scheduled_results` are all empty: nothing has ever run.

### Recommended action

Two layers, both needed.

**Immediate data repair** — 898 of the 923 maps have items resolving to exactly one real
business area (25 maps have no items at all), so the correct BA is unambiguous:

```sql
-- Verify first (expect 898 rows, each with exactly one distinct BA):
select mi.map_id, count(distinct f.business_area_id) spans
  from map_items mi
  join items i on i.id=mi.item_id
  join folders f on f.id=i.folder_id
 group by 1 having count(distinct f.business_area_id) > 1;
-- (returns 0 rows today)
```

Then set each map's `business_area_id` to the BA its items actually belong to, and
delete the synthetic BA.

**Structural fix** — the repair does not survive the next migration and does not model
Discoverer correctly. See [F-02b](#f-02b) and the architecture assessment: a Discoverer
worksheet legitimately spans business areas, so `loadMapDefinition` must scope folders by
*the items the map references*, not by the map's single BA.

### Dependencies

Blocks F-06, F-07, F-08 and the entire testing recommendation. Must be fixed first.

---

## F-02 — 49 819 migrated calculated fields are stored in a formula language no backend parser can read

- **Severity:** CRITICAL · **Area:** backend / migration / semantics
- **Confidence:** verified · **Blocks production:** YES

### Evidence

Stored values in `map_calculated_fields.formula`:

```
[1,102](Cap Pago,[5,2,"0"],[1,115](),Cap Pago)
[1,96]([1,61](Premio Anual Min),Ptcambio)
[1,102](Swestado,[5,1,"A"],D Motivo Encerr,[1,115]())
[1,96]([1,61]([1,28](Premio Min,[5,1,"."],[5,1,","])),Ptcambio)
```

This is Discoverer's internal token encoding: `[1,n]` is an `EUL_FUNCTIONS.FUN_ID`
operator, `[5,n]` a literal, `[6,n]` an element reference, `[8,n]` a parameter reference.

`backend/src/lib/sql/formula-parser.ts` tokenises `[` … `]` as `BRACKET_REF` — a
*bracketed item display name* — and resolves it through `resolveItem()`. `[1,102]`
resolves to nothing, producing `Unknown item reference "1,102"`.

`backend/src/services/calculated-field-evaluator.ts` is a **second, entirely separate**
parser (its own `tokenize`/`Parser` at line 1287), documented as being for *ad-hoc
request-time* fields only. It has no token support either.

The migration stores the token form deliberately —
`migrate/src/services/transformers/transform.ts:1019` notes the token form is the only
formula the workbook holds — and the grammar **is already documented inside `migrate/`**:

- `migrate/src/services/workbook-parser.ts:876-877` gives worked examples
  (`[1,92]` = `BETWEEN`, `[1,98]` = `AND`, `[1,86]` = `>=`).
- `:957` — *"How a `[1,n]` node behaves — `EUL_FUNCTIONS.FUN_FUNCTION_TYPE`."*
- `:3039-3046` — element-reference substitution, explicitly deferring naming to
  "a formula renderer" that does not exist.
- `migrate/src/scripts/dump-eul-functions.ts:7` maps `[1,92]` → `FUN_ID` 92.

Scale: 49 819 rows across 767 maps (mean 65 per map).

### Why it matters

Even with F-01 fixed, any worksheet carrying a calculated field would fail at SQL
generation. 767 of 923 worksheets — 83 % — carry at least one. Calculated fields are
where a Discoverer estate's business logic actually lives; this is the semantic core of
the migration.

### Recommended action

Promote the decoder from dev knowledge to a first-class component:

1. Read `EUL_FUNCTIONS` / `EUL_FUN_ARGUMENTS` from the source EUL during migration and
   persist the code → function mapping (the source has `EUL4_FUNCTIONS`, 24 columns, and
   `EUL4_FUN_ARGUMENTS`, 18 columns).
2. Write a token → AST parser in `migrate/`, emitting the *same* AST shape
   `lib/sql/formula-parser.ts` produces.
3. At migration time, store **both** the original token form (provenance, lossless) and a
   rendered canonical expression (executable). Do not discard the token form.
4. Add a corpus test asserting that every one of the 49 819 formulas either compiles or
   is explicitly quarantined with a reason.

### Dependencies

Depends on F-01 being fixed to be observable. Large effort — the single biggest piece of
genuine engineering remaining.

---

<a id="f-02b"></a>
## F-02b — `maps.business_area_id NOT NULL` flattens a core Discoverer concept

- **Severity:** CRITICAL · **Area:** database / architecture
- **Confidence:** verified · **Blocks production:** YES (as the root cause of F-01)

### Evidence

```
maps.business_area_id | uuid | not null
  FK → business_areas(id) ON DELETE CASCADE
```

In Discoverer, a workbook is stored in `EUL4_DOCUMENTS` and references items via
`EUL4_ELEM_XREFS`; nothing constrains those items to a single business area. Business
areas are a *presentation grouping over folders*, not an ownership boundary for
worksheets. `folder_business_areas` exists in the schema as a **many-to-many** join table
— and is empty (0 rows) — while `folders.business_area_id NOT NULL` enforces one-to-many.
The schema therefore contains two contradictory models of the same relationship.

### Why it matters

The migration had no correct choice available: it could not put a workbook in "its"
business area because that concept does not exist in the source. Inventing
`Migrated Workbooks` was a rational response to an incorrect constraint. Any repair that
leaves the constraint in place will break again on multi-BA worksheets.

### Recommended action

Make `maps.business_area_id` nullable and advisory (a default/home grouping for the UI),
and derive query scope from the map's referenced items. Decide deliberately whether
`folder_business_areas` is the real model (then drop `folders.business_area_id`) or dead
(then drop the table) — do not ship both.

---

## F-03 — Oracle data-source passwords are encrypted with a key published in this repository

- **Severity:** CRITICAL · **Area:** security / secrets
- **Confidence:** verified · **Blocks production:** YES

### Evidence

```ts
// backend/src/config.ts:147
ENCRYPTION_KEY: z.string().min(32).default('dev-only-insecure-encryption-key-change-me'),
// backend/src/config.ts:52
JWT_SECRET:     z.string().min(16).default('dev-only-insecure-secret-change-me'),
```

```
$ grep -n ENCRYPTION_KEY .env .env.example docker-compose.yml docker-compose.dev.yml docker-compose.prod.yml
ABSENT from .env
ABSENT from .env.example
ABSENT from all compose files
```

`backend/src/lib/encryption.ts` derives the AES-256-GCM key via
`scryptSync(config.ENCRYPTION_KEY, 'discoverer-neo-salt', 32)` — a fixed, published salt.
Because the variable is set nowhere, **the public default is what is protecting live
Oracle credentials.**

Corroborated by the live container: a decrypt failure on the placeholder data source
produced a stack trace through `encryption.ts:44`, confirming the path is active.

Two PostgreSQL dumps containing `COPY public.data_sources` sit in the working tree —
`backup-before-reset.sql` (20 MB) and `map_tables_backup.sql` (18 MB) — and per `INF-06`
**neither is covered by any `.gitignore` rule.**

### Why it matters

Anyone holding the repository and any database backup recovers every Oracle credential.
The salt is fixed, so there is not even per-deployment separation. A single `git add -A`
would commit the dumps.

### Recommended action

1. Add a `.superRefine` to the config schema rejecting either default when
   `NODE_ENV === 'production'` (≈5 lines — converts a silent breach into a boot failure).
2. Add `ENCRYPTION_KEY` and `JWT_SECRET` to `.env.example`, and use the
   `${ENCRYPTION_KEY:?…}` fail-fast form already used correctly for `POSTGRES_PASSWORD`
   in `docker-compose.prod.yml`.
3. Rotate the key and re-encrypt existing `password_enc` values.
4. Delete the two dumps; add `*.sql`, `*.dump`, `/backups/` to `.gitignore`.
5. Move to a per-deployment random salt stored alongside the ciphertext.

---

## DOC-04 — The workbook parser has **never been committed**, and there is no remote. One `git clean` ends the project's most valuable work.

- **Severity:** CRITICAL · **Area:** repository / data loss
- **Confidence:** verified · **Blocks production:** YES
- **This is the single most urgent item in the entire audit.** It costs one command to fix.

### Evidence

`git ls-files --error-unmatch` reports these as **untracked**:

| File | Size | Modified |
| --- | --- | --- |
| `migrate/src/services/workbook-parser.ts` | **128 565 B** | 2026-08-29 |
| `migrate/src/services/d4wkdmp-differ.ts` | 44 198 B | 2026-08-28 |
| `migrate/src/services/d4wkdmp-dump-parser.ts` | — | — |
| `migrate/src/services/map-reimport.ts` | — | — |
| `migrate/src/services/temporary-password.ts` | — | — |
| `migrate/EUL_SCHEMA_GROUND_TRUTH.md` | — | — |
| `backend/src/services/credential-file.service.ts` | — | — |
| `backend/src/lib/sql/totals.ts` | — | — |
| `frontend/src/components/data-table/CrosstabTable.tsx` | — | — |
| `discoverer-neo/CLAUDE.md` | — | — |
| 5 test files under `migrate/src/__tests__/` | — | — |
| Drizzle migrations `0005`–`0009` + snapshots | — | — |

**36 source files in total.** And `git remote -v` is **empty** — there is no copy anywhere but
this disk.

### Why it matters

The `.DIS` binary decoder is the hard-won centrepiece of this project: reverse-engineered from
an undocumented Oracle container, validated against Oracle's own `d4wkdmp.exe`, carrying a
222-entry function table recovered from `DCESQRES.DLL`. It has **never been under version
control.**

`discoverer-neo/CLAUDE.md` itself calls `EUL_SCHEMA_GROUND_TRUTH.md` the only trustworthy schema
reference — and that file is untracked too. So is `credential-file.service.ts`, which handles
credentials and has therefore never been through review.

A stray `git clean -fd`, a `git checkout`, or a disk failure destroys all of it.

### Recommended action

**Commit these files today, before any other work in this repository.** Then add a remote.
Nothing else in this audit is more urgent, and nothing else is cheaper to fix.

---

## DOC-01 — The 193 KB session plan's 200+ green checkmarks are *acceptance criteria*, not completion records

- **Severity:** CRITICAL (to planning, not to production) · **Confidence:** verified

`DISCOVERER_NEO_SESSION_PLAN.md:23` says so itself:

> **Deliverables** — acceptance criteria to verify before moving on

Every `- ✅` sits under a `**Deliverables:**` label inside a *forward-looking* session spec, and
`:3300-3310` uses unchecked `- [ ]` boxes for the same session's verification list. The file's
mtime is 20 July; sessions 7.5–7.9 were committed in August and September. **The plan was
written ahead of the work and never updated after.**

Read naively — as the next session would — 200+ green ticks look like a shipped product. They
are a wish list. `- ✅ Code coverage >80%` (`:3065`) and `- ✅ All performance targets met`
(`:3126`) are false as statements of fact and valid as targets.

**Action:** before any Master Plan is derived from it, add a banner: *"This document is a PLAN.
✅ marks are acceptance criteria, not completion status."* Keep it — it is the requirements
source — but never read it as status.

---

## DOC-02 — The one document that claims to state *verified* status is seven weeks stale, and wrong in the understating direction

- **Severity:** HIGH · **Confidence:** verified

`DISCOVERER_NEO_PLAN_REVIEW.md:1-6` presents itself as *"Verification of actual project status
against the planning documents"*, dated 2026-07-12. It then reports:

> Phase 2 — Query Engine… ❌ **Not started**
> Phase 3 — Map Builder UI… ❌ **Not started** (only a 2-file health-check placeholder)
> Phase 4 / 5 / 6 … ❌ Not started (`migrate/` contains only Dockerfiles + empty package)
> **Overall: 13 of 38 sessions complete (~34%)**

Today: 114 live routes across 19 route files, 923 migrated maps, 1 654 passing tests, commits
through "Session 7.9". Its note that the plan *"claims 28 sessions but defines 38"* is also
stale — the header now says 47, and 47 is what it defines.

**Why it matters:** it is the most authoritative-sounding document in the repository and now the
most wrong. A planner trusting it would re-plan work that already exists.

**Action:** delete or mark stale. Its structural critiques may retain historical value; its
status table does not.

---

## DOC-05 — `docs/api/endpoints.md` is 51 % accurate: 23 phantom endpoints, 56 real ones undocumented

- **Severity:** HIGH · **Confidence:** verified

Extracting route definitions from all 19 files in `backend/src/routes/` (114 routes) and
method+path pairs from the doc (81), normalising `:param` / `{param}`:
**`code=114 documented=81 both=58`.**

The phantoms are systematically business-area-nested paths that were never built:

```
DELETE /business-areas/:baId/folders/:folderId    → code has DELETE /api/folders/:id
PUT    /business-areas/:baId/items/:itemId        → code has PUT    /api/items/:id
POST   /business-areas/:baId/folders/:folderId/items
POST   /exports    POST /schedules    GET /schedules/:scheduleId/runs
```

Undocumented-but-real includes the entire `custom-functions`, `security/policies` and
`users/me/preferences` surfaces, plus `GET /api/maps/shared-with-me`,
`POST /api/security/policies/test` and `GET /api/folders/:folderId/joins/suggestions`.

This reads as a doc written from the *plan* and never reconciled with the built code. Any client
written from it fails. **Action:** regenerate from OpenAPI — `npm run generate-spec` exists.

---

## SEC-02 — Cleartext credentials are persisted in `audit_log`: 174 Oracle data-source passwords and 5 user passwords

- **Severity:** CRITICAL · **Area:** security / audit
- **Confidence:** verified · **Blocks production:** YES

### Evidence

`plugins/audit.ts:183` stores the full request body. Redaction at `:44-53` matches only
**exact** key names in `SENSITIVE_KEYS` (`password`, `passwordhash`, `token`, …).

- The data-source field is `passwordEnc` — and the client sends **plaintext** there; the
  server encrypts it later at `services/data-source.service.ts:31`. `passwordEnc` and
  `connectionString` are **not** in the set.
- Change-password uses `currentPassword` / `newPassword` (`routes/auth.ts:16-18`) — also
  not in the set.

Live, counting only (no values printed):

```sql
SELECT (details->'body'->>'passwordEnc' = '[REDACTED]'), count(*) …
--  all 174 rows FALSE (not redacted), value lengths 4–12
--  newPassword present on 5 rows, all FALSE, lengths 5/16/20
--  login `password` IS redacted on 6,649 rows (that key IS in the set)
```

### Why it matters

This is **true cleartext**, not ciphertext — arguably worse than F-03. Any admin reading
`GET /api/audit/*`, or anyone with a database backup, recovers current Oracle data-source
passwords and users' actual current passwords. The two 20 MB dumps in the working tree
(INF-06) contain `public.audit_log`.

### Recommended action

Redact by key **substring**, not exact match (`passwordenc`, `connectionstring`,
`currentpassword`, `newpassword`, plus anything containing `password`/`secret`/`token`).
Purge or rewrite the 179 affected rows. Rotate every credential that passed through those
endpoints.

### Dependencies

Compounds F-03 and SEC-13. Fix alongside the key rotation.

---

## SEC-01 — Token refresh defeats logout *and* defeats deprovisioning

- **Severity:** HIGH · **Area:** security / auth lifecycle
- **Confidence:** verified · **Blocks production:** YES

### Evidence

`routes/auth.ts:167-206`. Refresh calls
`fastify.jwt.verify(token, { ignoreExpiration: true })`, then re-signs `{ sub, email, role }`
**from the incoming token's own payload**. It never consults the Redis blacklist that
logout writes at `:222-226` and that `plugins/auth.ts:63` relies on. It accepts any token
expired up to 7 days (`:246-254`).

Live: `POST /api/auth/refresh` with a current admin token returned a brand-new token.

### Why it matters

Two independent failures:

1. **Logout is defeated.** A blacklisted token is refreshed into a fresh valid one, because
   refresh never checks the blacklist.
2. **Deprovisioning is defeated.** A user demoted `ADMIN → USER`, deactivated, or deleted
   keeps their old `role` claim and a live session by refreshing — for up to token life +
   7 days (~14 days). The access token is its own refresh secret; there is no rotation and
   no reuse detection.

This materially qualifies the "auth fails closed" positive recorded elsewhere in this
document: it fails closed on a *Redis outage*, but revocation itself is bypassable.

### Recommended action

In refresh: check the blacklist with the same lookup `authenticate` uses, re-load the user
row to confirm the account exists and is active, and take `role` from the database rather
than the token. Then move to short-lived access tokens with a distinct rotating refresh
token and reuse detection.

---

## SEC-03 — IDOR: any authenticated user can read any folder, item, join or hierarchy by ID

- **Severity:** HIGH · **Area:** security / object-level authorization
- **Confidence:** verified · **Blocks production:** YES

### Evidence

`middleware/authorize.ts:13-30` is **role-only**. Entity scoping lives in
`middleware/business-area-auth.ts` — but these single-object GETs attach only
`authenticate` and then call an unscoped `getById`:

| Route | Location |
| --- | --- |
| `GET /api/folders/:id` | `routes/folders.ts:196-199` |
| `GET /api/items/:id` | `routes/items.ts:175-178` |
| `GET /api/items/:id/descendants` | `routes/items.ts:531-534` |
| `GET /api/joins/:id` | `routes/joins.ts:151-154` |
| `GET /api/hierarchies/:id` | `routes/hierarchies.ts:142-145` |

Their sibling **mutations** correctly use `requireFolderAccess` / `requireItemAccess`
(e.g. `folders.ts:330`, `items.ts:316`), and the **collection** routes are correctly scoped
(`GET /api/business-areas/:baId/folders`, `folders.ts:154`). Only the by-id reads leak.
No global scoping hook exists — `app.ts` registers only audit/metrics/redis/errorHandler.

### Why it matters

Read-only, but it defeats business-area isolation for the entire metadata layer across all
18 non-admin accounts: underlying Oracle `table_name` / `table_owner`, `custom_sql` (which
can embed business logic), item `column_name` / `formula`, and the full join topology — for
business areas the user was never granted.

This is the **false-allow** counterpart to the historical false-deny bug; that one appears
fixed, this one is present.

### Recommended action

Add the existing `requireFolderAccess('VIEW')` / `requireItemAccess('VIEW')` /
`requireJoinAccess('VIEW')` / `requireHierarchyAccess('VIEW')` middleware to those five
routes. The middleware already resolves the owning business area from the entity id.

---

## SEC-04 — `folders.custom_sql` validation is bypassed entirely on UPDATE

- **Severity:** HIGH · **Area:** security / injection
- **Confidence:** verified · **Blocks production:** YES

### Evidence

`validateCustomSql` (`services/folder.service.ts:71`) applies the DDL/DML + `DBMS_`
blocklist and the SELECT/WITH-start check — but is called **only** on create (`:157`). The
update service (`:183-205`) spreads `data` straight into the row with no validation. The
PUT route imports `validateCustomSql` (`routes/folders.ts:11`) and **never calls it**:
`routes/folders.ts:387` goes directly to `update(id, bodyParsed.data)`, where
`UpdateBodySchema.customSql` is only `z.string().nullable().optional()` (`:45`).
`folderType` is updatable to `COMPLEX` on the same call.

### Why it matters

A user with `EDIT` on a business area (not admin-only) can PUT a folder to
`folderType=COMPLEX` with arbitrary `customSql`, skipping the blocklist. The only remaining
net is `from-clause.ts:34-43` at generation time: must start `select`/`with`, no embedded
`;`. That blocks second statements and DDL/DML but **not** `DBMS_` / `UTL_` / `OWA_` package
calls inside a single SELECT — for example `UTL_HTTP.REQUEST` for exfiltration, which is
exactly what the create-time blocklist existed to stop.

Currently unexercised in practice: 212 folders are all `TABLE`, and all 60 grants are
`VIEW`. The control is nonetheless defeated for anyone who does hold write access.

### Recommended action

Call `validateCustomSql` in `update()` whenever `customSql` or `folderType` is present
(mirroring `:152-160`). Better still, apply `security-predicates.ts`'s
`FORBIDDEN_PACKAGE_RE` — a stronger scanner than `folder.service`'s regex list — and add a
check for Oracle alternative quoting (`q'`).

---

## SEC-06 — Row-level security fails OPEN, and COMPLEX folders bypass it structurally

- **Severity:** MEDIUM · **Area:** security / RLS
- **Confidence:** verified

### Evidence

`resolveSecurityPredicates` (`services/map-execution.service.ts:290-291`) returns
`{ predicates: [], bindParams: {} }` when the user has no applicable policy — the query then
runs with **no predicate at all**. It fails *closed* only for an unknown executing user
(`:283-288`, throws). Rules apply per target: `BUSINESS_AREA` only when
`rule.targetId === businessAreaId`, `FOLDER` only when the folder is in `usedFolderIds`
(`:298-313`), so a map touching a folder no rule covers gets no predicate for that folder.

`security_policies` is **empty live**, so every query today is unfiltered.

**Bypass:** a COMPLEX folder inlines its `custom_sql` as a derived table
(`from-clause.ts:44`). Predicates AND onto the *outer* query by folder alias and are never
pushed into the subquery, so whatever rows the inner SELECT returns are unconstrained.

**Verified secure, and important:** the AND-composition is correct. `where-clause.ts:224-238`
brackets the whole user-condition block whenever any group is OR-joined — producing
`(a OR b) AND (pred)` — unconditionally, and wraps each predicate in its own parentheses
(`:293`). **An `OR` in a user condition cannot escape the security predicate.**

### Recommended action

Document the fail-open allowlist model explicitly, and offer a deny-by-default mode per
business area. Forbid COMPLEX folders under any business area carrying a security rule, or
push predicates into the derived table.

---

## F-06 — The Maps page is a placeholder, making the map builder and viewer unreachable

- **Severity:** CRITICAL · **Area:** frontend
- **Confidence:** verified · **Blocks production:** YES

### Evidence

`frontend/src/pages/MapsListPage.tsx` in full is 22 lines rendering a card whose body is
`t('mapViewer:mapsList.comingSoon')`. Live accessibility tree at `/maps`:

```
heading "Maps"
generic "Browse and manage your visual maps."
heading "Placeholder"
generic "This page is coming soon."
```

Routing (`frontend/src/App.tsx:96-100`):

```tsx
<Route path="maps">
  <Route index element={<MapsListPage />} />        {/* placeholder */}
  <Route path=":id" element={<MapBuilderPage />} />      {/* 434 lines, real */}
  <Route path=":id/view" element={<MapViewerPage />} />  {/* real */}
</Route>
```

There is no route to create a map and no list from which to reach `/maps/:id`. Reaching
either working page requires hand-typing a UUID; confirmed by navigating directly, which
rendered a real migrated worksheet with its Discoverer title intact.

### Why it matters

The application's central surface does not exist. All the backend map machinery, the
builder, the viewer, the results table and the parameter dialog are unreachable by any
normal user path.

### Recommended action

Build the real list: search, business-area filter, ownership/shared/all tabs, sort by
recency, and a create action. Blocked in practice by F-07.

---

## F-07 — `GET /api/maps` hides the entire migrated estate from every user, including admins

- **Severity:** CRITICAL · **Area:** backend / API
- **Confidence:** verified · **Blocks production:** YES

### Evidence

```
GET /api/maps   (admin token)
→ 200 {"data":{"mine":[],"shared":[]}}
```

with 923 maps present. All were created by the `migration@migrated.local` service user,
so they are neither "mine" for any human nor shared — `map_shares` has **0 rows**. The
dashboard consequently reports `Total Maps 0` and *"No maps yet. Create one from the Maps
page."*

### Why it matters

Even with F-06 built, the list would render empty. There is no administrative view of the
estate at all, and no endpoint returns it.

### Recommended action

Add an `all` scope for administrators and a business-area-scoped listing for users, gated
by `user_business_area_grants` (60 rows exist). Decide the ownership model for migrated
content deliberately — service-user ownership with no shares is effectively
write-only storage.

---

# HIGH

---

## F-08 — The Run button on the map viewer fires no request and reports no error

- **Severity:** HIGH · **Area:** frontend · **Confidence:** verified · **Blocks production:** YES

Clicking **Run** on migrated worksheet `GD_M.M02_V01` produced no network activity:

```
POST /api/auth/login → 200
GET  /api/maps → 200
GET  /api/maps/5b73118c-…/ → 200        ← nothing after this
```

`read_console_messages(onlyErrors)` → *No console logs.* The page still reads
*"Run the map to see results."* The worksheet carries parameters (`&Dt Início`,
`&Dt Fim` visible in its title), so a parameter prompt was expected and never appeared.

**Why it matters:** silent failure. The user cannot tell the difference between "not
clicked", "running" and "broken". This also masked F-01 from anyone testing by hand.

**Action:** trace the Run handler and the parameter-prompt precondition; add a visible
disabled state with a reason, a loading state, and a toast on failure.

---

## F-09 — **REFUTED.** The Oracle server is 12.2; `OFFSET/FETCH` is correct

- **Severity:** ~~HIGH~~ → **INFORMATIONAL (withdrawn)** · **Confidence:** verified

An earlier pass inferred that `backend/src/lib/sql/pagination.ts`'s Oracle 12c+
`OFFSET :row_offset ROWS FETCH NEXT :row_limit ROWS ONLY` would fail against an Oracle 8-era
source, and flagged it as the highest-value open question. **That inference was wrong.**

Determined read-only by driving the application's own connection pool from inside the
running container (single `SELECT`, no DDL):

```
SERVER_VERSION_STRING: 12.2.0.1.0   NUM: 1202000100
"Oracle Database 12c Enterprise Edition Release 12.2.0.1.0 - 64bit Production"
```

`OFFSET/FETCH` was introduced in 12.1, so the emitted syntax is valid on this server.

**Where the inference went wrong:** `migrate/src/scripts/diff-corpus.ts:42-44` describes the
**EUL vintage** — EUL4 metadata written by Discoverer 4.1, whose old password verifier is why
thick mode is required for *authentication* — not the database release the schema now runs
on. A 2011-era EUL living inside a 12.2 database is exactly what a long-lived Oracle estate
looks like.

**What remains true:** nothing in the codebase reads the server version
(`grep -rn "oracleServerVersion\|serverVersion\|v\$version\|product_component_version"` over
`backend/src` → no hits; `testConnection` runs only `SELECT 1 FROM DUAL`,
`data-source.service.ts:169`). Version-blindness is still a latent risk for a product whose
purpose is connecting to legacy estates, and BE-06 (no pagination tiebreaker) is a real
defect independent of syntax support. But there is **no dialect blocker**, and the
recommendation to build a fallback pagination path is withdrawn.

---

## MIG-01 — **Every migrated join is discarded at query time.** `def.joins` is always empty, so *all* 341 multi-folder maps fail

- **Severity:** CRITICAL · **Area:** schema modelling / query engine
- **Confidence:** verified · **Blocks production:** YES
- **This supersedes BE-01 below and is worse.**

### Evidence

```sql
SELECT count(*) total, count(left_item_id) with_left, count(right_item_id) with_right FROM joins;
--  total 10 | with_left_item 0 | with_right_item 0
```

`backend/src/services/sql-generator.ts:242-249`:

```ts
joins: joinRows.flatMap((j) => {
  if (!j.leftItemId || !j.rightItemId) return [];
```

Every migrated join lacks both item ids, so **every join is filtered out and `def.joins` reaches
`buildFromClause` empty.**

**Root cause — refined by LEG-01: this is a READER GAP, not missing source data.**

An earlier reading of this finding concluded the source "cannot populate" the item ids. That
overstated it. **The join predicate is in the source and is simply never selected:**

- `EUL_SCHEMA_GROUND_TRUTH.md:270-274` — live `EXPRESSIONS.EXP_TYPE` holds `CO` (6 967),
  `CI` (2 830) and **`JP` (10) — "a join predicate"**. Ten `JP` rows for ten `KEY_CONS` rows.
- `eul-schema-adapter.ts:583-585` — `DEFAULT_ITEM_EXP_TYPES = [CO, CI]`. The
  `WHERE EXP_TYPE IN (…)` at `:601` therefore **excludes every join predicate in the estate**.
- Oracle's own export DTD confirms the predicate is first-class:
  `discoverer10g/sql/EUL.dtd:191` — `<!ELEMENT ForeignKey (ElementRef*, Formula?, …)>`. The
  `Formula` is the predicate; `ElementRef*` is the ordered key-column list.

So `KEY_CONS` does bind folders — but the columns to join on live in `EXPRESSIONS` as `JP` rows,
and a two-element allowlist is what drops them. **That is roughly one line wide.**

**The schema change is still required** for composite joins — see LEG-02 below — but the data
is recoverable.

⚠️ **Do not fix this first.** See LEG-04: the empty `def.joins` is currently the only thing
preventing silently wrong aggregate results.

### Why it matters

BE-01 concluded that 271 of 341 multi-folder maps fail because the join *graph* is sparse. That
analysis is now moot: **zero joins reach the FROM builder, so all 341 fail**, and the 10 rows in
`joins` are dead metadata that can never participate in a query.

More importantly, this is not fixable by re-running the migration or by repairing data. The
target schema cannot represent what the source contains.

### Recommended action

A schema change is unavoidable. Either:

- **(a)** extend `joins` to store a join **predicate** — a column-pair list or a validated
  expression — rather than one item pair; or
- **(b)** resolve the item pair during migration from the folder's key columns, accepting that
  multi-column joins still cannot be represented.

**(a) is the faithful option.** Until one lands, no multi-folder migrated map can execute, and
no amount of business-area re-parenting changes that.

### Dependencies

Sits *behind* F-01: maps fail at definition load before ever reaching the join logic. Both must
be fixed, F-01 first — **and neither before LEG-04.**

---

## LEG-04 — ⚠️ No fan-trap guard exists. Fixing the joins would turn loud failures into silently wrong numbers.

- **Severity:** CRITICAL · **Area:** aggregation correctness
- **Confidence:** verified · **Blocks production:** YES
- **This is the most important sequencing constraint in the entire audit.**

### Evidence

`grep -ri 'fan.trap|fantrap|double.count|duplicate.*aggregat|chasm'` over `backend/src` returns
three hits, **none of them a guard** — one comment in `formula-parser.ts:432` about optional
`DISTINCT`, and two unrelated comment lines. `lib/sql/` contains `from-clause.ts`,
`group-by-clause.ts`, `select-clause.ts`, `where-clause.ts`, `totals.ts` — and no fan-trap module.

Neo cannot even *detect* the condition, because both inputs Discoverer used are missing:
`OneToOne` is never read (LEG-03), and the detail/master roles are flattened into a symmetric
`leftFolderId` / `rightFolderId` pair whose orientation `from-clause.ts:134` flips freely during
BFS traversal.

### The concrete wrong answer

Take `M M67 1 → M M67`, a real join in this estate. Say `M M67` is an order header carrying
`ORDER_TOTAL`, and `M M67 1` is its order lines — one-to-many, four lines per order. A user asks
for *sum of `ORDER_TOTAL` by customer* with a line-level filter.

`from-clause.ts:149` emits `INNER JOIN M_M67_1 f2 ON f1.order_id = f2.order_id`. The header row
is now repeated once per line. `select-clause.ts` emits `SUM(f1.ORDER_TOTAL)`.

**Every order total is counted four times. A £2.4M quarter reports as £9.6M.**

What makes this the dangerous class of defect:

1. **It is silent** — no error, no warning, no null. A clean result set comes back.
2. **It is plausible** — inflated by a factor nobody spots without the source data.
3. **It is exactly the case Discoverer got right**, using join cardinality to aggregate the
   detail side in an inline view before joining. Users migrating in have fifteen years of
   trained trust in these numbers.
4. **It is currently masked.** Because `def.joins` is always empty, multi-folder maps fail
   outright. **The failure is hiding the bug.**

### Recommended action — order matters, and not otherwise

1. Land the `joins` schema change **including** `is_one_to_one` and the master/detail roles.
2. Add the fan-trap guard: when an aggregate over folder A is joined to folder B across a
   non-`OneToOne` join where B is the detail side, aggregate B in a derived table before
   joining — or refuse and warn.
3. **Only then** read the `JP` predicates and re-enable multi-folder generation.

If step 2 is out of scope for now, **step 3 must still refuse.** Keep the drop at
`sql-generator.ts:242-243` but change it from silence to an explicit *"multi-folder queries are
disabled pending fan-trap handling"*. This codebase's established preference for documented
refusal over silent distortion — NOT nodes, `COUNT DISTINCT`, unresolvable totals — is exactly
the right instinct, and it should be extended to joins.

---

## LEG-02 — The FROM builder can only ever emit a single-column equijoin

- **Severity:** CRITICAL · **Area:** schema / SQL generation · **Confidence:** verified

`backend/src/lib/sql/from-clause.ts:145-150`:

```ts
const leftExpr  = ctx.itemExpression(j.leftItem,  j.leftFolder);
const rightExpr = ctx.itemExpression(j.rightItem, j.rightFolder);
parts.push(`${joinSql} … ${newAlias} ON ${leftExpr} = ${rightExpr}`);
```

One left expression, one right, one `=`. `types/sql.ts:34-40` types each side as a single
non-null `Item`. Discoverer's `ForeignKey` carries `ElementRef*` — a **list**. A composite-key
join, common on Oracle EBS-style schemas, is unrepresentable end to end.

**Why it matters:** even after LEG-01, populating a single item pair only makes single-column
joins work. A composite join would migrate **silently wrong** — one column of an N-column key,
producing a cartesian blow-up. That is worse than today's fail-closed behaviour.

**Proposed schema** (replaces the item pair):

```sql
CREATE TABLE join_predicates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  join_id       uuid NOT NULL REFERENCES joins(id) ON DELETE CASCADE,
  seq           integer NOT NULL,        -- composite keys pair by position
  left_item_id  uuid REFERENCES items(id) ON DELETE SET NULL,
  right_item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  operator      map_operator NOT NULL DEFAULT '=',
  raw_formula   text,                    -- the EXP_TYPE='JP' text, verbatim
  UNIQUE (join_id, seq)
);

ALTER TABLE joins
  ADD COLUMN detail_folder_id       uuid REFERENCES folders(id),  -- KEY_OBJ_ID
  ADD COLUMN master_folder_id       uuid REFERENCES folders(id),  -- FK_OBJ_ID_REMOTE
  ADD COLUMN allow_detail_no_master boolean NOT NULL DEFAULT false,
  ADD COLUMN allow_master_no_detail boolean NOT NULL DEFAULT false,
  ADD COLUMN is_one_to_one          boolean NOT NULL DEFAULT false,
  ADD COLUMN is_mandatory           boolean NOT NULL DEFAULT false,
  ADD COLUMN source_id              bigint;                       -- KEY_ID
ALTER TABLE joins DROP COLUMN left_item_id, DROP COLUMN right_item_id;
```

Derive `join_type` from the two booleans rather than storing it — one source of truth.
`raw_formula` is the escape hatch for a `JP` expression the parser cannot decompose: store it,
refuse to generate from it, warn.

## LEG-03 — Four join attributes Discoverer carries are neither read nor stored

`EUL.dtd:192-201` gives `ForeignKey` these attributes: `AllowDetailNoMaster`,
`AllowMasterNoDetail`, `OneToOne`, `Mandatory`. Neo has a single `join_type` enum
(`INNER|LEFT|RIGHT|FULL`, `schema.ts:511`), and all 10 live joins are `INNER` — but
`eul-schema-adapter.ts:134-135` shows `KEY_TYPE` is a *probed* column that **defaults to INNER
when absent**. So `INNER` on all 10 is a default, not a reading.

`AllowDetailNoMaster` / `AllowMasterNoDetail` are two independent outer-join switches; one
4-value enum cannot carry them plus `OneToOne` plus `Mandatory`. And `OneToOne` is the
fan-trap-relevant flag (LEG-04).

## LEG-05 — Default per-item aggregation is never read: `agg_function` is NULL on every row

- **Severity:** HIGH · **Confidence:** verified

```sql
SELECT count(*) FILTER (WHERE agg_function IS NOT NULL), count(*) FROM items;
--  0 / 9626
SELECT count(*) FILTER (WHERE agg_function IS NOT NULL), count(*) FROM map_items;
--  0 / 25960
```

The transformer *expects* it — `transformers/transform.ts:240`
`aggFunction: normalizeAggregation(item.aggregation)` — but `ITEM_COLUMNS`
(`eul-schema-adapter.ts:100-119`) selects `IT_FORMAT_MASK`, `IT_HEADING` and friends and **no
aggregation column at all**. So `normalizeAggregation` always receives `undefined`.

**Classification: READER GAP** — not a transformer drop, not absent in source.

**Already costing real data:** `lib/sql/totals.ts:197` emits *"A total on 'X' was skipped: its
Discoverer aggregate did not migrate"*, and **552 of 19 632 `map_totals` rows already have a
NULL `agg_function`**.

**Action:** add the aggregation column to `ITEM_COLUMNS` via `probeColumns()` — probe, do not
guess (`IT_DEFAULT_POSITION` / `IT_SUM_FLAG` / `IT_AGGREGATE` are candidates) — then re-run the
items pass.

## LEG-06 — `EUL4_DOMAINS` (item classes / lists of values) has no target table and no code path

`grep -ril 'itemClass|item_class|listOfValues|list_of_values|DOMAINS'` over `backend/src` and
`migrate/src` returns **no output**. The live database's 31 tables include no item-class table.
`EUL4_DOMAINS` is confirmed in the source (`eul4del.sql:455`) and is the target of
`EXPRESSIONS.IT_DOM_ID`.

A user who had a dropdown of valid cost centres now gets a free-text box. **SCHEMA GAP + reader
gap. MUST-PRESERVE, P1.**

---

## BE-01 — *(superseded by MIG-01)* The join graph is also sparse: 10 joins over 19 folders in 9 disconnected components

- **Severity:** CRITICAL → **subsumed** · **Area:** migration
- **Confidence:** verified · **Blocks production:** YES

### Evidence

The live join graph: **10 active `joins` rows spanning 19 folders in 9 disconnected
components, largest component = 3 folders.**

Counting folders reached through `map_items` **or** `map_conditions` — which is what
`usedFolderIds()` actually collects, since `where-clause.ts:87` calls `ctx.itemExpression`
which calls `aliasFor`:

| | Count |
| --- | --- |
| Maps resolving ≥1 folder | 922 of 923 |
| Single-folder maps | 581 |
| **Maps spanning 2+ folders** | **341** (max 5) |
| — fully join-connected | **70** |
| — **would throw `No join path connects…`** | **271** (101×2-folder, 81×3, 9×4, 80×5) |

*(Counting `map_items` alone gives only 16 multi-folder maps, all connected. That narrower
figure is misleading — conditions pull folders in too.)*

### Why it matters

F-01 is masking this. Fixing the business-area assignment moves 70 maps to correct SQL and
leaves the 581 single-folder maps correct, but converts **271 maps from `CONFIG: item not
found` to `CONFIG: no join path`** — still zero rows. The 923-map migration cannot be called
successful on the join metadata that was actually imported.

### Recommended action

Treat the join import as an **open migration defect**, not a runtime bug. Count
`SIID_TESTES.EUL4_KEY_CONS` and reconcile against the 10 imported rows. Per
`EUL_SCHEMA_GROUND_TRUTH.md`, joins bind **folders**, not items. If the source genuinely holds
only 10, the join information lives in the workbook query definitions and must be read from
the `.DIS` container instead.

### Dependencies

Sits directly behind F-01. Fixing F-01 alone does not deliver working reports.

---

## BE-02 — Saving a map through the API permanently destroys its totals

- **Severity:** HIGH · **Area:** backend / data loss
- **Confidence:** verified · **Blocks production:** YES

### Evidence

`services/map.service.ts:372-379` — `deleteChildren()` removes `mapItems` and
`mapCalculatedFields`. `insertChildren()` (`:269`) never writes `mapTotals`, `mapLayouts`,
`mapPageSetup` or `mapConditionalFormats`. Every `map_totals` foreign key cascades:

```sql
SELECT conname, confdeltype FROM pg_constraint WHERE conrelid='map_totals';
-- map_totals_map_item_id_…            | c
-- map_totals_break_map_item_id_…      | c
-- map_totals_map_calculated_field_id_…| c

SELECT count(*) FROM map_totals
 WHERE map_item_id IS NULL AND break_map_item_id IS NULL
   AND map_calculated_field_id IS NULL;   -- 0
```

Grepping `mapTotals` with insert/delete/update across `services/` and `routes/` returns **no
hits at all**.

### Why it matters

A single `PUT /api/maps/:id` carrying `items` silently and atomically wipes that map's totals
— all **19,632 migrated totals across 684 maps** are exposed. Page setup survives but is
orphaned. Nothing in the backend can recreate them; recovery means re-running the migration.
This is the failure most likely to be triggered *the first time a user edits a migrated
workbook*.

### Recommended action

Either carry totals, layout and page setup through `update()` (load-modify-write inside the
same transaction), or refuse `replacingChildren` on any map that has `map_totals` rows until
a totals editor exists.

---

## BE-03 — Async execution results are cached forever in a process-local Map

- **Severity:** HIGH · **Area:** backend / memory
- **Confidence:** verified · **Blocks production:** YES

`services/map-execution.service.ts:735` — `const jobs = new Map<string, AsyncJob>()`; `:750`
`jobs.set(...)`; `:966-974` assigns `job.result = { columns, rows, … }` after
`streamRows(conn, prepared, ASYNC_MAX_ROWS)` with `ASYNC_MAX_ROWS = 100_000` (`:41`).
`grep -n "jobs.delete\|MAX_JOBS\|evict"` → **no matches**. `activeConnections` (`:736`) and
`cancelRequested` *are* cleaned up (`:1026-1027`); `jobs` is not.

**Why it matters:** up to 100,000 rows per job, materialised as JS objects and JSON-serialised
in one shot, retained for the process lifetime. The store is also process-local, so async
execute/poll breaks under more than one backend replica and loses every job on restart.

**Action:** TTL-evict `jobs`, cap retained rows independently of `ASYNC_MAX_ROWS`, and move
async results to Redis alongside export jobs.

**Correct by contrast:** exports genuinely stream — `export.service.ts:314` `openRowStream` →
writer, released in `finally` (`:358-361`); the sync path is capped at `MAX_SYNC_ROWS = 1000`
with a `maxRows + 1` probe that reports truncation honestly.

---

## MIG-03 / F-10 — All 508 hierarchies lost: the reader probes a column that does not exist

- **Severity:** HIGH · **Area:** migration reader · **Confidence:** verified

`eul-schema-adapter.ts:148-155` probes `HIER_OPTIONAL_COLUMNS = ['HI_NAME', 'HI_DESCRIPTION',
'HI_DEVELOPER_KEY', 'BA_ID']`, and `:750` maps `BA_ID → businessAreaId`.

**`EUL4_HIERARCHIES` has no business-area column.** The recorded live dump
(`EUL_SCHEMA_GROUND_TRUTH.md:280-288`) gives: `HI_ID, HI_TYPE, HI_NAME, HI_DEVELOPER_KEY,
HI_DESCRIPTION, HI_SYS_GENERATED, HI_EXT_HIERARCHY, DBH_DEFAULT, IBH_DBH_ID` + audit columns.

`probeColumns` (`:409-448`) **silently omits an absent column** rather than failing, so `:811`
`businessAreaId: h.businessAreaId ?? null` yields null for all 508.
`assessment.ts:211-212` then scores 100 % as *orphans* — i.e. as source noise — and
`migration-runner.ts:835` emits one WARN each.

**The correct derivation is already written down** in `EUL_SCHEMA_GROUND_TRUTH.md` §4.2 item 6
and is simply not implemented:

```
HIERARCHIES → HI_NODES → IG_EXP_LINKS (IEL_TYPE='HIL', HIL_HN_ID → HIL_EXP_ID)
            → EXPRESSIONS.IT_OBJ_ID → BA_OBJ_LINKS
```

Note it is **not** the same query folders use: folders reach `BA_OBJ_LINKS` directly on
`BOL_OBJ_ID` (`eul-schema-adapter.ts:528-543`); hierarchies need the extra `IG_EXP_LINKS` hop.

**Classification: READER DEFECT.** 502 of the 508 are `IBH` (item-based) and 6 `DBH` (date).

**Action:** implement the derivation in `readHierarchies`. Because `hierarchies` and
`hierarchy_levels` are both empty and nothing references them, a targeted hierarchies-only
backfill could run without touching anything else — though no such service exists today.

**Also add:** `probeColumns` should *report* when an expected column is absent. Its silence is
why this survived three runs.

---

## MIG-06 — Grants: the 78 losses are unrelated to hierarchies, and all 60 survivors collapsed to `VIEW`

- **Severity:** MEDIUM · **Area:** migration · **Confidence:** verified

The audit hypothesised that one EUL4 object-link fix would recover both the 508 hierarchies and
the 78 grants. **That is false.** They are unrelated defects that happened to share a symptom.

```sql
SELECT permission_level, count(*) FROM user_business_area_grants GROUP BY 1;
--  VIEW | 60      (5 on ADMIN, 11 on each of the other five BAs)
```

`eul-schema-adapter.ts:1023-1025` notes *"GP_APP_ID's code table is undocumented offline; carry
the number through as a string"*, and `transform.ts:1337-1338` then falls through to
`DEFAULT_GRANT_PERMISSION`. **Every migrated user has read-only access regardless of what
Discoverer granted.**

The 78 that did not migrate fall into four buckets — workbook-level grants (`GD_DOC_ID` set;
Neo has no workbook grant), EUL-wide grants with no object target, grantees who are not migrated
users, and silent dedupe against Neo's `user|BA|permission` unique index
(`migration-runner.ts:1228-1230`, a bare `continue`). **None of it is logged:**
`migration-runner.ts:1209-1227` pushes to an in-memory `skipped[]` array with no `emit()` call,
and `migration_log` for that phase contains only `Inserted 60 row(s)`. The breakdown is
unrecoverable from the current database.

**Action:** `emit('WARN', …)` at each of the three `skipped.push` sites, and decode `GP_APP_ID`
(1006/1015 appear in Oracle's `batchusr.sql`).

## MIG-07 — The grant branch this audit suspected is dead code

`eul-schema-adapter.ts:1004-1011` derives `level` **from** the ids —
`businessAreaId !== null ? 'BUSINESS_AREA' : folderId !== null ? 'FOLDER' : …`. So
`transform.ts:1344-1348`'s test for `level === 'BUSINESS_AREA' && businessAreaId === null` is a
contradiction by construction and can never fire outside hand-built test fixtures. That branch
is where the "grants fail like hierarchies" hypothesis came from. Delete it or move the check
into `readGrants`.

---

## F-12 — The readiness scorer reports "ready" over a totally unusable migration

- **Severity:** HIGH · **Area:** migration / tooling · **Confidence:** verified · **Blocks production:** YES

Live output: `{"score":75,"rating":"ready-with-warnings","blockers":[]}`.

`migrate/src/services/assessment.ts` `scoreReadiness()` starts at 100 and subtracts:
`errorCount * 20`; `min(30, warningCount * 5)`; `min(20, orphans.total * 2)`; 5 if the
schema version is unknown. `blockers` is populated **only** by an unsupported EUL version
or error-level warnings. Our run: 1 warning (−5) + 509 orphans (−20, capped) = 75.

Losing 100 % of hierarchies scores the same −20 cap as losing one object.

**Why it matters:** this is the artefact an operator reads before committing to a
cutover. It says go on a migration where nothing runs. Its blindness is structural: it
never inspects the output it produced.

**Action:** add post-migration output assertions to the score — *can a sample of migrated
maps generate SQL?*, *do all map_items resolve within scope?*, *what fraction of formulas
compile?* Any of these would have returned a hard blocker today. Cap the score at the
worst category rather than summing capped deductions.

---

## F-18 — **REFUTED.** All four fields *are* extracted; the differ reports are two code generations stale

- **Severity:** ~~HIGH~~ → **withdrawn**, replaced by WB-01 below · **Confidence:** verified

An earlier pass read `d4dumps/_report-after-fix.json` and reported that calculation
`dataType`, `placement`, `hidden` and `isACalc` were at **0 % extraction** (0 agree /
41 263 `onlyInDump` each), concluding the parser could not even distinguish a calculation
from a plain item. **That was wrong.** The report predates the code.

**Proof** — current parser + current differ run offline against `DISCVR4/VIDSTR4.DIS` and
`d4dumps/_VIDSTR4.sample.txt`:

```
calculations: 1 | dataTypeCode non-null: 1 | placementCode: 1 | hidden: 1 | isACalc: 1
DIFFER calculations fields:
  dataType  {agree:1, disagree:0, onlyInDump:0, onlyInParser:0}
  placement {agree:1, disagree:0, onlyInDump:0, onlyInParser:0}
  hidden    {agree:1, disagree:0, onlyInDump:0, onlyInParser:0}
  isACalc   {agree:1, disagree:0, onlyInDump:0, onlyInParser:0}
```

Where each is read: `dataType` `workbook-parser.ts:3020` (`TAG.CALC_DATA_TYPE = 0x00e3`);
`placement` `:3030` (`0x00e2`); `hidden` `:3031` (`0x00e6`); `isACalc` `:3032` (`0x00e7`).
The differ compares all four at `d4wkdmp-differ.ts:340-343`.

**On `isACalc` specifically:** it is emphatically *not* "can the parser tell a calculation
from an item". That distinction is made by element **class** — `CLASS.CALCULATION = 0x00dc`
vs `CLASS.ITEM_REF = 0x00db` (`parser:196-198`). `isACalc` is a separate flag whose meaning
is genuinely unknown, and the parser says so (`parser:1993-1998`): it is *clear* on 277 of
47 548 elements, including Oracle's own `Profit SUM` sample. It is extracted and
deliberately **not** migrated because nobody knows what it means. That is the right call.

**What survives:** `map_calculated_fields.data_type` really is NULL — but as a **transformer
drop**, not a parser gap. See WB-05.

---

## WB-01 — Both differ reports are obsolete; every "0 %" figure in them is an artefact

- **Severity:** HIGH · **Area:** audit evidence integrity
- **Confidence:** verified · **Blocks production:** no

### Evidence

Modification times: report `2026-08-27 16:39`; `d4wkdmp-differ.ts` `2026-08-28 12:24`;
`workbook-parser.ts` `2026-08-29 00:23`. Both source files are **untracked in git**, so
there is no commit history to date them by.

Structural proof the report predates the differ that would produce it:

| | Report | Current code |
| --- | --- | --- |
| `aggregate` sections | 6 | **9** (`DumpDiffReport`, differ:1030-1050 — adds `sorts`, `queryRequests`, `joins`) |
| per-sheet keys | 6 | **15** (`SheetDiff` — adds `queryItems*`, `queries`, `filters`, `joins`, `axisItems`, `measureItems`, `hiddenItems`, `distinct`, `sortItems`) |
| `calculations.fields` keys | 5 | **8** (adds `name`, `identifier`, `desc`) |

### Why it matters

**This is the single highest-leverage correction in the audit.** A remediation plan built on
these reports would fund work that is already done (F-18) and mis-attribute a closed harness
gap as a parser defect. It has already cost this audit three wrong findings.

### Recommended action

Rename both to `_report-2026-08-27-STALE.json`. Re-run
`diff-corpus.ts --bytes-dir …` before quoting any number. **Blocker:** `d4dumps/` currently
holds **no `.bin` files**, so the corpus cannot be re-diffed offline today — exporting it is
a prerequisite.

---

## WB-03 — The stated blocker for building a token→SQL renderer no longer exists

- **Severity:** HIGH · **Area:** calculated fields / F-02 remediation
- **Confidence:** verified · **Blocks production:** YES (via F-02)

`transformers/transform.ts:1019-1024` explains why formulas are stored raw: *"The token form
is the only formula the workbook stores. It is kept verbatim … rather than machine-translated
to SQL: **Oracle's function-code table is not available**"*.

**That comment is stale.** `workbook-parser.ts:914` exports `EUL_FUNCTION_NAMES` — a
**complete 222-entry `FUN_ID → FUN_EXT_NAME` table**, recovered from `DISCVR4/DCESQRES.DLL`
(which carries the EUL seed script as literal `insert into EUL4_FUNCTIONS … VALUES …` text)
and then *"checked row for row against the live source's own `EUL4_FUNCTIONS`: identical for
all 222 built-ins."* A second, richer table — `CONDITION_OPERATOR_TABLE` (`parser:997-1034`)
— carries `{name, kind, minArgs, maxArgs, neo}` for the 23 boolean codes.

So the position is the **opposite** of "a partial hand-rolled table": there is a complete,
EUL-verified table and no renderer. `humanizeFormula` (`parser:3061-3077`) substitutes only
`[6,n]` and `[8,n]`; function codes are deliberately left verbatim because *"half the codes
are infix operators … rendering only the prefix ones would produce a formula that reads like
SQL and is not — worse than leaving it plainly in token form"* (`parser:3042-3046`).

**Action:** build the renderer, and fix the misleading comment either way. See the revised
scope in [AUDIT_MIGRATION_ASSESSMENT.md](AUDIT_MIGRATION_ASSESSMENT.md).

---

## WB-05 — `map_calculated_fields.data_type` is NULL because the *transformer* drops it

- **Severity:** MEDIUM · **Area:** migration transformer · **Confidence:** verified

The parser extracts it (`parser:3020, 3028-3029`) and the target column exists. But
`TransformedMapCalculatedField` (`transformers/types.ts:552-564`) carries only
`name, formula, displayOrder, axisType, isHidden` — no data type — and `transform.ts:1016-1032`
never sets one.

This is the one genuine drop among the four fields F-18 wrongly condemned. **Action:** add
`dataType` to the interface, map `calculation.dataType`, write it. One field on one interface.

---

## WB-04 — 2 536 formula disagreements are calculation-references-calculation, by design

- **Severity:** MEDIUM · **Area:** workbook parser · **Confidence:** verified

`parser:3050-3054`: *"A `[6,n]` reference is usually a plain EUL item, but `n` is sometimes
itself another `0x00dc` calculation — Oracle's own dump tool recursively substitutes that
calculation's *formula* in its place; `tokens` … does not walk that chain."*

All **38 727 exact-id matches agree with zero exceptions**; the 2 536 residual are this
single known representational difference, not a decode failure — 6.1 % of formulas will read
differently from Oracle's rendering. **Action:** resolve as part of the renderer (WB-03),
deciding expand-vs-link; do not patch `humanizeFormula` alone.

---

## F-21 — No test connects migration output to query execution

- **Severity:** HIGH · **Area:** testing · **Confidence:** verified · **Blocks production:** YES

Only two test files touch both migration and SQL generation
(`integration/query-engine.test.ts`, `sql-generator.test.ts`), and neither loads migrated
data. `integration/migration-audit.test.ts` asserts **row counts** and looks up business
areas by name (`:210-211`); it never generates SQL and never executes a map.

**Why it matters:** this is precisely the gap F-01 fell through. 1 654 tests pass against
a system where the core workflow is 100 % broken, because every test builds fixtures in
which `map.businessAreaId` matches its folders' by construction.

**Action:** one test would have caught it — migrate a fixture EUL, then for every
resulting map call `loadMapDefinition()` + `generateSql()` and assert success. Add it
before any other work.

---

## INF-02 — `/health` returns 200 with `status:"ok"` even when Postgres and Redis are down

- **Severity:** HIGH · **Confidence:** verified · **Blocks production:** YES

`backend/src/routes/health.ts` catches DB and Redis failures into
`database='disconnected'` / `redis='disconnected'`, then unconditionally returns
`{ status: 'ok' }` with no `reply.code()`. The Dockerfile `HEALTHCHECK` tests `r.ok`,
which is true on 200, and `docker-compose.prod.yml` gates nginx and frontend on
`backend: condition: service_healthy`. There is no separate readiness endpoint.

**Action:** return 503 when any dependency is disconnected; split liveness (`/health`)
from readiness (`/ready`) and point healthchecks at the latter.

---

## INF-03 — The audited stack is the *development* overlay; no production hardening has ever run

- **Severity:** HIGH · **Confidence:** verified · **Blocks production:** YES

`docker exec discoverer-neo-backend id` → `uid=0(root)`. `NODE_ENV=development`.
`docker inspect` shows **no Health key** and no memory/CPU limits. Ports
`0.0.0.0:5432`, `0.0.0.0:6379`, `0.0.0.0:3000`, `0.0.0.0:9229` are published. The command
is `npx tsx watch src/server.ts`.

Every positive in `docker-compose.prod.yml` and `backend/Dockerfile` — non-root
`appuser`, multi-stage build, resource limits, no published data-store ports, HEALTHCHECK
— is therefore **unexercised**.

**Action:** stand the prod compose up once end to end as a CI smoke job before any
release claim.

---

## INF-04 — CI has never run

- **Severity:** HIGH · **Confidence:** verified · **Blocks production:** YES

`.github/workflows/ci.yml` triggers on `main`; `git branch -a` shows
`claude/dreamy-lewin-9ac7e9`, `claude/stoic-hertz-5df023`, `* master` — **no `main`**.
`git remote -v` is **empty**. `docker.yml` triggers on `release: published`, unreachable
without a remote.

**Why it matters:** the lint/typecheck/test/db-migrate gate the quality story rests on is
decorative. Combined with a ~2 900-entry dirty tree and HEAD a month behind the running
code, nothing here has ever been mechanically verified.

**Action:** add `master` to the triggers (or rename), add a remote, push once.

---

## INF-05 — No dependency, image or secret scanning; 11 advisories live (6 high)

- **Severity:** HIGH · **Confidence:** verified

`grep -rn 'npm audit|trivy|snyk|dependabot|codeql' .github/` → no matches; no
`dependabot.yml`. `npm audit --omit=dev` → *11 vulnerabilities (5 moderate, 6 high)*,
including a React Router RSC-mode CSRF bypass (GHSA-qwww-vcr4-c8h2) and a `uuid` bounds
check via `exceljs` (GHSA-w5hq-g745-h8pq). `docker.yml` pushes `latest` to ghcr.io with
no scan, no SBOM, no provenance; base images use floating tags.

**Action:** gate CI on `npm audit --audit-level=high`; enable Dependabot; add Trivy and
`provenance: true`; pin base images by digest.

---

## INF-06 — A 20 MB dump containing `data_sources` is untracked, un-gitignored, and unusable as a backup

- **Severity:** HIGH · **Confidence:** verified · **Blocks production:** YES

`file backup-before-reset.sql` → *UTF-16, little-endian, CRLF*. PostgreSQL cannot read
UTF-16 input, so it is a PowerShell redirect artefact, not a restore point. Decoded, it
contains `COPY public.data_sources`, `public.users`, `public.audit_log`.
`git check-ignore -v` returns nothing for it or for `map_tables_backup.sql` — while it
*does* match for `credentials/`, `migrate/dist` and `backend/coverage`.

Verified non-leak: the dumps contain ciphertext only, not plaintext passwords
(`grep -c password_enc` on raw bytes = 0; values appear only via the decoded `COPY`).

**Action:** delete both dumps and `backups/*.dump`; add the patterns to `.gitignore`; use
`scripts/backup.sh`, which already writes correct `pg_dump` custom format.

---

# MEDIUM

---

## BE-05 — A calculated field mixing an aggregate with a bare column is omitted from GROUP BY → ORA-00979

`lib/sql/select-clause.ts:136-143` — `isAggregate = parsed.containsAggregate`, and
`if (!isAggregate) nonAggregateExprs.push(parsed.sql)`. `containsAggregate` is **one boolean
for the whole expression**, so `SUM(QTY) * PRICE` sets it true and the expression joins
neither the GROUP BY list nor the aggregate wrap. `group-by-clause.ts:9-10` then emits a
GROUP BY omitting `PRICE`, and Oracle rejects the statement with ORA-00979. The map saves
cleanly and fails at execution with a `kind: "QUERY"` 500. `totals.ts:190-192` has the
identical hole on the `INLINE` path.

**Action:** have `parseFormula` return the set of *non-aggregated leaf expressions* rather
than a single boolean. **Correct as written:** a fully-nested aggregate (`ROUND(SUM(X),2)`)
is handled properly, and `context.ts:108-122` correctly narrows the cumulative flag per item
so a total over an already-aggregating calculation is not emitted as `SUM(SUM(...))`.

## BE-07 — Totals drop `SELECT DISTINCT`, so 372 maps will show totals that contradict their own rows

`sql-generator.ts:78-88` builds each totals statement as `SELECT <parts>` + `from` +
`where.sql`. `select.distinct` (`select-clause.ts:149`) is applied **only** to the main
statement (`:152`). Live: `SELECT count(*) FROM maps WHERE select_distinct` → **372**.

The detail grid shows deduplicated rows; the total underneath sums the pre-dedup set. The two
visibly disagree, and the total is simply wrong.

**Action:** for a distinct map, wrap —
`SELECT <aggs> FROM (SELECT DISTINCT <select-list> FROM … WHERE …)`.

**Correct as written:** the totals/detail split itself is right. Totals reuse `from` + `where`
and their binds (`bindParams: { ...where.bindParams }`, `:89` — the same object spread, so the
predicate text cannot drift from its binds) and deliberately exclude GROUP BY, ORDER BY and
pagination, so a total covers the whole filtered set rather than the current page. That is the
correct Discoverer semantic, documented at `totals.ts:29-36`.

## BE-04 — `getConnection` leaks a connection whenever its own timeout wins the race

`services/oracle-connection-pool.ts:225-230`:
`return await Promise.race([pool.getConnection(), timeout]);`

The losing `pool.getConnection()` promise is neither awaited nor given a
`.then(c => c.close())`. When `CONNECT_TIMEOUT_MS` fires first, a connection arriving a moment
later is never released.

**Why it matters:** under exactly the load that causes acquire timeouts, every timeout
permanently burns one of `ORACLE_POOL_MAX` (default 10) slots. The pool degrades monotonically
to zero and only a restart recovers it.

**Action:** on the timeout branch attach
`pool.getConnection().then(c => c.close()).catch(() => {})` — or drop the race entirely and
rely on the pool's own `queueTimeout`, already set to the same value (`:178`).

## BE-06 — Pagination has no tiebreaker; 186 maps have no sort at all

`lib/sql/pagination.ts:18-25` emits `OFFSET`/`FETCH NEXT` unconditionally.
`order-by-clause.ts:110` returns `''` when a map configures no sort, and `sql-generator.ts:69`
filters empty clauses out. Live:

```sql
SELECT count(*) FROM maps m WHERE NOT EXISTS (
  SELECT 1 FROM map_items mi WHERE mi.map_id=m.id AND mi.sort_direction IS NOT NULL);
-- 186
```

Oracle guarantees no ordering without `ORDER BY`, so paging such a map can repeat one row and
skip another. **Action:** when `orderBy.sql` is empty and pagination is requested, append a
deterministic tiebreaker (`ORDER BY 1` suffices). This is independent of the F-09 correction.

## BE-08 — `importFromOracle` writes folder + items without a transaction, and the partial state is unrepairable

`services/folder.service.ts:443-476` — `await db.insert(folders)…returning()` then, separately,
`await db.insert(items).values(itemRows)`. No `db.transaction`. If the items insert fails, the
user is left with a folder containing **zero items**, and the idempotency guard (`:418-440`)
then refuses to fix it with *'Folder already exists for this table'*. Only a manual DB delete
clears it.

**Correct by contrast:** `map.service.ts` (`:442, 498, 612`), `security.service.ts`
(`:166, 199`), `scheduler.service.ts` (`:301, 336`) and `hierarchy.service.ts` (`:129, 177`)
all wrap their multi-table sequences correctly. `map.service.update` even validates *before*
opening the transaction, so a validation failure never touches the database.

## BE-12 — `loadMapDefinition` ignores shared folders

`services/sql-generator.ts` (loader, ~`:193`) loads folders with
`.where(eq(folders.businessAreaId, map.businessAreaId))` only; `folder_business_areas` is never
consulted (live count: **0 rows**). A folder shared into a business area is invisible to SQL
generation, so a map built on one fails with the same error as F-01 — for a configuration the
UI explicitly supports (`routes/folders.ts:515, :566`). Latent today; fix alongside F-01, same
query and same root-cause shape.

## F-11 — 78 of 138 EUL grants were lost

`analyze` reports `grants: 138`; `user_business_area_grants` holds 60.
`transform.ts:1344-1348` skips business-area grants with a null business area. Given F-10,
the same EUL4 object-link resolution gap is the likely cause. **Action:** resolve grants
through `EUL4_ACCESS_PRIVS` + `EUL4_BA_OBJ_LINKS` and reconcile to 138.

## F-13 — The dashboard renders developer apology notes as KPI values

Live accessibility tree at `/dashboard` puts these in `<h*>` elements where numbers
belong:

- *"No workspace-wide execution count endpoint exists yet — see each map's history for its own runs."*
- *"Scheduling has not been built yet."*
- *"See Admin -> Data Sources for the full list."*
- *"Scheduling isn't available yet — this section will populate once schedules ship."*

The scheduling text is **false**: `routes/schedules.ts`, `scheduler.service.ts` (816
lines) and `SchedulesPage.tsx` (727 lines) all exist, and `/schedules` is in the nav.
Worse, `frontend/src/__tests__/dashboard.test.tsx:93` **asserts** this text, locking the
placeholder in as correct behaviour.

**Action:** delete the placeholder cards or implement the endpoints; remove the test
assertion that enshrines them.

## F-14 — `/api/data-sources/{id}/tables` returns 404 KB unpaginated

One response carried 273 tables with every column — 404 507 bytes — with only
`{tables, count}` and no pagination, filter or projection. Against a large Oracle schema
this is a memory and latency hazard on both ends.

## F-16 — A decryption failure surfaces as a bare unhandled 500

`POST /api/data-sources/{placeholder-id}/test` → `500 {"error":"Internal Server Error"}`.
Backend log shows an unhandled `Error: Unsupported state or unable to authenticate data`
through `encryption.ts:44` → `data-source.service.ts:158` → `routes/data-sources.ts:351`.
No detail leaks to the client (good), but the operator gets nothing actionable.
**Action:** catch decrypt failures and return a 422 naming the misconfiguration.

## F-17 — An active seed data source with a placeholder credential sits in the real database

`data_sources` row *"Sample Oracle DB"*, `is_active = true`, `host
oracle-db.example.com`, `password_enc = 'PLACEHOLDER_ENCRYPTED_PASSWORD'` — from
`seed.ts:45`. It is the direct cause of F-16. **Action:** never seed placeholder
connections into a non-test database; delete this row.

## F-19 — **REFUTED.** The 1 137 "missing" items are the sheet's *hidden* query items

- **Severity:** ~~MEDIUM~~ → **withdrawn** · **Confidence:** verified

`itemsOnlyInDump` is not a miss count — it is a **definitional** difference. `differ:842-852`
compares the dump's `Items :-` list (the query's full item set) against
`worksheet.columns.map(columnDisplayName)` — **displayed columns only**. Items the query needs
but no column shows therefore land in `itemsOnlyInDump` by construction.

The current parser recovers them: `ParsedWorksheet.hiddenItems` (`parser:2802-2828`), whose
doc reads *"the **1 176** of the corpus's 34 683 query items that are in `d4wkdmp -f`'s sheet
`Items :-` list with no column of their own, typically because a calculation needs them"* —
the same population as the report's 1 137, counted on a later pass. The current differ has a
dedicated `hiddenItems` tally for exactly this set (`differ:~968-972`).

Clustering confirms the benign reading: **1 110 of 1 137 are `EUL Item - …`, 27 are
`Calculation - …`**, across only **167 distinct names** heavily repeated across versioned
copies of the same reports (`M M4.Dt Prim Emissao` ×39, and so on). **0 of the 1 137 also
appeared in `queryItemsOnlyInDump`** — the parser had already named every one.

**What survives — cosmetic:** `itemsOnlyInDump` is not netted against `hiddenItems`, so a
re-run today still prints ~1 137 under a heading that reads like a defect. Subtract the
matched hidden-item set so the field means "unexplained".

**The 48 spurious:** 42 are one documented workbook, `GD_M.M65_V13`, where every `IoId` the
dump prints runs exactly one less than the parser's element id — *"only in that one file"*.
The remaining 6 are one item each across 6 workbooks.

## F-20 — **REFUTED.** Condition case-sensitivity *is* extracted

- **Severity:** ~~MEDIUM~~ → **withdrawn** · **Confidence:** verified

The `0 agree / 3 299 onlyInDump` figure is from the same stale report (WB-01). The parser
reads it at `workbook-parser.ts:2884` (`TAG.CONDITION_CASE_SENSITIVE = 0x0102`, `parser:331`),
and the differ's `FIELDS_NOT_YET_PRODUCED` comment lists `Case Sensitive` among the fields
**closed by W2**.

That constant is now down to a single entry in the entire dump:

```ts
export const FIELDS_NOT_YET_PRODUCED = { Parameter: ['Drill Segment Id'] };
```

Whether the flag reaches a *PostgreSQL column* is a separate question — `map_conditions` has
no case-sensitivity column — but that is a schema/transformer gap, not a parser gap.

## F-22 — The coverage artefact is six weeks stale and contradicts the ">80 %" claim

`backend/coverage/coverage-summary.json` is dated **2026-07-19** and reports lines
**75.38 %**, statements 74.33 %, functions 70.70 %, **branches 56.10 %**. Commit
`f5bb591` is titled *"Backend test coverage push to >80%"*. On this artefact the claim is
false, and branch coverage is barely half.

## F-23 — One backend test fails

`src/__tests__/integration/query-engine.test.ts:875` — *"Scenario 9: async execution ›
submits a job, polls to completion, and exposes results"*; expected a `SUCCESS` row in
`query_execution_log`, got none. 1 056 of 1 057 pass. Jest also force-exits, indicating
leaked handles. **Action:** determine whether this is flake or a real async-execution
defect before trusting the async path.

## BE-09 — Two hand-written formula parsers with an identical grammar and already-drifted allowlists

`lib/sql/formula-parser.ts` (535 LoC) and `services/calculated-field-evaluator.ts` (1,323 LoC)
expose the **same 12 grammar methods** — `peek, next, parse, orExpr, andExpr, notExpr,
predicate, additive, multiplicative, unary, primary, caseExpr` — and identical `KEYWORDS`
(11/11). The allowlists have already drifted:

| Set | SQL parser | Row evaluator | Divergence |
| --- | --- | --- | --- |
| `AGGREGATE_FUNCTIONS` | 5 | 8 | `STDDEV`, `VARIANCE`, `MEDIAN` evaluator-only |
| `SCALAR_FUNCTIONS` | 35 | 34 | `NEXT_DAY` parser-only |

Two live inconsistencies today: `MEDIAN(x)` works in an ad-hoc field but is rejected on a
saved map (`select-clause.ts:99`, `totals.ts:201`); `NEXT_DAY` is the mirror image. Both are
silent until hit.

**The split is justified** — one emits Oracle SQL from the AST, the other evaluates in JS over
fetched rows; those are genuinely different back ends. **Duplicating the front end is not.**

**Action:** extract one tokenizer, one AST and one shared allowlist, with two emitters
(`toSql`, `evaluate`). F-02's token decoder then becomes a **third front end onto the same
AST** (`[1,102](…)` → AST), not a third parser. That is the only consolidation that makes
49,819 migrated formulas tractable, and it should be settled before the decoder is written.

## BE-10 — Schema drift: `map_conditions.groupId` exists in the backend schema and not in migrate's

Full column-level diff (30 backend tables vs 20 in migrate; ignoring `.references()`, which
migrate omits deliberately throughout so bulk loads need no FK ordering):

| Table | Difference |
| --- | --- |
| `map_conditions` | **`groupId` present in backend, absent in migrate** |
| `users` | `locale`, `theme`, `colorPalette` backend-only (benign — migrate never writes them) |
| `hierarchy_levels` | `parentLevelId`: backend self-FK, migrate bare `uuid` |
| `map_totals` | `mapCalculatedFieldId`: backend FK, migrate bare |
| backend-only tables | `audit_log`, `data_sources`, `export_jobs`, `map_shares`, `query_execution_log`, `schedule_parameters`, `scheduled_results`, `schedules`, `security_policies`, `security_policy_assignments`, `security_policy_rules` |
| migrate-only tables | `migration_log` |

Sanity-checked: `map_items` 23/23 and `maps` 11/11 columns agree on both sides.

**Consequence, live:**

```sql
SELECT count(*), count(*) FILTER (WHERE group_id IS NULL) FROM map_conditions;  -- 5605 / 5605
SELECT count(*) FROM map_conditions WHERE logic_operator='OR';                  -- 102
```

`where-clause.ts:200` keys grouping on `condition.groupId ?? '__single_<id>'`, so with
`group_id` NULL on every row each condition becomes its own singleton group. **The 102
migrated `OR` conditions are joined at top level with no bracketing of their own** and read
with Oracle's precedence — `a AND b OR c` — which is not necessarily what the worksheet meant.
The RLS predicate is still safe because the security layer's bracketing is unconditional.

**Action:** determine whether the `.DIS` reader can recover condition grouping. If not, record
the 102 rows in the migration report as a known, bounded semantic gap rather than leaving it
undiscovered.

## BE-11 — The `kind` error taxonomy covers one endpoint; no correlation id reaches the client

`services/map-execution.service.ts:148-153` defines `CONFIG | CONNECT | TIMEOUT | QUERY |
CANCELLED`, mapped in `routes/map-execution.ts:59-65`. But `grep -c "kind:" routes/*.ts` → **2**
call sites, both in `map-execution.ts`, while `grep "\.send({ error:" routes/*.ts | grep -v kind`
→ **175** error responses with no `kind`. `services/security.service.ts:32` defines a *separate*
taxonomy (`VALIDATION | NOT_FOUND | CONFLICT`) that never reaches a response body.

`app.ts:38-40` configures the logger with `level` only — no `requestIdHeader`, no `genReqId`.
Live `curl -D -` on `/api/maps` returns no `x-request-id`. Fastify's default `request.id` is a
per-process counter present in logs but never sent to the caller, so a user-reported failure
cannot be tied to a log line.

**Action:** set `requestIdHeader: 'x-request-id'` + `genReqId: () => randomUUID()`, echo it in
`onSend`, include it in the global error body. Widening `kind` beyond map execution is
optional; picking *one* taxonomy is not.

## F-25 — `NOT` cannot be represented in conditions; the parser refuses rather than distorts

`logic_operator` enum is `AND|OR` only; `map_operator` has no negated forms.
`workbook-parser.test.ts:325,331` — *"refuses a NOT node rather than migrating what it
negates"*, *"refuses a NOT anywhere inside a conjunction, and says it is a negation"*.

This is **good engineering** — refusing is far safer than silently inverting a filter —
but it is a hard semantic ceiling. The source also has `EUL4_SUB_QUERIES` and
`EUL4_SQ_CRRLTNS`, so correlated-subquery conditions exist and are likewise
unrepresentable.

## F-27 / MIG-05 — **Partly refuted.** `conditions: 0` is correct; `securityConditions: 0` means "never read"

- **Confidence:** verified

Both readers are switched off at the source, not misrouted:

```ts
// migrate/src/services/eul-reader.ts:70-71
export const CONDITION_EXP_TYPES: readonly string[] = [];
export const SECURITY_MANAGER_EXP_TYPES: readonly string[] = [];
```

`eul-reader.ts:299-308` short-circuits to `[]` rather than issuing an empty `IN ()`. The comment
at `:56-69` explains why: the previous values were `CO` — which is the plain column-backed item,
so every item was being read twice and mislabelled — and `SM`, attested by no source.

- **`conditions: 0` is CORRECT — absent in source.** `EUL_SCHEMA_GROUND_TRUTH.md:273-277`
  records the live answer: `EXP_TYPE` on this EUL holds only `CO` (6 967), `CI` (2 830) and
  `JP` (10). There are **no condition rows in `EXPRESSIONS`.** The 5 605 rows in
  `map_conditions` come from workbook bodies, which is the right place. **My earlier reading of
  this as unreliable was wrong.**
- **`securityConditions: 0` is NOT established — SCHEMA GAP / not implemented.** Grepping
  `ASM_POLICIES|ASMP_CONS|ASMP_LOGS|ASM_` across `migrate/src` and `backend/src` returns exactly
  **one hit**, and it is a table-inventory line in a markdown doc. No reader, no adapter entry,
  no transform. The Security Manager is unmigrated *and unreported*.
- **The "8 Security Manager condition(s)" warning is a red herring — and it misled this audit.**
  All eight rows carry `run_id a5757a5c-0000-4000-8000-000000000001`, the **seeded test
  artefact**, and each reads *"1 Security Manager condition(s)"* — eight repetitions of a
  one-condition fixture. The emitter (`migration-runner.ts:735-741`) is guarded by
  `securityConditions.length > 0`, which is unreachable on the live path.

**Action:** report the two separately. Keep the empty `CONDITION_EXP_TYPES` — it is correct.
Implement an `ASM_POLICIES` / `ASMP_CONS` reader into `security_policies` /
`security_policy_rules`; both target tables exist and are empty.

## MIG-08 — The 171 skipped items are one folder with no business area, and that is **absent in source**

- **Confidence:** verified

`migration_log`: `ERROR | folders | Folder "M M41" (114533) skipped: no business area.` — once
per completed run (`migration-runner.ts:607`). Its items then hit `:678`, producing
`items | WARN | "… skipped: folder not migrated."` — 513 rows across 3 runs, **171 distinct
items**. And 9 797 − 9 626 = **171 exactly**.

It is the same folder `analyze` reports as `foldersWithoutBusinessArea = 1` and that
`validate` flags as `FOLDER_NO_BA`.

**Classification: ABSENT IN SOURCE, not a defect.** `BA_OBJ_LINKS` has no row for object
114533, so the folder belongs to no business area **in Discoverer either**, and Neo's
`folders.business_area_id` is NOT NULL. The behaviour — skip loudly at ERROR, then skip
dependents at WARN with names and ids — is correct, and is the best-instrumented path in the
whole runner. **No action needed** beyond deciding whether those 171 items matter enough to
give the folder a business area before cutover.

## F-32 — The map detail endpoint omits totals, layout and page setup

`GET /api/maps/{id}` returns `items`, `conditions`, `parameters`, `calculatedFields` —
but **not** `totals` (19 632 rows), `layout` or `pageSetup` (923 rows). Data migrated
faithfully is discarded at the API boundary.

## INF-08 — No production guard on insecure config defaults

The only `.refine` on the config schema checks `ORACLE_POOL_MIN <= ORACLE_POOL_MAX`. The
sole `process.exit(1)` fires on a Zod parse failure, which a satisfied default never
triggers. The correct pattern is already used elsewhere
(`${POSTGRES_PASSWORD:?…}` in `docker-compose.prod.yml`) — it was simply not applied here.

## INF-09 — `/metrics` is proxied unauthenticated on the public TLS listener

`nginx/nginx-ssl.conf:139-143` exposes `location = /metrics` inside the `listen 443 ssl`
block with no `allow`/`deny`, no auth and no rate limit — directly contradicting the
metrics plugin's own comment: *"do not route it through the public ingress."*

## INF-10 — Metrics miss the Oracle pool, the scheduler queue and migration progress

39 metric families; only 8 application-specific, all export/HTTP/DB-cache. No `oracle_*`
family exists despite every execution passing through a configurable pool against a
2012-era database. Pool saturation would be invisible until users complain.

## INF-11 — Redis is RDB-only with a 1-hour worst-case window but is the system of record for jobs

`config get save` → `3600 1 300 100 60 10000`; `appendonly no`. The compose comment calls
Redis "a cache + BullMQ queue, neither of which needs AOF" — correct for the cache half,
wrong for the queue half. A crash can discard an hour of in-flight and delayed job state.

## INF-12 — `docker-compose.yml` is titled "Production" but publishes Postgres and Redis to `0.0.0.0`

Header line 2: *"Discoverer Neo — Production Docker Compose"*, with
`POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change_me_in_production}`, Redis with no
`requirepass`, no resource limits and no nginx — while the genuinely good
`docker-compose.prod.yml` is a third file most readers will not reach.

## INF-13 — CORS reflects any origin with credentials

`plugins/cors.ts` in full: `{ origin: true, credentials: true }`. No allowlist key exists
in config or any `.env`. Blunted in practice by Bearer-token auth, but nginx serves SPA
and API from one origin, so the exposure is real.

## INF-14 — 40 MB of database dumps sit in the tree with no ignore rule

2 908 dirty entries, of which **2 705 are the benign documented `.claude/agents` →
`agents-off` rename** — the tree is far less chaotic than the raw number implies, and that
deserves saying. What is not benign: three untracked dumps totalling ~40 MB matched by no
ignore rule.

## SEC-05 — No rate limiting or account lockout on login

No rate limiter is registered anywhere — `grep -rn 'rate-limit|rateLimit'` across `src/` and
`package.json` returns nothing, and `app.ts:69-77` lists none. `POST /api/auth/login`
(`routes/auth.ts:36`) has no `preHandler` and no attempt counter; `audit_log` holds 6,676
login attempts with no lockout artefact. `/api/auth/refresh` is likewise unauthenticated and
unthrottled. bcrypt cost 12 (`lib/password.ts:3`) slows throughput but there is no lockout,
so guessing is unbounded. Compounded by SEC-08 and SEC-09 (account enumeration).

## SEC-07 — Raw Oracle `ORA-` error text is returned to any user who can execute a map

`asExecutionError` → `errorMessage(err)` returns `err.message` verbatim
(`services/map-execution.service.ts:540-551`) and `routes/map-execution.ts:69-72` sends it
straight to the client, bypassing the generic 500-masking at `app.ts:52`. `ORA-00942` /
`ORA-00904` disclose table and column existence to a VIEW-level user. Currently unexercised
because of F-01. **Action:** map ORA codes to generic client messages; log detail server-side.

## SEC-10 — Data-source host/port are interpolated into the Oracle connect descriptor (SSRF, admin-gated)

`services/oracle-introspection.ts:88` and `data-source.service.ts:160` build
`(DESCRIPTION=(ADDRESS=(HOST=${ds.host})(PORT=${ds.port})…))` from stored fields, with
`host: z.string().max(255)` and no allowlist. Create/test are gated to `ADMIN`/`MANAGER`
(`data-sources.ts:143,207,317`). An admin already holds high privilege, so this is
**internal-only, not a remote exploit** — but if `MANAGER` is meant to be lower-trust,
restrict the host or drop `MANAGER` from create/test.

## SEC-11 — Read operations are never audited

`plugins/audit.ts:17,154` logs only `POST/PUT/PATCH/DELETE`. Every GET is skipped —
including the SEC-03 cross-business-area metadata reads and
`GET /api/exports/:jobId/download`. Authorization denials **are** captured on mutating
routes (the hook runs `onSend` regardless of status) but not on GETs. Writes are
fire-and-forget (`:187-189`), so a failed insert is silently dropped, and there is no
tamper-evidence or hash chaining. **Exfiltration through the SEC-03 IDOR leaves no trail.**

## SEC-12 — The access token is its own refresh credential; ~14-day effective lifetime

`routes/auth.ts:143-206`; the live token decodes to `exp - iat = 604800` (7 days), and
refresh extends any token expired within a further 7 days (`:252`). No rotation. A leaked
token is valid for up to ~14 days and self-renewing. Not independently exploitable beyond
SEC-01, but it sets that finding's blast radius.

## INF-07 — Nine plaintext credential CSVs are a week old on disk

`credentials/` (2 files, 2026-08-24) and `storage/credentials/` (7 files, 2026-08-27).
Correctly gitignored, but the documented "collect, distribute, then delete" step is manual
and has not happened. **Action:** write with a TTL and sweep on boot.

---

# LOW

- **SEC-08** — Login timing oracle: `routes/auth.ts:107-113` returns 401 for a missing email
  *before* the bcrypt compare, so an existing account is measurably slower. Unauthenticated
  account enumeration; feeds SEC-05. Compare against a dummy hash to equalise the paths.
- **SEC-09** — `GET /api/users/search` (`routes/users.ts:64-100`) returns id/name/email for
  all users to any authenticated user, with only `authenticate` attached. It exists for the
  map-share picker, so it is a design trade-off rather than a bug — but it widens the
  enumeration surface. Require a minimum query length and cap results.
- **F-15 — REFUTED.** I reported that `/documentation` and `/documentation/json` 404 "despite
  `plugins/swagger.ts` existing". **I probed the wrong path.** `swagger.ts:51` sets
  `routePrefix: '/api/docs'`, and live both `/api/docs` and `/api/docs/json` return **200**.
  `README.md:72` documents the correct URL. There is no defect here — the app deliberately
  overrides fastify-swagger's default prefix and says so.
- **Lockfile drift — REFUTED.** I flagged the root `package-lock.json` (20 July) as potentially
  inconsistent with later `package.json` changes. `npm ci --dry-run --ignore-scripts` →
  *"up to date in 820ms"*. The lockfile is consistent.
- **F-26** — The login form exposes two controls for one checkbox:
  `checkbox "Remember me" [type=button]` plus `checkbox "on" [type=checkbox]`. The native
  input is announced as "on". A screen-reader user hears a duplicated, unlabelled control.
- **F-28** — `analyze.estimate` returned *2 229.8 minutes ("~4.6 working days")*; the real
  runs took **20–21 seconds**. Off by ~6 000×. Cosmetic, but it is an unvalidated number
  presented to operators as a plan input.
- **F-29** — `analyze.workbookUsage` reports `workbookCount: 564` and
  `workbooksWithUsage: 1442` in the same object — internally impossible.
- **INF-15** — Node inspector port 9229 published on `0.0.0.0` in the dev overlay. Nothing
  listens today (no `--inspect` flag), so this is correctly *low*; but the mapping is the
  half an operator cannot see. Bind to loopback.
- **INF-16** — `frontend/Dockerfile.dev` uses `npm install` from the `frontend/` context,
  ignoring the workspace lockfile, unlike every other image in the repo.

---

# INFORMATIONAL

## F-05 (corrected) — The four migration `run_id`s are not a guard bypass

An earlier reading treated four `run_id`s as contradicting the README's "a second full
migration is refused". **That was wrong and is corrected here.** The guard is real
(`migration-runner.ts:314-322`). Per-run breakdown:

| run_id | Outcome |
| --- | --- |
| `a5757a5c-0000-4000-8000-000000000001` | Synthetic, hand-formed id; 4 of each phase, 4 `ERROR failed` — a seeded/test artefact, not a real run |
| `6a92675c` | **Failed and rolled back** (`ERROR folders`, `ERROR validate`, `ERROR failed`) |
| `730b3bc4` | Completed (`INFO done`) |
| `d815efa8` | Completed |

`backup-before-reset.sql` exists precisely because the database was reset between runs.
No contradiction. Per run the warnings are **508 hierarchies and 171 items** — and 171
matches the source-target item delta (9 797 − 9 626) **exactly**, which is a good sign for
the migration's internal consistency.

## F-04 (corrected) — The layout gap is stale data, not a current-code defect

899 of 923 maps have no `map_layouts` row, and the 24 that do have `source_attrs` set but
`worksheet_index`, `query_count` and `graph` all NULL — matching `analyze`'s
`withForcedJoins: 24` exactly. The initial hypothesis was a forced-join-only writer.

**The current code does not do this.** `migration-runner.ts` states explicitly:

```ts
// One row per map, not one per map that forced a join: the worksheet's
// index, GUID and printed title live here and nowhere else.
mapLayoutRows.push(buildMapLayoutRow(t.layout, joinAttrs, mapId, deps.genId()));
```

So the live database was written by an **older build than the current source tree** — a
direct consequence of HEAD being a month behind ~2 900 uncommitted files. A re-migration
on current code should produce all 923. This should be verified, not assumed.

## F-24 — The schema already models far more Discoverer semantics than the data contains

This materially changes the remediation picture and deserves emphasis. Live enums include
`map_axis_edge ROW|COLUMN`, `map_type TABLE|CROSSTAB|PAGE_DETAIL|CHART`,
`map_total_kind TOTAL|PERCENTAGE`, `map_total_placement GRAND_TOTAL|AT_CHANGE`,
`map_format_target CELL|ROW`. `map_items` carries `axis_edge`, `axis_order`, `sort_rank`,
`sort_group`, `column_width`, `alignment`, `word_wrap`, `heading_format_mask`,
`data_type`, `source_attrs`.

Yet: `axis_edge` is NULL on **all 25 960** rows, and `map_type` is `TABLE` on **all 923**
maps. **The crosstab model exists and is simply unpopulated.** Most "lost semantics" are a
parser/transformer problem, not a schema redesign problem.

## F-30 — Tests enshrine the incomplete state

`frontend/src/__tests__/dashboard.test.tsx:93` asserts the presence of *"Scheduling isn't
available yet"*. A test that locks in a placeholder makes removing the placeholder a test
failure.

## INF-17 — Real backup/restore tooling exists and is good

`scripts/backup.sh` (pg_dump custom format + gzip, Redis BGSAVE, volume tarball, 30-day
retention, documented cron) and `scripts/restore.sh` (`--postgres/--redis/--files`,
`--clean --if-exists`, interactive confirmation) are well written, with
`docs/deployment/backup.md` alongside. INF-06 is a **discipline gap, not a capability
gap** — an ad-hoc redirect was used instead of the procedure already written.

## Additional verified positives

### Security controls independently verified as sound

- **Every runtime value is a bind.** `where-clause.ts` `bindValueFor`/`placeholder`; `IN`
  and `BETWEEN` expand to per-value binds (`:104-124`, `:150-186`). Operators are
  enum-constrained in both zod (`routes/maps.ts:25`) and pgEnum (`db/schema.ts:180`).
- **Identifiers are validated, not escaped.** `identifiers.ts:13-33` matches
  `^[A-Za-z][A-Za-z0-9_$#]*$` and **rejects** anything containing a quote rather than
  trying to escape it. All table/owner/column emission routes through `quoteIdentifier`
  (`from-clause.ts:52-54`, `context.ts:91`).
- **RLS predicates cannot be escaped by an `OR`.** OR-groups are unconditionally bracketed
  before predicates are ANDed, and each predicate is separately parenthesised
  (`where-clause.ts:224-296`). Predicate binds are restricted to a `:current_user_*`
  allowlist and never taken from request input (`security-predicates.ts:32-38`).
- **Oracle introspection uses binds** (`:owner`, `:tableName` —
  `oracle-introspection.ts:153,166`). `parameter-resolver.ts` emits typed bind values only,
  never SQL text.
- **Map access control layers correctly** — `canAccessMap` (`map.service.ts:786-813`) checks
  owner / admin / public / share / business-area grant. Re-sharing is gated on owner or
  admin, not on a received EDIT share (`map-shares.ts:84,138,193`).
- **Export ownership is enforced** — `loadOwnJob` requires `requestedBy === user.sub` *and*
  live map access, and returns 404 rather than 403. File paths are UUID-derived server-side
  (`export.service.ts:199,439`) with no user input in filenames — **no path traversal**.
- **Schedules** are ownership-gated, re-check live map access on trigger, and scope result
  downloads by schedule id (`schedules.ts:110-141,357`).
- **All migration routes are `authorizeAdmin`** (`migration.ts:82`).
- **The `!migrat` sentinel fails closed** — live: `POST /api/auth/login` for
  `dcn@migrated.local` with a deliberately wrong password → **401**.
- **`custom_sql` has a secondary net at generation time** — `from-clause.ts:34-43` re-checks
  SELECT/WITH-start and rejects embedded `;`, limiting SEC-04 to single-statement abuse.
- **Aggregate functions are allowlisted** before wrapping (`select-clause.ts:99`,
  `totals.ts:201`).

### Other

- Auth fails **closed** on a Redis outage: the token-blacklist lookup sits inside the same
  `try/catch` as `jwtVerify` (`plugins/auth.ts:63`), yielding 401 rather than skipping
  revocation. **Qualified by SEC-01:** it fails closed on an *outage*, but revocation
  itself is bypassable via `/api/auth/refresh`.
- The must-change-password gate is enforced server-side against the database, not from the
  JWT, with an explicit exempt-route allowlist.
- Graceful shutdown is complete: re-entry guard, 10 s force-exit timer, `app.close()`
  draining, then `postgresPool.end()`.
- The backend fails fast at boot when `ORACLE_THICK_MODE` is set without a usable client.
- `nginx/nginx-ssl.conf` is solid: TLS 1.2/1.3, modern ciphers, OCSP stapling, HSTS
  `max-age=63072000`, a 20 r/s `limit_req` on `/api/`.
- `.dockerignore` is correct and non-obvious, documenting why `**/nginx/*` does not shadow
  `frontend/nginx.conf`.
- Metrics route labelling uses `request.routeOptions.url` (the pattern) with an explicit
  cardinality comment — the correct choice.

---

# §7 — Open questions and audit limits

**Not resolved; each needs one focused check.**

1. **Oracle server version** — settles F-09 outright. `SELECT banner FROM v$version`.
   Highest-value single query for the next session.
2. **Crosstab detection** — `analyze` reports `crosstabs: 0` across 923 worksheets. Is
   that true of this estate, or is detection broken? `map_type` is `TABLE` on all 923 and
   `axis_edge` NULL on all 25 960, which is consistent with either.
3. **Does a re-migration on current code produce 923 layouts?** (F-04 correction.)
4. **The 1 137 missing sheet items** (F-19) — which workbooks, and is there a pattern?
5. **`docker-compose.prod.yml` has never been run** (INF-03). Named volumes mount over
   `chown`ed directories, and Docker only copies image ownership into an *empty* volume —
   a second deploy could fail export writes with `EACCES`.
6. **Certificates** — prod compose mounts `./certs` read-only; nothing creates it and
   there is no renewal service. nginx will not start without `fullchain.pem`.
7. **Backups are never scheduled** — `scripts/backup.sh` assumes Unix cron; the host is
   Windows 11.

**Domains not audited to full depth** (auditor waves lost to usage limits): exhaustive
per-route IDOR sweep; complete CVE triage; systematic accessibility audit; full
documentation claim-by-claim reconciliation; deep `where-clause.ts` / `from-clause.ts`
join-resolution analysis (notably: what a multi-folder map does with only 10 joins —
cartesian product or thrown error — remains **unanswered and important**).
