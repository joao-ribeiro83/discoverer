# Verifying a migration

A migration that finished is not a migration that worked. `dn-migrate verify`
runs five checks against an already-migrated database and tells you which.

This exists because the alternative failed. Three separate mechanisms — a
readiness score, a 1 654-test suite and a coverage report — all reported success
over an estate where 807 of 923 worksheets could not produce SQL at all. None of
them ever looked at what the migration produced.

## Running it

```bash
npx dn-migrate verify --target postgres://user:pass@host:5432/discoverer_neo
```

Two of the five checks need the SQL generator and the formula parser, which live
in the backend workspace. For all five:

```bash
npm run verify --workspace @discoverer-neo/backend
```

That reads `DATABASE_URL`. Useful flags on both: `--json` for a machine-readable
report, `--samples N` for how many examples each check shows (default 10),
`--max-maps N` to stop the SQL check early on a large estate.

Exit code is 0 for `VERIFIED` and 1 for `COMPLETED_WITH_BLOCKERS`, so a cutover
runbook can gate on it.

## It is safe to run whenever

It reads only. It opens no transaction, writes nothing, and never re-imports —
so an estate that is already migrated can be verified as often as you like,
without touching it.

That is deliberate. Verification runs **after** the migration commits, never
inside it: a rollback would destroy the evidence you need to debug the failure,
and a single transaction spanning 923 maps and 49 819 formulas is not a
realistic thing to hold open.

The report names the database and nothing else. It never prints a connection
string, and it never reads a column from `data_sources` beyond `id` — that table
holds encrypted source passwords.

## What it checks

### 1. `sql-generation` — can every map produce SQL?

Loads each map and generates its statement. A map that throws here is a map a
user cannot open.

```
[FAIL   ] sql-generation — every migrated map loads and generates SQL
            maps=923 generated=116 failed=807
            · GD_M.M02_V01 (5b73118c-…): Unknown item reference "1,102" at position 0
```

`Unknown item reference "1,102"` means a stored Discoverer `[class,id]` token
that nothing renders yet. `No join path connects folder "X"` means the map spans
folders the join metadata does not link.

### 2. `formula-compile` — does every calculated field land in a named bucket?

This check **is** the compile run. It reads each calculated field's stored
token tree, renders it to an Oracle expression, and files the row in exactly
one of four buckets.

```
[PASS   ] formula-compile — every calculated field compiles or is quarantined with a reason
            formulas=49819 compiled=0 compiledUnverified=46685 quarantined=3134 failed=0
            distinctReasons=6 partitioned=49819
            · 1593x UNRESOLVED_ELEMENT
            · 685x UNFITTED_CODE
            · 649x INVALID_IDENTIFIER
            · 186x BAD_ARITY
            · 18x UNKNOWN_SEMANTICS
            · 3x UNREAGGREGABLE
```

That is the real estate, measured 2026-09-11: 93.71 % of its 49 819 calculated
fields render to an Oracle expression.

### The four buckets

| Bucket | What it means |
| --- | --- |
| `COMPILED` | Rendered **and** proven against a real Oracle. Nothing can claim this yet — the contract tests that would are a later phase — so this is 0. |
| `COMPILED_UNVERIFIED` | Rendered to an Oracle expression. Not yet run anywhere. |
| `QUARANTINED` | Did not render, and the tool can say why. Each row carries a reason code. |
| `FAILED` | Hit a path the compiler does not handle. **A bug in the tool**, never a data problem. |

`partitioned` must equal `formulas`. That is asserted, not decorative: without
it, `failed=0` could be satisfied by losing rows out of the partition instead
of by fixing them, and the check fails outright if the four stop summing.

`failed` is the only number that fails the check.

`quarantined` does not fail the check and **does** stop the report saying
`VERIFIED`. The compiler worked; the estate still cannot run those calculations.
Both appear under `Status:` as blockers — see [Reading the bottom
line](#reading-the-bottom-line).

Not every quarantine is a gap to close. `INVALID_IDENTIFIER` above is the
renderer refusing to emit 22 rows of `custom_functions` whose names are
operators (`!=`, `*`, `/`) rather than functions — correct behaviour on
metadata the migration passed through. Read the reasons before reading the
total.

`by reason:` is the whole histogram, not a sample. It is the improvement
backlog: whichever code tops it is the one worth fitting next.

### Publishing the partition

By default this check only reads, so it is safe against a live estate. Add
`--compile` to write each verdict back:

```bash
npx dn-migrate verify --target <connection> --compile
```

That fills three columns on `map_calculated_fields`:

| Column | Holds |
| --- | --- |
| `compile_status` | The bucket. `NULL` means no compile run has seen the row — a fifth state on purpose, so an unvisited row is not read as a clean one. |
| `compile_reason` | The reason code, on a quarantined or failed row. |
| `compiled_sql` | The Oracle expression, or `NULL` if the row was declined. |

```sql
SELECT compile_status, count(*) FROM map_calculated_fields GROUP BY 1;
```

Re-run it as often as you like. The compiled expression is derived from
`source_tokens`, which a compile run never writes, so a later run with a better
renderer simply replaces a derived value.

`compiled_sql` is **evidence, not an execution path.** Column references in it
are unqualified, because the table alias a column needs is chosen per query at
generation time and a stored string cannot know it. What the column proves is
that the formula has a reading at all.

### If every row says `NO_SOURCE_TOKENS`

That means the estate was migrated before the token form was kept, so there is
nothing for the renderer to read:

```
[PASS   ] formula-compile — every calculated field compiles or is quarantined with a reason
            formulas=49819 compiled=0 compiledUnverified=0 quarantined=49819 failed=0
            · 49819x NO_SOURCE_TOKENS
```

The fix is a maps re-import, which writes `source_tokens`, the element bindings
and `data_type` beside each formula. No amount of renderer work moves these
rows. There is no `dn-migrate` command for it — use
`POST /api/migration/reimport-maps`, or the script behind it:

```bash
npx tsx src/scripts/reimport-maps.ts <dataSourceId>          # dry run
npx tsx src/scripts/reimport-maps.ts <dataSourceId> --live
```

Run it from the environment that has the Oracle Instant Client. **It deletes
and rebuilds every migrated map**, so any edit made to one since the original
migration is lost; the dry run reports what it would replace first.

### 3. `referential-closure` — does everything a map points at hang together?

Foreign keys already stop a dangling id. This asks the question they cannot:
whether the things a map references are reachable *together*, as one query.

```
[FAIL   ] referential-closure — every map reference resolves inside the map's query scope
            references=31565 folderWithoutDataSource=0 mapsWithNoColumns=25
```

`folderWithoutDataSource` is the one to watch. A folder with no
`data_source_id` has no database behind it, so the map cannot execute even if
its SQL is perfect — `resolveDataSourceId` refuses it before a query is ever
sent. This seam found 31 405 of them: the migration knew which data source it
was reading and never wrote it down. If you see a non-zero count here, the
migration that produced the estate was run without `--data-source-id`.

`mapsSpanningDataSources` means a map's folders live in two physical databases,
which cannot be one statement.

### 4. `reconciliation` — do the counts match what was declared?

```
[PASS   ] reconciliation — target counts match the declared source-to-target expectations
            concepts=13 matched=13 drifted=0 rowsLostToAllowances=1492 unexplainedAllowances=1
```

The expected counts are declared in `migrate/src/verify/expected-loss.ts`, one
entry per concept with its source count, its expected target count and why they
differ. This check only asks whether reality still matches that declaration, so
a genuine regression can never be mistaken for a known gap.

`drifted` is what fails the check — in either direction. Fewer rows than
declared is a regression; more rows means something was recovered and the
declaration was left stale.

`unexplainedAllowances` counts gaps that are recorded but not understood. Today
that is 1: 78 of 138 business-area grants produced no target row, and nobody has
established whether that is correct de-duplication or 78 people losing access.

### 5. `measure-set` — can the fan-trap guard see anything to guard?

```
[PASS   ] measure-set — the estate carries a non-empty measure set for the fan-trap guard
            columns=25962 axis=20014 measure=5920 page=26 unclassified=2
            withAggregate=1760 measuresWithoutAggregate=4161 mapsWithAMeasure=402
```

The fan-trap guard's first step is *if there are no measures, emit the flat plan
and stop* — fan traps are an aggregation defect, so a query with nothing
aggregated cannot have one. An estate where no column carries an aggregate
classifies **every** query that way. The guard would pass its own tests and
never run on real data.

That is not hypothetical: before Phase 3.1 `agg_function` was null on all 25 964
map items, because the item read never selected `EXPRESSIONS.IT_FUN_ID`. Nothing
could see it. This seam is what makes it visible.

Both halves must be present, because either alone leaves the guard blind:
`measure` is the split the workbook gives (`0x0123`/`0x0124`), and
`withAggregate` is the EUL's Default aggregate on top of it. A zero in either
fails the check.

`measuresWithoutAggregate` is **reported, never failed on**. Oracle's `Detail` is
the marker for *do not aggregate* and 8 152 of this estate's items carry it, so a
null there is the source's own answer. Defaulting those to `SUM` would replace a
tracked gap with a wrong number.

### 6. `planner-live` — the planner-decision histogram

Real output, from this estate on 2026-09-06, after the join re-import:

```
[FAIL   ] planner-live — the planner-decision histogram, over every migrated map
            maps=924 decided=155 mapsWithANonEmptyMeasureSet=49
            flat=129 rewrite=0 refuse=26 fanTrapRefusals=0 error=0
            notDecided=769 fanCandidates=25 fanCandidatesDecided=1
            refuseDISCONNECTED=26
            REWRITE fired zero times: the rewrite path is unreachable, so the
            guard has not been shown to work — only shown to have no input.
            25 map(s) WOULD reach the fan test, and 1 of them reached a
            decision — the rest throw before the planner runs, so the blockage
            is upstream of this guard, not in it
            · no fan-trap rule (R1-R4, REAGG) fired: no map in this estate
              reached a trigger condition.
            · REFUSE(DISCONNECTED) = 26 against a baseline of 271, over 155 of
              924 maps that reached a decision. The 769 that did not are absent
              from every bucket, so this count is a floor and not yet a
              like-for-like reading of the baseline.
```

That is a FAIL, and it reads correctly. 769 maps carry an unrendered formula
token and never reach the planner — 24 of the 25 that would otherwise reach the
fan test are among them. The one that does decide is correctly `FLAT`: its
measure sits on the detail side, so nothing repeats.

The rewrite path itself is proven separately, against Oracle, by
`backend/src/scripts/verify-fan-trap-m67.ts` — see below.

Every map is decided, and the decision counted. One line per map, one bucket
per outcome:

| Bucket | Meaning |
| --- | --- |
| `flat` | a plain join. Either nothing aggregates, or nothing fans |
| `rewrite` | the fan-trap rewrite ran: each set of detail rows summarised in its own inline view, then combined |
| `rewriteN` | of those, how many had N branches |
| `refuseDISCONNECTED` | the folders the map uses are not linked by any join |
| `refuseNO_PREDICATE` | a join exists but says nothing about which columns to match |
| `refuseR1`…`refuseR4`, `refuseREAGG` | one of the five fan-trap rules |
| `error` | generation failed for a reason that is not a refusal — an unrendered formula, for instance. **Counted apart from refusals on purpose** |
| `notDecided` | the map could not be loaded at all. Absent from every bucket above |
| `fanCandidates` | maps that WOULD reach the fan test — multi-folder, connected, carrying a measure — counted from the tables, so maps the planner never sees are included |
| `fanCandidatesDecided` | how many of those actually reached a decision |

**Why it exists.** A guard that fires zero times is indistinguishable from a
guard that was never wired in. Every other fan-trap test in this project runs
against a hand-built fixture, so the guard can pass its whole suite while having
classified nothing real. This is the only check that reads migrated maps.

**Why it counts each rule, not each kind.** The first version of this check
asserted `REFUSE > 0`. That cannot tell the fan-trap guard from a failure that
predates it: 271 of this estate's 341 multi-folder maps refuse because their
folders are not connected, a rule Neo has had since long before the planner
existed. Those alone satisfy `REFUSE > 0`, so the check would have passed with
the guard never once having fired.

**The three things it asserts:**

1. **`rewrite` is above zero.** The one that matters. A guard that only ever
   refuses has not been shown to work — it has been shown to have no input.
2. **`refuseDISCONNECTED` is below the recorded baseline of 271.** Otherwise the
   join model did not fix what it claimed to.
3. **A fan-trap rule fired, or the run says in words that none could.** "No map
   in this estate reaches a trigger condition" is an acceptable answer, and it
   is printed as a finding. Silence is not an answer.

**`rewrite = 0` means two different things.** With `fanCandidates = 0`, this
estate simply contains no fan trap, and nothing downstream can change that. With
candidates that did not get decided, the rewrite path is blocked *upstream* — the
guard is fine, its work never arrives. The blocker line says which.

**Read `notDecided` before you read anything else.** A map that could not be
loaded is in no bucket, so it cannot be counted as `refuseDISCONNECTED` either
— and that count falls for a reason that has nothing to do with the join model.
The check prints the coverage next to the number for exactly this reason. While
`notDecided` is large, treat every count here as a floor.

### Proving the rewrite path itself

The histogram can only report what the estate lets the planner see. When
`rewrite` is 0 because its candidates do not load,
`backend/src/scripts/verify-fan-trap-m67.ts` proves the path directly against
Oracle. It builds a worksheet from the migrated metadata for `M M67 1` (2 623
policy headers) joined to `M M67` (833 340 receipt lines), and asks the source
system three questions:

```
plan decision              REWRITE(2)
1. Oracle reference        4 392 650.47
2. naive flat join     1 278 415 648.69
3. Neo (rewritten)         4 392 650.47
```

Neo matches the source system exactly; the unguarded join inflates by 291.04x.
The script asserts the naive number *differs* from the reference — if it agreed,
the shape would contain no fan and the check would be passing vacuously.

Run it inside the backend container, where the Oracle Instant Client lives.

## Reading the bottom line

```
Status: COMPLETED_WITH_BLOCKERS
  BLOCKER formula-compile: 80 of 49819 calculated field(s) do not compile — see the per-reason histogram
  BLOCKER referential-closure: 2 closure invariant(s) broken across 31565 reference(s)
```

There are two kinds of blocker in that list, and the difference matters when
you decide what to do about one:

- A **check that failed** says a part of the tool is broken. `referential-closure`
  above is one.
- A **readiness blocker** comes from a check that *passed*. The tool worked,
  refused honestly, and the estate still is not usable — `formula-compile`
  above declined 80 calculations correctly, and a report that called that
  "ready" would be lying. A migration once scored 75 out of 100 with no
  blockers listed over an estate where none of its 923 maps could run; this is
  the line that stops that happening again.

Either kind stops the report saying `VERIFIED`.

`VERIFIED` — every check passed.

`COMPLETED_WITH_BLOCKERS` — the rows are there and something they imply is not
true. It is not a failure: nothing needs rolling back, and rolling back would
lose the evidence. It is also not success, and a migration job that reaches this
state reports it under the same name rather than saying `COMPLETED`.

`SKIPPED` on a check means it could not be evaluated here — normally because you
ran `dn-migrate verify` and the check needs the backend workspace. A skipped
check is never a pass. Run the backend entry point to resolve it.

## What it does not tell you

It does not connect to Oracle, so it cannot tell you whether generated SQL is
accepted by your database server — only that it was produced. It does not run a
map. And it says nothing about the source: for that, `dn-migrate analyze` scores
the EUL before you migrate, and deliberately never claims a migration is ready.

---

**See also:** [Migration tool](migration-tool.md) ·
[Troubleshooting](troubleshooting.md) ·
[Testing](../developer-guide/testing.md)
