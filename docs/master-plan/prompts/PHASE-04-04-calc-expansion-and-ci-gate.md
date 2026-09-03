# PHASE 4.4 — Calculation-reference expansion and the CI gate

**Model:** Opus · **Effort:** high

## Purpose

Resolve calculations that reference other calculations, and make the compile rate a build gate.

## Scope

1. **Recursive calculation-reference expansion, at render time, with cycle detection.**
2. **Wire the four-bucket partition into CI.**
3. Close BE-09 — the two hand-written formula parsers converge on one AST.

## The semantics are known, not open

`migrate/src/services/workbook-parser.ts:3050-3056` records it directly: a `[6,n]` reference is
*"sometimes itself another `0x00dc` calculation — **Oracle's own dump tool recursively
substitutes that calculation's formula** in its place"*, and the parser deliberately does not
walk that chain.

**Therefore WB-04's 2 536 "formula disagreements" are that unwalked chain. They are by design,
not defects.** Expanding recursively, as Oracle does, resolves them.

**At render time, not migration time** (D-056) — so improving the renderer never requires
re-migrating.

## The bucket vocabulary is fixed (D-059)

| Bucket | Meaning |
| ------ | ------- |
| `COMPILED` | rendered to SQL, and where a `DisplayFormula` exists, it **matches** |
| `COMPILED_UNVERIFIED` | rendered, but no reference rendering exists to check it against |
| `QUARANTINED(reason)` | refused with a stated, enumerated reason |
| `FAILED` | **must be zero** — an unhandled path is a bug, not a data problem |

> **A bare percentage is exactly this project's signature failure mode.** Three mechanisms once
> reported success over a dead system. The gate is a partition with reasons, not a number.

## Prerequisites

Phase 4.3 — ≥ 99 % exact, `FAILED = 0`.

## Required files to read first

- `docs/master-plan/research/formula-decoder-analysis.md` §4, §5
- `docs/master-plan/DECISION_REGISTER.md` D-056, D-059
- `migrate/src/services/workbook-parser.ts:3036-3080` — `humanizeFormula` and its docstring
- `migrate/src/scripts/diff-corpus.ts`, `migrate/src/services/d4wkdmp-differ.ts` — **extend
  these; do not build a second harness**
- `backend/src/services/calculated-field-evaluator.ts` — the second AST consumer
- `.github/workflows/ci.yml`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` — essential; the differ report is ~3 MB.

## Implementation instructions

- Expansion needs the worksheet's calculation set keyed by element id, and
  `calculation.itemRefs` in first-use order is already available.
- **Cycle detection must be explicit**: a calculation referencing itself, directly or
  transitively, is a `QUARANTINED(cycle)`, never a stack overflow.
- Bound the depth and report the observed maximum — an unbounded recursion over customer data
  is an availability risk.
- **Extend the existing differ.** It already parses dumps, diffs and aggregates; adding buckets
  is a small change. Building a parallel harness would repeat the mistake this phase closes.
- **The checked-in differ reports are two code generations stale (WB-01). Regenerate before
  quoting any number.**
- BE-09: with one AST, `formula-parser.ts` and `calculated-field-evaluator.ts` must share the
  allowlist rather than keeping two drifted copies. Converge them.

## Tests

- A calculation referencing another expands correctly
- A two-level chain expands correctly
- **A cycle quarantines rather than overflowing**
- The observed maximum depth is reported
- **The 2 536 known WB-04 chains resolve**
- CI fails on a deliberate bucket regression
- The two parsers share one allowlist

## Security checks

- Bound the expansion depth — unbounded recursion over customer-controlled data is a
  denial-of-service vector.
- Expanded formulas must go through the **same** identifier validation and bind discipline as
  unexpanded ones; expansion must not become a splice path.

## Validation

```bash
cd discoverer-neo && npm test --workspace migrate && npm test --workspace backend
npx tsx migrate/src/scripts/diff-corpus.ts   # regenerate; the checked-in report is stale
```

## Acceptance criteria

- [ ] **The 2 536 known WB-04 chains resolve**
- [ ] Cycles quarantine with a stated reason; no overflow
- [ ] Expansion depth is bounded and the observed maximum is reported
- [ ] The four-bucket partition runs in CI and **fails on any regression**
- [ ] `FAILED = 0` is asserted in CI
- [ ] The differ reports are **regenerated**, not the stale checked-in ones
- [ ] `formula-parser.ts` and `calculated-field-evaluator.ts` share one allowlist (BE-09
      closed)

## Documentation updates

- `docs/developer-guide/testing.md` — the bucket vocabulary and the gate
- `docs/decisions/eul-fidelity-decisions.md` — render-time expansion and why

## Git checkpoint

Expansion; cycle detection; the CI gate; the allowlist convergence. Push after each.

## Handover artefacts

- **The regenerated bucket histogram.** Phase 4.5 runs it against the stored estate.
- The observed maximum expansion depth.

## Explicitly out of scope

- Compiling the **stored** 49 819 formulas and feeding readiness. Phase 4.5.
- Conditions referencing calculated fields — that is a **schema** change, Phase 5.3.

## Resume instructions

Read the checkpoint, run the differ, check CI for the bucket job. Resume at the first unchecked
criterion.

## TOKEN-BUDGET SAFE EXECUTION

1. Expansion → cycles → CI gate → allowlist convergence. Commit each.
2. **No specialist agents.**
3. Use `context-mode` for the differ report — never read 3 MB into context.
4. Checkpoint the histogram after each run.
5. Commit coherently.
6. Leave CI green.
7. If interrupted, record whether expansion is committed and whether CI gates on buckets.
