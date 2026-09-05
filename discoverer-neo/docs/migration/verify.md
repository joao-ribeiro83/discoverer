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

```
[PASS   ] formula-compile — every calculated field compiles or is quarantined with a reason
            formulas=49819 compiled=0 compiledUnverified=37 quarantined=49782 failed=0
            · 49027x unrendered Discoverer [class,id] token — no renderer yet
```

`failed` is the only number that fails the check. It counts formulas that hit a
path the classifier does not handle, which is a bug in the tool. A large
`quarantined` count is a stated, understood gap — every one of them carries a
reason, and the reasons are aggregated so you see the shape rather than 49 782
lines.

`compiled` stays 0 until formulas are proven against a real Oracle. "Parses" and
"works" are different claims, and the report keeps them apart.

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

## Reading the bottom line

```
Status: COMPLETED_WITH_BLOCKERS
  BLOCKER referential-closure: 2 closure invariant(s) broken across 31565 reference(s)
```

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
