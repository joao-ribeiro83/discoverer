# PHASE 4.1 — Corpus fixture, code fitting and the decoder spec

**Model:** Opus · **Effort:** max

## Purpose

Turn the token-formula problem from research into fitting, and write the specification the
rest of Phase 4 builds from.

> **The reference rendering already exists in this repository.** Oracle's `d4wkdmp.exe` dumps
> carry **`DisplayFormula` — 37 971 instances across 547 dumps, paired 1:1 with the raw
> `IOFormula` token string.** Fixity, arity, argument order, parenthesisation and literal
> formatting are all **directly observable**. Nothing has to be guessed.
>
> **Correction to the audit:** `AUDIT_MIGRATION_ASSESSMENT.md` §10 proposes diffing a renderer
> against `IOFormula`. **`IOFormula` is the raw token string** — diffing against it proves
> round-tripping, not correctness. As a renderer oracle it is worthless. **`DisplayFormula` is
> the oracle.**

## Scope

1. Extract the **aligned `(IOFormula, DisplayFormula)` pairs** from the 547 dumps in
   `E:\claude\discoverer\d4dumps\` into a **checked-in fixture**.
2. **Derive** name, arity and fixity for the **56** `[1,n]` codes actually used — from that
   evidence, not from guesswork.
3. Classify the **7 371** `IOFormula` entries that have no `DisplayFormula` — conditions,
   empties, or a gap.
4. Settle the **dump character encoding**. `PR�MIO` appears in `DisplayFormula`; on a
   Portuguese estate this is load-bearing for exact-match comparison.
5. **Write `docs/master-plan/research/formula-decoder-spec.md`** — the implementation
   specification (D-004).

## What is already established — do not re-derive

- **The lexer and parser are DONE.** `workbook-parser.ts:1086-1185` (`parseConditionTree`) is a
  complete recursive-descent reader. **The calculation and condition token languages are one
  language.** Only the renderer is missing.
- **The grammar:** `node ::= '[' field {',' field} ']' ['(' [node {',' node}] ')']`,
  `field ::= integer | '"' string '"'`.
- **Exactly five namespaces**, matching the parser's switch with no missing case:
  `[1,n]` built-in (276 300 uses) · `[5,k,"…"]` literal (182 051) · `[6,n]` item (168 304) ·
  `[2,n]` custom function (7 097) · `[8,n]` parameter (4 861).
- **Three literal kinds:** `[5,2]` number (144 513) · `[5,1]` string/format (28 476) ·
  **`[5,4]` date (9 062 — the known unknown)**.
- **The `[1,n]` distribution is extreme:** 10 codes cover **93.5 %**; 20 codes appear fewer
  than 50 times; 6 appear ≤ 3 times.
- Known already: `[1,94]` is `+`, `[1,106]` is a bracket, `[1,55]` is `TO_CHAR`, `[1,115]` is
  zero-arg, `[1,61]` is 1-arity.
- **`[2,n]` ids are workbook-local `IoId`s (range 17–411)**, not the 112 777-style EUL ids —
  those are reached *after* the element-table indirection.

## Prerequisites

Phase 1.3 — the compile-rate bucket baseline.

## Required files to read first

- `docs/master-plan/research/formula-decoder-analysis.md` — **the authoritative brief; read it
  all**
- `docs/master-plan/DECISION_REGISTER.md` D-050 to D-059
- `migrate/src/services/workbook-parser.ts` — `EUL_FUNCTION_NAMES` (`:914`),
  `CONDITION_OPERATOR_TABLE` (`:997`), `parseConditionTree` (`:1086`), `humanizeFormula`
  (`:3059`) and the comment at `:3043`. **Grep and read ranges — 3 179 lines, never whole.**
- `migrate/src/services/d4wkdmp-dump-parser.ts`, `d4wkdmp-differ.ts`, `scripts/diff-corpus.ts`
- Two or three files in `E:\claude\discoverer\d4dumps\`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` — **essential**; the corpus is 547 files and the aggregate
report is ~3 MB.

## Implementation instructions

- **Extend `d4wkdmp-dump-parser.ts` to read `DisplayFormula`** if it does not already — the
  parser exists, do not write a second one.
- The fixture must be **checked in** and small enough to live in git. Store the aligned pairs,
  not the 547 raw dumps.
- **Derive, never guess.** For each of the 56 codes, the fixture gives you: how many arguments
  it takes (`args.length` in the token tree) and how Oracle rendered it. **Fixity falls out of
  comparing the two.** Where the corpus does not attest a code's fixity, mark it
  **refuse-only** — do not infer from the name.
- The 7 371 unmatched entries: align per record, then classify the remainder. Report the
  classification; do not assume.
- Encoding: detect it, record it, and make the fixture store text in a single normalised
  encoding so exact-match comparison is meaningful.

## Tests

- The extractor produces the expected pair count from a known dump
- A round-trip test: every fixture entry parses to a token tree without an `unknown` node, or
  is recorded as one
- The 56-code table is complete and every entry is either attested or marked refuse-only

## Security checks

- The dumps contain **real customer business data** — item names, formulas, values. **Redact
  or minimise** what enters the committed fixture. Prefer structural coverage over volume:
  one attesting example per code beats thousands of rows.
- Do not commit anything from `d4dumps/` wholesale.

## Validation

```bash
cd discoverer-neo && npm test --workspace migrate
```

Plus a count: every one of the 56 codes appears in the fixture at least once.

## Acceptance criteria

- [ ] The aligned fixture is committed and every one of the 56 codes is represented
- [ ] **Every code has an attested arity and fixity, or is explicitly marked refuse-only**
- [ ] **No code is guessed** — this repository has a documented history of fabricated names
      reaching production code
- [ ] The 7 371 unmatched `IOFormula` entries are classified
- [ ] The dump encoding is settled and normalised
- [ ] `docs/master-plan/research/formula-decoder-spec.md` exists and covers the grammar, the
      code space, the target AST, dual storage, calc-reference expansion, custom functions,
      the refusal policy and the corpus harness
- [ ] Customer data in the fixture is minimised

## Documentation updates

- `docs/master-plan/research/formula-decoder-spec.md` — the deliverable
- `migrate/EUL_SCHEMA_GROUND_TRUTH.md` — the token grammar, if not already recorded

## Git checkpoint

Extractor; fixture; the 56-code table; the spec. Push after each.

## Handover artefacts

- The fixture
- **The 56-code table** — Phase 4.2 and 4.3 implement directly from it
- The spec

## Explicitly out of scope

- **Any rendering.** Phase 4.2.
- Custom-function resolution and `[5,4]` date literals. Phase 4.3.
- Calculation-reference expansion. Phase 4.4.
- An operator precedence table — **it is not needed at all**; Phase 4.2 parenthesises
  unconditionally (D-051).

## Resume instructions

Read the checkpoint and check for the fixture and the 56-code table. Resume at the first
unchecked criterion.

## TOKEN-BUDGET SAFE EXECUTION

1. Extractor → fixture → fitting → spec. Commit each.
2. **No specialist agents.** A specialist died on this exact task during planning; the work is
   mechanical extraction plus careful reading, and it belongs in one context with
   `context-mode` doing the heavy lifting.
3. **Never read the 547 dumps or the 3 MB report into context.** Process in the sandbox and
   surface counts.
4. Checkpoint after the 56-code table exists — it is the phase's key artefact.
5. Commit coherently.
6. Leave the migrate suite green.
7. If interrupted, record how many of the 56 codes are attested.

---

## ⟐ CORRECTIONS from the plan review

### Corpus extraction moved to Phase 0.5 (R-04 / F-03)

This stage no longer builds the corpus. **Phase 0.5 does**, because Phase 1.3 also needs it and
consumed it three phases before v1.0 created it — and because the raw dumps cannot be committed
at all:

> `migrate/src/__tests__/d4wkdmp-differ.test.ts:18-19` — *"the real dumps are customer report
> metadata and never committed."* Confirmed: `git ls-files` tracks none, and Phase 0.1a
> gitignores `d4dumps/`.

**D-114** settles it: the corpus is committed **anonymised**, identifiers replaced through a
deterministic, **byte-class-and-length-preserving**, gitignored mapping. That preservation is
deliberate — it keeps this stage's character-encoding question (`PR?MIO`) answerable.

**This stage consumes the committed corpus** and does the fitting: derive name, arity and fixity
for the 56 used codes, classify the unrendered `IOFormula` entries, settle the encoding, and
write the implementation spec (D-004).

### Rename the parser while you are here (A-10 / informational)

The token parser is real and general over the grammar this phase needs — `[1,code]` calls,
`[2,n]` custom functions, `[5,kind]` literals, `[6,n]` items, `[8,n]` parameters
(`workbook-parser.ts:1054-1069`). *"Only the renderer is missing"* is correct.

**But it is named `parseConditionTree` and typed `ConditionNode`.** Rename both. A future reader
grepping for a formula parser will conclude it does not exist — this review did, briefly, before
inspecting the type.

### Context rule (G-02)

**Never read the corpus into context.** Script the fitting in the sandbox; emit the 56-code
table, the counts per code, and a file path. 37 971 pairs will not fit and do not need to.
