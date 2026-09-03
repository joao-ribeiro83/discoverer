# Discoverer Neo — Testing Assessment

**Audit date:** 2026-09-01 · All figures below were produced by **running the suites**
during this audit, not read from documentation.

---

## 1. Measured results

| Workspace | Command | Suites | Tests | Pass | Fail | Time |
| --- | --- | --- | --- | --- | --- | --- |
| backend | `npm test` (jest) | 45 | 1 057 | **1 056** | **1** | 250 s |
| migrate | `npm test` (jest) | 12 | 463 | **463** | 0 | 25 s |
| frontend | `npx vitest run` | 16 | 134 | **134** | 0 | 4 s |
| **Total** | | **73** | **1 654** | **1 653** | **1** | |

`npm run typecheck --workspaces` passes clean on all three.

**E2E:** 9 Playwright specs exist — `accessibility`, `admin-business-areas`,
`admin-data-sources`, `export`, `i18n-theming`, `login`, `map-builder`, `map-viewer`,
plus `fixtures.ts`. Not executed in this audit; **never executed in CI** (INF-04).

### The one failure

```
FAIL src/__tests__/integration/query-engine.test.ts
  ● Scenario 9: async execution › submits a job, polls to completion, and exposes results
    expect(logs.some((l) => l.status === 'SUCCESS')).toBe(true)
    Expected: true   Received: false                    (line 875)
```

Jest also reports *"Force exiting … consider `--detectOpenHandles`"*, indicating leaked
handles somewhere in the async path. **This must be classified as flake or defect before
the async execution path is trusted** — it is the only automated signal touching that path.

### Coverage — stale and below the claim

`backend/coverage/coverage-summary.json` is dated **2026-07-19** (six weeks old):

| Metric | Covered / Total | % |
| --- | --- | --- |
| Lines | 3 921 / 5 201 | **75.38** |
| Statements | 4 086 / 5 497 | 74.33 |
| Functions | 613 / 867 | 70.70 |
| **Branches** | 1 232 / 2 196 | **56.10** |

Commit `f5bb591` is titled *"Session 6.1: Backend test coverage push to >80%"*. On the only
coverage artefact in the repository that claim is **false**, and branch coverage — the
metric that matters for a SQL generator full of conditionals — is barely half.

---

## 2. The central question: how did 1 654 passing tests miss a 100 % failure?

**F-01 means zero of 923 migrated maps can execute.** The suite is green. This is the most
important thing in this document, so it is worth being precise about the mechanism.

### Cause 1 — no test spans the seam

Only two files touch both migration and SQL generation
(`integration/query-engine.test.ts`, `sql-generator.test.ts`), and **neither loads migrated
data**. `integration/migration-audit.test.ts` — the file whose name promises exactly this
coverage — asserts **row counts** and looks up business areas **by name** (`:210-211`,
`eq(businessAreas.name, 'Sales Analysis')`). It never calls `generateSql()` and never
executes a map.

### Cause 2 — fixtures are constructed correct-by-accident

Every SQL-generator test builds its own map, folders and items in one business area. The
invariant F-01 violates — *a map's items live in folders belonging to the map's business
area* — holds by construction in every fixture and is asserted nowhere. It was an
**implicit** invariant, and implicit invariants do not fail tests.

### Cause 3 — the migration is tested against a fake writer

`migrate/src/testing/fake-writer.ts` collects planned rows in memory. Tests assert *what
the migration intended to write*. Nothing asserts that what was written is **usable**. The
migration can be perfectly self-consistent and still produce an inert database — which is
exactly what happened.

### Cause 4 — the readiness scorer agreed

`scoreReadiness()` returned `75 / "ready-with-warnings" / blockers: []`. Two independent
mechanisms both reported success. Neither looked at output.

### The one test that would have caught it

```ts
it('every migrated map can generate SQL', async () => {
  await runMigration(fixtureEul, target);
  const maps = await db.select().from(mapsTable);
  expect(maps.length).toBeGreaterThan(0);
  for (const m of maps) {
    const def = await loadMapDefinition(m.id);   // throws today
    expect(() => generateSql(def)).not.toThrow();
  }
});
```

The same shape would have caught **F-04** (assert `map_layouts` count equals `maps` count)
and would surface **F-02** as a formula compile-rate metric.

---

## 3. Test-class audit

### Genuine unit tests

`identifiers.test.ts`, `sql-generator.test.ts`, `calculated-fields.test.ts`,
`metadata-cache.test.ts`, and most of `migrate/`'s 463 — pure functions, no infrastructure.
`sql-generator.ts` is deliberately split into a pure `generateSql(def)` and a
database-backed `loadMapDefinition()`, which is good design and makes the pure half
properly unit-testable.

### Mislabelled — infrastructure-dependent tests filed as units

Everything in `backend/src/__tests__/*.test.ts` that hits Postgres or Redis sits **outside**
`__tests__/integration/` yet requires a live database. `npm test` runs a `pretest` hook
(`scripts/setup-test-db.mjs`) that creates `discoverer_neo_test`, so ~250 s of the run is
infrastructure-bound work presented as a unit suite. The naming implies a fast inner loop
that does not exist.

**Positive:** `test-database-guard.test.ts` exists and enforces that the suite refuses to
run against a non-`_test` database. That is a genuinely good safety control.

### Real integration tests

14 files under `__tests__/integration/`: `auth`, `business-areas`, `custom-functions`,
`data-sources`, `export-scheduling`, `folders`, `hierarchies`, `items`, `joins`,
`map-sharing`, `migration-audit`, `query-engine`, `rbac`, `rls-enforcement`. These use real
Postgres and are legitimately integration-scoped.

### Tests that enshrine incomplete behaviour

`frontend/src/__tests__/dashboard.test.tsx:93` asserts the presence of *"Scheduling isn't
available yet"* — so removing the placeholder becomes a test failure (F-30). A test should
pin behaviour that is **wanted**, not behaviour that is merely **current**.

---

## 4. Coverage gaps that matter

| Gap | Evidence | Consequence |
| --- | --- | --- |
| **Migration output → execution** | No test spans it | F-01, 100 % failure, undetected |
| **Real Oracle** | `oracledb` mocked throughout; only the live `/test` endpoint reaches Oracle | F-09 (12c+ pagination vs Oracle 8 source) cannot surface |
| **Token formula corpus** | 49 819 formulas, none compile-tested | F-02 scale unknown to the suite |
| **Migrated-data fixtures** | Every fixture is hand-built | Real-estate shapes never exercised |
| **RLS** | `rls-enforcement.test.ts` exists; `security_policies` has **0 rows** live | Fail-open vs fail-closed **unverified** — a security-relevant unknown |
| **Sharing** | `map-sharing.test.ts` exists; `map_shares` **0 rows** live | F-07 undetected |
| **Multi-folder joins** | 10 joins for 212 folders | Cartesian-product risk untested |
| **Branch coverage** | 56.1 % | Half the conditionals in a SQL generator are unexercised |
| **E2E in CI** | 9 specs, CI never runs | No end-to-end signal at all |
| **Performance** | `PERFORMANCE.md` exists; no benchmark suite found | Numbers unreproducible |
| **Migration corpus regression** | `d4wkdmp` differ is dev-only | The best asset in the repo runs only by hand |

---

## 5. The strongest testing asset is not in the test suite

The **`d4wkdmp` differ harness** (`migrate/src/scripts/`) is the most rigorous verification
work in this project: 547 reference dumps from **Oracle's own decoder**, a dump parser, a
differ, and an aggregate report over 544 workbooks with 0 harness failures.

It found real defects the unit suite could not — F-18 (`dataType`/`placement`/`hidden`/
`isACalc` at 0 % extraction), F-19 (1 137 missing sheet items), F-20 (`caseSensitive` never
extracted) — and measured improvement between runs (calculation `ioFormula` agreement rose
from 10 207 to **38 727**).

Its README states it is **dev-only, not imported by the migration, and not in CI**. That is
the single highest-leverage change available to this project's testing story: **check in a
fixture corpus and gate CI on the differ's aggregate agreement rates.**

---

## 6. Recommended minimum trustworthy suite

Ordered by value per unit of effort.

### Tier 1 — would have caught every CRITICAL finding

1. **Migration → execution contract test** (§2). Catches F-01 and F-04.
2. **Formula compile-rate test** over the full corpus: every `map_calculated_fields.formula`
   either compiles or is explicitly quarantined with a reason. Catches F-02; converts an
   unknown into a tracked number.
3. **Referential-closure test**: every `map_item` resolves to an item, folder and data
   source **within the map's query scope**.
4. **Source↔target reconciliation test** with declared expected-loss allowances. Catches
   F-10 (508→0) and F-11 (138→60) automatically.

### Tier 2 — parity confidence

5. **`d4wkdmp` differ in CI** against a checked-in corpus, gated on agreement rates so a
   regression in the parser fails the build.
6. **Oracle contract tests** against a real instance (or a version-matched container),
   proving the generated SQL parses on the target server version. Catches F-09.
7. **RLS fail-closed test**: assert that a user with no policy sees nothing, and that
   removing a policy does not open access.
8. **Playwright E2E in CI** — the 9 specs already exist.

### Tier 3 — hygiene

9. Fix or delete the failing async-execution test; resolve the leaked handles.
10. Regenerate coverage in CI; gate on **branch** coverage, not lines.
11. Move infrastructure-dependent tests out of the unit directory; keep a genuinely fast
    unit loop.
12. Remove the dashboard test that asserts placeholder text.

---

## 7. Verdict

**1 654 tests, 99.94 % passing, and the product does not work.**

This is not a small suite or a lazy one — it is 73 files with real integration coverage, a
test-database guard, and an exceptional external-reference harness. The failure is
architectural: **every test verifies a component against its own fixtures, and no test
verifies the system against reality.**

The fix is not more tests. It is *four* tests at the seams — migration→execution,
formula compilation, referential closure, source↔target reconciliation — plus promoting the
differ harness into CI. Those five changes would have caught every CRITICAL finding in this
audit, and they are all small.

**Do them before writing any new feature code.** Until CI runs at all (INF-04), none of it
is enforced anyway.
