# Phase 4.2 checkpoint — the top-10 renderer

**Status: complete. The gate is cleared on both denominators — 93.19 % weighted,
93.55 % distinct — and nothing in the estate renders wrongly that the corpus
itself did not destroy.**

The brief's headline number does not survive contact with the corpus, and that
is the first thing a reader needs. It is not a defect in the brief; it is two
denominators being read as one. §1 says exactly what happened and what was done
about it.

---

## 1. The brief's 93.5 % and the gate's 93 % are different numbers

The brief picks ten codes said to cover **93.5 % of 276 300 uses**, then sets an
acceptance gate of **≥ 93 % of 37 971 aligned pairs**. Both figures are correct.
They do not meet:

| | denominator | counts |
| --- | --- | --- |
| the brief's 93.5 % | 276 300 | *built-in node uses*, across all 547 whole dumps |
| the gate's 93 % | 37 971 | *whole formulas*, in the aligned corpus |

A node-use figure and a whole-formula figure diverge because **a formula renders
only when every code in it is implemented**. Ten codes covering 93.5 % of nodes
cover far less than 93.5 % of formulas, because the formulas they nearly cover
still contain an eleventh code.

Measured, on the committed corpus:

| code set | weighted | distinct |
| --- | ---: | ---: |
| the ten named | 82.83 % | 85.85 % |
| **as shipped: 20 codes** | **95.69 %** | **96.12 %** |
| all 42 FITTED codes (Phase 4.3's ceiling) | 99.63 % | 99.67 % |

Coverage is what the renderer *attempts*. Exact match is what survives the
corpus's own damage: **93.19 % weighted, 93.55 % distinct**, which is the gate.

**A second finding, and a larger one.** A plain `===` comparison against
`DisplayFormula` caps at **4.60 % weighted, whatever the renderer does.** 99.77 %
of corpus rows contain an item or parameter reference, and the anonymised corpus
(D-114) carries no workbook element table — there is no name to render. So the
comparison had to change, not the target. §3 states exactly what "exact" now
means and what it still guarantees.

---

## 2. What shipped: 20 codes, not 10, and why

`migrate/src/semantics/builtin-codes.ts` carries two lists, kept apart so the
delta stays visible and reversible.

**`PHASE_4_2_TOP_TEN`** — the brief's ten, verbatim:
`[1,102]` DECODE, `[1,95]` `-`, `[1,12]` SIGN, `[1,115]` NULL, `[1,96]` `*`,
`[1,94]` `+`, `[1,61]` TO_NUMBER, `[1,58]` TO_DATE, `[1,68]` NVL, `[1,55]` TO_CHAR.

**`PHASE_4_2_GATE_CLOSERS`** — ten more, each chosen by measurement rather than
taste. Greedily: each is the code that buys the most weighted coverage given the
ones before it. Running total, weighted coverage:

| added | name | coverage |
| --- | --- | ---: |
| `[1,49]` | TRUNC | 85.47 % |
| `[1,1]` | SUM | 87.51 % |
| `[1,81]` | `=` | 89.45 % |
| `[1,87]` | LIKE | 91.24 % |
| `[1,106]` | `( )` | 92.67 % |
| `[1,97]` | `/` | 93.83 % |
| `[1,85]` `[1,86]` `[1,83]` `[1,84]` `[1,104]` | `<= >= > < !=` | 95.69 % |

The last row is the comparison-operator family. It went in as a unit, not
piecemeal: `=` and `LIKE` alone left `<=` and `>=` refusing, which is an
arbitrary cut through one concept and a trap for the next reader. All five are
`infixSpaced`, so they cost data rows and no new machinery.

**`[1,82]` `<>` is deliberately absent** although it is FITTED and its family
shipped. All eleven corpus rows using it are either anonymiser casualties or
blocked by `[1,98]` `AND`, so it has **no clean attestation to test against**,
and implementing it buys exactly zero exact matches — verified by measuring with
and without it. An implemented code with no evidence behind it is the guess this
phase exists to refuse.

Everything else — the remaining 22 FITTED codes, all 14 non-FITTED ones, `[2,n]`
and `[5,4]` in SQL — refuses with a stated reason. Phase 4.3's scope is intact.

---

## 3. What "exact" means here, and what it still guarantees

`displayMatches` (`migrate/src/semantics/render.ts`) compares byte for byte
**outside item and parameter name spans**, which the corpus cannot supply, and
unifies those spans with a back-reference.

This is the Phase 4.1 fitter's own machinery, and its constraints are load
bearing, not cosmetic:

- A name may not contain a bracket or a comma, so a placeholder cannot swallow
  structure and make a wrong shape "match".
- A name may not open or close on a space — the only thing separating `a<b` from
  `a < b`.
- **A name used twice in one formula must unify to the same text.** A reading
  that renders one element two different ways cannot pass. There is a test for
  precisely this.

So every operator, every function name, every literal, every bracket and every
space is still compared exactly. Only the anonymised names are not, and those
were destroyed by design.

---

## 4. The measurement

`npm run render-corpus -w @discoverer-neo/core`, over all 22 748 rows /
37 971 occurrences. Not sampled.

```
                       weighted            distinct
exact                 35385   93.19%     21281   93.55%
mismatch                949    2.50%       584    2.57%
quarantined            1637    4.31%       883    3.88%
  of which damaged      937    2.47%       574    2.52%
  UNEXPLAINED            12    0.03%        10    0.04%

threw (a bug):     0
```

### The quarantine histogram — the handover artefact

| reason | occurrences | share | rows |
| --- | ---: | ---: | ---: |
| `CODE_NOT_IMPLEMENTED` | 1 547 | 4.07 % | 836 |
| `UNFITTED_CODE` | 90 | 0.24 % | 47 |

Nothing else fires on this corpus. `UNRESOLVED_ELEMENT`, `UNRESOLVED_FUNCTION`,
`DATE_WITH_TIME`, `BAD_ARITY`, `INVALID_IDENTIFIER`, `NOT_IN_ALLOWLIST`,
`UNREAGGREGABLE` and `PARSE_FAILED` are all implemented and tested, and none of
them is reachable from a corpus row: the display path resolves no elements, and
Phase 4.1 already established zero parse failures and zero unknown nodes.

`CODE_NOT_IMPLEMENTED` is Phase 4.3's whole worklist, and it is one edit to
`builtin-codes.ts` per code. `UNFITTED_CODE` is not: those 90 occurrences need
the evidence rule widened (spec §11.3) or the corpus rebuilt.

### The number that actually matters: 12

**Unexplained mismatches: 12 occurrences over 10 distinct rows — 0.03 %.**

A quarantine is a gap a later phase closes. An unexplained mismatch means the
tree was read wrongly, and a formula the migrator already wrote may be a wrong
number in a real report. So the two are counted separately and never added.

All twelve are the comparator's strictness rather than the renderer's reading.
The renderer's structure is right in every one; the name span simply cannot
match, because these anonymised names contain brackets:

```
io       [1,87]([1,68]([6,20],[5,1,"0"]),[8,35])
expected NVL(Eenp Ferkojvkb,'0') LIKE :"Dciagkksqq Ossywidgtek (N/Q)"
actual   NVL(<i20>,'0') LIKE <p35>
```

Loosening the placeholder to admit brackets would clear all twelve and weaken
every other row's evidence at the same time — a placeholder that eats structure
makes wrong shapes match. Not done, on purpose.

### The ceiling, and why 93 % is near it

2.47 % weighted is mismatch the **anonymiser** explains, detected by Phase 4.1's
own two signals: a literal that has vanished from the display, or a word-shaped
built-in name that has. A private filter's `Name` is frequently its own
`DisplayFormula`, so Phase 0.5 replaced whole display strings wholesale and
Oracle's keywords went with them:

```
io       [1,81]([6,18],[5,2,"1522501002"])
expected U Bthpput = 3156233073      -- the literal 1522501002 was overwritten
```

These can never match. **The achievable ceiling on the committed corpus is about
96 %, not 100 %** — which is what makes 4.3's ≥ 99 % gate unreachable without the
one-line fix in decoder spec §11.1 and a corpus rebuild. Phase 4.3 should do that
first; it is cheaper than anything else on its list.

---

## 5. Security

Unchanged in shape from the backend's SQL builder, because it is now literally
the same code.

- **The allowlist is not forked.** `AGGREGATE_FUNCTIONS` and `SCALAR_FUNCTIONS`
  moved to `migrate/src/semantics/allowlist.ts`; `backend/src/lib/sql/formula-parser.ts`
  re-exports them. Two drifting allowlists is defect **BE-09**, and the migrator
  cannot import from the backend, so copying was the only alternative. The
  identifier and bind-name patterns moved the same way. One declaration each,
  the same shape as the 21 shared schema tables.
- **Identifiers are rejected, never escaped.** A resolved column or qualifier
  carrying a quote returns `INVALID_IDENTIFIER`. Quoting it away would hide
  either a metadata defect or an attack.
- **Every runtime value is a bind** — including numeric literals, because a
  `[5,2]` payload is whatever bytes the workbook stored, not a number. No string
  splicing anywhere.
- **`containsAggregate` is read from the tree**, never from the emitted text. A
  text scan would call a column named `SUM_TOTAL` an aggregate and rewrite a
  query that needs no rewriting. There is a test with exactly that column name.

---

## 6. Two things the brief asked for that were not needed

- **No precedence table.** D-051 holds: parenthesising every infix node
  unconditionally removes the problem instead of solving it. Nothing in 20 codes
  wanted one, and nothing in the remaining 36 will either.
- **No subagents, no new workspace.** The renderer is four files under
  `migrate/src/semantics/`, exported as `@discoverer-neo/core/semantics`.

---

## 7. Explicitly not done

Phase 4.3 and 4.4 own these; the brief assigns them and nothing here encroaches.

- The remaining 22 FITTED codes and all 14 non-FITTED ones.
- `[2,n]` custom functions. The aligned corpus attests **zero**, so there is no
  evidence for the rendering; `renderSql` refuses with `UNRESOLVED_FUNCTION`
  rather than inventing `NAME(args)`.
- `[5,4]` date literals **in SQL**. The display side renders them (the
  `yy.mm.dd` shape is fitted, and the fidelity comparison needs it); the SQL side
  refuses `DATE_LITERAL_NOT_IMPLEMENTED`, because emitting `TO_DATE('01.12.01')`
  makes the century depend on `NLS_DATE_FORMAT`. 4.3 emits an explicit mask.
- Recursive calculation-reference expansion, and its cycle detection (4.4).
- The `formula_tokens` column beside `formula` (spec §7). Nothing in 4.2 writes
  a formula to the database, so adding the column here would ship an unused
  migration. It belongs with 4.5, which compiles the stored estate.

---

## 8. Files

| File | What |
| --- | --- |
| `migrate/src/semantics/allowlist.ts` | the single allowlist, moved out of the backend |
| `migrate/src/semantics/identifiers.ts` | the single identifier and bind-name patterns |
| `migrate/src/semantics/builtin-codes.ts` | the 20 implemented codes: display shape, arity, SQL form |
| `migrate/src/semantics/render.ts` | `renderDisplay`, `displayMatches`, `renderSql`, the refusal set |
| `migrate/src/semantics/index.ts` | `@discoverer-neo/core/semantics` |
| `migrate/src/scripts/render-corpus.ts` | `npm run render-corpus` |
| `migrate/src/services/formula-corpus-agreement.ts` | `TOKEN_RENDERER`, `reportRendering`, damage classification |
| `migrate/src/__tests__/formula-renderer.test.ts` | 49 tests: one per code, plus SQL safety |
| `migrate/corpus/agreement-baseline.json` | raised from 0 to 93.55 / 93.19, and now a gate as well as a ratchet |
| `backend/src/lib/sql/formula-parser.ts` | re-exports the allowlist instead of declaring it |
| `backend/src/lib/sql/identifiers.ts` | re-exports `isValidIdentifier`, uses `isValidBindName` |
| `backend/jest.config.js` | maps the `semantics` subpath to source, like the other three |

---

## 9. Resume

```bash
cd discoverer-neo
npm run render-corpus -w @discoverer-neo/core
```

If it reports **≥ 93 %** exact on both denominators, this stage is done. The CI
gate asserts the same thing from `corpus/agreement-baseline.json`, so a
regression fails the build rather than waiting to be noticed.
