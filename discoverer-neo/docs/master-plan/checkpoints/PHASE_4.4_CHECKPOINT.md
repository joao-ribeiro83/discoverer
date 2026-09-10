# Phase 4.4 — calculation-reference expansion and the CI gate

**Status:** complete, with one acceptance criterion that cannot be *measured* on
this machine and is stated as such below rather than claimed.

## The handover artefacts

### The bucket histogram

Regenerated 2026-09-10 with `npm run render-corpus -w @discoverer-neo/core` over
`migrate/corpus/formula-corpus.tsv` — 22 748 distinct rows, 37 971 occurrences.
This is the D-059 partition, and it is what Phase 4.5 runs against the stored
estate.

| Bucket | rows | | occurrences | |
| --- | ---: | ---: | ---: | ---: |
| `COMPILED` | 21 760 | 95.66 % | 36 342 | 95.71 % |
| `COMPILED_UNVERIFIED` | 912 | 4.01 % | 1 487 | 3.92 % |
| `QUARANTINED` | 76 | 0.33 % | 142 | 0.37 % |
| **`FAILED`** | **0** | 0.00 % | **0** | 0.00 % |
| (sum) | 22 748 of 22 748 | | 37 971 of 37 971 | |

Quarantine histogram: `UNFITTED_CODE` 142 occurrences (76 rows). Nothing else.

The sum is asserted, not decorative. Without it, `FAILED = 0` is satisfiable by
losing rows out of the partition rather than by fixing them.

`COMPILED` is reachable here only because every corpus row carries a
`DisplayFormula` to check against. The verifier's own partition over the 49 819
**stored** formulas has no reference rendering and still tops out at
`COMPILED_UNVERIFIED` until the Phase 9.1 Oracle contract tests exist. The two
buckets share a name and mean different things; `docs/developer-guide/testing.md`
now carries the table that separates them.

### The observed maximum expansion depth

**Not measurable on this machine, and not claimed.** `d4dumps/` is empty here,
so the differ — the only harness that sees a worksheet's calculation set beside
its dump — cannot be run over real workbooks. The corpus is a flat list of
single formulas with no worksheet around them, so a `[6,n]` there has nothing to
resolve into and expansion over it is a no-op by construction.

What exists instead:

- The differ **reports** the observed maximum, per corpus run, beside the
  substitution count and any refusals by reason: `expansion: N calculation(s)
  expanded, M reference(s) substituted, deepest chain D (bound 16)`.
- The bound is 16, and the deepest chain the unit tests exercise is 3.
- On the fixture that stands in for a real chain, the reported maximum is 1.

Whoever next has the dumps should run `npx tsx
migrate/src/scripts/diff-corpus.ts` and record the real number here. If it is
anywhere near 16, the bound is the wrong bound.

## What was built

### Expansion, at render time

`migrate/src/semantics/expand.ts`. A `[6,n]` that names another calculation is
substituted with that calculation's **tree**, recursively, exactly as Oracle's
dump tool substitutes its formula. Render time, not migration time (D-056), so
improving the renderer never means re-migrating an estate.

Three bounds, all before it walks anything:

| Refusal | When |
| --- | --- |
| `CALCULATION_CYCLE` | a calculation reaches itself, directly or through others. The chain is named in the detail |
| `EXPANSION_TOO_DEEP` | more than 16 references deep |
| `EXPANSION_TOO_LARGE` | more than 20 000 nodes after expansion |

The third is not redundant with the second. An acyclic diamond — `d` names `c`
twice, `c` names `b` twice, `b` names `a` twice — is four deep and expands to
eight leaves; twenty levels of it expands to a million. Substitution turns a DAG
into a tree, and a tree is exponential in the DAG. Depth alone does not bound
the work, and the test that proves it uses twelve levels well inside the depth
cap.

Expansion produces **nodes, never text**, so the expanded tree goes through
`renderSql` exactly as an unexpanded one does. Identifier validation, the
allowlist and the bind discipline all still apply, once, in the one place that
owns them. It is not a splice path.

### The differ, extended rather than duplicated

`diffCalculations` now expands the parser's tokens before comparing them with
the dump's `IOFormula`, and reports an `ExpansionTally` alongside the field
tallies. `diff-corpus.ts` aggregates it and prints it.

`formatFormulaTree` in `workbook-parser.ts` is the parser's inverse, needed
because expansion happens on the tree while the dump prints text. All 22 748
committed corpus token strings round-trip through it byte for byte, which is
what makes Oracle's notation — `()` on a zero-argument call included — a
measurement rather than an assumption.

### The gate in CI

The D-059 partition runs in CI two ways, both on the migrate job:

- `npm test -w @discoverer-neo/core` — five assertions in
  `formula-corpus-agreement.test.ts`: every row in exactly one bucket, the sums,
  `FAILED = 0` as an equality, cross-agreement with the independently measured
  rates, and a per-bucket ratchet against `agreement-baseline.json`.
- `npm run render-corpus -w @discoverer-neo/core` — a named CI step so the
  histogram lands in the log where a person can read it. It exits non-zero on a
  non-empty `FAILED` bucket or a partition that stops summing.

A hand-made two-row regression proves the gate bites: a row whose rendering
contradicts an intact reference lands in `FAILED`, not in the unverifiable
bucket. That is the case that matters — it means a tree was read wrongly and
something already migrated may be a wrong number.

**Why not `diff-corpus.ts`, as the brief asked.** It needs a live Oracle source
and uncommitted customer dumps, so it can never run in CI — the same reason
recorded in the Phase 1.3 amendment to D-059. It was extended anyway, for the
expansion work above; the *gate* lives where CI can reach it.

### BE-09 closed

Three files carried their own set of Oracle function names and had drifted:

| | Was | Now |
| --- | --- | --- |
| `calculated-field-evaluator.ts` | own `AGGREGATE_FUNCTIONS` (with `STDDEV`, `VARIANCE`, `MEDIAN`) and own `SCALAR_FUNCTIONS` (without `NEXT_DAY`) | imports both from `@discoverer-neo/core/semantics` |
| `query-plan.ts` | own `UNREAGGREGATABLE`, differing in three names including both spellings of `COUNT DISTINCT` | re-exports `UNREAGGREGABLE_FUNCTIONS` |
| `formula-parser.ts` | already converged at Phase 4.2 | unchanged |

Two things had to move for the single list to be honest rather than nominal:

- `UNREAGGREGABLE_FUNCTIONS` widened to the planner's fuller set — both
  spellings of `COUNT DISTINCT`, plus `VAR` and `MEDIAN`. The safe direction:
  more refusals, not fewer. Inert for the renderer, which checks it only after
  `AGGREGATE_FUNCTIONS` membership, and no built-in code maps to those names.
- **`NEXT_DAY` is now implemented in the evaluator.** It was in the canonical
  scalar list and not in the evaluator's, so sharing the list would have let the
  parser admit a name `apply` could not compute — reaching the "unreachable"
  branch at runtime, in a user's report. Oracle semantics: strictly *after* the
  date, so `NEXT_DAY` of a Monday asking for Monday is the following week.
  English day names only; an unrecognised name is refused, because this
  evaluator has no `NLS_DATE_LANGUAGE` to resolve one against.

The evaluator's aggregate rejection now tests the union of `AGGREGATE_FUNCTIONS`
and `UNREAGGREGABLE_FUNCTIONS`, which preserves the exact message for every name
it used to catch without restating one of them.

Two tests hold it: `allowlist-single-definition.test.ts` (no `*_FUNCTIONS` set
may be declared in the backend, and every consumer must import from core) and a
functional one that calls **every** name in the canonical scalar list and
requires it to compute. The second is the real guard — a re-copied list that
drifts fails there, not just in a grep.

The name-based check is deliberate. A shape-based scan for "a set of all-caps
strings" cannot tell an allowlist copy from a legitimate subset with different
semantics — `NULL_TOLERANT` lists seven function names to answer which accept a
NULL argument — and a guard that fires on both gets turned off.

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| The 2 536 known WB-04 chains resolve | **Mechanism landed; count not measurable here.** The differ expands before comparing, proven on a fixture. `d4dumps/` is empty on this machine, so the 2 536 cannot be re-counted |
| Cycles quarantine with a stated reason; no overflow | done — `CALCULATION_CYCLE`, chain named |
| Expansion depth bounded and the observed maximum reported | done — bound 16, reported per differ run |
| The four-bucket partition runs in CI, fails on regression | done — test assertions plus a named CI step |
| `FAILED = 0` asserted in CI | done — as an equality, not a ceiling |
| The differ reports are regenerated, not the stale checked-in ones | **the corpus report is regenerated** (above). There are no checked-in differ reports on this machine to be stale, and none can be produced without the dumps |
| `formula-parser.ts` and `calculated-field-evaluator.ts` share one allowlist | done — BE-09 closed, and `query-plan.ts` with them |

## What was deliberately not done

- **Compiling the stored 49 819 formulas.** Phase 4.5, and out of scope here.
- **Conditions referencing calculated fields.** A schema change, Phase 5.3.
- **Widening `AGGREGATE_FUNCTIONS` to admit `STDDEV`/`VARIANCE`/`MEDIAN` into
  emitted SQL.** They are refused, not emitted. Adding a function to a security
  allowlist without an attested need in the corpus is the speculative widening
  D-058 exists to prevent; the convergence did not require it.
