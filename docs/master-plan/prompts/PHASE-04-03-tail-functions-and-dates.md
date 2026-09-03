# PHASE 4.3 — The tail, custom functions and date literals

**Model:** Opus · **Effort:** high

## Purpose

Take the renderer from 93.5 % to ≥ 99 % exact, and make the estate's 593 registered PL/SQL
functions **callable**.

## Scope

1. **The remaining 46 `[1,n]` codes.** 20 appear fewer than 50 times; 6 appear ≤ 3 times
   (`[1,192]` and `[1,111]` once each). Implement from Phase 4.1's attested table; mark any
   unattested code refuse-only.
2. **`[2,n]` custom-function resolution** (7 097 uses, ~100 distinct).
3. **`[5,4]` date literals** — 9 062 uses, 5 % of all literals. **The known unknown.**

## What you already know about `[2,n]`

- The ids are **workbook-local `IoId`s, range 17–411** — *not* the 112 777-style EUL ids. The
  dumps prove it: every reference carries `IoId = 16` alongside `Id = 114404`. The EUL id is
  reached **after** the element-table indirection, exactly as `[6,n]` and `[8,n]` already work.
- **593 custom functions migrated exactly** (`custom_functions`), of which **~100 are actually
  referenced**.
- `backend/src/lib/sql/formula-parser.ts` **allowlists only built-ins** — so registered PL/SQL
  functions are migrated but **not callable**. That is the gap this stage closes.

## What you know about `[5,4]`

Nothing beyond its frequency. **Its aligned `DisplayFormula` shows Oracle's own rendering** —
extract every `[5,4,"…"]` payload with its rendering and derive the encoding from the pairs.
**If it cannot be derived, quarantine it with a stated reason. Do not guess a date format.**

## Prerequisites

Phase 4.2 — the renderer at ≥ 93 %.

## Required files to read first

- `docs/master-plan/research/formula-decoder-spec.md` — Phase 4.1's deliverable
- `docs/master-plan/research/formula-decoder-analysis.md` §2, §6
- `docs/master-plan/DECISION_REGISTER.md` D-057, D-058
- `backend/src/lib/sql/formula-parser.ts` — the allowlist
- `backend/src/services/custom-function.service.ts`
- `backend/src/scripts/dump-eul-functions.ts`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode`, `typescript-lsp`.

## Implementation instructions

- Work the 46 codes **in descending frequency** — the percentage is the progress signal.
- Custom-function calls need a **separate allowlist path** from built-ins: a `[2,n]` is valid
  only if it resolves to a migrated `custom_functions` row. **Resolution failure is a
  quarantine, not a passthrough.**
- The emitted call must use a **validated identifier** for the function name — same rejection
  rule as column identifiers. **Never splice the name from source data into SQL text.**
- Check whether each referenced function's **arity** matches `custom_functions`; a mismatch is
  a quarantine.

## Tests

- A unit test per implemented tail code
- **A corpus test asserting ≥ 99 % exact match**
- **A corpus test asserting `FAILED = 0`** — every formula compiles or quarantines with a
  reason; an unhandled path is a bug, not a data problem
- A `[2,n]` resolving to a real `custom_functions` row renders a call
- A `[2,n]` with no matching row **quarantines**
- A function name containing a quote is **rejected**
- `[5,4]` renders correctly, or quarantines with a stated reason

## Security checks

- **Custom functions are the largest new SQL surface in this phase.** The function name must be
  a validated identifier, rejected on quotes, and the argument list must be rendered through
  the same bind-variable discipline as everything else.
- Confirm a malicious `custom_functions.name` cannot escape into SQL — add a test with a
  hostile name.
- Confirm the built-in allowlist is unchanged and unforked.

## Validation

```bash
cd discoverer-neo && npm run typecheck --workspaces && npm test --workspace migrate
```

Plus the corpus comparison, reporting the exact-match percentage and the bucket counts.

## Acceptance criteria

- [ ] **≥ 99 % exact match against `DisplayFormula`**
- [ ] **`FAILED = 0`**
- [ ] Registered PL/SQL functions are callable, with a validated identifier and no splicing
- [ ] An unresolvable or arity-mismatched `[2,n]` quarantines
- [ ] A hostile function name is rejected, with a test proving it
- [ ] `[5,4]` renders or quarantines with a stated reason — **never a guessed format**
- [ ] Unattested codes are refuse-only, not inferred

## Documentation updates

- `docs/admin-guide/custom-functions.md` — that registered functions are now callable in
  formulas, and the validation applied
- `docs/troubleshooting/` — the quarantine reasons

## Git checkpoint

The 46 codes (in frequency batches); `[2,n]`; `[5,4]`; tests. Push after each.

## Handover artefacts

- The final exact-match percentage and the bucket histogram
- The `[5,4]` verdict — encoding derived, or quarantined with the reason

## Explicitly out of scope

- Calculation-reference expansion. Phase 4.4.
- The CI gate. Phase 4.4.
- Compiling the stored estate. Phase 4.5.

## Resume instructions

Read the checkpoint, run the corpus comparison. If ≥ 99 % and `FAILED = 0`, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Tail codes in frequency batches, then `[2,n]`, then `[5,4]`. Commit each batch.
2. **No specialist agents.**
3. Use `context-mode` for every corpus run.
4. Checkpoint the percentage after each batch.
5. Commit coherently.
6. Leave typecheck and the migrate suite green.
7. If interrupted, record the percentage, which codes remain, and the `[5,4]` status.
