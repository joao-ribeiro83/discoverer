# Token-Formula Decoder — scoping analysis

**Produced:** 2026-09-02, **inline** (decision D-004: the Stage C specialist agent was killed
by the usage limit after 138 k tokens with no output; the full implementation spec is moved
into the first stage of the formula phase itself, where it belongs).

**Method:** direct measurement of `E:\claude\discoverer\d4dumps\` (547 Oracle `d4wkdmp.exe`
reference dumps) and targeted reads of `migrate/src/services/workbook-parser.ts` and
`backend/src/lib/sql/formula-parser.ts`.

**Headline: this task is roughly 3.5× smaller than the audit assumed, and a complete
reference rendering for it already exists in this repository.**

---

## 1. Two corrections to the audit's framing

### C-1. `IOFormula` is NOT a rendered formula. `DisplayFormula` is.

`AUDIT_MIGRATION_ASSESSMENT.md` §10 offers as the ready-made test oracle: *"render all ~42 k
corpus formulas and diff against `d4wkdmp -f`'s own `IoFormula`."*

**`IOFormula` is the raw token string.** Measured, `d4dumps/114491.txt`:

```
IOFormula = [1,102]([1,55]([6,16],[5,1,"YYYY"]),[1,55]([6,17],[5,1,"YYYY"]),[5,2,"0"],…)
```

Diffing against it proves the token string **round-trips**, not that any rendering is
correct. As an oracle for a *renderer* it is worthless.

### C-2. But Oracle does render — and the rendering is checked in

**`DisplayFormula` — 37 971 instances across the 547 dumps**, paired 1:1 with `IOFormula`:

```
DisplayFormula = DECODE(TO_CHAR(Feocurre,'YYYY'),TO_CHAR(Feapertu,'YYYY'),0,1)
DisplayFormula = ( NVL(Cap Prop Me,0)+NVL(Cap Prop Mi,0) )*NVL(R Com Tx Com Vig/100,0)+…
DisplayFormula = TRUNC(MONTHS_BETWEEN(DECODE(Data Anulacao,NULL,Data Fim Vigencia,Data Anulacao),Data Prim Vig)/12)
DisplayFormula = Premio Acumulado-Sinistros Acumulados-ABS(Participacaoes Acumuladas)
```

**This changes the task from research into fitting.** Fixity, arity, argument order,
parenthesisation and literal formatting are all *directly observable* from 37 971 aligned
`(IOFormula, DisplayFormula)` pairs produced by Oracle's own code. Nothing has to be guessed,
and the acceptance test writes itself: render `IOFormula`, compare to `DisplayFormula`.

| Measure | Count |
| ------- | ----- |
| Reference dumps | 547 |
| `IOFormula` occurrences | **45 342** |
| `DisplayFormula` occurrences | **37 971** |
| Unrendered remainder | 7 371 (conditions and empties — establish which before assuming) |

---

## 2. The code space is closed, and much smaller than assumed

Measured over the whole corpus. **Exactly five namespaces exist** — matching
`workbook-parser.ts:1160-1183`'s switch with **no missing case**:

| Namespace | Occurrences | Meaning | Resolved from |
| --------- | ----------- | ------- | ------------- |
| `[1,n]` | 276 300 | **built-in function / operator** | `EUL_FUNCTION_NAMES` (`workbook-parser.ts:914`, 222 entries) |
| `[5,k,"…"]` | 182 051 | **literal**, kind `k` | inline |
| `[6,n]` | 168 304 | **item** reference | workbook element table (`IoId`) |
| `[2,n]` | 7 097 | **custom PL/SQL function** | workbook element table (`IoId`) |
| `[8,n]` | 4 861 | **parameter** reference | workbook element table (`IoId`) |

### The `[1,n]` fixity problem is 56 codes, not ~199

`AUDIT_MIGRATION_ASSESSMENT.md` §10 sizes the remaining work as *"fixity and arity for the
~199 non-boolean codes"*. **Only 56 distinct `[1,n]` codes appear anywhere in this estate**,
and the distribution is extreme:

| Rank | Code | Uses | Cumulative share |
| ---- | ---- | ---- | ---------------- |
| 1 | `[1,102]` | 61 941 | 22 % |
| 2 | `[1,95]` | 48 358 | 40 % |
| 3 | `[1,12]` | 38 994 | 54 % |
| 4 | `[1,115]` | 35 302 | 66 % |
| 5 | `[1,96]` | 21 388 | 74 % |
| 6 | `[1,94]` (`+`) | 15 278 | 80 % |
| 7 | `[1,61]` | 12 921 | 84 % |
| 8 | `[1,58]` | 12 199 | 89 % |
| 9 | `[1,68]` | 7 938 | 92 % |
| 10 | `[1,55]` (`TO_CHAR`) | 4 063 | **93.5 %** |

**Ten codes cover 93.5 %. Fifty-six cover 100 %.** The tail is trivial — 20 codes appear
fewer than 50 times, and 6 appear three times or fewer (`[1,192]` and `[1,111]` once each).

Full used set:
`102 95 12 115 96 94 61 58 68 55 49 106 97 88 42 87 81 48 163 1 92 86 85 98 103 162 28 114
18 11 99 84 79 43 83 44 104 89 82 164 35 64 140 73 126 91 139 137 189 138 90 23 32 117 192
111`

Known from the parser's own comments: **`[1,94]` is `+`**, **`[1,106]` is a bracket**
(`workbook-parser.ts:3043`). From the dumps, `[1,55]` is `TO_CHAR`, `[1,115]` is a zero-arg
call, `[1,61]` is 1-arity.

### Literal kinds: three, one unknown

| Kind | Occurrences | Reading |
| ---- | ----------- | ------- |
| `[5,2,"…"]` | 144 513 | number (`"0"`) |
| `[5,1,"…"]` | 28 476 | string / format mask (`"YYYY"`, `"DD-MON-RRRR"`) |
| `[5,4,"…"]` | **9 062** | **the date literal — the audit's known unknown** |

`[5,4]` is 5 % of literals and appears in real formulas, so it must be settled, not skipped.
The aligned `DisplayFormula` for any `[5,4]`-bearing formula shows Oracle's own rendering.

### `[2,n]` ids are workbook-local, not EUL ids

`AUDIT_MIGRATION_ASSESSMENT.md` §10 says *"customer function ids start at 112 777"*.
The observed `[2,n]` range is **17–411**. The dumps show why — every reference is an `IoId`
with a separate `Id`:

```
EUL Item Reference
    IoId = 16
    Id   = 114404
    Identifier = FEOCURRE
```

So `[2,n]`, `[6,n]` and `[8,n]` all carry a **workbook-local `IoId`**, resolved through the
workbook's own element table, exactly as `workbook-parser.ts` already treats `[6,n]`/`[8,n]`.
The 112 777-style value is the EUL `Id` reached *after* that indirection. **~100 distinct
custom functions are actually referenced**, out of 593 migrated.

---

## 3. The grammar is already implemented

`workbook-parser.ts:1086-1185` (`parseConditionTree`) is a complete recursive-descent reader
for this language, and **the calculation and condition token languages are one language**.

```
node    ::= '[' field { ',' field } ']' [ '(' [ node { ',' node } ] ')' ]
field   ::= integer | '"' string '"'
```

It already yields a typed tree — `call` / `function` / `literal` / `item` / `parameter` — and
maps anything unrecognised to `unknown` rather than guessing (`:1183`). **The lexer and
parser are done. What is missing is the renderer.**

---

## 4. Recommended design — and the precedence problem dissolves

### Do NOT re-parse `DisplayFormula`

`DisplayFormula` is Discoverer's *display* language and it is **ambiguous**. Real corpus line:

```
NVL(R Com Tx Com Vig/100,0)
```

`R Com Tx Com Vig` is a bare item name containing spaces, immediately followed by `/`. A
tempting design — token tree → `DisplayFormula` text → feed the existing
`backend/src/lib/sql/formula-parser.ts` → SQL — **cannot disambiguate that reliably.**

### Emit SQL directly from the token tree, fully parenthesised

The token tree already carries the structure; identifiers resolve through the element table
to real item ids. So:

1. **Render token tree → SQL directly**, resolving `[6,n]`/`[8,n]`/`[2,n]` through the
   element table to validated identifiers and bind variables.
2. **Parenthesise every infix node unconditionally.** `((a) + (b))`.
   **This removes the operator-precedence problem entirely** — precedence only matters when
   re-emitting un-parenthesised infix. The ~199-code precedence table the audit scoped is
   **not needed at all**. Only *name*, *arity* and *fixity* are, for 56 codes.
3. **Use `DisplayFormula` purely as the fidelity oracle** for deriving and regression-testing
   the 56-entry fixity table — never as an intermediate representation.

Cost of full parenthesisation: uglier generated SQL. That is the correct trade for a system
whose failure mode is silently wrong numbers.

### Reuse the existing security contract, do not rebuild it

`backend/src/lib/sql/formula-parser.ts` holds the validated invariants — an allowlist, no
string splicing, identifiers validated and quoted from metadata, every runtime value a bind.
The token renderer must emit into **the same AST and the same allowlist**, not a parallel
path. Per `architecture-analysis.md` H1 it lives in `migrate/src/semantics/`, exported from
the renamed `@discoverer-neo/core`, with **no new npm workspace**.

`ParsedFormula` today is `{ sql, containsAggregate, referencedItems }`
(`formula-parser.ts:235`). `containsAggregate` is load-bearing for the fan-trap planner — see
`architecture-analysis.md` H5.

### Calculation-references-calculation is specified, not open

`workbook-parser.ts:3050-3056`: a `[6,n]` reference is *"sometimes itself another `0x00dc`
calculation — Oracle's own dump tool **recursively substitutes that calculation's formula**
in its place"*, and the parser deliberately does not walk that chain.

**So the semantics are known: expand recursively, as Oracle does.** WB-04's 2 536
"disagreements" are that unwalked chain and are **by design**, not defects. Expansion needs
cycle detection; do it at **render time**, not migration time, so that improving the renderer
does not require re-migrating.

---

## 5. Why the compile-rate gate must be structural

`AUDIT_TESTING_ASSESSMENT.md` and `architecture-analysis.md` H4 agree: a check that reports
success over a non-functional system is this project's signature failure. So the gate is not
"how many compiled" but a **partition with reasons**:

Every one of the 49 819 stored formulas resolves to exactly one of:

| Bucket | Meaning |
| ------ | ------- |
| `COMPILED` | rendered to SQL, and where a `DisplayFormula` exists, it **matches** |
| `COMPILED_UNVERIFIED` | rendered, but no reference rendering exists to check it against |
| `QUARANTINED(reason)` | refused with a stated, enumerated reason |
| `FAILED` | **must be zero** — an unhandled path is a bug, not a data problem |

CI asserts `FAILED = 0` and that each bucket's count moves only in the intended direction.
The differ harness (`migrate/src/scripts/diff-corpus.ts`,
`migrate/src/services/d4wkdmp-differ.ts`) already does this shape for parser fields; extend
it rather than building a second one. Note that **the checked-in differ reports are two code
generations stale (WB-01) — every percentage in them is an artefact.** Regenerate before
quoting any number.

---

## 6. The refusal contract — inherited, and non-negotiable

This parser's established instinct is to **refuse rather than approximate**: `NOT` maps to
`null`, not to `IN`, because *"migrating it as `IN` inverts the filter"*. That instinct is
the reason the estate's numbers can be trusted at all, and the renderer must inherit it.

Refuse, with a stated reason, on:

- any `[1,n]` code not in the 56-code fitted table;
- any node the parser typed `unknown`;
- any `[2,n]` whose element does not resolve to a migrated `custom_functions` row;
- any `[5,4]` date literal until its on-wire encoding is settled;
- a calculation-reference cycle;
- an aggregate inside a formula that the fan-trap planner cannot re-aggregate
  (`AVG`, `COUNT DISTINCT`, `STDDEV`, `VARIANCE` — `architecture-analysis.md` H8/B-9).

**Never silently substitute a near-equivalent function.** A quarantined formula is a visible
gap; a wrongly-rendered one is a wrong number in a report whose users have fifteen years of
trained trust in it.

---

## 7. Suggested staging (feeds the master plan)

Each stage leaves the tree committed, typechecking and green.

| Stage | Objective | Acceptance |
| ----- | --------- | ---------- |
| **1** | Extract the aligned `(IOFormula, DisplayFormula)` corpus from the 547 dumps into a checked-in fixture. Derive the 56-code name/arity/fixity table **from evidence**. Write the decoder specification. | Fixture committed; every one of the 56 codes has an attested arity and fixity, or is explicitly marked refuse-only |
| **2** | Renderer for the **top 10 codes** (93.5 % of uses), fully parenthesised, emitting into the existing AST and allowlist. | ≥ 93 % of the aligned corpus renders **exactly equal** to `DisplayFormula` |
| **3** | The remaining 46 codes, `[2,n]` custom-function resolution against `custom_functions`, and `[5,4]` date literals. | ≥ 99 % exact match; `FAILED = 0` |
| **4** | Recursive calculation-reference expansion with cycle detection; wire the compile-rate gate into CI. | The 2 536 known WB-04 chains resolve; CI fails on any regression |
| **5** | Compile all 49 819 stored formulas; publish the four-bucket partition; feed `QUARANTINED` and `FAILED` into migration readiness as **blockers**. | Readiness refuses to report "ready" while `FAILED > 0` |

---

## 8. Open questions — with the exact command that settles each

| # | Question | Settled by |
| - | -------- | ---------- |
| 1 | What are the 7 371 `IOFormula` entries with no `DisplayFormula`? Conditions, empties, or a gap? | Align the two fields per record in the 547 dumps and classify the unmatched. Local, read-only. |
| 2 | Which of the 56 codes are infix vs prefix, and what is each arity? | Fit against the aligned corpus (Stage 1). **Evidence, not guesswork.** |
| 3 | `[5,4]` date-literal on-wire encoding (9 062 uses)? | Extract every `[5,4,"…"]` payload and its `DisplayFormula` rendering. Local. |
| 4 | Does the estate use any `[1,n]` code Oracle renders as something other than a plain call? | Same corpus fit. `[1,106]` (bracket) is already known to be one. |
| 5 | Do the 100 referenced `[2,n]` all resolve to migrated `custom_functions`? | Join the workbook element tables against `custom_functions` after Stage 3. |
| 6 | Character encoding of the dumps — `PR�MIO` appears in `DisplayFormula`. | Detect the dump encoding before building the fixture; a Portuguese estate makes this load-bearing for exact-match comparison. |
