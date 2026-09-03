# PHASE 3.2 — The join model

**Model:** Opus · **Effort:** max

## Purpose

Model joins the way Discoverer does, so the fan-trap guard has correct inputs.

> **Every migrated join is discarded at query time.** All 10 have NULL `left_item_id` and
> `right_item_id`, and `sql-generator.ts:242-249` drops any join missing them. So `def.joins`
> is **always empty** and all 341 multi-folder maps fail.
>
> **The cause is a modelling error, not missing data:** EUL4 `KEY_CONS` binds **folders** with
> a column predicate, while Neo models a join as a single **item pair**, which the source
> cannot populate.

## Scope

1. `joins` becomes **folder-to-folder**.
2. New `join_predicates` table — 1..n column pairs per join, **each with an `operator`**
   (`=`, `<`, `>`, `<=`, `>=`, `<>`). Discoverer supports all six.
3. Store **four booleans**: `one_to_one`, `allow_master_no_detail`, `allow_detail_no_master`,
   `mandatory`.
4. **Derive `join_type`; stop storing it.**
5. Read `EUL4_EXPRESSIONS.EXP_TYPE='JP'` in the reader — 10 predicate rows exist for the 10
   joins, and `DEFAULT_ITEM_EXP_TYPES = [CO, CI]` is all that excludes them today.
6. A join with **no** predicate becomes an **explicit refusal naming the join** (D-039).

## Constraints — read every one

- **Orientation is settled by Phase 0.3's Q1** (D-040). Two artefacts in this repository
  disagreed: `eul-schema-adapter.ts:129-130` maps `KEY_OBJ_ID → masterFolderId`; the evidence
  says `KEY_OBJ_ID` is the **DETAIL** folder. **Use the probe's answer. An inversion produces
  correct-looking wrong numbers, not an error.**
- **`KEY_TYPE` is a *probed* column that defaults to `INNER` when absent**
  (`eul-schema-adapter.ts:134-135`). "All 10 live joins are INNER" is a **default, not a
  reading.** Do not treat the existing values as evidence.
- **`mandatory` has no join-type effect.** It is a referential-integrity assertion that unlocks
  join trimming and summary eligibility. Store it; keep it out of the derivation.
- **`OneToOne` defaults to `False` (= one-to-many)** and its **only** effect is fan-trap
  detection. Unknown or absent ⇒ treat as fanning.
- **`(allow_master_no_detail, allow_detail_no_master) = (True, True)` maps to a REFUSAL, not
  `FULL`** (D-038). No vendor text describes it, and it is inexpressible in the Oracle 8 `(+)`
  syntax 4.1 targeted — even though the enum already has `FULL`.

Derivation table:

| `allow_master_no_detail` | `allow_detail_no_master` | Emitted |
| --- | --- | --- |
| false | false | `INNER JOIN` |
| **true** | false | `LEFT JOIN` from master (detail side `(+)`) |
| false | **true** | `RIGHT JOIN` from master — *"rare in real business scenarios"* |
| true | true | **REFUSE** |

## Prerequisites

Phase 3.1. **Phase 0.3 — this stage cannot start without Q1 and Q2 answered.**

## Required files to read first

- `docs/master-plan/research/legacy-analysis.md` §2 (all of it) — **the authoritative brief**
- `docs/master-plan/research/architecture-analysis.md` **H6, H7** and the Nits
- `docs/master-plan/DECISION_REGISTER.md` D-032, D-038, D-039, D-040
- `docs/master-plan/research/eul-probe-results.md` — **Q1, Q2 and the `JP` shape**
- `migrate/src/services/eul-schema-adapter.ts:120-145`
- `backend/src/db/schema.ts` — the `joins` table and `join_type` enum (~:511)
- `backend/src/lib/sql/from-clause.ts`
- `backend/src/services/sql-generator.ts:235-255`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode`, `typescript-lsp`, and `code-review` **or** `coderabbit` on
the diff.

## Implementation instructions

- Schema first (`core`'s `db/schema.ts` per D-011, re-exported by backend), then a Drizzle
  migration, then the reader, then `from-clause`.
- The multi-column question — one `JP` row with a compound formula, or *n* rows — is answered by
  Phase 0.3. **Model whichever it is; do not assume single-column.**
- Keep the old `joins` columns until the reader writes the new ones, then drop them in a second
  migration. Do not lose the existing 10 rows.
- `from-clause` still emits **only** what the Phase 3.3 planner tells it to. This stage supplies
  data and derivation, not the rewrite.

## Tests

- A unit test per row of the derivation table, including **the `(true,true)` refusal**
- A reader test asserting `JP` predicates are read and bound to the right folders
- **An orientation regression test** using the folder names observed in Phase 0.3
- A test asserting a predicate-less join refuses, naming the join
- A multi-column predicate test, if the source has one

## Security checks

- Join predicates become part of generated SQL. **Column names must go through the existing
  identifier validation and be rejected, not escaped, if they contain quotes.**
- The operator must come from a **closed set**, never interpolated from source data.

## Validation

```bash
cd discoverer-neo && npm run typecheck --workspaces && npm test --workspace migrate && npm test --workspace backend
```

```sql
SELECT j.id, j.master_folder_id, j.detail_folder_id, j.one_to_one,
       j.allow_master_no_detail, j.allow_detail_no_master, j.mandatory,
       count(p.id) AS predicates
FROM joins j LEFT JOIN join_predicates p ON p.join_id = j.id
GROUP BY 1,2,3,4,5,6,7;
```

Expect **10 rows, each with ≥ 1 predicate and non-null folder endpoints.**

## Acceptance criteria

- [ ] All 10 estate joins carry non-null folder endpoints and at least one predicate
- [ ] Every derivation-table row has a passing unit test, including the `(true,true)` refusal
- [ ] **The orientation regression test exists and matches Phase 0.3's finding**
- [ ] `join_type` is derived, not stored
- [ ] `mandatory` is stored and excluded from the derivation
- [ ] A predicate-less join refuses, naming the join
- [ ] Operators come from a closed set and identifiers are validated

## Documentation updates

- `migrate/EUL_SCHEMA_GROUND_TRUTH.md` — the `KEY_CONS` columns and the `JP` predicate shape
- `docs/developer-guide/architecture.md` — the join model
- `docs/admin-guide/metadata-management.md` — what the four flags mean

## Git checkpoint

Schema + migration; reader; from-clause derivation; tests. Push after each.

## Handover artefacts

- The 10-row query output above, in the checkpoint
- Confirmation of the orientation, with the folder names that prove it

## Explicitly out of scope

- **The fan-trap guard.** Phase 3.3.
- **Enabling multi-folder generation.** Phase 3.4. Phase 1.1's interim refusal **stays in
  place** through this stage.
- Forced joins as first-class data — they live in `map_layouts.source_attrs` for now.

## Resume instructions

Read the checkpoint, run the 10-row query. If every join has endpoints and predicates and the
orientation test passes, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Schema → migration → reader → derivation → tests. Commit each.
2. **No specialist agents.**
3. Use `context-mode` for SQL output.
4. Checkpoint after each commit, recording the 10-row state.
5. Commit coherently. **Never leave a migration applied but uncommitted.**
6. Leave typecheck and both suites green.
7. If interrupted, record which of the six scope items are complete and whether the migration
   has been applied to the dev database.

---

## ⟐ CORRECTIONS from the plan review

### 1. The joins table is ALREADY folder-to-folder — do not rewrite it (A-05)

D-032 says to *"replace the item-pair `joins` model with folder-to-folder `joins`"* and MIG-01
says *"all 10 migrated joins have NULL endpoints."* The schema says otherwise:

```
backend/src/db/schema.ts — joins
  leftFolderId : uuid('left_folder_id').notNull().references(folders.id)
  rightFolderId: uuid('right_folder_id').notNull().references(folders.id)
  leftItemId   : uuid('left_item_id').references(items.id)      -- nullable
  rightItemId  : uuid('right_item_id').references(items.id)     -- nullable
  joinType     : joinTypeEnum('join_type').notNull()
```

Both folder columns are **`NOT NULL`**. The null endpoints are the **item** columns — the
predicate — and `sql-generator.ts:242-243` drops a join on those even though its folder endpoints
are present and usable. `EUL_SCHEMA_GROUND_TRUTH.md:172` agrees: *"joins bind **folder to
folder**, not item to item."*

**So: leave `left_folder_id` and `right_folder_id` alone.** The work is `join_predicates`, the
four booleans, and deriving `join_type`. D-039's refusal is a change at `sql-generator.ts:242`,
not a modelling change.

**One migration detail:** `join_type` is `NOT NULL` today, so dropping it means dropping the
constraint before the column.

### 2. Write characterisation tests BEFORE the rewrite (R-15 / D-02)

**`backend/src/lib/sql/` has no dedicated test files at all.** `from-clause.ts`,
`where-clause.ts`, `select-clause.ts`, `context.ts`, `totals.ts` are exercised only indirectly,
through `sql-generator.test.ts`'s one hand-built `mkDef()` fixture (`:285-295`). Section 8's
*"unit tests are genuinely good already"* is **false for exactly the modules Phase 3.3 is about
to replace.**

Pin the current behaviour first, so 3.3's rewrite can be proven not to have changed anything it
did not intend to:

- [ ] The single-folder short-circuit (`from-clause.ts:73-76`)
- [ ] The BFS spanning tree over `def.joins` (`:104-126`)
- [ ] The disconnection refusal (`:105-107`)
- [ ] The null-item-endpoint join drop (`sql-generator.ts:242-243`)

**This is the cheapest insurance in the plan and v1.0 does not fund it anywhere.**

### 3. Reconcile the three counts and record them (B-04 / R-10)

**Resolved by Phase 0.4** (`docs/master-plan/research/baseline-counts.md`) — the counts used to
disagree across the plan; they no longer do:

1. **341** maps span more than one folder (confirms this prompt; the 272 once quoted elsewhere
   was wrong).
2. **70** of those 341 have a folder set **connected by the 10 known joins**.
3. **271** of those 341 are not connected by any of the 10 joins and hit the disconnection
   refusal — exactly the research's "271 of 341".
4. **24** worksheets declare join usage in the container (tag `0x0127`, [DUMP] 24/0) — smaller
   than 70 because most of the 70 get connected implicitly by the BFS spanning tree, without
   the source query ever forcing the join.

**Adding predicates to 10 joins cannot connect the other 271** — their folders were never
joined in Discoverer either. Phase 3.4's expected histogram is **70 connected / 271
refused**, not `total − single-folder`.

### 4. Orientation

Use Phase 0.3 Q1's **cardinality measurement**, not the folder-name reading. If measurement and
naming disagreed, 0.3 recorded it as a finding — read that before assuming.
