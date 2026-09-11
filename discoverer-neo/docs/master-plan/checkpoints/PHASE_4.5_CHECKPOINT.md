# Phase 4.5 — compile the estate

Completed 2026-09-11. Five commits, plus the measurement and the docs.

---

## The partition

Two numbers, and the difference between them is the whole finding.

### What the estate reports today

`npx dn-migrate verify --target <connection>`, run 2026-09-11 against the live
target (49 819 calculated fields, 925 maps):

| Bucket | rows | |
| --- | ---: | ---: |
| `COMPILED` | 0 | 0.00 % |
| `COMPILED_UNVERIFIED` | 0 | 0.00 % |
| `QUARANTINED` | 49 819 | 100.00 % |
| **`FAILED`** | **0** | 0.00 % |
| (sum) | 49 819 of 49 819 | |

One reason, no residue: **`NO_SOURCE_TOKENS` × 49 819.**

The estate was migrated before dual storage existed, so not one row carries the
token tree its formula came from. `map_calculated_fields.formula` holds the
*readable* form — the token string with `[6,n]`/`[8,n]` replaced by the names
they point at — and that string cannot be re-parsed: substituting a name like
`R Com Tx Com Vig` into a token tree destroys the bracket structure the tree was
written in (decoder analysis C-8). There is nothing for the renderer to read.

**So the honest answer to "how much of the estate actually works" is 0 %, and
the reason is one word.** A maps re-import fixes it; no amount of renderer work
does.

### What it reports once the token forms are there

`npm run render-corpus -w @discoverer-neo/core`, over this same estate's
22 748 committed token strings / 37 971 occurrences:

| Bucket | rows | | occurrences | |
| --- | ---: | ---: | ---: | ---: |
| `COMPILED` | 0 | 0.00 % | 0 | 0.00 % |
| `COMPILED_UNVERIFIED` | 22 668 | 99.65 % | 37 808 | **99.57 %** |
| `QUARANTINED` | 80 | 0.35 % | 163 | 0.43 % |
| **`FAILED`** | **0** | 0.00 % | **0** | 0.00 % |
| (sum) | 22 748 of 22 748 | | 37 971 of 37 971 | |

Every element resolves when this is measured, deliberately. That separates
renderer coverage from the per-map item lookup: a row here is a formula-language
gap, while `UNRESOLVED_ELEMENT` on a live estate is a metadata question.

`COMPILED` is 0 in both and stays 0 by construction. There is no reference
Oracle result to check an emitted expression against, so claiming that bucket
would be claiming a proof Phase 9.1 has not produced.

---

## The per-reason quarantine breakdown — the backlog

163 occurrences across 80 rows, and the ordering is the work queue:

| Reason | occurrences | rows | What closes it |
| --- | ---: | ---: | --- |
| `UNFITTED_CODE` | 142 | 76 | The Phase 4.1 fit could not establish these built-ins' exact form from the evidence. `CASE`/`WHEN`/`ELSE`, `IS NULL`, `UPPER`, `GREATEST`, and the analytic family. Needs the evidence rule widened or the corpus rebuilt — not more renderer code. |
| `UNKNOWN_SEMANTICS` | 18 | 1 | `2_Pass_Percentage`. Discoverer displayed it as its argument alone, so the corpus cannot say what it computed. Unclosable from this evidence; the one row has to be rewritten. |
| `UNREAGGREGABLE` | 3 | 3 | `AVG`/`COUNT DISTINCT`/`STDDEV`/`VARIANCE` under a re-aggregation. A refusal by design (D-058), not a gap. |

Of the three, only `UNFITTED_CODE` is worth work, and the work is evidence
rather than code. `d4dumps/` is empty on this machine, so a corpus rebuild is
not possible here.

---

## What was built

### Dual storage (D-055)

`map_calculated_fields` gained four columns (`backend/drizzle/0016`):

| Column | Holds |
| --- | --- |
| `source_tokens` | The verbatim `[class,id]` token form. Provenance, never overwritten. |
| `compiled_sql` | The Oracle expression the renderer emitted, or null. |
| `compile_status` | The D-059 bucket. Null means no compile run has seen the row — a fifth state on purpose. |
| `compile_reason` | The reason code. |

`source_attrs.elementBindings` carries the fifth piece: the element table's own
name lookup for the `[6,n]`, `[8,n]` and `[2,n]` ids inside `source_tokens`.
Without it a token form is uncompilable once the `.DIS` is out of reach, and the
renderer could only ever be improved by re-migrating the estate. It went into
the existing `source_attrs` jsonb rather than a new column, which is what the
brief pointed at.

### The compile run

Seam 2 of `dn-migrate verify` **is** the compile run now. It reads
`source_tokens`, expands sibling calculations, renders through the Phase 4
renderer, and files each row in exactly one bucket. The renderer lives in
`@discoverer-neo/core`, so `dn-migrate verify` reports the seam instead of
skipping it — the first time seam 2 has been evaluable from the migrator.

The injected `compileFormula` hook stays and now covers only the rows with no
token form: a calculated field authored in Neo, whose formula is readable text
the backend's parser owns.

`--compile` writes the verdict back. Off by default so the verifier stays
read-only against a live estate, and re-runnable when on (D-070): the compiled
expression is a function of `source_tokens`, which it never writes.

Proven against real Postgres, not only a fake: `migration-seams.test.ts` seeds
four calculated fields covering both halves of the path — two with a token form
(one that renders, one whose element has no binding) and two without — then
asserts the partition, the read-only default, the written columns, and that
`source_tokens` comes back byte for byte after a compile run.

**Two properties make the partition a gate rather than a summary.**

- The buckets must sum to the row count. Without that, `FAILED = 0` is
  satisfiable by losing rows out of the partition rather than by fixing them —
  so a partition that stops summing is itself a FAIL.
- `QUARANTINED` blocks readiness. `FAILED` says our compiler is broken;
  `QUARANTINED` says the compiler worked and the estate still cannot run. F-12
  was a target scoring 75 with no blockers listed over an estate where none of
  923 maps could execute; reporting a correct refusal as a note is that failure
  exactly. `SeamResult.readinessBlocker` stops the report reading `VERIFIED`
  without claiming the compiler failed.

### WB-05 — four columns read and dropped

`map_calculated_fields.data_type` was NULL on all 49 819 rows, and
`description`, `format_mask` and `source_identifier` with it. The workbook
parser had read all four all along; the mapper listed only the fields it
happened to need, and nothing failed to say so — a declared, documented,
permanently empty column. Fixed in the mapper, so `migration-runner` and
`map-reimport` both get it.

The visible cost was `data_type`: a calculated column with no data type renders
unformatted and exports as text.

### BE-05 — ORA-00979 on a mixed formula

`SUM(AMOUNT) / HEADCOUNT` contains an aggregate, so `select-clause` treated the
whole expression as aggregated and the bare column never reached GROUP BY. Any
per-unit or share-of-total calculation — one of the commonest shapes a
Discoverer worksheet has — died with ORA-00979.

`containsAggregate` answers "does this statement need a GROUP BY". It cannot
answer "of what", and that was the bug. The parser now also collects
`bareReferences`, tracked with a depth counter on the tree rather than scanned
out of the text, so `SUM(A/B)` (group by nothing) and `SUM(A)/B` (group by B)
are told apart correctly.

A bare reference whose own resolved expression aggregates is dropped: an item
whose EUL formula reads `SUM(x)` is bare in the calculated field's tree and
still an aggregate in the SQL, and grouping by it would be ORA-00934 — the
mirror-image error.

---

## One design correction the work forced

Expansion substitutes a sibling calculation's **tree**, and that subtree's
`[6,n]` ids were written against the *sibling's* bindings, not the row's.
Resolving only the row's own bindings quarantined every expanded formula as
`UNRESOLVED_ELEMENT` — a false negative that would have understated the compile
rate and sent someone after a renderer bug that did not exist. Element ids are
workbook-scoped, so the scope now carries one merged binding table per map and
the row's own bindings win where both name an id.

---

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| All 49 819 formulas fall into exactly one bucket, summing correctly | done — `partitioned=49819` of `formulas=49819`, asserted by the seam and by test |
| `FAILED = 0` | done — on the live run and on the corpus projection, both as equalities |
| Readiness refuses to report "ready" while `FAILED > 0` | done — forced with a fixture, since the real estate has `FAILED = 0` and an assertion that only sees the happy path proves nothing |
| `QUARANTINED` reported per reason | done — the whole histogram, unbounded, printed under `by reason:` |
| The token form is retained alongside the compiled expression | done — `source_tokens` is never written by a compile run, asserted in `formula-compile.test.ts` and in the persistence test |
| `data_type` non-null after a re-import | **mechanism landed; not observable here.** The transformer writes it and a transformer test asserts it. The live estate still reads NULL because it has not been re-imported — the same re-import the partition needs |
| A mixed aggregate/bare-column formula no longer produces ORA-00979 | done — three tests in `sql-generator.test.ts` |
| Formula bodies are not logged | done — reasons are codes; `scrub` strips quoted spans and bracketed runs from the one path that could carry content, with a test |

---

## Security

- The compile run writes **no audit entries**. It runs outside Fastify, so the
  Phase 0.2 redactor is not on its path at all.
- That redactor is key-name based (`password`, `secret`, `token`…). It does not
  and never did redact formula content. Nothing this stage writes reaches it.
- `source_tokens` and `compiled_sql` do ride along on the map-detail API
  response, which selects every column. **No new information is disclosed**:
  `formula` was already on that response, the new columns hold the same content
  in a different encoding, and the audience is identical — anyone who can read
  the map can read its formulas. Worth knowing rather than worth fixing, and
  recorded here rather than silently.

---

## What was deliberately not done

- **The maps re-import.** It needs the live Oracle EUL, it destroys and rebuilds
  every migrated map, and writing to the estate is the operator's call. It is
  the one action standing between the 0 % above and the 99.57 %.
- **`scoreSourceReadiness` was not taught about the target.** D-071 says that
  function must stop speaking about a target, not learn to; the blockers went
  into the verifier, where the target is in scope. Recorded in a comment there.
- **Conditions referencing calculated fields** — schema change, Phase 5.3.
- **Result-set equivalence** — Phase 9.1. It is also the only thing that can
  ever move a row into `COMPILED`.
- **New function support** beyond what Phase 4.3 attested.

---

## One thing the brief assumed that is not true

The brief says "Phase 2.2's refusal UI renders these — keep the wording
aligned." It does not. `frontend/src/components/map-builder/ExecutionRefusal.tsx`
and `mapViewer.json` cover **worksheet-level** planner refusals
(`NO_JOIN_PATH`, `FAN_TRAP_R1`…). There is no per-formula refusal surface in the
UI yet, so `docs/troubleshooting/formula-refusals.md` is the only user-facing
home for these codes. The new entries were written in the same
title / why / what-to-change shape as the UI copy, so the alignment is there
when a surface is built.

---

## How to resume

```bash
cd discoverer-neo
npx dn-migrate verify --target <connection>          # read the partition
npx dn-migrate verify --target <connection> --compile # publish it
npm run render-corpus -w @discoverer-neo/core         # the projection, no DB needed
```

```sql
SELECT compile_status, count(*) FROM map_calculated_fields GROUP BY 1;
SELECT count(*) FROM map_calculated_fields WHERE data_type IS NULL;
```

If `FAILED = 0` and readiness blocks on the quarantines, this stage is done —
which is where it stands. The next real movement on the number needs the
re-import, not code.

Measured on the live target 2026-09-11, after schema migration 0016 was
applied there:

```
 data_type IS NULL | source_tokens IS NULL | compile_status IS NULL | total
             49819 |                 49819 |                  49819 | 49819
```

`compile_status` is still NULL because the run above was read-only. Publishing
the partition into the estate is a write, so it is the operator's to run:

```bash
cd discoverer-neo
npx dn-migrate verify --target <connection> --compile
```

Today that stamps `QUARANTINED` / `NO_SOURCE_TOKENS` on all 49 819 rows, which
is worth doing anyway — it turns an all-NULL column into a stated answer, and
it is the same command that publishes the real partition after the re-import.
