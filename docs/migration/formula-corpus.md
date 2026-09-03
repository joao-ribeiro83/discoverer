# The formula corpus — what it is, how to rebuild it, why it is anonymised

**Artefact:** `discoverer-neo/migrate/corpus/formula-corpus.tsv` (4.8 MB, committed)
**Counts:** `discoverer-neo/migrate/corpus/formula-corpus.meta.json`
**Builder:** `discoverer-neo/migrate/src/scripts/build-formula-corpus.ts`
**Decision:** D-114, option 1 — anonymised corpus. Settled in Phase 0.5.

---

## What it is

Every `(IOFormula, DisplayFormula)` pair Oracle's own `d4wkdmp.exe -f` printed for this
estate. `IOFormula` is the raw token string; `DisplayFormula` is **Oracle's own rendering of
it**. That makes the pair a test oracle for a renderer: render the token string, compare to
Oracle's answer.

Phases 4.1 (code fitting), 4.2 (`>= 93 %` exact) and 4.3 (`>= 99 %` exact, `FAILED = 0`) all
gate on it, and 1.3 runs the `d4wkdmp` differ against it in CI.

| | |
|---|---|
| Source dumps | 547 |
| **Aligned pairs — the gate denominator** | **37 971** |
| Distinct pairs (rows in the TSV) | 22 748 |
| `IOFormula` with no `DisplayFormula` | 7 371 |
| Distinct `[1,n]` built-in codes attested | **55** (of 56 in the dumps) |
| Sampled? | **No.** Nothing was dropped. |

### The file format

Tab-separated, `latin1`, one header line:

```
occurrences<TAB>io_formula<TAB>display_formula
```

`occurrences` is how many times that exact pair appears across the 547 dumps. Identical pairs
are collapsed into one row **with their count**, which is a lossless compaction, not a sample:
sum the `occurrences` column and you get 37 971 back. A percentage gate may be computed either
way — weight by `occurrences` for "% of the estate", or count rows for "% of distinct
formulas" — but **say which one**, because they are different numbers.

---

## Why it is anonymised

`d4dumps/` is customer report metadata and is gitignored (Phase 0.1a). `DisplayFormula` is the
customer's business logic in the customer's own words — item names, custom function names and
string literals are all customer vocabulary.

But what the renderer is fitted against is **structure**: arity, fixity, argument order,
parenthesisation and literal formatting. None of that needs the customer's words. So every
identifier is replaced by a synthetic name and only the *mapping* is secret.

The alternative was a private corpus on a self-hosted runner — reproducible for the team but
not for a fresh clone, and this project has no CI infrastructure to host it.

### What survives, deliberately

- **Byte class and length.** Upper stays upper, lower stays lower, digit stays digit,
  non-ASCII stays non-ASCII, and spaces and punctuation pass through unchanged. A 6-byte name
  with a non-ASCII byte in position 3 stays exactly that — so **Phase 4.1 can still settle the
  dump's character encoding from the committed corpus alone**. (It is cp1252: single-byte,
  `N\xC3O`, `OCORR\xCANCIA`. 827 rows carry a non-ASCII byte.)
- **Token codes and structure.** `[1,n]`, `[2,n]`, `[5,k]`, `[6,n]`, `[8,n]` are untouched.
- **Number and date literals.** `[5,2]` and `[5,4]` payloads are verbatim: `[5,4]` is the date
  literal 4.1 must settle, and its rendering (`[5,4,"20011201000000"]` -> `TO_DATE('01.12.01')`)
  is only visible if the digits survive.
- **Oracle's format masks and function names.** `YYYY`, `DD-MON-RRRR`,
  `NLS_NUMERIC_CHARACTERS = '.,'` and everything in `EUL_FUNCTION_NAMES` are Oracle's
  vocabulary, not the customer's, and they are the fitting target.
- **Global stability.** The map is keyed by the identifier text, not by the workbook, so the
  same item has the same synthetic name in every dump. Calculation-reference chains (D-056,
  WB-04) still resolve, which is what makes Phase 4.4's gate meaningful.

### What is replaced

Item, folder, parameter, custom-function and private-item/filter names — and **string literals
that are customer text**. That last one is a refinement of D-114 as written: `Premio` and
`Nota de Credito` appear inside `[5,1,"..."]` payloads, so "identifiers only" would have leaked
them. A `[5,1]` payload is kept verbatim only when it parses entirely as Oracle format-model
elements, or is an NLS parameter string, or has no letters in it.

Two things are **not** replaced, on purpose:

- names with no letter in them (`58`, `1`) — replacing those would rewrite the token codes
  themselves, which is a bug this cost one rebuild to find;
- one-character names — they carry no vocabulary, and a single letter would match inside a
  quoted format mask.

---

## Rebuilding it

Needs `d4dumps/` present. Only a machine that has the dumps can rebuild the corpus; everyone
else consumes the committed file.

```bash
cd discoverer-neo && npm run rebuild-corpus -w @discoverer-neo/migrate
```

Point it elsewhere with `-- --dumps-dir <path>`. It prints the counts and writes three files:

| File | Committed? |
|---|---|
| `corpus/formula-corpus.tsv` | yes |
| `corpus/formula-corpus.meta.json` | yes |
| `corpus/identifier-map.private.json` | **NO — gitignored (`*.private.json`)** |

**The mapping is the key that undoes the anonymisation. Treat a leak of it exactly as you
would treat committing `d4dumps/` itself.** The `.gitignore` rule is committed alongside the
corpus so the two can never drift apart.

The build is deterministic: the same dumps produce a byte-identical corpus, so a rebuild that
changes the `sha256` means the dumps changed, not the tool.

---

## How the anonymisation is proved

`migrate/src/__tests__/formula-corpus.test.ts`, 13 tests. Three of them are the control's
actual proof:

1. **Determinism** — the same input anonymises identically twice, and the map inverts without
   collisions.
2. **Byte class and length** — asserted per character, including the non-ASCII case.
3. **No leak** — with the private map present, no identifier of 4 characters or more appears
   anywhere in the committed corpus, and no chance match is longer than 3 characters.

On the 4-character threshold: a synthetic name keeps the original's spaces, so a multi-word
synthetic is a run of random word-shaped fragments, and a 2- or 3-letter fragment can coincide
with some *other* short identifier. Those matches are synthetic bytes, not survivals, and two
or three letters carry no vocabulary. Measured on the current corpus: 0 matches at 4+
characters, 101 chance matches at 2-3.

CI has no `d4dumps/` and so cannot rebuild the map. It verifies the recorded `sha256` instead,
which ties the committed bytes to the run that passed the leak check.

---

## One thing Phase 4.1 should know before it starts

**The aligned corpus attests 55 of the 56 `[1,n]` codes, not all 56.** `[1,64]` (`GREATEST`)
appears only in a formula that has an `IOFormula` and no `DisplayFormula`, so it is in the
dumps but has no rendered counterpart to fit against.

Phase 4.1's acceptance criterion *"every one of the 56 codes appears in the fixture at least
once"* therefore cannot be met from the aligned pairs. `GREATEST` has to be taken from
`EUL_FUNCTION_NAMES` and its fixity marked `[INFER]`, or the criterion restated as 55.
