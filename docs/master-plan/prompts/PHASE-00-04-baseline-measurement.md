# PHASE 0.4 — Baseline measurement

**Model:** Sonnet · **Effort:** medium

> ## ⚠ WHY THIS STAGE EXISTS
>
> **Every estate count in the master plan is unverified, and three of them contradict
> themselves.** Phase gates assert against those numbers. A gate built on a disputed number is
> not a gate.
>
> | Object | One source says | Another says |
> | ------ | --------------- | ------------ |
> | Multi-folder maps | **272** (`PHASE-01-01:9,151`, and `651 + 272 = 923` is arithmetic on it) | **341** (`PHASE-03-02:11`); the research says *"271 of 341"* (`legacy-analysis.md` §1.11 step 1) |
> | Conditions | **5 605** (`PHASE-01-02`, `PHASE-05-02`) | **3 395** (`PHASE-05-03`, the population D-072's central claim was measured over) |
> | Non-admin users | **18** (`PHASE-06-02`) | **17** migrated users (`PHASE-09-03`, the **cutover runbook**) |
>
> If 341 is right, single-folder is **582**, not 651 — and a session executing Phase 1.1
> measures 582/341, compares it against a criterion demanding ~651/~272, and **cannot tell
> whether it passed.** Both readings are defensible from the plan, which is the worst possible
> state for a gate.
>
> The user-count discrepancy is smaller and lands in a **go-live runbook**, where an off-by-one
> means one person cannot log in on cutover day.

## Purpose

Measure the estate once, record it in one place, and make every later gate reference the record
instead of a literal.

## Scope

Read-only queries against the **target PostgreSQL** (the migrated estate), plus the workbook
corpus where the container is the only source. **No writes. No migration run.**

### Counts to record

**Maps and folders**

- total maps
- maps referencing exactly one folder (single-folder)
- maps referencing more than one folder (multi-folder)
- **maps whose folder set is connected by the 10 known joins** — this is the population Phase 3.2
  can actually help
- **maps declaring join usage in the container** — tag `0x0127`, which
  `EUL_SCHEMA_GROUND_TRUTH.md:1019` grades **[DUMP] 24 / 0**. Twenty-four, against ~272–341
  multi-folder maps
- maps with no sort at all (BE-06's pagination tiebreaker population)

> **These three map numbers rarely agree, and the gap is the finding.** ~272–341 maps span more
> than one folder while only **24** declare a join. The rest are multi-folder *by item spread*,
> with no declared join path — which is exactly the population that hits the disconnection
> refusal (271, per §1.11 step 1; the arithmetic lines up closely). **Adding predicates to 10
> joins cannot connect a map whose folders were never joined in Discoverer either.**

**Conditions**

- total `map_conditions`
- **the population any depth distribution was measured over**, and the difference from the total
- conditions with `group_id IS NULL`
- conditions at depth 0 / 1 / 2 / ≥3

**Users and grants**

- total users; admins; non-admins; migrated users needing re-provisioning at cutover (D-094)
- grants migrated vs grants in source

**Formulas, hierarchies, layouts**

- `map_calculated_fields` total
- hierarchies migrated vs in source
- `map_layouts` count vs `maps` count (5.4's gate)
- `map_items` with non-null `agg_function` (**this is 3.1's before-picture and 3.3's inertness
  check — record it now, at zero**)

## Prerequisites

Phase 0.1a. The target PostgreSQL must be reachable. The workbook corpus in `d4dumps/` must be
readable for the container-derived counts.

## Required files to read first

- `docs/master-plan/research/legacy-analysis.md` §1.11 step 1 — the *"271 of 341"* statement
- `discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7.8.3 — the container tag confidences
- `discoverer-neo/backend/src/db/schema.ts` — table and column names
- The three prompts that disagree: `PHASE-01-01`, `PHASE-03-02`, `PHASE-05-03`

## Required tooling

**Skills:** none. **Agents:** none — single-context work.
**Plugins / MCPs:** `context-mode` — **essential**. Result sets here are large.

## Implementation instructions

- **Never read a result set into context.** Write the queries, run them in the sandbox, and
  surface **only the counts**. This is the rule for every data-heavy stage in the plan.
- Record **how each number was derived** — the query, not just the answer. A future session must
  be able to re-run it and get the same figure. A count with no query behind it becomes the next
  contradiction.
- Where the container is the source (join usage, axis/measure vectors), use the existing parser
  rather than writing new tooling.
- **Do not resolve a contradiction by choosing.** Measure it. If the measured multi-folder count
  matches neither 272 nor 341, that is the answer and both prompts were wrong.

## Tests

None. This stage produces a record, not code.

## Security checks

- **Read-only.** No writes to the target database.
- The counts themselves are not sensitive; **the queries must not export row content** into the
  recorded artefact — counts only.

## Validation

Every count in the artefact has a query beside it, and re-running the artefact's queries
reproduces the artefact.

## Acceptance criteria

- [ ] `docs/master-plan/research/baseline-counts.md` exists, with a query beside every number
- [ ] The three known contradictions are **resolved by measurement** and the resolution recorded:
      multi-folder maps, conditions, users
- [ ] `PHASE-01-01`, `PHASE-03-02`, `PHASE-05-03`, `PHASE-06-02` and `PHASE-09-03` are updated to
      reference the baseline instead of their literals
- [ ] **No acceptance criterion anywhere in `docs/master-plan/prompts/` quotes a literal estate
      count.** Grep for the disputed figures to confirm
- [ ] `map_items.agg_function` non-null count is recorded (expected: zero) as 3.1's baseline

## Documentation updates

- `docs/master-plan/research/baseline-counts.md` — new
- `MASTER_PLAN_REVIEW_CHECKPOINT.md` — the headline counts, so a fresh session sees them without
  opening the artefact

## Git checkpoint

One commit: the baseline artefact plus the prompt edits that de-literalise the gates.

## Handover artefacts

- `baseline-counts.md`
- The headline numbers in the checkpoint
- **A note of any count that could not be measured, and why** — an unmeasurable count must be
  visible, not silently absent

## Explicitly out of scope

- Any fix for a number that turns out wrong. Measuring is this stage; fixing belongs to the phase
  that owns the defect.
- Re-running the migration.
- The formula corpus — that is Phase 0.5.

## Resume instructions

Read the checkpoint. If `baseline-counts.md` exists and the prompt edits are committed, this
stage is done — go to `PHASE-00-05-formula-corpus.md`. If the artefact exists but prompts still
quote literals, finish the de-literalisation.

## TOKEN-BUDGET SAFE EXECUTION

1. Write all queries first, then run them in one sandbox pass.
2. **No specialist agents — none needed.**
3. **Checkpoint on progress, not only on completion.** Append each count as you measure it.
4. Surface counts only. Never a result set.
5. One commit at the end.
