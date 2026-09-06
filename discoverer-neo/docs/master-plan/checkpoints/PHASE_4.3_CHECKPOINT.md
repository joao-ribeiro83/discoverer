# Phase 4.3 — the tail, custom functions and date literals

**Status:** complete. Gates cleared.

## The numbers

Measured with `npm run render-corpus -w @discoverer-neo/core` over
`migrate/corpus/formula-corpus.tsv` — 22 748 distinct rows, 37 971 occurrences.

| | weighted | distinct |
| --- | ---: | ---: |
| exact | 36 342 · **95.71 %** | 21 760 · **95.66 %** |
| mismatch | 1 487 · 3.92 % | 912 · 4.01 % |
| quarantined | 142 · 0.37 % | 76 · 0.33 % |
| — of which anonymiser damage | 1 487 · 3.92 % | 912 · 4.01 % |
| — **UNEXPLAINED** | **0** | **0** |
| threw (`FAILED`) | 0 | 0 |

**Clean subset**, damaged rows excluded — the denominator the gate is stated
against:

| | weighted | distinct |
| --- | ---: | ---: |
| exact | 36 342 / 36 484 · **99.61 %** | 21 760 / 21 836 · **99.65 %** |

Quarantine histogram: `UNFITTED_CODE` 142 occurrences (76 rows). Nothing else.
`CODE_NOT_IMPLEMENTED` retired with no population; so did
`DATE_LITERAL_NOT_IMPLEMENTED`.

### Why the gate is stated against the clean subset

The brief asks for `>= 99 %` against all 37 971 aligned pairs, and that
denominator cannot reach it. Phase 0.5's anonymiser destroyed 912 rows outright
(decoder spec §11.1): a private filter's `Name` is frequently its own
`DisplayFormula`, so whole display strings were registered as single
identifiers and replaced wholesale, taking Oracle's keywords with them. A
destroyed row can never match whatever the renderer does. The spec's own
instruction is *"either state the gates against the clean subset, or rebuild
the corpus"*, and rebuilding needs `d4dumps/`, which is not on this machine.

The exclusion is kept honest by one assertion, and it is an equality rather
than a ceiling: **`weightedMismatchedUnexplained = 0`**. Every mismatch across
the full corpus is one the damage classifier can account for. If the classifier
were absorbing renderer defects to flatter the clean rate, that is where it
would break. The raw rates stay in `agreement-baseline.json` and stay
ratcheted beside the clean ones.

## What landed

### The 21 remaining `FITTED` codes

Batch A, above 100 uses: `BETWEEN`, `IN`, `AND`, `SYSDATE`, `TRUNC` `[1,18]`,
`ROUND`, `ADD_MONTHS`, `OR`, `||`. Took weighted exact from 93.19 % to 95.03 %.

Batch B, the rest: `ABS`, `MONTHS_BETWEEN`, `<>`, `LAST_DAY`, `REPLACE`,
`COUNT`, unary `-`, `2_Pass_Percentage`, `NOT IN`, `LPAD`, `SUBSTR`,
`COUNT_DISTINCT`. Took it to 95.71 %, and clean to 99.61 %.

All 42 codes Phase 4.1 settled are now implemented. Two are deliberately half
implemented — they render and refuse to compile:

- `[1,117]` `COUNT_DISTINCT` → `UNREAGGREGABLE`. It means `COUNT(DISTINCT a)`,
  which the fan-trap planner cannot re-aggregate (spec §10). The emission is
  written out anyway so lifting the restriction is one edit, not a fresh guess.
- `[1,126]` `2_Pass_Percentage` → `UNKNOWN_SEMANTICS`, a new reason. It
  displays as its argument alone, so what it computes is not in the evidence
  and never will be from this corpus.

`[1,91]` `NOT IN` carries a caveat. The fitter hard-codes `' IN ('` for its
`inList` shape and ignores the code's name, so `[1,91]` "fits" only because the
strict placeholder swallows the word `NOT` — `Xkzoub Krwa NOT` is a legal
identifier under that class. The rendering is not in doubt: the attested row
reads `Xkzoub Krwa NOT IN ('M','A')`. This renderer writes the code's own name,
which is what the corpus shows rather than what the fitter's regex accepted.

### `[2,n]` custom functions

D-057's gap is closed. A `[2,n]` resolves through the workbook element table to
a migrated `custom_functions` row and renders a call; anything short of that
quarantines. Four gates, all refusing rather than repairing:

1. resolves → else `UNRESOLVED_FUNCTION`
2. name passes the same identifier predicate a column does → else
   `INVALID_IDENTIFIER`, rejected and never escaped or quoted into safety
3. arity matches any signature the row carries → else `BAD_ARITY`
4. arguments go through the ordinary emitter, so every literal inside a call is
   still a bind

The built-in allowlist is untouched and unforked — a registered function is a
separate path and cannot become a way to call what the allowlist refuses.
A hostile `custom_functions.name` is refused, with a test.

Two limits stated rather than papered over:

- The aligned corpus attests **zero** `[2,n]` occurrences (spec §9), so
  `NAME(args)` is Oracle's SQL form read back, not a fitted display shape. It
  stays `[INFER]`.
- `transformCustomFunction` writes `parameters: null` for every row and raises
  `FUNCTION_SIGNATURE_DEFAULTED`, because the EUL's normalized `FUNCTIONS` read
  carries no argument list. **So the arity gate is enforced and today has
  nothing to bite on.** Refusing every call for want of a signature would make
  all 593 migrated functions permanently uncallable, which is not what a
  missing column means.

### `[5,4]` date literals — the verdict

**Derived, not quarantined.** The display encoding was already settled at
Phase 4.1 by the same fitting method as a shape: `yy.mm.dd` reproduces 846
date-bearing rows against 184 for `dd.mm.yy`, 35 for `mm.dd.yy` and 0 for every
other candidate. So this stage owed only the SQL side.

`[5,4,"20011201000000"]` now compiles to `TO_DATE(:v1, 'YYYYMMDD')` with
`:v1 = '20011201'`. The mask is a constant in the renderer, never taken from
the data; the date is still a bind. Emitting the display form
`TO_DATE('01.12.01')` would have made the century depend on `NLS_DATE_FORMAT`.

The trailing six digits are dropped only because they are proven zero: a
non-midnight payload still refuses `DATE_WITH_TIME` rather than truncating. A
14-digit mask could have carried the time, but the year, month and day
positions are fitted and the time positions are not — not one of the estate's
7 670 date literals exercises them — and an unattested reading of six digits is
the guess this phase exists to refuse.

### Three measurement fixes the tail exposed

Rendering `AND` and multi-literal rows showed the measurement, not the
renderer, was the weaker half. Each fix is attested:

1. **`isAnonymiserDamage` had neither order nor multiplicity.** It tested
   `display.includes(x)`. A row rendering `= 100 AND = 1` against a display
   whose second literal was rewritten to `5` still "contains" `1`, because
   `100` does; a row rendering six `AND`s against a display carrying four still
   "contains" `AND`. It now walks the anchors the renderer itself wrote and
   requires them in the same order.
2. **A double-quoted name may contain brackets.** `:"Prazo Restante (M/A)"` is
   a real parameter name. The bare strict placeholder class forbids brackets,
   so nineteen otherwise-clean rows read as renderer defects. A quoted branch
   is safe where a widened strict class would not be: the closing quote bounds
   the span.
3. **Discoverer brackets a whole condition when it shows it** — `( a OR b )`.
   Phase 4.1 established that as a property of the root position and kept it
   out of every code's shape; the comparator has to know it too.

`UNEXPLAINED` went 12 → 90 → 0 across these.

## What is still refused, and why

`UNFITTED_CODE`, 142 occurrences (0.37 % weighted), 14 codes:

| Codes | Uses | State |
| --- | ---: | --- |
| `[1,162]/[1,163]/[1,164]` `CASE`/`WHEN`/`ELSE` | 342 | `UNTESTED` — they block each other |
| `[1,89]` `IS NULL` | 41 | `AMBIGUOUS` — 4 clean rows attest `postfixSpaced`, 14 are casualties, and the degenerate `passthrough` also covers them |
| `[1,35]` `UPPER`, `[1,90]` `IS NOT NULL`, `[1,140]` | 63 | `UNTESTED` |
| `[1,137]/[1,138]/[1,139]/[1,189]/[1,192]` analytics | 39 | `UNTESTED` — one workbook pattern, spacing under-determined |
| `[1,64]` `GREATEST` | 0 | `UNATTESTED` — occurs only in an `IOFormula` with no `DisplayFormula` |

(Uses are over all 547 dumps; the 142 is what reaches the aligned corpus.)

**These were not implemented, and that is a decision, not an omission.** The
phase brief's rule is "implement from Phase 4.1's attested table; mark any
unattested code refuse-only". The decoder spec §11.3 suggests a different
route — widen the evidence rule to fit a *pair* of unknown codes jointly, which
would probably settle `CASE`/`WHEN`/`ELSE`. That was not done, because the gate
clears without it and asserting a shape is the failure mode this whole phase is
built to avoid. It remains the cheapest win available, and it is the honest way
to close the last 0.37 %.

## Files

| Path | What changed |
| --- | --- |
| `migrate/src/semantics/builtin-codes.ts` | 21 codes added; `PHASE_4_3_BATCH_A`/`_B`/`_CODES`; 4 display shapes, 5 SQL forms |
| `migrate/src/semantics/render.ts` | new shapes and forms; `customFunction`; `[5,4]` SQL; `FunctionBinding`; widened `NAME_PATTERN`; `rootUnwrapped` |
| `migrate/src/services/formula-corpus-agreement.ts` | ordered-anchor damage detector; clean-subset rates on `RenderReport` |
| `migrate/src/scripts/render-corpus.ts` | prints the clean subset beside the raw |
| `migrate/corpus/agreement-baseline.json` | raised to 95.71/95.66 raw, 99.61/99.65 clean; `cleanPhaseGate: 99` |
| `migrate/src/__tests__/formula-renderer.test.ts` | 84 tests — one fidelity case per implemented code, the `[2,n]` contract, the Phase 4.3 SQL forms |
| `migrate/src/__tests__/formula-corpus-agreement.test.ts` | the clean-subset gate, `UNEXPLAINED = 0` as an equality, `FAILED = 0` |
| `docs/admin-guide/custom-functions.md` | the migrated-formula path and what is checked |
| `docs/troubleshooting/formula-refusals.md` | new — the eleven quarantine reasons |

## Validation

```
npm run typecheck --workspaces     # clean
npm test --workspace migrate       # 634/634, 19 suites
npm test -w backend                # 1248/1248, 55 suites
npm run render-corpus -w @discoverer-neo/core
```

## Out of scope, as the brief states

Calculation-reference expansion (4.4), the CI gate (4.4), compiling the stored
estate (4.5). `renderSql` still has no production caller — wiring it into the
compile path is 4.5's job, which is why this stage delivers the resolution
contract rather than the lookup.
