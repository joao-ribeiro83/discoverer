# PHASE 1.3 — The four seam tests and the verification harness

**Model:** Opus · **Effort:** high

## Purpose

Build the verification that could not possibly have reported green on this system's real
state.

> **1 654 tests, 99.94 % passing, and the product does not work.** Every test verifies a
> component against its own fixtures; **no test verifies the system against reality.** Three
> independent mechanisms — the readiness scorer, the test suite, and the coverage artefact —
> all reported success over a system where zero of 923 worksheets could execute.
>
> **The fix is not more tests. It is four tests at the seams.**

## Scope

### The four seam tests

1. **Migration → execution contract.** For every migrated map: `loadMapDefinition()` +
   `generateSql()` must not throw. Catches F-01 and F-04.
2. **Formula compile rate.** Every `map_calculated_fields.formula` either compiles or is
   quarantined with a stated reason. Converts F-02 from an unknown into a tracked number.
   *(The renderer arrives in Phase 4 — here the bucket is `QUARANTINED(no renderer yet)` and
   the count is the baseline.)*
3. **Referential closure.** Every `map_item` resolves to an item, folder and data source
   **within the map's query scope**.
4. **Source ↔ target reconciliation** with **declared expected-loss allowances**. Catches
   hierarchies 508 → 0 and grants 138 → 60 automatically.

### The verifier

5. **D-070** — a re-runnable `dn-migrate verify` subcommand that runs the four tests against a
   real target, **post-commit**, never inside the migration transaction. Add a
   `COMPLETED_WITH_BLOCKERS` migration status.
6. **D-071 / F-12** — `scoreReadiness()` inspects **its own output** and emits **blockers**,
   not notes. It currently returns `75 / "ready-with-warnings" / blockers: []` over a
   migration where nothing runs. *"It never inspects the output it produced. That is the
   defect — not the arithmetic."*
7. **Promote the `d4wkdmp` differ into CI** with a checked-in fixture corpus, gated on
   agreement rates. *"The single highest-leverage change available to this project's testing
   story."*
8. **F-23** — classify the one failing async-execution test as flake or defect, fix or delete
   it, and resolve the leaked handles Jest reports.
9. **F-22** — regenerate coverage in CI and gate on **branch** coverage (56.1 %, not the
   claimed >80 %), not lines.

## Why post-commit, not in-transaction

A rollback destroys the evidence needed to debug, and a transaction over 923 maps × 49 819
formulas is untenable. **The estate is already migrated, so verifying without re-importing is
the first thing you will want.**

## Prerequisites

Phase 1.2 — including the `group_id` write fix, or these tests pin conditions that lost their
structure at import.

## Required files to read first

- `AUDIT_TESTING_ASSESSMENT.md` §2 and §6 — **the authoritative brief**, including the exact
  test that would have caught F-01
- `docs/master-plan/research/architecture-analysis.md` **H4, M5**
- `docs/master-plan/DECISION_REGISTER.md` D-059, D-070, D-071
- `migrate/src/services/assessment.ts` — `scoreReadiness()`
- `migrate/src/scripts/diff-corpus.ts`, `migrate/src/services/d4wkdmp-differ.ts`
- `backend/src/__tests__/integration/migration-audit.test.ts` — the file whose name promises
  this coverage and which **asserts row counts and looks up business areas by name**

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` — essential; the differ report is ~3 MB. `playwright` is
**not** needed here.

## Implementation instructions

- The shape of test 1, from the audit:

```ts
it('every migrated map can generate SQL', async () => {
  const maps = await db.select().from(mapsTable);
  expect(maps.length).toBeGreaterThan(0);
  for (const m of maps) {
    const def = await loadMapDefinition(m.id);
    expect(() => generateSql(def)).not.toThrow();
  }
});
```

- **Expected-loss allowances must be declared data, not magic numbers in an assertion.** A
  file listing each concept, its source count, its expected target count and *why* it differs.
  When Phase 5 recovers hierarchies, the allowance shrinks and the test tightens.
- The compile-rate bucket vocabulary is fixed by D-059: `COMPILED` / `COMPILED_UNVERIFIED` /
  `QUARANTINED(reason)` / `FAILED`. **CI asserts `FAILED = 0`** — an unhandled path is a bug,
  not a data problem.
- **The checked-in differ reports are two code generations stale (WB-01). Every percentage in
  them is an artefact. Regenerate before quoting any number.**
- Move infrastructure-dependent tests out of the unit directory — ~250 s of the run is
  DB-bound work presented as a unit suite.

## Tests

This stage *is* tests. Its own meta-acceptance: **run the four tests against today's database
and confirm they FAIL for the right reasons** before Phase 3–5 make them pass.

## Security checks

- The verifier must not print credentials from `data_sources`.
- `test-database-guard.test.ts` already refuses to run against a non-`_test` database — keep
  that guard intact when moving tests between directories.

## Validation

```bash
cd discoverer-neo && npm test --workspace backend && npm test --workspace migrate
npx dn-migrate verify --target <connection>
```

## Acceptance criteria

- [ ] All four seam tests exist and run in CI
- [ ] **`scoreReadiness()` refuses to report "ready" against today's database state** — this is
      the stage's defining test
- [ ] `dn-migrate verify` runs post-commit and is re-runnable without re-importing
- [ ] `COMPLETED_WITH_BLOCKERS` exists as a migration status
- [ ] The `d4wkdmp` differ runs in CI against a checked-in fixture corpus and gates the build
- [ ] The failing async test is fixed or deleted with a stated reason; no leaked handles
- [ ] CI gates on **branch** coverage
- [ ] Expected-loss allowances are declared in a file, not inline

## Documentation updates

- `docs/developer-guide/testing.md` — the four seams, the bucket vocabulary, the allowance file
- `docs/migration/` — what `verify` checks and how to read its output

## Git checkpoint

One commit per numbered item. Push after each.

## Handover artefacts

- The **baseline numbers**: how many maps generate SQL, how many formulas fall in each bucket,
  the reconciliation deltas. **Every later phase measures progress against these.** Record
  them in `MASTER_PLAN_GENERATION_CHECKPOINT.md`.

## Explicitly out of scope

- **Making the tests pass.** They are *supposed* to fail today. Phases 3, 4 and 5 fix them.
- The token renderer — Phase 4.
- Oracle contract tests against a real instance — Phase 9.1.
- Playwright E2E in CI — Phase 2.3.

## Resume instructions

Read the checkpoint. If the four tests exist and `scoreReadiness()` reports blockers against
today's data, this stage is done. Otherwise resume at the first unchecked criterion.

## TOKEN-BUDGET SAFE EXECUTION

1. One test at a time, committed before starting the next.
2. **No specialist agents.** This is single-context work.
3. Use `context-mode` for the differ report and all corpus output — never read a 3 MB report
   into context.
4. Checkpoint after each test lands, recording its baseline number.
5. Commit coherently.
6. Leave CI green — a *failing seam test is expected*, so mark those as reporting rather than
   gating until their fixing phase lands, and record which are which.
7. If interrupted, the checkpoint must name which of the nine scope items are complete.

---

## ⟐ CORRECTIONS from the plan review

### 1. The fixture corpus comes from Phase 0.5, not from here (R-04 / F-03)

The v1.0 scope said *"promote the `d4wkdmp` differ into CI **with a checked-in fixture
corpus**"* — phrased as promoting something that exists. It did not. `git ls-files` tracks no
dumps; `d4dumps/` is 552 untracked files that **Phase 0.1a gitignores**; and
`migrate/src/__tests__/d4wkdmp-differ.test.ts:18-19` records the standing decision:

> *"the real dumps are customer report metadata and never committed."*

v1.0 also created the fixture in Phase **4.1** — three phases *after* this one consumed it.

**Phase 0.5 now builds an anonymised corpus (D-114) and commits it.** This stage **consumes** it.
If Phase 0.5 has not run, stop: the CI gate you are asked to build has nothing to gate on.

### 2. `scoreReadiness` cannot be fixed as D-071 describes (R-23 / D-03)

```
migrate/src/services/assessment.ts:571
  scoreReadiness(eul: EulReadResult, orphans: OrphanReport, warnings: MigrationWarning[])
```

**All three parameters are source-side.** The function never receives target state, so *"inspect
its own output"* is not an arithmetic change — there is no output in scope to inspect. Its three
tests (`assessment.test.ts:284-312`) assert version support, a clean-EUL 100, and degradation on
orphans; **none would fail against a target database where zero maps execute.**

**Do this, not that:** demote `scoreReadiness` to a **source-side pre-check** and make
`dn-migrate verify` the gate — which D-070 already implies. Do not try to patch arithmetic into
a function that structurally cannot see the answer.

### 3. Two items moved here from Phase 8.2 (R-06 / A-06)

Phases 3 and 4 hold Oracle connections open across the whole estate. They must not run without:

- **BE-04** — the `getConnection` leak when its own timeout wins the race.
- **INF-10, pool portion only** — the Oracle pool metric.

Both are small, and this is already the stage that builds measurement apparatus. The rest of
8.2 stays where it is.

### 4. Coverage (R-24 / D-07)

Coverage is not merely misreported — **there is no `coverageThreshold` in any of the three
workspaces, and CI never passes `--coverage`.** The committed `coverage/` artefact is a stale
local run. Add `--coverage` to the CI test steps, set a **branch** threshold at the measured
baseline (56.1%, not the lines figure), delete the committed artefact, and ratchet upward per
phase.

### 5. Context rule (G-02)

The reconciliation spans the whole estate. **Never read it into context.** Script it in the
sandbox; emit only counts, the top N discrepancies with reasons, and the path to the full
result.
