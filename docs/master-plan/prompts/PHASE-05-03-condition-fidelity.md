# PHASE 5.3 — Condition fidelity

**Model:** Sonnet *(Opus for the parser change)* · **Effort:** high

## Purpose

Close the parser's `NOT` refusal and let conditions reference calculated fields — **without
building an expression tree the corpus does not need.**

## The measurement that scopes this stage

Over **all 3 395 source condition trees** — the full population; see
`docs/master-plan/research/baseline-counts.md` §1 for why this does not conflict with the
5 605 `map_conditions` rows in the target DB (a different, later-stage population: one row per
flattened leaf predicate, not per tree):

| Depth | Share |
| ----- | ----- |
| 0 | **92.6 %** |
| 1 | 7.3 % |
| 2 | **7 instances** |
| ≥ 3 | **zero** |

The existing flat `group_id` + `logic_operator` model covers depth ≤ 1 and, via groups, depth 2.

> **The real ceiling is `NOT`** — a per-node flag in Oracle's own object model
> (`DCBImportedFilterNode::IsNot`), which the parser currently refuses outright because
> *"migrating it as `IN` inverts the filter."*
>
> **The 80 % version is one boolean.**

## Scope

1. **Add `negated boolean` to `map_conditions`** and honour it in `where-clause.ts`. Close the
   parser's `NOT` refusal.
2. **Add the case-sensitivity column.** The parser already reads it
   (`workbook-parser.ts:2884`, `TAG.CONDITION_CASE_SENSITIVE = 0x0102`) and the differ lists it
   as closed. **The gap is the target column, not the parser** — F-20's *finding* was refuted,
   but this column is genuinely missing.
3. **Conditions on calculated fields.** `backend/src/db/schema.ts:774-776` has
   `map_conditions.item_id NOT NULL` with an FK to `items`. Make it nullable, add
   `calculated_field_id`, add a CHECK that **exactly one** is set.
4. Wire `securityConditions` reading (F-27/MIG-05) — **but see the correction below.**

## Two corrections you must carry

- **F-27's `EUL4_ASM_POLICIES` attribution is wrong.** That table is **Automated Summary
  Management**, not Security Manager conditions (D-077). Do **not** build a reader against it
  here. `conditions: 0` in the assessment is correct; `securityConditions: 0` means "never
  read", and what should be read is a different thing entirely — Phase 6.3 handles it.
- **The `parent_id` expression tree is explicitly NOT in scope.** It waits until
  `EUL4_SUB_QUERIES` / `EUL4_SQ_CRRLTNS` have a reader — **subquery nodes are the tree's real
  justification, not nesting depth**, and those tables' contents are currently UNKNOWN.

## Prerequisites

Phase 5.1. Phase 1.2 (the `group_id` write path is fixed, so conditions import with their
grouping intact).

## Required files to read first

- `docs/master-plan/research/legacy-analysis.md` §7 (all of it) — **the authoritative brief**,
  including the measured depth distribution
- `docs/master-plan/research/architecture-analysis.md` **M1, M1b, M4**
- `docs/master-plan/DECISION_REGISTER.md` D-072, D-077
- `backend/src/lib/sql/where-clause.ts:194-219`
- `backend/src/db/schema.ts:770-790`
- `migrate/src/services/workbook-parser.ts:2880-2900` — case sensitivity
- `migrate/src/services/workbook-parser.ts` — the `NOT` refusal sites (grep `IsNot`)

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `typescript-lsp`, `context-mode`.

## Implementation instructions

- **`negated` is per-node.** Applying it at the group level would change semantics.
- Case sensitivity affects comparison semantics — an insensitive comparison must emit the
  matching Oracle form (`UPPER(col) = UPPER(:bind)` or equivalent) **on both sides**, and must
  be reflected in the migrated data, not just the schema. **This silently changes results if
  got wrong.**
- The CHECK constraint on `item_id` / `calculated_field_id` must be a real database constraint,
  not application-level only.
- A condition on a calculated field must resolve through the Phase 4 renderer, and inherits its
  quarantine behaviour: **an uncompilable calculation means an unusable condition, refused, not
  ignored.**

## Tests

- A `NOT` condition migrates and emits correct SQL — **and no longer refuses**
- A case-insensitive condition emits the insensitive comparison; a sensitive one does not
- A condition on a calculated field resolves and emits
- The CHECK rejects a row with both or neither reference
- A condition on a **quarantined** calculation refuses loudly
- Existing depth-0, depth-1 and the 7 depth-2 conditions still emit unchanged

## Security checks

- Conditions are user-authored input reaching SQL. **Confirm the existing invariant holds: an
  `OR` in a user condition cannot escape a security predicate** — bracketing must remain
  unconditional. Add a test with a negated condition, since `NOT` is new.
- A condition on a calculated field is a new path into the renderer — confirm identifier
  validation and bind discipline are unchanged.

## Validation

```bash
cd discoverer-neo && npm run typecheck --workspaces && npm test --workspace backend && npm test --workspace migrate
```

## Acceptance criteria

- [ ] `NOT` is representable and **no longer refused by the parser**
- [ ] Case sensitivity is stored and honoured, on both sides of the comparison
- [ ] Conditions can reference calculated fields, with a real CHECK constraint
- [ ] A condition on a quarantined calculation refuses loudly
- [ ] **The security-predicate bracketing invariant still holds, tested with a negated
      condition**
- [ ] Existing conditions emit unchanged
- [ ] **No `parent_id` tree was built**

## Documentation updates

- `docs/decisions/eul-fidelity-decisions.md` — why one boolean rather than a tree, with the
  measured distribution
- `docs/admin-guide/metadata-management.md` — conditions

## Git checkpoint

`negated`; case sensitivity; calculated-field references. Push after each.

## Handover artefacts

- The count of conditions carrying `negated = true` after re-import
- Confirmation that the depth distribution is unchanged

## Explicitly out of scope

- **The `parent_id` expression tree.**
- Correlated subqueries (`EUL4_SUB_QUERIES`, `EUL4_SQ_CRRLTNS`) — no reader exists and their
  contents are UNKNOWN.
- Security Manager conditions and RLS. **Phase 6.3**, and note D-077's correction.

## Resume instructions

Read the checkpoint. If `NOT` migrates without refusal and the CHECK exists, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. `negated` → case sensitivity → calculated-field references. Commit each.
2. **No specialist agents.**
3. Checkpoint after each commit.
4. Commit coherently.
5. Leave typecheck and both suites green.
6. **Resist scope creep into the expression tree.** It is deliberately deferred and the
   measurement supports that.
7. If interrupted, record which of the three changes are complete.

---

## ⟐ CORRECTIONS from the plan review

### 1. Split into two single-model stages (R-19 / G-04 / D-007)

This prompt's header reads **`Model: Sonnet (Opus for the parser change)`** — an instruction to
switch model mid-session, which **D-007 explicitly forbids** because it discards the prompt cache
and re-bills the whole context at write price. A session following this prompt does the forbidden
thing; a session following D-007 cannot follow this prompt.

- **5.3a — the parser change** · `Model: Opus · Effort: high`. Close the parser's `NOT` refusal.
- **5.3b — the schema fidelity work** · `Model: Sonnet · Effort: medium`. `negated boolean`, the
  case-sensitivity column the parser already reads, nullable `item_id` +
  `calculated_field_id` + CHECK.

**No stage may name two models (D-119).**

### 2. D-072's central claim rests on a population — resolved by Phase 0.4 (F-05)

**Resolved.** `docs/master-plan/research/baseline-counts.md` §1 measured both populations: the
distribution was taken over 3 395 source **condition trees** (the full source population, not a
subset), while 5 605 is the target `map_conditions` **row count after flattening** each tree's
leaves into individual rows — a different, later-stage population, not 2 210 excluded
conditions. D-072's claim covers the entire measured corpus, as stated; nothing was excluded.

**Also newly measured and worth carrying into this stage:** every one of the 5 605
`map_conditions` rows in the current target DB has `group_id IS NULL` — the write-path fix
D-072 marks `FIXED` has not taken effect in this database (either not re-run, or not doing what
the register claims). Depth-1 and depth-2 grouping cannot currently survive import. Confirm
before assuming "existing depth-1/depth-2 conditions still emit unchanged" (Tests, above) means
anything beyond depth-0 in this database today.

### 3. Note for Phase 5's planning

`EUL_SCHEMA_GROUND_TRUTH.md:272-276` records that **worksheet conditions are not `EXPRESSIONS`
rows at all** — `EXP_TYPE` holds only `CO`, `CI` and `JP`. Conditions live in the workbook body.
So there is **no EUL-side source to reconcile against** here, only the parser. Do not go looking
for one.
