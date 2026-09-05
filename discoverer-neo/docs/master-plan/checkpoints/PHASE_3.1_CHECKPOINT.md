# Phase 3.1 checkpoint — Populate the measure set

**Date:** 2026-09-05 · **Status:** complete, re-import run, estate measured
**Commits:** `493e414` parser/EUL read · `d2e7689` transformer write + constraint ·
`337bfb8` seam 5 and tests

---

## The handover numbers

Phase 3.3's planner depends on these; Phase 3.4 compares against them.

| Number | Value | Where |
| --- | ---: | --- |
| **Measure columns carrying an aggregate** | **1 760** | `map_items.agg_function IS NOT NULL` |
| **Maps with at least one** | **402** of 923 | `count(DISTINCT map_id)` on the same |
| Distinct EUL items behind them | 337 | join to `items` |
| Measure columns with **no** aggregate | 4 161 | `axis_type='MEASURE' AND agg_function IS NULL` |
| Axis / measure / page columns | 20 014 / 5 920 / 26 | `map_items.axis_type` |

Before this phase: `agg_function` was NULL on **all 25 964** map items and on
all 9 626 items. One hand-made row carried `SUM`.

```sql
SELECT agg_function, count(*) FROM map_items GROUP BY agg_function ORDER BY 2 DESC;
SELECT axis_type, agg_function IS NULL AS agg_null, count(*)
  FROM map_items GROUP BY 1,2 ORDER BY 3 DESC;
```

## The null count, and why it is not a defect

4 161 measures carry no aggregate. That is the source's own answer, not a gap
in the read:

| `IT_FUN_ID` | `FUN_NAME` | items | Meaning |
| ---: | --- | ---: | --- |
| 110 | `Detail` | 8 152 | Oracle's marker for *do not aggregate* |
| 1 | `SUM` | 1 292 | the only real aggregate this estate uses |
| null | — | 353 | no default at all (legacy §3.4's "no default" case) |

`AVG`, `COUNT`, `MIN` and `MAX` have **no live instance** in this EUL. Nothing
is defaulted: a measure whose item says `Detail` keeps a null `agg_function`,
because guessing `SUM` there is a wrong number that looks right, in money.

## Where the two facts come from

Neither file holds both, and the guard needs both.

- **Which items are measures** — the `.DIS` query request's two literal vectors,
  `0x0123` axis and `0x0124` measure (§7.8.3). Already parsed; already in
  `map_items.axis_type`. Given, not inferred (D-031).
- **What to aggregate them with** — `EXPRESSIONS.IT_FUN_ID`, the EUL's Default
  aggregate (§3.2). The `.DIS` carries no per-item aggregate function; its one
  aggregate code (`0x0c1d`) belongs to a *total*.

The brief named the parser as the source of truth for both. It is the source for
the split only. Phase 0.3's Q3 answered the aggregate half — the column
legacy-analysis §3.2 had recorded as UNKNOWN — and Q3's own note says so.

`readItems` hardcoded `aggregation: null`, which is the single line that made the
whole column empty. It is now probed (a missing column would `ORA-00904` the
entire item read) and resolved through `FUNCTIONS`.

## Known gap — `items.agg_function` is still NULL on all 9 626

The brief specified `POST /api/migration/reimport-maps`, which rewrites maps and
**does not rewrite `items`**. `map_items.agg_function` is populated; the item
column is not.

This is a completeness gap, not a correctness one, for migrated maps:
`select-clause.ts:96` reads `mapItem.aggFunction ?? item.aggFunction`, and the
first now answers. It bites a map built in Neo's own UI, which gets no item
default. **A full re-migration fills it** — the write path (`transformItem` →
`items.aggFunction`) is already correct and tested.

## The guard cannot now ship inert — seam 5

`migration-verify` gained a fifth seam. The fan-trap guard's step 0 is
`if |M| = 0: flat plan, STOP`, so an estate with no aggregates classifies every
query that way and the guard passes its own tests while running on nothing.

Seam 5 fails on exactly that state, asserting both halves (a zero in either
`measure` or `withAggregate` fails). `measuresWithoutAggregate` is reported and
never failed on.

Live run: **PASS** — `columns=25962 axis=20014 measure=5920 page=26
unclassified=2 withAggregate=1760 measuresWithoutAggregate=4161
mapsWithAMeasure=402`.

## `agg_function` is constrained

`0012_constrain_agg_function.sql` adds a CHECK over `SUM|COUNT|AVG|MIN|MAX` or
NULL to `items` and `map_items` — the set `lib/sql/formula-parser.ts` accepts.
`map_totals` is deliberately untouched; it has its own established discipline
(§7.12) and widening this change to it is another phase's call.

`COUNT DISTINCT` is decoded by the migration and deliberately never written, so
it is deliberately not permitted here either.

## Tests

`npm test --workspace migrate` — 531 pass.
`npm test --workspace backend -- migration-seams` — 20 pass.

* the parser reads both vectors as the disjoint sets they are
* `readItems` resolves `IT_FUN_ID`, reports `Detail` uninterpreted, and still
  reads items on an EUL lacking the column
* `normalizeAggregation` drops `Detail` and anything Neo cannot run
* `mapItemAggFunction` writes on measures only, and never defaults
* seam 5 against real Postgres: FAIL on a measure-less estate, PASS with one
  measure, and the CHECK refuses `COUNT DISTINCT`

## Found in passing — not this stage's scope

The live `verify` run reports three pre-existing blockers, none touched by this
phase:

* `sql-generation` 808 of 924 maps — the Phase 4 token renderer, unchanged.
* `referential-closure` `mapsWithNoColumns=25` — matches the recorded baseline
  in `docs/migration/verify.md`.
* `reconciliation` drifted 2 — **the declaration is stale, not the data.**
  `worksheet layouts` still declares `expectedTarget: 24` from F-04, but W3
  landed layouts and 923 now exist; `worksheets → maps` declares 923 against 925
  (two hand-made maps). Drift fails in both directions by design — that is the
  alarm working. Correcting `verify/expected-loss.ts` belongs to whoever owns
  those numbers.
