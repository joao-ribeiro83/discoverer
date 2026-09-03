# Discoverer Neo — Legacy Compatibility Matrix

**Audit date:** 2026-09-01 · Source estate: **EUL4 / Discoverer 4.1.11.0.0**, owner
`SIID_TESTES`, Oracle at `10.236.141.201:1530` SID `COSEC`, 61 `EUL4_*` tables.

## Method and trust order

Neo-side claims were checked against the **live PostgreSQL schema and data**, not against
planning documents. Legacy-side claims come from, in trust order: Oracle's shipped SQL in
`discoverer10g/sql/`; `discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md`; the
user-authored *Discoverer 4.1 EUL Metadata Reference Guide* files; and the live EUL table
inventory. `oracle_discoverer_complete_reference.md` §8 and `EUL_VERSION_REFERENCE.md`
were **not** used — both carry retraction headers and contain fabricated names.

## Legend

- **Support:** `none` · `partial` · `full` — what Neo can represent *and populate today*.
- **Fidelity:** `lost` · `approximated` · `faithful`.
- **Class:** `MUST` (business semantics that must be preserved) · `SHOULD` ·
  `DROP` (deliberately not preserved).
- **Priority:** P0 blocks any usable migration · P1 blocks parity · P2 valuable · P3 optional.

> **Read this column pair carefully:** several rows are `Support: partial / Fidelity:
> lost` because the **schema models the concept correctly but no data was written**. Those
> are cheap to fix and are marked *(schema ready)*. They are a different class of problem
> from rows where the model itself is missing.

---

## A. Metadata layer

| Discoverer concept | Support | Fidelity | Evidence | Gap | Class | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| **Business Areas** | full | faithful | `EUL4_BAS` → `business_areas`; 6 → 6 (+1 synthetic) | Synthetic `Migrated Workbooks` BA must go (F-01) | MUST | P0 |
| **Folders — simple** | full | faithful | `EUL4_OBJS` → `folders`; 213 → 212; `folderTypeBreakdown: {TABLE: 213}` | 1 source orphan | MUST | — |
| **Folders — complex / custom SQL** | partial | untested | `folder_type` enum has `TABLE\|VIEW\|DERIVED\|COMPLEX\|JOIN\|SUMMARY`; `folders.custom_sql` exists | This estate has only `TABLE` folders, so complex/custom paths are **entirely unexercised** | MUST | P1 |
| **Folder ↔ Business Area** | partial | **approximated** | `folders.business_area_id NOT NULL` (212/212) **and** `folder_business_areas` join table (**0 rows**) | Two contradictory models shipped; Discoverer's is many-to-many | MUST | P0 |
| **Items** | full | faithful | `EUL4_EXPRESSIONS` → `items`; 9 797 → 9 626 (171 skipped, folder orphans) | Reconcile the 171 | MUST | P1 |
| **Item types** | full | faithful | `item_type` enum `CO\|CI\|CU\|JI\|HI\|AG\|FU` — mirrors EUL expression types | — | MUST | — |
| **Item Classes / LOVs** | **none** | **lost** | Source has `EUL4_DOMAINS` (20 cols); no Neo table, no route | Parameter pick-lists and item validation impossible | MUST | P1 |
| **Joins** | full | faithful | `EUL4_KEY_CONS` → `joins`; **10 → 10 exact** | Only 10 joins for 212 folders — verify against `EUL4_OBJ_JOIN_USGS` | MUST | P1 |
| **Join direction / optionality** | partial | approximated | `join_type` enum `INNER\|LEFT\|RIGHT\|FULL` | Discoverer's one-to-many/optional/detail semantics and fan-trap handling are not modelled | MUST | P1 |
| **Registered PL/SQL functions** | full | faithful | `EUL4_FUNCTIONS`+`EUL4_FUN_ARGUMENTS` → `custom_functions`; **593 → 593 exact** | Registered, but **not callable**: `formula-parser.ts` allowlists only built-ins | MUST | P1 |
| **Summary / aggregate folders** | **none** | **lost** | Source has `EUL4_SUMMARY_OBJS` (38), `EUL4_SUMO_EXP_USGS` (15), `EUL4_SUM_BITMAPS` (12), `EUL4_SUM_RFSH_SETS` (22); `folder_type` has a `SUMMARY` value but nothing populates it | No summary redirection — queries hit base tables, losing Discoverer's main performance mechanism | SHOULD | P2 |
| **Hierarchies (date & item)** | **none** | **lost** | `EUL4_HIERARCHIES`/`HI_NODES`/`HI_SEGMENTS`/`DBH_NODES`; **508 → 0**; 508 `WARN … no business area` per run | Tables exist and are empty; binding is via `EUL4_BA_OBJ_LINKS` in EUL4 (F-10) | MUST | P1 |
| **Drill paths** | **none** | **lost** | Depends on hierarchies | No drill up/down at all | MUST | P1 |

---

## B. Query semantics

| Discoverer concept | Support | Fidelity | Evidence | Gap | Class | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| **Calculations (worksheet)** | partial | **lost in practice** | 49 819 rows in `map_calculated_fields`, stored as raw token form `[1,102](…)`; no backend parser accepts it (F-02) | Formulas migrate but cannot execute — the single largest semantic loss | MUST | P0 |
| **Calculation metadata** | **full in parser, partial in target** | **faithful — CORRECTED** | `dataType` `parser:3020`, `placement` `:3030`, `hidden` `:3031`, `isACalc` `:3032`; all four compared by the differ (`:340-343`) and **agree** when run on current code. The 0 % figures came from a **stale report** (WB-01) | Only `dataType` fails to reach PostgreSQL, and that is a one-field transformer drop (WB-05). `placement` and `hidden` *are* migrated (`transform.ts:1030-1031`) | MUST | P2 |
| **Conditions (worksheet filters)** | partial | faithful *within the model* | 5 605 rows; formula agreement **3 297/3 298** vs Oracle's decoder | See nesting/`NOT` below | MUST | P1 |
| **Condition nesting & `NOT`** | **none** | **lost — refused, not distorted** | `logic_operator` enum is `AND\|OR` only; flat `group_id`; `workbook-parser.test.ts:325,331` refuse `NOT` nodes explicitly | Correct engineering (safer to refuse than invert a filter) but a hard ceiling | MUST | P1 |
| **Conditions on calculated fields** | **none** | **lost** | `map_conditions.item_id NOT NULL` FK → `items` | Cannot filter on a calculation | MUST | P1 |
| **Correlated-subquery conditions** | **none** | **lost** | Source has `EUL4_SUB_QUERIES` (15), `EUL4_SQ_CRRLTNS` (10) | Not representable at all | SHOULD | P2 |
| **Condition case-sensitivity** | partial | **extracted, not stored** | Parser reads it at `parser:2884` (`TAG.CONDITION_CASE_SENSITIVE = 0x0102`); the differ's `FIELDS_NOT_YET_PRODUCED` lists it as closed by W2. The 0-agree figure was from the **stale report** (F-20 withdrawn) | `map_conditions` has no case-sensitivity column — a schema/transformer gap, not a parser gap | MUST | P1 |
| **Percentages** | **none** | **ABSENT IN SOURCE** | `parser:1759-1765`: *"`DCBIMPB.DLL` … defines thirteen `DCBImported*` classes and none of them is a percentage; Discoverer's percentage lives in the *query* layer (`DCBPercentageRequest` in `DCB.DLL`)"* — the `.DIS` body does not serialise it | Not recoverable from the workbook container. Would need the EUL query layer | SHOULD | P2 |
| **Graphs** | **none** | **ABSENT IN SOURCE** | `CLASS.GRAPH = 0x0272` (`parser:254`) — *"empty on every workbook of the live corpus"*; `transform.ts:1577-1579` — *"empty on all 917 corpus worksheets that have one"* | Nothing to migrate; `graph: null` is correct | SHOULD | P3 |
| **Drill definitions** | **none** | **lost** | The **only** remaining entry in `FIELDS_NOT_YET_PRODUCED` (`differ:1017-1024`): `Parameter: ['Drill Segment Id']` | The single genuinely unproduced field in the entire dump | MUST | P1 |
| **Security Manager conditions** | **none** | **lost** | `EUL4_ASM_POLICIES`/`ASMP_CONS`/`ASMP_LOGS` exist; `migration_log`: *"8 Security Manager condition(s) were NOT migrated"*; yet `analyze` reports `securityConditions: 0` (F-27) | Reader not wired for EUL4 | MUST | P1 |
| **Parameters** | full | faithful | 7 521 rows over 898 maps; prompt agreement **3 767/3 784** | — | MUST | — |
| **Cascading / LOV-backed parameters** | **none** | **lost** | `map_parameters` has no LOV source; depends on `EUL4_DOMAINS` | Free-text entry only | SHOULD | P2 |
| **`SELECT DISTINCT`** | full | **faithful — exact** | `maps.select_distinct`; source **372 → target 372** | — | MUST | — |
| **Per-item default aggregation** | partial | untested | `map_items.agg_function varchar(64)` | Populated? unverified; no enum constraint | MUST | P1 |
| **Fan-trap / aggregation correctness** | **none** | **lost** | No detection anywhere in `lib/sql/` | Discoverer actively guards against double-counting across one-to-many joins; Neo does not | MUST | P1 |
| **Query Prediction / governor** | **none** | n/a | Source has `EUL4_QPP_STATS` (47 cols) | No pre-execution cost estimate or row cap | SHOULD | P2 |
| **NULL handling / "show nulls as"** | **none** | **lost** | No column on `map_items` | Display-level; low risk | SHOULD | P3 |

---

## C. Worksheet presentation

| Discoverer concept | Support | Fidelity | Evidence | Gap | Class | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| **Workbook → many worksheets** | **none** | **lost** | 564 workbooks → 923 standalone `maps`; no `workbooks` table. Only link is a name prefix (`GD_M.M27_V08 — …`) | Users think, share and schedule in workbooks | MUST | P1 |
| **Worksheet identity / ordering** | partial | *(schema ready)* | `map_layouts.worksheet_index`, `.worksheet_guid` exist; only 24 rows and both NULL in them (F-04) | Current code writes all 923; live data is stale | MUST | P1 |
| **Table layout** | full | faithful | `map_type = TABLE` on all 923 | — | MUST | — |
| **Crosstab layout** | **full** | **faithful — SETTLED** | Detection keys on Oracle's own class discriminator: `parser:2516-2523`, `CLASS.VIEW_TABLE = 0x0384` vs `VIEW_CROSSTAB = 0x0385`; `transform.ts:1250`; `assessment.ts:269`. **Positive control:** run live on `DISCVR4/VIDSTR4.DIS`, the parser returns `["TABLE","CROSSTAB"]` — Oracle's own sample sheet 2 is correctly identified | **None.** `crosstabs: 0` is a *true property of this estate*, not a detection failure. `layoutUndecoded: 0` proves all 923 resolved to one of the two known classes | MUST | — |
| **Crosstab row-vs-column edge** | n/a | **ABSENT IN SOURCE** | `backend/src/db/schema.ts:125-130`: *"Discoverer records no [edge]; the migration leaves this null and Neo sets it when a user builds a crosstab"* | **Not a loss.** `axis_edge` NULL on all 25 960 rows is *correct* — the edge is not in the `.DIS` format at all | — | — |
| **Page-detail axis** | partial | *(schema ready)* | `map_type PAGE_DETAIL`; `axis_type PAGE` on 26 map_items | Barely exercised | MUST | P2 |
| **Measures vs axis items** | full | faithful | `axis_type`: `AXIS` 20 014, `MEASURE` 5 920, `PAGE` 26 | — | MUST | — |
| **Hidden items** | full | faithful | `map_items.is_hidden`: 1 154 hidden / 24 806 visible | — | MUST | — |
| **Sorting** | full | faithful | 740 source → **737** target worksheets with a sorted item | — | MUST | — |
| **Sort by rank** | partial | *(schema ready)* | `map_items.sort_rank integer` exists | Population unverified | SHOULD | P2 |
| **Group / break sort** | partial | *(schema ready)* | `map_items.sort_group boolean NOT NULL` exists | Population unverified | MUST | P2 |
| **Totals — grand & sub** | full | faithful | 686 source → **684** target worksheets; 19 632 rows; `map_total_placement GRAND_TOTAL\|AT_CHANGE`; `break_map_item_id` FK | — | MUST | — |
| **Percentages** | partial | *(schema ready)* | `map_total_kind TOTAL\|PERCENTAGE` | % of total vs % of subtotal distinction unverified | MUST | P2 |
| **Running totals** | **none** | **lost** | No `map_total_kind` value for it | — | SHOULD | P2 |
| **Number / date format masks** | full | faithful | `map_items.format_mask`, `.heading_format_mask`; `map_calculated_fields.format_mask` | — | MUST | — |
| **Column widths, alignment, wrap** | partial | *(schema ready)* | `map_items.column_width`, `.alignment`, `.word_wrap` | Population unverified | SHOULD | P2 |
| **Conditional formats / exceptions** | partial | **lost in data** *(schema ready)* | `map_conditional_formats` table + `map_format_target CELL\|ROW` exist; **0 rows** | Exception highlighting is a headline Discoverer feature | MUST | P1 |
| **Fonts & colours** | **none** | **lost** | No columns | Cosmetic | SHOULD | P3 |
| **Page setup / headers / footers** | full | faithful | `map_page_setup` **923/923**; `map_orientation PORTRAIT\|LANDSCAPE` | — | SHOULD | — |
| **Worksheet title (RTF/HTML)** | full | faithful | `map_layouts.title`, `.title_rtf`, `.title_html` | Title **tokens are not substituted** — live UI shows `&Date (&Time) &Dt Início &Dt Fim` literally | SHOULD | P2 |
| **Graphs / charts** | partial | untested | `map_type CHART`; `map_layouts.graph jsonb` | jsonb blob hides semantics; unexercised | SHOULD | P3 |
| **Forced joins per worksheet** | partial | approximated | `map_layouts.source_attrs`; `withForcedJoins: 24` | Stored as a jsonb sidecar — *"no `map_joins` table exists … nowhere better for them to live"* | SHOULD | P2 |

---

## D. Security, sharing and operations

| Discoverer concept | Support | Fidelity | Evidence | Gap | Class | Pri |
| --- | --- | --- | --- | --- | --- | --- |
| **EUL users** | full | faithful | `EUL4_EUL_USERS` → `users`; 17 → 17 (+admin, +service) | Non-bcrypt `!migrat` sentinel blocks login by design — correct | MUST | — |
| **Privileges / grants** | partial | **lost** | `EUL4_ACCESS_PRIVS`; source **138 → 60** (F-11) | 78 lost, same EUL4 object-link gap as hierarchies | MUST | P1 |
| **Workbook sharing** | **none** | **lost** | `map_shares` table exists; **0 rows** | Combined with F-07, no user can see any migrated worksheet | MUST | P0 |
| **Row-level security** | partial | **untested** | `security_policies`/`_rules`/`_assignments` all **0 rows**; `policy_type` has only `ROW_LEVEL`; `lib/sql/security-predicates.ts` exists | Source `EUL4_ASM_POLICIES` never read. Whether the predicate injection fails **open or closed** with no policy is **unverified and important** | MUST | P1 |
| **Scheduled workbooks** | partial | **lost** | Source: `EUL4_BATCH_REPORTS`(19), `_SHEETS`(10), `_QUERIES`(13), `_PARAMS`(15), `EUL4_BR_RUNS`(14), plus 9 materialised `EUL4_B*Q*R1` result tables. Target: `schedules`, `schedule_parameters`, `scheduled_results` all **0 rows** | Full scheduler exists in code (816-line service, 727-line page) but nothing migrated. Dashboard falsely says *"Scheduling has not been built yet."* | MUST | P1 |
| **Scheduled result sets** | **none** | **lost** | The nine `EUL4_B<ts>Q<n>R1` tables hold historical results | Retained report history is not carried over | SHOULD | P2 |
| **Export formats** | partial | modernised | `export_format XLSX\|CSV`; `export_jobs` **0 rows** | Discoverer also had PDF/HTML/text. XLSX+CSV is a reasonable modern subset | SHOULD | P2 |
| **Audit trail** | full | **exceeds legacy** | `audit_log` 15 995 rows, indexed on user/entity/created_at | No retention policy | SHOULD | P2 |
| **Query execution log** | partial | *(schema ready)* | `query_execution_log` exists; **0 rows** — nothing has ever run | Source `hasQueryLog: true`, 7 316 executions of usage history not carried over | SHOULD | P2 |

---

## E. Deliberately NOT preserved — with justification

Each of these is a conscious recommendation to break with the legacy, not an oversight.

| Legacy behaviour | Why drop it |
| --- | --- |
| **Desktop/Plus client-server session model** | Discoverer held stateful sessions with client-side result caching. A stateless HTTP API with per-request auth is strictly better for security, scaling and operability. No business semantics live here. |
| **EUL-embedded user accounts and passwords** | `EUL4_EUL_USERS` stores Discoverer's own credentials. Neo correctly re-provisions accounts with bcrypt and a forced password change, blocking migrated hashes with the `!migrat` sentinel. Carrying legacy credential material forward would be a liability. |
| **`EUL4_PLAN_TABLE`** | A local copy of Oracle's `PLAN_TABLE`. Neo's `explainSql()` uses `DBMS_XPLAN` directly. Correct modernisation. |
| **`EUL4_SEQUENCES` / `EUL4_GATEWAYS` / `EUL4_FREQ_UNITS`** | EUL-internal bookkeeping with no business meaning. |
| **Materialised `EUL4_B<timestamp>Q<n>R1` result tables** | Discoverer's mechanism for persisting batch output. A modern job store (`scheduled_results` + object storage) is the right replacement — *but the historical rows they contain should be assessed for retention value before the source is decommissioned.* |
| **PDF/HTML/text export** | XLSX and CSV cover the real use. Add PDF only on demand. |
| **Discoverer's fixed 5-level date hierarchy defaults** | The estate has 508 hierarchies, most named `… Default Date Hierarchy<n>` — auto-generated boilerplate. Reproduce *user-defined* hierarchies faithfully; regenerate date hierarchies natively rather than importing hundreds of near-duplicates. **This is the one row where losing 508 objects may be partly acceptable — but it must be a decision, not the current accident.** |

---

## F. Scorecard

Counting the 47 substantive concepts in §A–D:

| Verdict | Count | Share |
| --- | --- | --- |
| `full` + `faithful` | 16 | 34 % |
| `partial` — **schema ready, data missing** | 13 | 28 % |
| `partial` — model genuinely incomplete | 7 | 15 % |
| `none` / `lost` | 11 | 23 % |

*(Counts above are the first-pass scoring. The workbook-fidelity audit subsequently
overturned six rows — see the correction table below, which supersedes them.)*

**Two headlines.**

**First, an "ABSENT IN SOURCE" band exists and matters more than its size.** Crosstab
row-vs-column edge, percentages, graphs and the auto-generated date-hierarchy defaults are
**not** things Discoverer Neo lost — the `.DIS` container does not carry them. Scoring them as
gaps, as the first pass did, would have funded work with nothing to recover.

**Second, the "schema ready" band is still the cheapest fidelity available** — conditional
formats, worksheet identity, sort rank and group, column widths, case-sensitivity storage.
Those need a transformer fix, not a redesign.

### Rows corrected by the workbook-fidelity audit

| Concept | Was scored | Now | Why |
| --- | --- | --- | --- |
| Crosstab layout | partial / lost in data | **full / faithful** | Detection keys on Oracle's own class discriminator and is verified working; `crosstabs: 0` is true of this estate |
| Crosstab axis edge | must-implement gap | **absent in source** | Discoverer records no edge (`schema.ts:125-130`) |
| Calculation metadata | none / lost | **faithful in parser** | The 0 % figures came from a stale report (WB-01) |
| Condition case-sensitivity | none / lost | **extracted, not stored** | Parser reads it; the gap is the target column |
| Percentages | partial *(schema ready)* | **absent in source** | Not serialised in the `.DIS` body |
| Graphs | partial / untested | **absent in source** | Empty on all 917 corpus worksheets that have one |

**The lesson generalises: score this matrix against the parser and the container, not against
the migrated data.** An empty target column has at least four distinct causes — absent in
source, parser gap, transformer drop, and stale build — and they carry completely different
remediation costs. The first pass of this matrix conflated them.

## G. Priority summary

**P0 — nothing works without these**

1. Business-area scoping (F-01) — unblocks every row in §B and §C.
2. Token formula decoding (F-02) — 83 % of worksheets carry a calculated field.
3. Workbook sharing / map visibility (F-07) — otherwise no user sees anything.

**P1 — required for parity**

Hierarchies and drill · item classes/LOVs · conditional formats · crosstab population ·
condition `NOT`/nesting/case-sensitivity · calculation metadata · Security Manager
conditions · grants · scheduled workbooks · registered functions callable in formulas ·
fan-trap correctness · workbook aggregate.

**P2 — valuable**

Summary folders · correlated subqueries · running totals · percentages detail · sort rank
and group · column formatting · query-usage history · title-token substitution · forced
joins as first-class data.

**P3 — optional**

Fonts and colours · show-nulls-as · graphs.
