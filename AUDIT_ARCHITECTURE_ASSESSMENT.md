# Discoverer Neo — Architecture Assessment

**Audit date:** 2026-09-01 · Companion to [AUDIT_DETAILED_FINDINGS.md](AUDIT_DETAILED_FINDINGS.md)

---

## 1. Current architecture, as built

```
                       ┌──────────────────────────────────────┐
   Browser ── nginx ──►│ frontend  (React 19 + Vite + TS)      │
                       │  react-query · zustand · shadcn/ui    │
                       │  dnd-kit · TanStack Table + Virtual   │
                       └──────────────────┬───────────────────┘
                                          │ REST + Bearer JWT
                       ┌──────────────────▼───────────────────┐
                       │ backend  (Fastify 5 + TypeScript)     │
                       │  routes/ → services/ → lib/sql/       │
                       │  plugins: auth, audit, cors, helmet,  │
                       │           metrics, redis, swagger     │
                       └───┬───────────────┬──────────────┬────┘
                           │               │              │
              ┌────────────▼───┐  ┌────────▼──────┐  ┌────▼──────────────┐
              │ PostgreSQL 16  │  │ Redis 7       │  │ Oracle (thick)    │
              │ Drizzle ORM    │  │ BullMQ queues │  │ per-source pools  │
              │ 32 tables      │  │ + cache       │  │ USER DATA + EUL   │
              └────────────────┘  └───────────────┘  └───────────────────┘
                           ▲
                           │ writes
              ┌────────────┴────────────────────────────┐
              │ migrate  (@discoverer-neo/migrate)       │
              │  eul-reader → eul-schema-adapter →       │
              │  transformers → migration-runner →       │
              │  migration-writer                        │
              │  + workbook-parser.ts (.DIS decoder)     │
              │  + d4wkdmp differ harness (dev-only)     │
              └──────────────────────────────────────────┘
```

**Three npm workspaces.** `backend` depends on `@discoverer-neo/migrate` as a library, so
the migration can run either from the `dn-migrate` CLI or through
`POST /api/migration/run`. That is a sound arrangement — one implementation, two
entry points.

**Request path for a worksheet execution:**

```
POST /api/maps/:id/execute
  → authenticate (JWT) → authorize(role) → business-area-auth (entity scope)
  → map-execution.service
      → sql-generator.loadMapDefinition(mapId)          ← F-01 dies here
      → generateSql(def)  [select → where → order → totals → from → group → paginate]
      → oracle pool.execute(sql, binds)
      → calculated-field-evaluator (row-level, ad-hoc fields only)
      → response
```

---

## 2. Architectural strengths

### 2.1 Metadata-driven SQL generation with a hard safety contract

`sql-generator.ts` states and keeps three invariants:

- identifiers come only from metadata, validated and quoted (`lib/sql/identifiers.ts`);
- **every** runtime value is a bind variable, without exception;
- formulas are parsed to an AST against an allowlist and re-emitted from that AST —
  never string-spliced.

This is the correct design for a product whose entire purpose is executing
user-authored queries against a customer database. It is also *well factored*: the clause
builders are separate, pure, and unit-testable without a database.

The build ordering is deliberate and correct, and the comments explain why:

```
SELECT first  (assigns folder aliases in display order, detects aggregates
               including those hidden inside formulas)
ORDER BY / totals next (a sort on a hidden item reaches folders nothing else aliased)
FROM last     (so it sees every folder the query touches)
```

### 2.2 The workbook parser is the project's real asset

`migrate/src/services/workbook-parser.ts` decodes an undocumented Oracle binary container
and is **validated against Oracle's own `d4wkdmp.exe`** over 544 real workbooks with zero
harness failures. Item identity, folder binding, function references, parameter prompts
and condition formulas agree at 99.5–100 %.

Just as important is *how* it handles what it cannot do: it **refuses** rather than
approximates. `NOT` nodes, functions on the left of a comparison, expressions on the
right, ambiguous `IN` values with embedded commas — all refused with a stated reason
rather than silently distorted. For a migration tool, that is the right instinct, and it
should be preserved as a design rule.

### 2.3 The PostgreSQL schema is more faithful than the estate suggests

See F-24. `map_axis_edge ROW|COLUMN`, `map_type CROSSTAB|PAGE_DETAIL`,
`map_total_kind PERCENTAGE`, `map_total_placement AT_CHANGE`, `map_format_target
CELL|ROW`, plus `map_items.sort_rank`, `.sort_group`, `.column_width`, `.alignment`,
`.word_wrap`, `.heading_format_mask`, `.source_element_id`, `.source_attrs`.

The schema also keeps **provenance**: `source_element_id` and `source_attrs` on
`map_items` and `map_layouts` retain the original Discoverer identifiers. That is an
excellent decision for a migration product — it makes re-import, diffing and forensic
work possible later. It should be extended, not removed.

### 2.4 Correct hard choices already made

- **Thick-mode Oracle** is not an optimisation here; the pre-11g password verifier means
  thin mode cannot authenticate at all. Recognised, documented, and enforced with a
  fail-fast boot check.
- **Per-data-source connection pools**, sized by concurrent executions rather than user
  count, with the export-worker interaction called out in `.env.example`.
- **Drizzle with explicit SQL migrations** (`backend/drizzle/0000…0009`) rather than
  auto-sync — the right call for a system holding customer metadata.
- **BullMQ** for exports and schedules, with the option to run workers in-process or
  separately behind a flag.

---

## 3. Architectural weaknesses

### 3.1 The single-business-area worksheet model (CRITICAL)

`maps.business_area_id NOT NULL` is the root architectural error. In Discoverer, business
areas group *folders* for presentation; a workbook references items through
`EUL4_ELEM_XREFS` with no BA constraint. Neo made the BA an ownership boundary for
worksheets, so the migration had no correct value to write and invented
`Migrated Workbooks`. Every migrated map then failed, because `loadMapDefinition()` scopes
folders by that same column.

**Correction — an earlier draft of this assessment called `folders.business_area_id` and
`folder_business_areas` "two contradictory models of the same relationship". That was wrong.**
They model different things, and both are intended:

| Table | Meaning | State | Written by |
| --- | --- | --- | --- |
| `folders.business_area_id NOT NULL` | the **owning** business area | 212/212 | the migrator |
| `folder_business_areas` | additional BAs a folder is **shared into** | 0 rows | `folder.service.ts` only |

`migration-runner.ts` never writes `folder_business_areas` (`grep -B4 -A10 folderBusinessAreas`
over that file returns nothing). It is read and written exclusively by user-facing sharing —
`shareWithBusinessArea` (`folder.service.ts:320-324`), `unshareWithBusinessArea` (`:332-339`),
`listSharedBusinessAreas` (`:344-347`), and the list query at `:275-289` that unions owned and
shared rows and tags each `isShared`. **It is empty because nobody has shared anything yet, not
because it is vestigial.** Drop neither.

**But there is a real gap next to it.** Discoverer's `BA_OBJ_LINKS` is genuinely M:N — one
folder can be linked into several business areas — and the migrator writes only
`folders.business_area_id`. A folder that lived in three BAs now lives in one. That is a
**transformer drop**, and the fix needs no schema change: write the first `BA_OBJ_LINKS` row to
`business_area_id` and the remainder to `folder_business_areas`. The table Neo built for its own
sharing feature is exactly the right shape for Discoverer's multi-BA folders.

### 3.2 Three formula representations, none canonical

| Representation | Where | Understands token form? |
| --- | --- | --- |
| SQL-compiled AST | `backend/src/lib/sql/formula-parser.ts` | **No** |
| Row-level evaluator AST | `backend/src/services/calculated-field-evaluator.ts` | **No** |
| Discoverer token form | `migrate/` (documented, partially decoded) | Partially |

The split between the first two is *defensible* — one pushes work to Oracle, one computes
over result rows referencing output columns, and the evaluator's docstring argues the case
well (no aggregates, no `SYSDATE`, because a row cannot see other rows or be
non-deterministic). But **the representation the migration actually produces is understood
by neither**, and the knowledge to decode it lives in a third workspace that the query
path does not import.

This is the clearest example of the project's central pattern: **the components are right;
the seams are missing.**

### 3.3 Coupling and boundary issues

- `backend` imports `@discoverer-neo/migrate` for the migration API. Reasonable — but the
  reverse knowledge (how to render a token formula as SQL) is exactly what needs to flow
  the other way and does not.
- **Two Drizzle schema definitions** exist: `backend/src/db/schema.ts` and
  `migrate/src/db/schema.ts`. Whether they have drifted was not verified in this audit —
  it is an open item, and duplication of a 32-table schema across workspaces is a standing
  drift hazard regardless.
- `map_layouts` carries `graph jsonb` and `source_attrs jsonb`. `source_attrs` as a
  provenance sidecar is fine; `graph` as the sole home for chart definitions hides
  semantics from queries and constraints. The header comment concedes as much —
  forced joins live there because *"no `map_joins` table exists … the one column W3 added
  with nowhere better for them to live."*
- `map_conditions.item_id NOT NULL` FK → `items` means **a condition can never reference a
  calculated field**, and there is no nesting depth or `NOT`.

### 3.4 No dialect awareness

Nothing detects the Oracle server version (F-09). `pagination.ts` hard-codes 12c+
`OFFSET/FETCH` against a documented Oracle 8-era source. A product whose value proposition
is *connecting to legacy Oracle estates* must treat dialect as a first-class concern.

### 3.5 Verification is structurally optimistic

Three separate mechanisms all reported success over a non-functional system:

- `scoreReadiness()` — 75/100, `blockers: []`, because it never inspects its own output.
- 1 654 tests — green, because no test spans migration → generation → execution.
- The coverage artefact and session plans — claiming >80 % and completion.

This is an architectural property, not an accident: **no component in the system is
responsible for asserting end-to-end truth.**

---

## 4. Candidate redesigns

### R1 — Scope queries by referenced items, not by the map's business area (P0)

```ts
// today, in loadMapDefinition():
where(eq(folders.businessAreaId, map.businessAreaId))

// proposed: derive the folder set from what the map actually references
const folderIds = distinct(mapItems.map(mi => itemById(mi.itemId).folderId))
                    ∪ folders reachable through the map's joins
```

Make `maps.business_area_id` nullable and advisory (UI grouping only). Authorisation moves
from "the map's BA" to "every BA the map's folders belong to" — which is *stricter* and
more correct, since a user must be entitled to all the data the worksheet touches.

**Cost:** small. **Unblocks:** F-01, and it is the only version of the fix that survives
the next migration.

### R2 — Make the token formula a first-class, canonical representation (P0)

1. Persist `EUL_FUNCTIONS` / `EUL_FUN_ARGUMENTS` during migration as a code → function
   table (the reader work is largely done; `dump-eul-functions.ts` proves the mapping).
2. Add `migrate/src/services/formula/token-parser.ts` emitting the **same AST shape** as
   `lib/sql/formula-parser.ts`.
3. Store both forms: token (lossless provenance) and canonical expression (executable).
4. Corpus-test all 49 819 formulas: compile or explicitly quarantine with a reason.

**Cost:** large — the single biggest genuine engineering task remaining.

### R3 — Write multi-BA folder links into the table that already exists (P1)

*(Revised — the two tables are not duplicates; see §3.3.)* Keep both. Change the migrator to
write the first `BA_OBJ_LINKS` row to `folders.business_area_id` and every additional link to
`folder_business_areas`. No schema change. Then union `folder_business_areas` into
`loadMapDefinition`'s folder load, which currently ignores it entirely (BE-12).

### R3b — Fix the join model, and guard fan traps *before* re-enabling it (P0)

The join predicate is recoverable — `EXPRESSIONS.EXP_TYPE='JP'` holds 10 rows for the 10 joins,
and `DEFAULT_ITEM_EXP_TYPES = [CO, CI]` is all that drops them. But the FROM builder emits only
a single-column equijoin, and **nothing in the codebase guards against fan traps.**

Sequence, and not otherwise:

1. Land the `join_predicates` table and the four Discoverer flags (`LEG-02`).
2. Add the fan-trap guard keyed on `is_one_to_one` and the master/detail roles.
3. *Only then* read the `JP` predicates and re-enable multi-folder generation.

Reversing 2 and 3 converts 341 loud failures into silently inflated aggregates. **The current
breakage is the safer state** — see LEG-04.

### R4 — Introduce an Oracle dialect layer (P1)

Detect the server version at pool creation; select pagination and function forms from a
small capability table; refuse unsupported versions loudly rather than emitting SQL that
cannot parse.

### R5 — Add an output-verification stage to the migration (P1)

Make "did the migration produce a usable system?" a first-class pipeline phase: sample N
migrated maps, run `loadMapDefinition` + `generateSql`, report the compile rate for
formulas and the resolve rate for items, and feed all of it into `scoreReadiness()` as
**blockers**, not notes.

### R6 — Model the workbook, not just the worksheet (P2)

Today each worksheet is a standalone `maps` row; a 564-workbook estate became 923
unrelated maps whose only link is a name prefix (`GD_M.M27_V08 — M27 - Detalhe de
Pagamentos`). Discoverer users think in workbooks, share workbooks, and schedule
workbooks. Add a `workbooks` table with an ordered worksheet relation. `map_layouts`
already carries `worksheet_index` and `worksheet_guid` for exactly this.

### R7 — Give conditions a real tree (P2)

Replace the flat `group_id` + `AND|OR` model with a proper expression tree supporting
`NOT`, arbitrary nesting, conditions on calculated fields, and (eventually) the correlated
subqueries the source holds in `EUL4_SUB_QUERIES` / `EUL4_SQ_CRRLTNS`. Until then the
parser's refuse-don't-distort behaviour must be preserved.

---

## 5. Rejected alternatives

**Rewrite the migration to target a document store.**
Rejected. The relational model is a good fit and the schema is already close to right.
The failures are population and integration, not storage shape.

**Abandon token formulas; require users to re-author calculations.**
Rejected. 49 819 calculated fields across 767 worksheets *are* the customer's business
logic. Asking them to re-enter it removes the product's entire reason to exist.

**Drop crosstab support and ship tables only.**
Rejected. The schema already models crosstabs (`map_axis_edge`, `map_type CROSSTAB`); the
gap is a parser/transformer one. Removing modelled capability to match unpopulated data
would be a real loss for no gain.

**Replace Fastify/Drizzle/React with something else.**
Rejected. No evidence supports a stack change. Every framework-level decision inspected
was defensible and the code is idiomatic.

**Redesign the schema around the audit's findings before fixing F-01.**
Rejected, and this is the important one. The system has never run end to end. Redesigning
against a model that has never executed a single query would be designing blind. **Make it
run first, then let real behaviour inform the redesign.**

**Fix F-01 with the data repair alone.**
Rejected as a solution, accepted as a stopgap. The UPDATE unblocks the audit trail and
lets tests be written today, but it does not survive the next migration and does not model
Discoverer. Ship both layers.

---

## 6. Recommended target architecture

Keep the shape. Change five things.

| # | Change | Priority |
| --- | --- | --- |
| 1 | Query scope derived from referenced items; `maps.business_area_id` advisory | P0 |
| 2 | Token formula decoder as a shared, canonical component with dual storage | P0 |
| 3 | One folder ↔ business-area model, many-to-many | P1 |
| 4 | Oracle dialect capability layer | P1 |
| 5 | Migration output verification feeding readiness blockers | P1 |
| 6 | `workbooks` aggregate above `maps` | P2 |
| 7 | Condition expression tree with `NOT` and nesting | P2 |

**The guiding principle for the replan:** this project's problem is not that the wrong
things were built. It is that the things built were never joined together and never
verified against reality. Prioritise seams and proof over new capability.
