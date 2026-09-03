# PHASE 3.4 — Enable multi-folder generation

**Model:** Opus · **Effort:** high

## Purpose

Remove the interim refusal, let the planner drive, and **prove the guard is actually live**.

> **A guard that fires zero times is indistinguishable from a guard that is not wired in** —
> and this project's documented failure mode is exactly three mechanisms reporting success over
> a non-functional system.

## Scope

1. **Delete Phase 1.1's interim refusal** from `buildFromClause` — the three lines that throw
   on `required.length > 1 && ctx.hasAggregates`.
2. Let the Phase 3.3 planner drive every query.
3. Extend migration verification to emit the **planner-decision histogram** across all 923
   maps: FLAT / REWRITE(n) / REFUSE(rule).
4. **Assert `REFUSE > 0 && FLAT < 923`** (D-037).
5. Verify one real master–detail join in this estate against the source system.

## Prerequisites

**Phase 3.3 complete, reviewed and green.** Do not start this stage on a partial planner.

## Required files to read first

- `docs/master-plan/research/architecture-analysis.md` **H4** — **the authoritative brief for
  the histogram**
- `docs/master-plan/DECISION_REGISTER.md` D-014, D-030, D-037
- `docs/master-plan/research/legacy-analysis.md` §10 — the validation hooks
- `backend/src/lib/sql/from-clause.ts` — the interim refusal
- `migrate/src/services/assessment.ts` — `scoreReadiness()`
- The Phase 1.3 baseline numbers in `MASTER_PLAN_GENERATION_CHECKPOINT.md`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` — **essential**; the histogram runs over 923 maps and its
raw output must not enter context.

## Implementation instructions

- Delete the refusal **and its tests** in the same commit — those tests asserted a temporary
  behaviour.
- The histogram belongs in `dn-migrate verify` (Phase 1.3), not in a new tool.
- **Choose the verification join deliberately.** `legacy-analysis.md` §10.1 and the audit both
  name `M M67 1 → M M67` (header to lines) as a real master–detail pair in this estate. If
  Phase 0.3's Q5 confirmed `EUL4_QPP_STATS` records returned row counts, **use it as an
  independent oracle** — it is otherwise the only one available from this repository.
- If the histogram shows `REFUSE = 0`, **stop.** Either the guard is not wired in, or the
  measure set is still empty (Phase 3.1). Diagnose before proceeding — do not relax the
  assertion.

## Tests

- The histogram assertion itself: `REFUSE > 0 && FLAT < 923`
- A known multi-folder aggregate map now produces a **correct** total, not an inflated one
- A known multi-folder **non**-aggregate map generates flat SQL
- Phase 1.3's migration → execution seam test now passes for the multi-folder set, or refuses
  with a named rule — **never throws an unhandled error**

## Security checks

- Confirm security predicates are applied **per branch**, not only in the outer query — the
  Phase 3.3 tests cover this, but re-verify against real migrated data, which is the first time
  the rewrite runs on real conditions.
- Confirm RLS still fires on rewritten queries.

## Validation

```bash
cd discoverer-neo && npm test --workspace backend
npx dn-migrate verify --target <connection>
```

Then, against the live Oracle: execute the chosen master–detail worksheet and **compare the
total to the source system's own recorded value.**

## Acceptance criteria

- [ ] The interim refusal is deleted, along with its tests
- [ ] **`REFUSE > 0 && FLAT < 923`** — the histogram proves the guard fires
- [ ] The histogram is part of `dn-migrate verify` and reported in readiness
- [ ] **A real master–detail join in this estate produces the correct total, verified against
      the source system**
- [ ] No map throws an unhandled error — every outcome is rows, a named refusal, or a stated
      configuration problem
- [ ] Security predicates apply per branch on real data

## Documentation updates

- `docs/troubleshooting/` — the refusal rules, now that users will hit them
- `docs/migration/` — how to read the histogram
- `docs/user-guide/` — why some worksheets refuse

## Git checkpoint

One commit removing the refusal; one adding the histogram; one for the verification evidence.
Push after each.

## Handover artefacts

- **The histogram itself** — FLAT / REWRITE(n) / REFUSE(rule) counts across 923 maps. This is
  the single most important number the project has produced to date.
- The master–detail verification result, with the source system's own figure alongside.

## Explicitly out of scope

- Formula compilation — Phase 4. Maps whose formulas do not yet compile will still fail; that
  is expected and must be **counted separately** from planner refusals.
- Hierarchies, item classes, conditional formats — Phase 5.
- Result-set equivalence across a sample — Phase 9.1.

## Resume instructions

Read the checkpoint, run `dn-migrate verify`, and read the histogram. If `REFUSE > 0` and
`FLAT < 923` and the master–detail total is verified, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Remove the refusal, run the histogram, **read it before doing anything else.**
2. **No specialist agents.**
3. Use `context-mode` for the 923-map run.
4. **Checkpoint the histogram immediately** — it is the phase's deliverable.
5. Commit coherently.
6. **If `REFUSE = 0`, stop and diagnose.** Do not weaken the assertion to make it pass. That
   would recreate this project's signature failure exactly.
7. If interrupted, record the histogram as far as it ran, and whether the interim refusal has
   been removed — **a removed refusal with an unproven guard is the most dangerous state this
   codebase can be left in.**

---

## ⟐ CORRECTION — the acceptance gate is rewritten (review R-07 / B-03)

**The v1.0 gate `REFUSE > 0 && FLAT < 923` cannot tell the fan-trap guard from a pre-existing
failure, and would pass with the guard never having fired once.**

`legacy-analysis.md` 1.11 step 1 keeps Neo's existing disconnection refusal, and records that
**271 of 341 multi-folder maps hit it today**. Those refusals alone satisfy `REFUSE > 0`, and
`FLAT` is comfortably below the total. Step 10's own enumeration
(`FLAT | REWRITE(n) | REFUSE(R1..R4|REAGG)`) **omits the disconnection rule entirely**, so the
refusal that actually fires is not even in the histogram's vocabulary.

### Emit a PER-RULE histogram

```
FLAT · REWRITE(n) · REFUSE(DISCONNECTED) · REFUSE(NO_PREDICATE) ·
REFUSE(R1) · REFUSE(R2) · REFUSE(R3) · REFUSE(R4) · REFUSE(REAGG)
```

Add `DISCONNECTED` and `NO_PREDICATE` to 1.11 step 10's enumeration.

### Three assertions replace the one

- [ ] **`REWRITE(n) > 0`** — the rewrite path is reachable at all. **This is the assertion v1.0
      was missing, and it is the one that matters.** A guard that only ever refuses has not been
      shown to work; it has been shown to have no input.
- [ ] **`REFUSE(DISCONNECTED)` has fallen** against the baseline Phase 3.2 recorded — otherwise
      3.2 did not fix what it claimed.
- [ ] **At least one fan-trap rule fired** (`R1`–`R4`, `REAGG`, or the 5a single-branch case),
      **or** the run explicitly records that no map in the estate meets the trigger condition.
      "No map triggers it" is an acceptable answer; **silence is not.**

### ⟐ Browser-validate the refusal UI (review R-18 / F-04)

Phase 3.3 hands you a refusal-rule list whose stated consumer is *"the refusal UI"* — built in
**Phase 2.2, against Phase 1.1's single generic `SqlGenerationError` message**, before Phase 3
existed. No stage re-validated it. **This is where real structured refusals first become
reachable, so this is where it gets checked.**

- [ ] Using `Claude_Browser`, trigger **one instance of each planner refusal rule** and confirm
      the UI renders its rule name, the folders involved, and a next step — not a generic error.

**Add `Claude_Browser` to this stage's tooling.** The v1.0 prompt lists only `context-mode`.

### ⟐ Counts

Assert against **Phase 0.4's recorded baseline** (`docs/master-plan/research/baseline-counts.md`),
never a literal. Resolved: **341** multi-folder maps (the `272` this prompt's v1.0 arithmetic
once inherited was wrong), of which **70** are connected by the 10 known joins and **271** are
not — exactly the research's "271 of 341".
