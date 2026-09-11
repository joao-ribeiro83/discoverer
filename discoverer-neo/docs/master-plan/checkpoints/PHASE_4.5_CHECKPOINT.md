# Phase 4.5 — compile the estate

Completed 2026-09-11. The estate was re-imported and compiled; the partition
below is measured, not projected.

---

## The partition

The maps were re-imported and the estate compiled on 2026-09-11. This is the
number that says how much of the estate actually works.

| Bucket | rows | |
| --- | ---: | ---: |
| `COMPILED` | 0 | 0.00 % |
| `COMPILED_UNVERIFIED` | **46 685** | **93.71 %** |
| `QUARANTINED` | 3 134 | 6.29 % |
| **`FAILED`** | **0** | 0.00 % |
| (sum) | 49 819 of 49 819 | |

46 685 rows carry a `compiled_sql`. Nothing is unvisited — `compile_status` is
non-null on every row.

`COMPILED` is 0 and stays 0 by construction. There is no reference Oracle
result to check an emitted expression against, so claiming that bucket would be
claiming a proof Phase 9.1 has not produced.

### What it took to get here, and what it cost to find out

The estate had been migrated before dual storage existed, so the first compile
run over it reported `NO_SOURCE_TOKENS` for all 49 819 rows — a true statement
about the estate and no statement at all about the renderer. The maps were
re-imported (923 maps, 564 workbooks, 71 s), which wrote `source_tokens`, the
element bindings and `data_type` onto every row.

The second run then reported **17.8 %**, not the 99.57 % the corpus projection
predicted. The projection was not wrong — it resolves every element on purpose,
so it measures the renderer and not the estate's metadata — but the gap was
almost entirely two defects in how this stage built its resolution scope, and
the first run is what exposed them. Measured over the 128 068 element bindings
inside the 39 425 quarantined rows:

| | bindings | What it meant |
| --- | ---: | --- |
| resolved only via the map's **folders** | 54 664 | The scope looked at the map's *displayed columns*. A Discoverer calculation may reference an item the worksheet does not display, and the query's folder set is the scope Discoverer resolves in. |
| resolved only as a **sibling calculation keyed by element id** | 50 378 | Sibling trees were keyed by *name*. The workbook parser disambiguates same-named siblings, so a binding reads `SEGURO DIRECTO1 #100` while the stored name is `SEGURO DIRECTO1`, and the round-trip missed. |
| already resolved | 21 360 | These rows failed on a different binding. |
| genuinely unresolvable | 1 666 | |

Both are fixed. The name detour also manufactured **741 false
`CALCULATION_CYCLE` refusals** — two elements sharing a label made a reference
look like a self-reference — and that reason is now absent from the partition
entirely.

The lesson is the one this project keeps relearning: a projection measured with
every input resolved tells you about your code, not about the estate. Only the
live run finds a scope built too narrowly, and it found two.

## The per-reason quarantine breakdown — the backlog

3 134 rows, and the ordering is the work queue:

| Reason | rows | | What closes it |
| --- | ---: | ---: | --- |
| `UNRESOLVED_ELEMENT` | 1 593 | 3.20 % | The formula names an item that is in no folder the map uses, or an item the EUL carries with no `column_name` at all (2 786 of 9 626 items are like that, and have no formula either, so there is nothing to emit). A metadata question, not a renderer one. |
| `UNFITTED_CODE` | 685 | 1.37 % | Built-ins whose exact form the Phase 4.1 fit could not establish from the evidence — `CASE`/`WHEN`/`ELSE`, `IS NULL`, `UPPER`, `GREATEST`, the analytic family. Needs the evidence rule widened or the corpus rebuilt, not more renderer code, and `d4dumps/` is empty on this machine. |
| `INVALID_IDENTIFIER` | 649 | 1.30 % | **Correct behaviour, and a finding.** 22 of the 593 migrated `custom_functions` rows are not functions: their names are `!=`, `()`, `*`, `+`, `/`, `-1`, `2_Pass_Percentage`. The EUL's function catalogue includes operators, the migration wrote them through, and the renderer refuses to emit an operator as a call. Handling those as built-ins is Phase 4.3 territory and explicitly out of this phase's scope. |
| `BAD_ARITY` | 186 | 0.37 % | A call whose argument count is outside the fitted arity. Either the fit's arity range is too narrow or the tree says something unexpected; needs a case-by-case read. |
| `UNKNOWN_SEMANTICS` | 18 | 0.04 % | `2_Pass_Percentage`. Discoverer displayed it as its argument alone, so the corpus cannot say what it computed. Unclosable from this evidence — the rows have to be rewritten. |
| `UNREAGGREGABLE` | 3 | 0.01 % | `AVG`/`COUNT DISTINCT`/`STDDEV`/`VARIANCE` under a re-aggregation. A refusal by design (D-058), not a gap. |

Two of the six — `UNKNOWN_SEMANTICS` and `UNREAGGREGABLE`, 21 rows — cannot be
closed by any amount of work. `INVALID_IDENTIFIER` is already correct. So the
addressable backlog is 2 464 rows, or 4.9 % of the estate.

### The corpus projection, for comparison

`npm run render-corpus -w @discoverer-neo/core` still runs the renderer over
the estate's 22 748 committed token strings with every element resolved, and
still reports 99.57 % of occurrences rendering. That number is the renderer's
own coverage and it is gated in CI. The live 93.71 % is the estate's, and the
6 % between them is metadata: items with no column, and operators migrated into
the function table.

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
| All 49 819 formulas fall into exactly one bucket, summing correctly | done — `partitioned=49819` of `formulas=49819` on the live run, asserted by the seam and by test |
| `FAILED = 0` | done — on the live run and on the corpus projection, both as equalities |
| Readiness refuses to report "ready" while `FAILED > 0` | done — forced with a fixture, since the real estate has `FAILED = 0` and an assertion that only sees the happy path proves nothing |
| `QUARANTINED` reported per reason | done — the whole histogram, unbounded, printed under `by reason:` and persisted to `compile_reason` |
| The token form is retained alongside the compiled expression | done — `source_tokens` non-null on all 49 819 rows after the compile run, and never written by it |
| `data_type` non-null after a re-import | **done, measured** — 49 819 of 49 819 non-null after the re-import; NULL on all of them before it |
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
- The re-import needed the live EUL credential. It was never handled in
  plaintext and never written to a file: `startMapReimport` reads
  `data_sources.password_enc` from the target and decrypts it in process.

---

## What was deliberately not done

- **`scoreSourceReadiness` was not taught about the target.** D-071 says that
  function must stop speaking about a target, not learn to; the blockers went
  into the verifier, where the target is in scope. Recorded in a comment there.
- **The 22 operator rows in `custom_functions` were left alone.** They are why
  `INVALID_IDENTIFIER` has 649 rows. Treating `!=`, `*` and `/` as built-ins
  rather than as PL/SQL calls is new function support, which Phase 4.3's
  attestation bounds and this brief puts out of scope.
- **Conditions referencing calculated fields** — schema change, Phase 5.3.
- **Result-set equivalence** — Phase 9.1. It is also the only thing that can
  ever move a row into `COMPILED`.

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

## One thing that was missing and is now built

There was **no entry point for the maps re-import at all**. `reimportMaps` had
existed in `@discoverer-neo/core` since Phase 1 with no CLI command and no
script able to reach it from the migrator; the only caller was
`POST /api/migration/reimport-maps` and `backend/src/scripts/reimport-maps.ts`
behind it. That script works and is what was used here. Worth knowing before
someone goes looking for `dn-migrate reimport-maps`, which does not exist.

Running it also surfaced a real defect. The driver refuses a second
`initOracleClient` two different ways — `already been initialized` when the
arguments match, and `NJS-090: … already called with different arguments` when
they do not — and only the first was tolerated, in **both** workspaces. The
re-import runs inside the backend, whose pool initialises with a configured
`libDir` while the migrator's own init passes none, so it hit the second form
and failed at the read step with a message telling the operator to set a
variable that would not have fixed anything. One predicate now, in
`@discoverer-neo/core`, matching on "already".

---

## How to resume

```bash
cd discoverer-neo
npx dn-migrate verify --target <connection>            # read the partition
npx dn-migrate verify --target <connection> --compile  # re-publish it
npm run render-corpus -w @discoverer-neo/core          # renderer coverage, no DB
```

```sql
SELECT compile_status, coalesce(compile_reason,'-'), count(*)
FROM map_calculated_fields GROUP BY 1,2 ORDER BY 3 DESC;
```

Measured on the live target 2026-09-11, after the re-import and the compile:

```
   compile_status    |       reason       | count |  pct
---------------------+--------------------+-------+-------
 COMPILED_UNVERIFIED | -                  | 46685 | 93.71
 QUARANTINED         | UNRESOLVED_ELEMENT |  1593 |  3.20
 QUARANTINED         | UNFITTED_CODE      |   685 |  1.37
 QUARANTINED         | INVALID_IDENTIFIER |   649 |  1.30
 QUARANTINED         | BAD_ARITY          |   186 |  0.37
 QUARANTINED         | UNKNOWN_SEMANTICS  |    18 |  0.04
 QUARANTINED         | UNREAGGREGABLE     |     3 |  0.01
```

`FAILED = 0`, the partition sums, readiness blocks on the quarantines. This
stage is done. The addressable backlog is 2 464 rows; the next real movement on
it is evidence work (`UNFITTED_CODE`) or metadata work
(`UNRESOLVED_ELEMENT`), not renderer code.

To re-run the whole thing from scratch — the re-import needs the backend
container, which is where the Oracle Instant Client lives, and a fresh
`migrate/dist` copied in because `/app/migrate` is not bind-mounted:

```bash
npm run build -w @discoverer-neo/core
docker cp migrate/dist discoverer-neo-backend:/app/migrate/
docker exec -w /app/backend discoverer-neo-backend \
  npx tsx src/scripts/reimport-maps.ts <dataSourceId>          # dry run
docker exec -w /app/backend discoverer-neo-backend \
  npx tsx src/scripts/reimport-maps.ts <dataSourceId> --live
```
