# PHASE 4.2 — The top-10 renderer

**Model:** Opus · **Effort:** max

## Purpose

Render 93.5 % of the estate's formulas to SQL, exactly.

## Scope

Implement a renderer for the **10 `[1,n]` codes covering 93.5 %** of 276 300 uses:

| Code | Uses | Cumulative |
| ---- | ---- | ---------- |
| `[1,102]` | 61 941 | 22 % |
| `[1,95]` | 48 358 | 40 % |
| `[1,12]` | 38 994 | 54 % |
| `[1,115]` | 35 302 | 66 % |
| `[1,96]` | 21 388 | 74 % |
| `[1,94]` (`+`) | 15 278 | 80 % |
| `[1,61]` | 12 921 | 84 % |
| `[1,58]` | 12 199 | 89 % |
| `[1,68]` | 7 938 | 92 % |
| `[1,55]` (`TO_CHAR`) | 4 063 | **93.5 %** |

Plus `[6,n]` and `[8,n]` resolution through the workbook element table, and `[5,1]` / `[5,2]`
literals.

## Three binding design decisions

### 1. Render the token tree DIRECTLY to SQL (D-050)

**Do not re-parse `DisplayFormula` as an intermediate form.** It is Discoverer's *display*
language and it is **ambiguous** — a real corpus line reads:

```
NVL(R Com Tx Com Vig/100,0)
```

`R Com Tx Com Vig` is a bare item name **containing spaces**, immediately followed by `/`.
Nothing can disambiguate that reliably. Use `DisplayFormula` **only as the fidelity oracle.**

### 2. Parenthesise every infix node UNCONDITIONALLY (D-051)

`((a) + (b))`. **This removes the operator-precedence problem entirely** — the ~199-code
precedence table the audit scoped is not needed at all. Only *name*, *arity* and *fixity*
matter.

Cost: uglier generated SQL. **Correct trade for a system whose failure mode is silently wrong
numbers.**

### 3. Emit into the EXISTING AST and allowlist (D-054)

`backend/src/lib/sql/formula-parser.ts` holds the validated invariants: an allowlist, no string
splicing, identifiers validated and quoted from metadata, every runtime value a bind.
**`ParsedFormula` is `{sql, containsAggregate, referencedItems}` (`:235`) and
`containsAggregate` is load-bearing for the Phase 3 planner.**

The renderer lives in `migrate/src/semantics/`, exported from `@discoverer-neo/core`.
**No new npm workspace** (D-011).

## Prerequisites

Phase 4.1 — the fixture and the 56-code table.

## Required files to read first

- `docs/master-plan/research/formula-decoder-spec.md` — Phase 4.1's deliverable
- `docs/master-plan/research/formula-decoder-analysis.md` §4, §6
- `docs/master-plan/DECISION_REGISTER.md` D-050, D-051, D-054, D-058
- `backend/src/lib/sql/formula-parser.ts` — **the target AST**
- `backend/src/services/calculated-field-evaluator.ts` — the second AST consumer
- `migrate/src/services/workbook-parser.ts:1086-1185` — the token tree it consumes

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` (corpus comparison), `typescript-lsp`, `code-review` **or**
`coderabbit` on the diff.

## Implementation instructions

- Consume the existing `ConditionNode` tree. **Do not write a second parser.**
- Resolve `[6,n]` / `[8,n]` through the workbook element table to real item ids, then to
  validated identifiers and bind variables.
- Any `[1,n]` outside the implemented 10 ⇒ **quarantine with a stated reason**, never a
  best-effort render.
- Any node the parser typed `unknown` ⇒ quarantine.
- The comparison harness: render each fixture entry, compare to its `DisplayFormula`, and
  report exact / mismatch / quarantined.

## Tests

- One unit test per implemented code, from the fixture
- **A corpus test asserting ≥ 93 % exact match against `DisplayFormula`**
- Fully-parenthesised output for every infix node
- An unimplemented code quarantines rather than renders
- Identifiers containing quotes are **rejected, not escaped**
- `containsAggregate` is set correctly — the Phase 3 planner depends on it

## Security checks

- **Every identifier goes through the existing validation and is rejected, not escaped.**
- **Every runtime value is a bind variable.** No string splicing, ever.
- The allowlist is shared with `formula-parser.ts` — do not fork it. Two drifted allowlists is
  BE-09, the defect this phase exists partly to close.

## Validation

```bash
cd discoverer-neo && npm run typecheck --workspaces && npm test --workspace migrate
```

Then the corpus comparison, reporting the exact-match percentage.

## Acceptance criteria

- [ ] **≥ 93 % of the aligned corpus renders exactly equal to `DisplayFormula`**
- [ ] Every infix node is fully parenthesised
- [ ] Unimplemented codes quarantine with a reason; none renders best-effort
- [ ] Output emits into the existing AST and shares the existing allowlist
- [ ] Identifiers are validated; values are binds
- [ ] `containsAggregate` is correct
- [ ] The renderer lives in `migrate/src/semantics/` with no new workspace

## Documentation updates

- `docs/developer-guide/architecture.md` — where the renderer lives and why it parenthesises
- `docs/decisions/eul-fidelity-decisions.md` — the direct-render decision and its reason

## Git checkpoint

Renderer skeleton; the 10 codes; the comparison harness; tests. Push after each.

## Handover artefacts

- **The exact-match percentage.** Phase 4.3 must raise it to ≥ 99 %.
- The quarantine reason histogram.

## Explicitly out of scope

- The remaining 46 codes, `[2,n]`, `[5,4]`. Phase 4.3.
- Calculation-reference expansion. Phase 4.4.
- Compiling the stored estate. Phase 4.5.
- Any precedence table — **it is not needed.**

## Resume instructions

Read the checkpoint, run the corpus comparison. If it reports ≥ 93 % exact, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. One code at a time, highest frequency first. **The percentage climbs visibly** — that is
   your progress signal.
2. **No specialist agents.**
3. Use `context-mode` for every corpus run.
4. Checkpoint the percentage after each code lands.
5. Commit coherently.
6. Leave typecheck and the migrate suite green.
7. If interrupted, record which codes are implemented and the current percentage.
