# Discoverer Neo — Forensic Audit: Executive Summary

**Audit date:** 2026-09-01
**Auditor:** Claude Opus 5 (Claude Code), operating from the repository root
**Method:** Evidence-first. Live running stack, live Oracle EUL, live PostgreSQL, source
code, executed test suites, and Oracle's own `d4wkdmp.exe` reference decoder output.
Historical planning documents were treated as claims to be checked, not as facts.

**Scope note:** Ten specialist auditors were dispatched in parallel across the audit
domains. Two full waves were lost to account usage limits; only the infrastructure
auditor completed (17 findings, incorporated as `INF-*`). Every other domain was
audited directly by the lead. Coverage depth therefore varies by domain and is stated
explicitly in [AUDIT_DETAILED_FINDINGS.md](AUDIT_DETAILED_FINDINGS.md).

---

## 1. The one-paragraph answer

Discoverer Neo is a **substantial, well-engineered, and genuinely impressive body of
work that does not currently function as a product.** The metadata layer, the SQL
generation architecture, the Oracle connectivity, and above all the reverse-engineered
`.DIS` workbook parser are real, careful, and in the parser's case *validated against
Oracle's own decoder across 544 workbooks*. But the migrated estate of 923 worksheets is
unreachable through three independent defects — it cannot be listed, cannot be executed,
and its calculated fields cannot be compiled — and the production security posture rests
on an encryption key published in the repository. The project is not "80% done and
needing polish". It is roughly **60% built, ~15% integrated, and 0% delivered**: the
pieces are largely right, and almost nothing is joined up end to end.

---

## 2. Current state — what is actually true

### Verified working

| Area | Evidence |
| --- | --- |
| Oracle connectivity to a real 2011-era Discoverer 4.1 estate | `POST /api/data-sources/{id}/test` → `200 {"success":true,"latencyMs":910}` against `10.236.141.201:1530` SID `COSEC` |
| EUL version detection | `POST /api/migration/detect` → `EUL4`, `4.1.x`, schemaVersion `4.1.11.0.0`, 61 `EUL4_*` tables |
| Full EUL assessment pipeline | `POST /api/migration/analyze` completed in 45.8 s and returned real counts, orphans, complexity and fidelity |
| Workbook binary parsing | Oracle `d4wkdmp.exe` cross-check, **0 failures**: item identity 29 591/29 591 agree, functions 717/719, parameters 3 767/3 784, condition formulas 3 297/3 298. Calculation `dataType`/`placement`/`hidden`/`isACalc` also agree on current code. *(The checked-in reports are stale — see WB-01.)* |
| Complete Oracle function-code table | `EUL_FUNCTION_NAMES`, 222 built-ins recovered from `DCESQRES.DLL` and verified row-for-row against the live `EUL4_FUNCTIONS`. The stated blocker for a token→SQL renderer no longer exists |
| Type safety | `npm run typecheck --workspaces` clean across backend, frontend, migrate |
| Test suites | 1 654 tests, **1 653 pass / 1 fail** (backend 1 056/1 057, migrate 463/463, frontend 134/134) |
| Credential redaction at the API | `GET /api/data-sources` exposes only `hasPassword: boolean` — never ciphertext or plaintext |
| Graceful shutdown, health probes, metrics | Real dependency probes; 39 Prometheus metric families served |
| Production Dockerfiles & compose | Multi-stage, non-root, resource-limited, healthchecked (`INF-17`, and see caveat below) |

### Verified broken

| Area | Evidence |
| --- | --- |
| **Executing any migrated worksheet** | 0 of 923. `POST /api/maps/{id}/execute` → `400 "Item … not found in the map's business area"` |
| **Finding any migrated worksheet** | `GET /api/maps` → `{"data":{"mine":[],"shared":[]}}` |
| **The Maps page** | `MapsListPage.tsx` renders "This page is coming soon." |
| **Migrated calculated fields** | 49 819 rows stored in Discoverer token form (`[1,102](…)`) that no backend parser accepts |
| **Hierarchies** | 508 in source, **0** migrated |
| **Row-level security, sharing, scheduling, exports, conditional formats** | All tables empty; never exercised against real data |
| **Production secret handling** | `ENCRYPTION_KEY` absent from every config file; the repo's public default is in force |
| **CI** | Has never run — workflows trigger on `main`, the repo is on `master`, and there is no git remote |

---

## 3. Major strengths

These are real and should be protected in any replan.

1. **The workbook parser is the project's crown jewel, and it is better than the audit's own
   first pass gave it credit for.** Reverse-engineering an undocumented Oracle binary container
   and proving it against Oracle's own decoder is exceptional work — but the detail that matters
   is *how*: `EUL_FUNCTION_NAMES` was recovered from `DCESQRES.DLL`'s embedded seed script and
   then verified row-for-row against the live `EUL4_FUNCTIONS` (222/222). `WorkbookTotal`'s
   fields are read off `DCBIMPB.DLL`'s export table. Uncertain fields are *labelled* uncertain
   ("Unit unconfirmed", "Semantics unconfirmed"), and the parser **refuses rather than distorts**
   — `NOT IN` maps to `null`, not to `IN`, because *"migrating it as `IN` inverts the filter"*.
   The differ's list of fields it cannot yet produce is down to **one**: `Drill Segment Id`.
2. **The PostgreSQL schema is far better than the migrated data suggests.** It already
   models crosstab edges (`map_axis_edge ROW|COLUMN`), `map_type CROSSTAB|PAGE_DETAIL`,
   sort rank and group-break, column widths, alignment, word wrap, percentages
   (`map_total_kind TOTAL|PERCENTAGE`), grand-vs-at-change totals, and cell/row
   conditional formats. Most "lost" Discoverer semantics are a **population** problem,
   not a modelling problem.
3. **The SQL generation architecture is sound.** Identifiers validated and quoted from
   metadata only; every runtime value a bind variable; formulas parsed to an AST against
   an allowlist and re-emitted — never spliced.
4. **The Oracle integration genuinely works** against a pre-11g database that thin-mode
   drivers cannot even authenticate to. That is not trivial and it is done correctly.
5. **The operational tooling is better than the artefacts imply** — real `backup.sh` /
   `restore.sh`, a well-built `docker-compose.prod.yml`, a solid TLS nginx config.

---

## 4. Top blockers (ordered)

| # | Blocker | Severity | Fix size |
| --- | --- | --- | --- |
| **0** | **36 source files — including the 128 KB workbook parser and `EUL_SCHEMA_GROUND_TRUTH.md` — have never been committed, and there is no git remote** | **CRITICAL** | **One command.** Do this before anything else. |
| 1 | All 923 maps sit in a synthetic business area with zero folders, so none can execute | CRITICAL | **Small** — data repair; 898/923 resolve to exactly one real BA |
| 2 | `MapsListPage` is a placeholder, so the builder and viewer are unreachable | CRITICAL | Medium |
| 3 | `GET /api/maps` returns only owned/shared maps, hiding the whole migrated estate | CRITICAL | Small |
| 4 | Migrated formulas are in token form; no backend decoder exists | CRITICAL | **Large** — but the grammar is already documented in `migrate/` |
| 5 | `ENCRYPTION_KEY` defaults to a public repository string | CRITICAL | Trivial (5 lines) |
| 5b | 174 Oracle passwords + 5 user passwords sit in `audit_log` in **cleartext** | CRITICAL | Small (redact by substring, then purge) |
| 6 | **Every migrated join is discarded at query time** — all 10 have NULL item ids, so `def.joins` is always empty and *all* 341 multi-folder maps fail | CRITICAL | **Large** — a schema modelling error: Discoverer joins folders, Neo models an item pair |
| 7 | Saving a map through the API **permanently destroys its totals** (19,632 rows exposed) | HIGH | Small |
| 8 | 508 hierarchies lost; drill is impossible | HIGH | Medium |
| 9 | No test bridges migration output → SQL generation → execution | HIGH | Medium |
| 10 | CI has never run; nothing has been mechanically verified | HIGH | Trivial |

**The striking fact:** blockers 1, 3, 5, 5b and 7 are all *small* fixes. A focused week could
plausibly move this system from "nothing works" to "worksheets render" — for the **651 maps**
that are single-folder or fully join-connected.

**The sobering counterweight (MIG-01):** every one of the 10 migrated joins has NULL
`left_item_id` and `right_item_id`, and `sql-generator.ts:242-249` drops any join missing them.
So `def.joins` is **always empty** and *all 341* multi-folder maps fail — not 271. The cause is
a modelling error, not missing data: EUL4 `KEY_CONS` binds **folders** with a column predicate,
while Neo models a join as a single **item pair**, which the source cannot populate.

That means **651 of 923 maps (single-folder) are reachable by the small fixes above; the
remaining 272 need a schema change to `joins` first.**

**One relief:** an earlier draft of this audit flagged an Oracle dialect blocker. **It was
wrong** — the server is 12.2, `OFFSET/FETCH` is valid, and the fear that fixing the scoping
bug would yield *silently wrong numbers* is also unfounded: the join resolver throws a clear
error rather than emitting a cartesian product. See §10.

---

## 5. Migration readiness

**Not ready. The tool reports that it is.**

`scoreReadiness()` returned `75 / "ready-with-warnings"` with **`blockers: []`** on a
migration where every single map is unexecutable. It scores only EUL-version support,
warning counts and orphan counts. It never inspects whether the output it produced is
usable. This is the most dangerous single defect in the migration pipeline, because it
converts a total failure into a green light.

Source-vs-target, measured live:

| Concept | EUL4 source | Migrated | Verdict |
| --- | --- | --- | --- |
| Business areas | 6 | 6 (+1 synthetic) | OK |
| Folders | 213 | 212 | OK (1 orphan in source) |
| Items | 9 797 | 9 626 | 171 lost — exactly the folder-orphan count |
| Joins | 10 | 10 | Exact |
| Custom functions | 593 | 593 | Exact |
| Users | 17 | 17 (+2) | OK |
| Worksheets | 923 | 923 | Exact |
| `SELECT DISTINCT` | 372 | 372 | **Exact** |
| Worksheets with totals | 686 | 684 | 99.7 % |
| Worksheets with sorts | 740 | 737 | 99.6 % |
| Page setup | 923 | 923 | Exact |
| **Hierarchies** | **508** | **0** | **Total loss** |
| **Grants** | **138** | **60** | **78 lost** |
| **Worksheet layouts** | 923 decoded | **24 stored** | **Stale data — current code writes all 923** |
| Crosstab worksheets | 0 detected | 0 | Unverified — detection may be broken |

Worksheet *content* fidelity is genuinely high. Worksheet *usability* is zero.

---

## 6. Security posture

**Fails an enterprise bar. Four issues are serious, and two of them are credential
exposure.**

1. **Cleartext credentials in `audit_log` (SEC-02).** The audit hook stores full request
   bodies and redacts only *exact* key names. `passwordEnc` — which the client sends as
   **plaintext** before the server encrypts it — and `newPassword` are not in that list.
   Live count: **174 Oracle data-source passwords and 5 user passwords sitting in cleartext**
   in the database. This is worse than the encryption-key problem, because it is not
   encrypted at all.
2. **The public encryption key (F-03).** `config.ts:147` defaults `ENCRYPTION_KEY` to a
   string published in this repository, and the variable appears in no `.env`,
   `.env.example` or compose file — so the default protects every stored Oracle password.
   `JWT_SECRET` has the same pattern. Nothing refuses to boot in production with either.
3. **Refresh defeats logout *and* deprovisioning (SEC-01).** `/api/auth/refresh` never
   checks the logout blacklist and re-signs `role` from the incoming token rather than the
   database. A demoted, deactivated or deleted user keeps a live session for up to ~14 days.
4. **IDOR on metadata reads (SEC-03).** `GET` by id on folders, items, joins and hierarchies
   attaches only `authenticate` — no entity scoping — so any of the 18 non-admin accounts can
   read the whole metadata layer, including `custom_sql` and join topology, across business
   areas they were never granted.

Also open: `folders.custom_sql` validation is skipped entirely on UPDATE (SEC-04); RLS fails
**open** with no policy, and COMPLEX folders bypass predicates structurally (SEC-06); no rate
limiting or lockout on login (SEC-05); raw `ORA-` errors reach clients (SEC-07); reads are
never audited, so IDOR exfiltration leaves no trail (SEC-11); CORS reflects any origin with
credentials; `/metrics` is public on 443 against its own documented instruction; 11 npm
advisories (6 high) with no scanning in CI; nine plaintext credential CSVs a week old on disk.

**Mitigating, and genuinely good:** every runtime value is a bind variable; identifiers are
*rejected* rather than escaped when they contain quotes; **an `OR` in a user condition
cannot escape a security predicate** (bracketing is unconditional and correct); export
downloads are ownership-gated with UUID-derived paths and **no path traversal**; migration
routes are all admin-gated; the API redacts credentials in responses; and the `!migrat`
sentinel for migrated users fails closed (verified live).

The SQL layer is disciplined. The failures are concentrated in secret handling, the token
lifecycle, and object-level authorization — which makes them tractable, but they are more
numerous than the first pass suggested.

---

## 7. Architecture posture

**Largely sound; two decisions need revisiting, one urgently.**

- **Keep:** the three-workspace split; metadata-driven SQL generation with AST-parsed
  formulas; thick-mode Oracle for legacy sources; Drizzle + explicit migrations; BullMQ
  for exports and schedules.
- **Change urgently:** `maps.business_area_id NOT NULL` flattens Discoverer, where a
  worksheet draws items from folders across business areas. This single constraint is the
  root cause of the top blocker.
- **Change:** two independent formula parsers exist (`lib/sql/formula-parser.ts` for SQL
  compilation, `services/calculated-field-evaluator.ts` for row-level evaluation) and
  **neither** understands the token form that migration actually produces. A third
  representation — the decoder that already exists inside `migrate/` — needs to become
  the canonical one.

---

## 8. UI posture

**The weakest dimension by a wide margin.** The backend has ~11 000 lines of working
service code behind a front end whose central page says "This page is coming soon."

- `/maps` is a 22-line placeholder. `MapBuilderPage` and `MapViewerPage` are real and
  substantial but reachable only by hand-typing a UUID.
- The dashboard renders developer apology notes inside `<h*>` elements where KPI numbers
  belong: *"Scheduling has not been built yet."*, *"No workspace-wide execution count
  endpoint exists yet…"* — while a full schedules API, `scheduler.service.ts` (816 lines)
  and `SchedulesPage.tsx` (727 lines) all exist.
- Clicking **Run** on a real migrated worksheet fires **no network request at all** and
  shows no error. Silent failure is worse than a visible one.
- The dashboard reports "Total Maps 0" and "No maps yet" against 923 maps.

The admin surfaces (Security, Migration, Schedules, Data Sources, Audit) are, by
contrast, substantial and real. The product's *own* surface is the one that is missing.

---

## 8b. The one sequencing constraint that matters more than any single fix

**Do not "fix the joins" first. It is the most tempting change in this codebase and the most
dangerous.**

Neo has **no fan-trap guard** — no cardinality awareness, no duplicate-aggregation handling
anywhere in `lib/sql/`. Discoverer made this a headline feature: it used join cardinality to
detect when an aggregate would be computed across a one-to-many expansion, and aggregated the
detail side in an inline view before joining.

Today that gap is **masked** — because `def.joins` is always empty, multi-folder maps fail
outright. The failure is hiding the bug.

The join predicate turns out to be recoverable in roughly one line: `EXPRESSIONS.EXP_TYPE='JP'`
holds exactly 10 predicate rows for the 10 joins, and `DEFAULT_ITEM_EXP_TYPES = [CO, CI]` is all
that excludes them. Someone will notice that and fix it.

**The moment they do, a real join in this estate — `M M67 1 → M M67`, header to lines — starts
returning every order total multiplied by its line count. A £2.4M quarter reports as £9.6M,
silently, in a system whose users have fifteen years of trained trust in these numbers.**

Correct order:

1. Land the `join_predicates` schema plus Discoverer's four join flags (`OneToOne`,
   `AllowDetailNoMaster`, `AllowMasterNoDetail`, `Mandatory`).
2. Add the fan-trap guard.
3. **Only then** read the `JP` predicates and re-enable multi-folder generation.

If step 2 slips, step 3 must still refuse — but replace the silent drop at
`sql-generator.ts:242-243` with an explicit *"multi-folder queries are disabled pending
fan-trap handling"*. Refusing loudly is this codebase's established instinct, and it is the
right one here.

---

## 9. Recommended overall direction

**Do not replan from the existing plans. Replan from this evidence.**

The instinct this audit should provoke is *not* a redesign. The architecture is mostly
right and the hardest technical problem in the project — decoding Oracle's undocumented
workbook format — is largely solved and independently proven. The failure is one of
**integration and verification**, not of design.

Recommended sequence:

1. **Phase 0 — Make it true (days).** Fix the business-area scoping, unhide the maps,
   repair `/api/maps`, add the production config guard, correct Oracle pagination, point
   CI at `master`. Add one end-to-end test: migrate → generate SQL → execute → assert
   rows. This is the highest-leverage work in the entire project.
2. **Phase 1 — Make it reachable.** Build the real Maps list; wire Run; remove every
   placeholder from the dashboard.
3. **Phase 2 — Make it faithful.** Build the token-formula decoder as a first-class
   backend component; recover `dataType` / `placement` / `hidden` / `isACalc` in the
   parser; migrate hierarchies; populate `axis_edge` and crosstab detection.
4. **Phase 3 — Make it safe.** Full security remediation and dependency hygiene.
5. **Phase 4 — Make it operable.** Prove `docker-compose.prod.yml` end to end; add Oracle
   pool and queue metrics; schedule real backups.

**Above all: stop trusting the readiness scorer, the coverage artefact, and the session
plans.** Every one of them currently reports success over a system that does not run. The
first deliverable of the next phase should be a verification harness that could not
possibly have reported green on today's state.

---

## 10. Confidence and limits

**Verified first-hand:** all migration counts, the execution failure, the formula
encoding, the config defaults, the UI placeholders, the API responses, the test results,
the EUL contents, and the `d4wkdmp` fidelity numbers.

### Corrections made during the audit

**Six** first-pass findings were overturned by later evidence. They are recorded because a plan
built on the original readings would have funded work that is already done.

| Original claim | Verdict | What is actually true |
| --- | --- | --- |
| **F-18 (HIGH):** calculation `dataType`/`placement`/`hidden`/`isACalc` at **0 % extraction**; "the parser cannot tell a calculation from an item" | **REFUTED** | All four **are** extracted (`parser:3020,3030,3031,3032`) and **agree** when the current differ is run. The 0 % figures came from `_report-after-fix.json`, which is **two code generations stale**. Calculation-vs-item is decided by element *class* (`0x00dc` vs `0x00db`), never by `isACalc`. |
| **F-19:** 1 137 worksheet items missing (3.4 % column loss) | **REFUTED** | Not misses. `itemsOnlyInDump` compares the query's full item set against *displayed columns only*; those 1 137 are the sheet's **hidden query items**, which the parser now recovers as `hiddenItems`. 1 110 of 1 137 are plain items a calculation needs. |
| **F-20:** condition case-sensitivity never extracted | **REFUTED** | Read at `parser:2884`. Listed as closed in the differ's own history. The real gap is that `map_conditions` has no column for it. |
| **F-09 (HIGH):** pagination emits Oracle 12c+ syntax against an Oracle 8 source | **REFUTED** | The server is **Oracle 12.2.0.1.0**; `OFFSET/FETCH` (12.1+) is valid. The "Oracle 8" note describes the *EUL vintage* — a 2011 EUL inside a modern database — not the release it runs on. |
| **F-05:** four migration `run_id`s contradict the "a second migration is refused" guard | **REFUTED** | The guard is real (`migration-runner.ts:314-322`). Two runs completed, one failed and rolled back, one is a seeded test artefact; the database was reset between them. |
| **Crosstab support "lost"** | **REFUTED** | Detection keys on Oracle's own class discriminator (`0x0384` table / `0x0385` crosstab) and is verified working on Oracle's own sample workbook. `crosstabs: 0` is a **true property of this estate**. `axis_edge` NULL is *correct* — Discoverer records no row-vs-column edge at all. The frontend also *has* a `CrosstabTable.tsx`; my grep missed it because the file is untracked. |
| **F-15:** `/documentation` 404s despite `swagger.ts` existing | **REFUTED** | I probed the wrong path. `swagger.ts:51` sets `routePrefix: '/api/docs'`; live, `/api/docs` and `/api/docs/json` both return **200**, and `README.md:72` documents it correctly. |
| **Lockfile drift** | **REFUTED** | `npm ci --dry-run` → *"up to date in 820ms"*. Consistent. |

**The common cause of five of these six: I scored the migration against stale artefacts and
empty target columns rather than against the parser and the source container.** An empty column
has at least four causes — absent in source, parser gap, transformer drop, stale build — with
wildly different costs. That distinction is now made explicitly throughout
[AUDIT_LEGACY_COMPATIBILITY_MATRIX.md](AUDIT_LEGACY_COMPATIBILITY_MATRIX.md).

A third worry was tested and cleared: fixing the business-area scoping was feared to yield
**silently wrong numbers** through cartesian products. It does not —
`from-clause.ts:104-111` throws `No join path connects folder "<name>"…` and the builder has
no comma-join or `CROSS JOIN` branch at all. Wrong answers are not reachable here. The cost
is instead visible and loud: 271 maps trade one error for another (BE-01).

**Still inferred, not proven:** whether the estate genuinely contains no crosstabs or
detection is broken; whether re-migrating on current code yields 923 layouts rather than 24.

**Not yet audited to depth:** documentation claim-by-claim reconciliation; the legacy matrix
against Oracle's shipped SQL in `discoverer10g/sql/`; the migration pipeline's EUL4
object-link resolution (the shared root cause of the lost hierarchies and grants). Specialist
auditors for these are queued — open items are listed in
[AUDIT_DETAILED_FINDINGS.md](AUDIT_DETAILED_FINDINGS.md) §7.

**No production claim in any existing document survived contact with the running system.**
