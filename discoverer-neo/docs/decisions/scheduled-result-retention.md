# Scheduled result retention: the nine `EUL4_B*Q*R1` tables

**Date:** 2026-09-14 · **Status:** decided
**Context:** [`migrate/EUL_SCHEMA_GROUND_TRUTH.md` §3.8](../../migrate/EUL_SCHEMA_GROUND_TRUTH.md)

## What was found

Every scheduled batch report Discoverer ever ran materialised its result set
into its own table, named `EUL4_B<timestamp>Q<query-index>R1`. Nine such
tables exist on the live estate:

| Table | Rows | Last analyzed |
| --- | --- | --- |
| `EUL4_B110321141200Q1R1` | 0 | 2025-03-21 |
| `EUL4_B110322085606Q1R1` | 0 | 2025-03-22 |
| `EUL4_B110401095209Q1R1` | 0 | 2025-04-08 |
| `EUL4_B110401101850Q1R1` | 0 | 2025-04-08 |
| `EUL4_B110401102507Q1R1` | 0 | 2025-04-08 |
| `EUL4_B110401102915Q1R1` | 0 | 2025-04-08 |
| `EUL4_B110401111749Q1R1` | 0 | 2025-04-08 |
| `EUL4_B110401112553Q1R1` | 0 | 2025-04-08 |
| `EUL4_B110401113030Q1R1` | 0 | 2025-04-08 |
| `EUL4_B260506220828Q1R1` | **861** | 2026-05-07 |
| `EUL4_B260506220828Q2R1` | 0 | 2026-05-07 |
| `EUL4_B260506220828Q3R1` | 0 | 2026-05-07 |
| `EUL4_B260506220828Q4R1` | 0 | 2026-05-07 |

(Table-name timestamps decode as creation dates from 2011-03-21 through
2026-05-06; `last_analyzed` above is Oracle's stats date, close to but not
identical to creation.)

**Content shape:** every table's columns are generic `BRVCn` (VARCHAR2) /
`BRNn` (NUMBER) / `BRDn` (DATE) — positional, not named. The only thing that
gives them meaning is the `E<expr_id>` alias map recorded in the *owning*
`EUL4_BATCH_QUERIES.BQ_RESULT_SQL_*` row, which in turn points back into
`EXPRESSIONS`. There is no way to read a `BRVC7` column as "customer name"
without first re-deriving that map per table.

Eight of the nine tables are empty. The one populated table
(`EUL4_B260506220828Q1R1`) holds 861 rows of generic, unlabelled data from a
single run four months ago.

## Decision

**Drop all nine tables. Do not migrate their contents into `scheduled_results`
or object storage.**

## Why

- 8 of 9 are empty — there is nothing to lose.
- The one table with data requires reconstructing a column-alias map per
  table before a single value in it means anything; that reconstruction cost
  falls on every future reader, forever, for one stale 861-row snapshot.
- Every source batch report is a one-shot run (`BR_AUTO_REFRESH = 0`, see
  §3.8), so none of these results represent an ongoing report a user still
  depends on seeing historically — they are single point-in-time captures
  whose corresponding schedule has already completed.
- Migrated schedules import disabled and are re-run under the modern
  scheduler when a human enables them; a fresh, correctly-labelled result is
  one enable away, and is more trustworthy than reverse-engineering an old
  unlabelled capture.

## Scope

This decision is about the **row contents** of the nine tables. It does not
license dropping the tables from the source Oracle EUL — that is the
customer's own database, out of scope for Discoverer Neo. Phase 7.2 does not
write to, read the contents of, or reference these nine tables from Neo; a
human operator may drop them from Oracle at their own discretion once the
source EUL is decommissioned.
