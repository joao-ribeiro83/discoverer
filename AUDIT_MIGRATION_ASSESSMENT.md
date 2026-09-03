# Discoverer Neo — Migration Assessment

**Audit date:** 2026-09-01 · Companion to
[AUDIT_LEGACY_COMPATIBILITY_MATRIX.md](AUDIT_LEGACY_COMPATIBILITY_MATRIX.md)

---

## 1. The source, established live

| Property | Value | How established |
| --- | --- | --- |
| EUL version | **EUL4** (prefix `EUL4_`) | `POST /api/migration/detect` → 200 |
| Discoverer version | **4.1.x**, schema `4.1.11.0.0` | same |
| Oracle host | `10.236.141.201:1530`, SID `COSEC` | `data_sources` + TCP connect |
| Schema owner | `SIID_TESTES` | detect + introspection |
| EUL tables | **61** | detect |
| Non-EUL tables in owner | 212 | `/api/data-sources/{id}/tables` (273 total) |
| Oracle server version | **NOT DETERMINED** | nothing in the codebase queries it |
| Connection mode | **thick, mandatory** | pre-11g password verifier; thin fails `NJS-116` |
| Connectivity | **works**, 910 ms | `POST /api/data-sources/{id}/test` → `{"success":true}` |
| Supported by the tool | `supported: true` | detect |

The estate is a real production Portuguese credit-insurance reporting system: 564
workbooks, 923 worksheets, workbook names like `GD_M.M27_V15.DIS — M27 - Detalhe de
Pagamentos`, with usage history back to 2014 and 7 316 recorded executions.

> **Open item, highest value:** `SELECT banner FROM v$version`. It settles F-09, the
> Oracle 12c+ `OFFSET/FETCH` pagination question, which is a second independent execution
> blocker.

---

## 2. Supported migration path

```
Oracle EUL4 (thick mode)
   → eul-reader.ts            read EUL tables
   → eul-schema-adapter.ts    EUL4 vs EUL5 normalisation
   → workbook-parser.ts       decode DOC_DOCUMENT (.DIS container) per worksheet
   → transformers/            EUL shapes → Neo row shapes
   → migration-runner.ts      orchestrate, count, log, transact
   → migration-writer.ts      write PostgreSQL
```

Two entry points over one implementation — `dn-migrate` CLI (`analyze`, `export`,
`validate`, `run`) and the API (`/api/migration/detect|analyze|run|reimport-maps|jobs`).
That is a good arrangement.

**Verified working:** `detect` (instant), `analyze` (45.8 s over the full EUL, real
output), `run` (20–21 s), and `test`-connection. `export`, `validate --target`, dry-run and
`reimport-maps` were **not** exercised in this audit.

---

## 3. What the migration actually achieved

Measured live, source (`/api/migration/analyze`) against target (`COUNT(*)`).

### Faithful

| Concept | Source | Target | |
| --- | --- | --- | --- |
| Business areas | 6 | 6 (+1 synthetic) | OK |
| Folders | 213 | 212 | 1 source orphan |
| Joins | 10 | **10** | exact |
| Custom functions | 593 | **593** | exact |
| Users | 17 | 17 (+2) | OK |
| Worksheets | 923 | **923** | exact |
| `SELECT DISTINCT` | 372 | **372** | exact |
| Page setup | 923 | **923** | exact |
| Worksheets with totals | 686 | 684 | 99.7 % |
| Worksheets with sorts | 740 | 737 | 99.6 % |
| Items | 9 797 | 9 626 | 171 skipped — **exactly** the per-run `WARN items` count |

The 171 match is worth noting: the migration's own accounting is internally consistent.

### Lost

| Concept | Source | Target | Cause |
| --- | --- | --- | --- |
| **Hierarchies** | 508 | **0** | 100 % flagged "no business area" — EUL4 binds via `EUL4_BA_OBJ_LINKS`, not a column (F-10) |
| **Grants** | 138 | **60** | same object-link resolution gap (F-11) |
| **Worksheet layouts** | 923 decoded | **24** | **Stale build — CONFIRMED.** `transform.ts:1570-1573` names the old behaviour as a fixed bug: *"This used to be written only when the worksheet forced a join, so a map's worksheet index, GUID and printed title were lost on every worksheet that did not."* Current writers push unconditionally (`migration-runner.ts:1129`, `map-reimport.ts:516`). **`POST /api/migration/reimport-maps` would produce 923.** Expect `count(*)=923, worksheet_index=923, source_attrs=24` |
| **Conditional formats** | ? | **0** | never read |
| **Security Manager conditions** | ≥8 | **0** | EUL4 reader not wired (F-27) |
| **Scheduled workbooks** | `EUL4_BATCH_*` populated | **0** | never read |
| **Item classes / LOVs** | `EUL4_DOMAINS` | **0** | no target table |
| **Summary folders** | `EUL4_SUMMARY_OBJS` | **0** | no target model |

### Migrated but unusable

| Concept | Rows | Why |
| --- | --- | --- |
| Every map | 923 | Synthetic business area with zero folders (F-01) |
| Calculated fields | 49 819 | Raw Discoverer token form, no backend decoder (F-02) |
| Map items | 25 960 | 100 % cross-business-area |
| Conditions | 5 605 | Reachable only through a map that cannot execute |
| Parameters | 7 521 | same |
| Totals | 19 632 | same, and not even returned by `GET /api/maps/{id}` (F-32) |

**Bottom line: metadata fidelity is high; system usability is zero.**

---

## 4. Idempotency, re-runs and rollback

### The guard is real — an earlier reading of this was wrong

`migration-runner.ts:314-322` refuses a real run against an already-migrated target
*before reading the EUL*, with the message *"…so it is refused. Migrate into a fresh
database, or clear the …"*. Covered by `migration-runner.test.ts:1108`.

Four `run_id`s exist, which initially looked like a bypass. Reconciled:

| run_id | Duration | Outcome |
| --- | --- | --- |
| `a5757a5c-0000-4000-8000-000000000001` | — | Hand-formed id, 4 of each phase, 4 `ERROR failed` — a seeded/test artefact |
| `6a92675c` | 20 s | **Failed and rolled back** (`ERROR folders`, `ERROR validate`, `ERROR failed`) |
| `730b3bc4` | 21 s | Completed (`INFO done`) |
| `d815efa8` | 21 s | Completed |

`backup-before-reset.sql` exists precisely because the database was reset between runs.
**No contradiction. The guard works.**

### Rollback works, and the log survives it

`ERROR | failed | "Migration rolled back: Failed query: insert into \"users\" …"` proves a
failing run rolls back its data writes while the `migration_log` entry persists — the
right design. The rolled-back run left no partial rows.

### Re-run safety

- **Into a fresh database:** safe and proven (three clean runs).
- **Into a migrated database:** correctly refused.
- **Incremental / delta re-import:** **not supported.** There is no "migrate what changed"
  path. The only partial route is `POST /api/migration/reimport-maps`, which re-imports
  maps only.

This is a real gap for a production cutover, where the source keeps changing while the
target is validated.

---

## 5. Validation and verification — the weakest link

### The readiness scorer is structurally blind (F-12)

Live output on a migration where **nothing runs**:

```json
{"score": 75, "rating": "ready-with-warnings", "blockers": []}
```

`scoreReadiness()` starts at 100 and subtracts `errorCount*20`, `min(30, warnings*5)`,
`min(20, orphans*2)`, and 5 for an unknown schema version. `blockers` is populated **only**
by an unsupported EUL version or error-level warnings. Losing 100 % of hierarchies costs
the same capped −20 as losing a single object.

**It never inspects the output it produced.** That is the defect — not the arithmetic.

### Supporting inaccuracies in the same report

- `estimate`: *2 229.8 minutes ("~4.6 working days")*. Real runs: **20–21 seconds**.
  Off by ~6 000× (F-28).
- `workbookUsage`: `workbookCount: 564` alongside `workbooksWithUsage: 1442` — internally
  impossible (F-29).
- `worksheetFidelity.layoutDecoded: 923 / layoutUndecoded: 0` — true of the *reader*,
  while only 24 layouts reached the database. The report measures decode capability and
  presents it as migration outcome.
- `conditions: 0`, `securityConditions: 0` — contradicted by the migration's own
  `WARN | security | "8 Security Manager condition(s) were NOT migrated"` (F-27).

**Every quantitative claim this tool makes about migration outcomes should be treated as
unverified until it is re-derived from the target database.**

### Independent verification

`validate --target` exists and was not exercised. Whether it would have caught F-01 is
**unknown and worth establishing** — it is the natural home for the output assertions
recommended below.

The one genuinely excellent verification asset is the **`d4wkdmp` differ harness**
(`migrate/src/scripts/`): 547 reference dumps from Oracle's own decoder, a parser, a
differ and an aggregate report. It found real defects (F-18, F-19, F-20) and measured the
improvement between two runs. It is explicitly **dev-only and not in CI** — that should
change.

---

## 6. Unsupported data — classification

| Feature | Source evidence | Classification | Notes |
| --- | --- | --- | --- |
| Hierarchies & drill | `EUL4_HIERARCHIES` etc., 508 | **MUST IMPLEMENT** | Reader defect, not a modelling gap |
| Calculated-field execution | 49 819 token formulas | **MUST IMPLEMENT** | Largest engineering task remaining |
| Calculation metadata | Oracle dump proves presence | **MUST IMPLEMENT** | Differ already provides the acceptance test |
| Conditional formats | `map_conditional_formats` empty | **MUST IMPLEMENT** | Schema ready |
| Crosstab axis population | `axis_edge` NULL ×25 960 | **MUST IMPLEMENT** | Schema ready |
| Condition case-sensitivity | 3 299 onlyInDump | **MUST IMPLEMENT** | Silently changes results |
| Security Manager conditions | `EUL4_ASM_POLICIES` | **MUST IMPLEMENT** | Security-relevant |
| Grants (78 missing) | 138 → 60 | **MUST IMPLEMENT** | Same fix as hierarchies |
| Item classes / LOVs | `EUL4_DOMAINS` | **SHOULD IMPLEMENT** | Needs a new table |
| Scheduled workbooks | `EUL4_BATCH_*` | **SHOULD IMPLEMENT** | Target scheduler already exists |
| Workbook → worksheet grouping | 564 → 923 | **SHOULD IMPLEMENT** | Needs a `workbooks` table |
| Summary / aggregate folders | `EUL4_SUMMARY_OBJS` | **SHOULD IMPLEMENT** | Big performance win |
| Correlated-subquery conditions | `EUL4_SUB_QUERIES` | **OPTIONAL** | Needs the condition-tree redesign first |
| Condition `NOT` / nesting | parser refuses | **SHOULD IMPLEMENT** | Currently refused safely — acceptable interim |
| Running totals | — | **OPTIONAL** | |
| Historical scheduled results | 9 `EUL4_B*Q*R1` tables | **REQUIRES MANUAL INTERVENTION** | Decide retention before decommissioning the source |
| Query-usage history | 7 316 executions | **OPTIONAL** | Useful for prioritising which worksheets to validate |
| Fonts / colours | no columns | **OPTIONAL** | |
| Legacy password hashes | `EUL4_EUL_USERS` | **IMPOSSIBLE — and correctly so** | Re-provision with bcrypt; `!migrat` sentinel blocks login |
| `EUL4_PLAN_TABLE`, `_SEQUENCES`, `_GATEWAYS` | EUL bookkeeping | **IMPOSSIBLE / N-A** | No business meaning |
| Auto-generated date hierarchies | most of the 508 | **DECIDE DELIBERATELY** | Regenerate natively rather than import hundreds of near-duplicates |

---

## 7. Risks for a production cutover

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| 1 | Readiness scorer green-lights an unusable migration | **CRITICAL** | Add output assertions as blockers |
| 2 | Nothing executes post-migration (F-01) | **CRITICAL** | Fix scoping; add an end-to-end test |
| 3 | 83 % of worksheets carry an uncompilable formula (F-02) | **CRITICAL** | Build the token decoder |
| 4 | Oracle dialect mismatch (F-09) | **HIGH** | Query the server version; add a dialect layer |
| 5 | No incremental re-import; source drifts during validation | **HIGH** | Build a delta path, or freeze the source |
| 6 | Silent semantic change via case-sensitivity (F-20) | **HIGH** | Add the column; re-migrate |
| 7 | The live target was written by an older build than the source tree | **HIGH** | Commit the tree; re-migrate from a known commit |
| 8 | No output-vs-output comparison against real Discoverer | **HIGH** | See §8 |
| 9 | Users cannot see migrated maps at all (F-07) | **HIGH** | Ownership/visibility model |
| 10 | Migration provisions plaintext credential files, left undeleted (INF-07) | **MEDIUM** | TTL + boot sweep |

---

## 8. Recommended validation strategy

The current success criterion is *"rows were imported."* It must become *"the new system
reproduces the old system's output."*

**Tier 1 — structural (automate now, cheap).**
Row counts source vs target for every concept, with an explicit expected-loss allowance.
Referential closure: every `map_item` resolves to an item, folder and data source. **Every
map's items resolve within its query scope** — this alone catches F-01.

**Tier 2 — generative (the missing gate).**
For every one of the 923 maps: `loadMapDefinition()` + `generateSql()`. Report
success rate, and the formula compile rate across all 49 819 calculated fields. Anything
below 100 % is a blocker, not a note.

**Tier 3 — executional.**
Execute a stratified sample against the live Oracle. Assert non-error, row count and
column count. Use the source's own `EUL4_QPP_STATS` usage history (7 316 executions) to
pick the worksheets that actually matter.

**Tier 4 — output equivalence (the real bar).**
For a chosen set, run the same worksheet in legacy Discoverer and in Neo and diff the
result sets. This is the only test that proves the migration. The `d4wkdmp` harness shows
the team already knows how to build this class of tool — apply the same pattern to
*results*, not just metadata.

**Promote the `d4wkdmp` differ into CI** with a checked-in fixture corpus. It is the best
verification asset in the repository and it currently runs only by hand.

---

## 9. Rollback strategy

**Today:** transactional rollback within a run works. Beyond that there is no strategy —
the "backup" in the tree is a UTF-16 PowerShell artefact PostgreSQL cannot read (INF-06),
while the genuinely good `scripts/backup.sh` exists and has evidently never been used for
this purpose.

**Required before cutover:**

1. `pg_dump` custom-format snapshot before every run, via `scripts/backup.sh`.
2. Migration into a fresh database, promoted by connection-string switch — never in place.
3. Keep the legacy Discoverer estate read-only-live through a parallel-run period.
4. Record the source EUL's `EUL4_VERSIONS` state and the migrating commit SHA in
   `migration_log` for reproducibility.
5. Delete the UTF-16 dumps so nobody mistakes them for restore points.

---

## 10. Required tooling

**Exists and works:** `detect`, `analyze`, `run`, `reimport-maps`, transactional rollback,
`migration_log`, the `d4wkdmp` differ harness, `backup.sh` / `restore.sh`.

**Must be built:**

1. **Output verification stage** feeding `scoreReadiness()` as blockers (Tier 1+2 above).
2. **Token formula decoder** — the P0 engineering task. **Its stated blocker is gone.**
   `transform.ts:1019-1024` says the token form is kept raw because *"Oracle's function-code
   table is not available"* — that comment is stale. `workbook-parser.ts:914` exports
   `EUL_FUNCTION_NAMES`, a complete 222-entry table recovered from `DCESQRES.DLL` and verified
   row-for-row against the live `EUL4_FUNCTIONS`. Revised scope:

   | Already in hand | Still to build |
   | --- | --- |
   | A lexer/parser for the same grammar (`parseConditionTree`, `parser:1086` — the calculation and condition token languages are one language) | Fixity and arity for the ~199 non-boolean codes (names only today; roughly half are infix) |
   | All 222 built-in names; arity + kind for the 23 boolean codes (`CONDITION_OPERATOR_TABLE`) | Oracle operator precedence, for correct parenthesisation — not in `EUL_FUNCTIONS` |
   | `[6,n]` / `[8,n]` resolution (`humanizeFormula`) | `[2,n]` PL/SQL function resolution (customer ids start at 112 777) |
   | `calculation.itemRefs` in first-use order | Calculation-references-calculation expansion (WB-04) |
   | **A ready-made test oracle:** render all ~42 k corpus formulas and diff against `d4wkdmp -f`'s own `IoFormula` | `[5,4]` date-literal on-wire encoding |

   Only `EUL4_FUNCTIONS` needs reading, and only for the fixity/arity columns and customer
   functions — the built-ins are already snapshotted.
   `backend/src/scripts/dump-eul-functions.ts` is the tool for it.
3. **EUL4 object-link resolver** — one fix recovers hierarchies *and* grants.
4. **Incremental re-import** for a realistic cutover.
5. **Result-set differ** (Tier 4) — Neo vs legacy Discoverer output.
6. **Oracle version detection** and a dialect capability table.
7. **CI wiring** for the differ corpus.

---

## 11. Verdict

**The migration reads Discoverer better than it writes Discoverer Neo.**

The EUL reader and workbook parser are strong, measured, and in the parser's case
independently validated against Oracle's own decoder. The transformer and writer are where
fidelity is lost — and, crucially, **most of that loss is population, not modelling**: the
schema already models crosstab edges, conditional formats, worksheet identity, sort rank
and percentages, and simply has no rows.

That makes this a far more recoverable position than the raw numbers suggest. But it
cannot be claimed until the readiness scorer stops reporting green over a system where
nothing runs. **Fix the verification before fixing the features** — otherwise the next
migration will report success just as confidently as this one did.
