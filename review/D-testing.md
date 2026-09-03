# Review D — Testing Challenge

**Method.** Pass 1 `code-modernization:test-engineer`, tight scope, seven closed questions —
returned in full (74 760 tokens, 41 tool calls). Pass 2 (validation-coverage challenge) done
**inline**, for the same reason C2 was: it asks whether the plan's Tier 1–4 programme covers
every high-risk subsystem, which needs the plan in context rather than a fresh reader.

**The headline finding is a contradiction inside the plan itself**, and it invalidates the
acceptance gates of two phases.

---

## Inventory (verified)

| Workspace | Test files | Reality |
| --------- | ---------- | ------- |
| backend | 45 (33 "unit", 12 integration) | **21 of the 33 "unit" files connect to real Postgres** |
| frontend | 16 + 9 Playwright e2e specs | e2e have never run in CI |
| migrate | 12 | **all against hand-built fixtures** |
| **Total** | **73 + 9 e2e** | Oracle is never reached, in any test, in any environment |

---

## D-01 · The plan's central testing strategy conflicts with a standing data-handling decision

- **Severity:** CRITICAL
- **Phase/Stage:** 1.3 · 4.1 · 4.2 · 4.3 · §5 · §8 · tooling manifest "capability gaps"
- **Type:** INCORRECT (an unnoticed contradiction, not a missing detail)

**Finding.** The plan's single most-emphasised testing move is to check in a corpus derived
from Oracle's `d4wkdmp.exe` dumps:

- Phase **1.3**: *"**promote the `d4wkdmp` differ into CI** with a **checked-in fixture
  corpus**"*
- Phase **4.1**: *"Extract the **37 971 aligned `(IOFormula, DisplayFormula)` pairs** from the
  547 dumps into a **checked-in fixture**"*
- §5: *"the single highest-leverage change available to this project's testing story is to
  **check in a fixture corpus** and gate CI on its agreement rates"*
- Manifest, capability gaps: *"**`d4wkdmp` differ in CI**"*

The codebase has already decided the opposite, in writing:

> `migrate/src/__tests__/d4wkdmp-differ.test.ts:18-19` — *"a hand-written dump text that is
> grammatically faithful to real `d4wkdmp.exe -f` output but describes **placeholder data** …
> **the real dumps are customer report metadata and never committed**."*

Verified:
- `git ls-files | grep -i dump` → **nothing tracked**.
- `d4dumps/` holds **552 files**, untracked, and **not gitignored** — so they are among the 74
  untracked paths Phase 0.1 triages.
- Phase 0.1's own scope says *"`.gitignore` the ~40 MB of dumps"* — **the plan excludes them in
  0.1 and commits fixtures derived from them in 1.3 and 4.1.**

**Why the derived fixture is the same problem.** `DisplayFormula` is not a schema; it is the
customer's business logic in the customer's own words. The plan quotes its own examples —
`PR<?>MIO`, `NVL(R Com Tx Com Vig/100,0)` — which are customer item names inside customer
formulas. A 37 971-row fixture of those is customer report metadata by any reading that makes
the existing comment mean anything.

**The consequence is not theoretical.** Phase 4.2's gate is *"≥ 93 % of the aligned corpus
renders exactly equal to `DisplayFormula`"* and 4.3's is *"≥ 99 % exact; `FAILED = 0`"*. If the
corpus cannot be committed, **neither gate can run in CI**. They become local, unreproducible,
one-machine checks — which is precisely the failure the plan diagnoses elsewhere: *"every test
verifies a component against its own fixtures, and no test verifies the system against
reality."*

**Recommendation.** This is a decision the plan must make, not defer. Add it to the Decision
Register with a `D-0xx` id, and put the choice in Phase 0 (it gates 1.3 and 4.1):

1. **Anonymised corpus (recommended).** Commit the *(token form, rendered form)* pairs with
   every identifier replaced by a stable synthetic name via a committed, deterministic mapping
   that is itself gitignored. Structure, arity, fixity and operator placement — everything the
   renderer is fitted against — survive; the customer's vocabulary does not. Encoding questions
   (the `PR<?>MIO` character-set issue in 4.1) survive too if the mapping preserves byte
   classes.
2. **Private corpus + self-hosted CI.** Keep `d4dumps/` out of the repository and run the gate
   on a runner with access to it. Reproducible for the team, not for a fresh clone. Costs
   infrastructure the project does not have today (there is no remote at all yet).
3. **Commit a sampled corpus with customer sign-off.** Smallest change, needs a human decision
   the plan cannot make on its own.

Whichever is chosen, **update 4.2's and 4.3's gates to say where the corpus lives and who can
run them**, and correct §5 and the manifest's capability-gap row.

---

## D-02 · No test loads a migrated definition; and the files Phase 3.3 rewrites have no tests at all

- **Severity:** CRITICAL
- **Phase/Stage:** 1.3 · 3.2 · 3.3 · §8
- **Type:** MISSING

**Finding.** Two related facts:

1. `backend/src/__tests__/sql-generator.test.ts:285-295` builds its input with a local `mkDef()`
   helper — a hand-written `MapDefinition` literal. **No test anywhere loads a `MapDefinition`
   from Postgres or from a migrated map row.** The plan knows this (it is seam test 1 in 1.3).
2. **`backend/src/lib/sql/` has no dedicated test files at all.** `from-clause.ts`,
   `where-clause.ts`, `select-clause.ts`, `context.ts`, `identifiers.ts`, `totals.ts` are
   exercised only indirectly, through `sql-generator.test.ts`'s hand-built fixtures.

The second fact is the one the plan misses, and it contradicts §8's first row: *"Unit —
**genuinely good already**. `generateSql(def)` is pure and properly unit-testable."* Being
*testable* is not being *tested*. Phase 3.2 rewrites the join model, Phase 3.3 replaces
`from-clause.ts`'s decision logic entirely, and A-02 shows `context.ts`'s alias accumulator must
change too. **All three are about to be rewritten with no direct test coverage to regress
against.**

**Recommendation.**
- Correct §8's "unit tests are genuinely good already" to name the gap: *the emitter modules
  have no direct tests; they are covered only through one composite fixture.*
- Add to **Phase 3.2's scope** (before the rewrite, not after): direct unit tests for
  `from-clause.ts`'s current behaviour — the single-folder short-circuit, the BFS spanning
  tree, the disconnection refusal, and the null-endpoint join drop. These are characterisation
  tests: they pin what exists so the 3.3 rewrite can be proven not to have changed anything it
  did not intend to. This is the cheapest insurance in the whole plan and it is currently
  absent.

---

## D-03 · `scoreReadiness` cannot see execution — D-071's fix requires a signature change

- **Severity:** HIGH
- **Phase/Stage:** 1.3 · D-071
- **Type:** UNDER-ENGINEERING

**Finding.** D-071 says *"`scoreReadiness()` must inspect **its own output** and emit blockers,
not notes … *'It never inspects the output it produced. That is the defect — not the
arithmetic.'*"* The signature shows the defect is structural, not behavioural:

```
migrate/src/services/assessment.ts:571
  scoreReadiness(eul: EulReadResult, orphans: OrphanReport, warnings: MigrationWarning[])
```

All three parameters are **source-side**. The function never receives target state, so it
cannot inspect output — there is no output in scope to inspect. Its three tests
(`assessment.test.ts:284-312`) assert only version support, a clean-EUL 100, and score
degradation on orphans. **Confirmed: none of them would fail against a target database where
zero maps execute.**

**Recommendation.** State in 1.3 that D-071's fix is a **signature change** —
`scoreReadiness` must take the verifier's result (the four seam tests' output) as a parameter,
or be replaced by `dn-migrate verify` as the gate with `scoreReadiness` demoted to a source-side
pre-check. The plan's *"`scoreReadiness()` stops being the gate; the verifier becomes it"*
(D-070) already implies the second option; say so explicitly so a session does not try to
patch arithmetic into a function that structurally cannot see the answer.

---

## D-04 · Phase 1.1's defining gate cannot run in CI

- **Severity:** HIGH
- **Phase/Stage:** 1.1 · 9.1 · §8
- **Type:** MISSING

**Finding.** Phase 1.1's first acceptance criterion is *"a single-folder migrated map
**executes end to end against the live Oracle** and returns rows."* Verified: **no Oracle
instance is reachable from any test or from CI.** `.github/workflows/ci.yml` provisions
`postgres` and `redis` services only. `oracle-connection-pool.test.ts` uses the real driver
against a deliberately unreachable port. Every other Oracle interaction is a hand-built fake
`Connection`.

So the gate that defines "Phase 1 is done" is a **manual, one-machine, unrecorded step**, in a
plan whose entire thesis is that *"every verification mechanism reports success over a dead
system."*

**Recommendation.** Say so plainly in 1.1, and make the manual step leave evidence:
- Mark the criterion **MANUAL — requires live Oracle**, and require the executing session to
  record the map id, the generated SQL, the row count and the timestamp in the checkpoint.
  A number in a durable artefact is what distinguishes this from the green suites the plan
  distrusts.
- Add to §8's testing programme a row for **"live-Oracle gates"**, listing every acceptance
  criterion across the plan that cannot run in CI (1.1, 3.4's known-join total, 9.1 entirely),
  so nobody mistakes a green CI run for those having passed.

---

## D-05 · The Oracle fakes cannot exercise type marshalling

- **Severity:** MEDIUM
- **Phase/Stage:** 9.1 · §8
- **Type:** MISSING

**Finding.** `oracledb` is never module-mocked; each test hand-builds a `Connection`
(`map-execution.test.ts:33-106`). The fakes do cover failure, timeout and ORA-01013 cancel —
better than the plan credits. What they cannot cover is **type marshalling**: DATE/TIMESTAMP
arriving as JS `Date`, NUMBER precision loss, LOB/CLOB descriptors needing `.getData()`, NULLs
inside otherwise-typed columns. Every fake row contains whatever JS value the test author typed.

This matters specifically for **Phase 4.3's `[5,4]` date literals (9 062 uses)** and for the
`SUM`/`COUNT` re-aggregation of **Phase 3.3**, where a NUMBER that loses precision on the way
back produces a wrong total that no test can see.

**Recommendation.** Add to 9.1's scope a small **type-marshalling conformance test** against
live Oracle — one table, one row, one column per Oracle type the estate uses — asserting what
the driver returns for each. It is a handful of assertions and it is the only place the
plan would catch a class of silent numeric error it otherwise cannot.

---

## D-06 · "Move the DB-bound tests" is 21 of 33 files, not hygiene

- **Severity:** MEDIUM
- **Phase/Stage:** §8 "Hygiene, once"
- **Type:** UNDER-ENGINEERING

**Finding.** §8 lists as one-off hygiene: *"move infrastructure-dependent tests out of the unit
directory (~250 s of the run is DB-bound work presented as a unit suite)."* Measured: **21 of
33** backend "unit" files import `db` and connect in `beforeAll`, and `backend/jest.config.js`
forces `maxWorkers: 1` because they share one throwaway database and race otherwise.

That is not a directory move. It is two thirds of the backend suite, and the serialisation is
load-bearing — relocating the files without giving each a transaction or its own schema will
surface flakiness the current `maxWorkers: 1` is hiding.

**Recommendation.** Give it its own stage — **8.5, or a scope item in 1.3** — with an explicit
approach (per-test transaction rollback, or schema-per-worker) rather than listing it as
hygiene. Note the `maxWorkers: 1` dependency so nobody removes it as an unrelated speed-up.

---

## D-07 · Coverage is not configured, not just wrongly reported

- **Severity:** MEDIUM
- **Phase/Stage:** §8 "Hygiene, once"
- **Type:** INCORRECT

**Finding.** The plan says *"gate on **branch** coverage (56.1 %, not the claimed > 80 %), not
lines; regenerate coverage in CI."* The numbers check out — `backend/coverage/coverage-summary.json`
reports lines 75.38 %, statements 74.33 %, functions 70.7 %, **branches 56.1 %**. But the
situation is one step worse than "wrongly reported":

- **No `coverageThreshold` key exists in any config** — not in `backend/jest.config.js`, not in
  `migrate/jest.config.js`, not in `frontend/vitest.config.ts`.
- **No `package.json` script passes `--coverage`.**
- **CI never measures coverage at all** (`ci.yml:73-74, 99-100, 125-126` run bare `npm test`).

So the committed artefact is a stale out-of-band local run. Nothing to "regenerate" — the
pipeline step does not exist.

**Recommendation.** Restate as: *add `--coverage` to the CI test steps, add a
`coverageThreshold` on **branches** in all three workspaces set at the measured baseline, and
delete the committed `coverage/` artefact so a stale number cannot be quoted again.* Ratchet
upward per phase rather than setting a target the suite cannot meet.

---

## D-08 · The frontend test pins a gap that is already built behind it

- **Severity:** MEDIUM
- **Phase/Stage:** 2.3 · D-101 · D-104
- **Type:** INCORRECT (extends A-13)

**Finding.** `frontend/src/__tests__/dashboard.test.tsx:93` asserts
`/Scheduling isn.t available yet/` — sourced from `frontend/src/locales/en/mapViewer.json:37`.
Backend scheduling exists and is tested (`schedules.test.ts`, `scheduler.test.ts`,
`integration/export-scheduling.test.ts`). The test will **fail the day the frontend is wired to
the working backend**, which is Phase 7.2.

Two additions to what the plan says:
- The string lives in a **locale file**, and the plan requires all four locales stay in sync
  (§9). Removing it is a four-file change, not a one-line delete.
- Line **92** (`/No maps yet/`) is the empty state D-101/R2 explicitly forbids — see A-13.

**Recommendation.** 2.3's scope: *"rewrite `dashboard.test.tsx`'s empty-state assertion to the
truthful copy; delete the scheduling assertion **and its key from all four locale files**."*

---

## Part 2 — Does the validation programme cover every high-risk subsystem?

The plan's Tier 1–4 table (§5) against the subsystems §5 of the review brief names:

| Subsystem | Covered by | Verdict |
| --------- | ---------- | ------- |
| SQL generation | Tier 2 (1.3), unit | ⚠️ **gap** — the emitter modules have no direct tests (D-02) |
| Migration | Tiers 1–2 (1.3), 4.5 | ✅ well covered, once D-01 is resolved |
| Worksheet fidelity | differ + `DisplayFormula` | ❌ **blocked by D-01** |
| Oracle integration | Tier 3 (9.1) | ⚠️ real, but no type-marshalling check (D-05) |
| Row-level security | 6.3's fail-closed test | ❌ **gap — see below** |
| Exports | 7.3 | ⚠️ thin: *"export matches on-screen rows"*, no RLS-in-export test |
| Scheduling | 7.2 | ❌ **gap — see below** |
| Frontend | 2.x | ✅ plus 9 e2e specs entering CI at 2.3 |
| E2E workflows | 2.3 | ✅ |

### D-09 · Row-level security has one test, and it is the wrong shape

- **Severity:** HIGH
- **Type:** MISSING

The whole RLS programme is gated by one criterion: *"A user with no policy sees **nothing**, and
removing a policy does not open access"* (6.3). Given Review C, that is not enough. The tests
the plan needs, and does not name:

1. A user with **no** policy sees nothing — the stated one. ✅
2. A **BA-scoped** policy fires when `business_area_id IS NULL` — the plan has this, in 1.1. ✅
3. A **folder reached only through a calculated-field reference** has its policy applied, or
   the query refuses. **(C-02, missing)**
4. A **folder joined only as a BFS bridge** has its policy applied, or the query refuses.
   **(C-02, missing)**
5. A policy-bearing folder the executing user cannot resolve causes a **refusal**, not an
   unfiltered query. **(C-08's interim, missing)**
6. An **export** carries the same predicates as the on-screen query. **(missing — 7.3 asserts
   only that rows match, which passes if both are equally unfiltered.)**

**Recommendation.** Write these six as a named **RLS conformance suite** in 1.1, extended in
6.3. They are the highest-value tests in the plan and currently three of the six do not exist
in any phase.

### D-10 · Scheduling has no validation beyond "it runs"

- **Severity:** MEDIUM
- **Type:** MISSING

7.2's gate is *"schedules run from migrated defs."* Combined with A-08 (a planner refusal on a
scheduled workbook has no handling) and D-09/6 (exports may not carry predicates), a scheduled
export can deliver either nothing or unfiltered data to a file, on a timer, with no assertion
covering either case.

**Recommendation.** Add two gates to 7.2: *a migrated schedule whose definition the planner
refuses imports as `DISABLED` with its reason recorded*, and *a scheduled run executes under the
schedule owner's entitlements, asserted by a test with two users and one policy.*

---

## Verified correct

- The `d4wkdmp` differ, the parser and the fixture builder are **real and careful** — the differ
  correlates on exact element ids and the fixture builder assigns them deterministically. The
  plan's instruction to **protect** this code is right.
- 9 Playwright e2e specs exist and have never run in CI — confirmed.
- The Oracle fakes **do** simulate rejection, timeout and ORA-01013 cancel
  (`makeFailingConn`, `makeHangingConn`) — better than "mocked throughout" implies. Worth
  crediting so a session does not rebuild them.
- The row-limit clamps are real: `clampSyncMaxRows` on the sync path and
  `ASYNC_MAX_ROWS = 100_000` on the async path. This does **not** clear BE-03, which is about
  the process-local result cache.
- Branch coverage 56.1 % vs lines 75.38 % — the plan's numbers are exactly right.
