# Scheduled result retention: the nine `EUL4_B*Q*R1` tables

**Date:** 2026-09-14 · **Status:** **superseded 2026-09-17 — see below**
**Context:** [`migrate/EUL_SCHEMA_GROUND_TRUTH.md` §3.8](../../migrate/EUL_SCHEMA_GROUND_TRUTH.md)

> **This decision was reversed at Phase 9.3 cutover planning.** Dropping the
> row contents unrecoverably, on the say-so of a reconstruction-cost argument
> that turned out to matter less than "don't destroy data before the legacy
> source is gone," was the wrong call. The nine tables' rows are migrated
> into `scheduled_results` instead — see
> [`docs/deployment/cutover-runbook.md`](../deployment/cutover-runbook.md#blocking-decisions)
> and [`docs/migration/migration-tool.md`](../migration/migration-tool.md#scheduled-batch-reports-and-their-historical-results)
> for the implementation (`backend/src/services/batch-result-import.service.ts`,
> run via `src/scripts/import-batch-results.ts`). The analysis below (what the
> tables contain, why they were unreadable without the alias map) is still
> accurate and is what the migration code decodes against — only the
> **Decision** and **Execution** sections are superseded.

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

## Decision (2026-09-14, superseded)

~~Drop all nine tables. Do not migrate their contents into `scheduled_results`
or object storage.~~

## Decision (2026-09-17, current)

**Migrate the row contents into `scheduled_results`, attached to the schedule
each table's owning report+sheet was already migrated to (Phase 7.2). Do not
discard them, and do not leave them stranded in a source about to be
read-only-then-gone.**

Implemented in `backend/src/services/batch-result-import.service.ts`, run via
`src/scripts/import-batch-results.ts` — see
[`docs/migration/migration-tool.md`](../migration/migration-tool.md#scheduled-batch-reports-and-their-historical-results).

## Why the reversal

The 2026-09-14 reasoning below was sound as far as it went, but weighed the
wrong things against each other: reconstruction cost is a one-time cost paid
once, by code, not "by every future reader forever" — and it is now paid.
Losing the one table with real data because dropping was easier than decoding
it is not an acceptable trade at cutover, when the source is about to become
unreadable for good. The original reasoning, kept for the record:

- 8 of 9 are empty — there is nothing to lose *from those eight*.
- The one table with data requires reconstructing a column-alias map per
  table before a single value in it means anything; that reconstruction cost
  falls on every future reader, forever, for one stale 861-row snapshot. —
  **Superseded: the alias map is now decoded once, by
  `parseResultAliasMap()`, not re-derived per reader.**
- Every source batch report is a one-shot run (`BR_AUTO_REFRESH = 0`, see
  §3.8), so none of these results represent an ongoing report a user still
  depends on seeing historically — they are single point-in-time captures
  whose corresponding schedule has already completed.
- Migrated schedules import disabled and are re-run under the modern
  scheduler when a human enables them; a fresh, correctly-labelled result is
  one enable away, and is more trustworthy than reverse-engineering an old
  unlabelled capture. — **Still true, and still not a reason to destroy the
  one real historical capture that exists: a re-run produces new data, it
  does not recover the old.**

## Scope

This decision is about the **row contents** of the nine tables, now migrated
into Neo. It does not license dropping the tables from the source Oracle
EUL — that is the customer's own database, out of scope for Discoverer Neo.
A human operator may drop them from Oracle at their own discretion once the
source EUL is decommissioned **and the batch-result backfill above has been
run and verified** — dropping first would destroy the one table this
migration exists to preserve.

## Execution — pending, not yet run

Asked directly on 2026-09-14 whether to run `DROP TABLE` against the live
`SIID_TESTES` schema then: **declined.** Dropping from a live Oracle database
is an irreversible action against the customer's own system, not something
this tooling executes on its own say-so — a DBA runs it, on their own
schedule, when they're ready, and only after confirming the migrated
`scheduled_results` rows are in place.

The statements, for whoever does run it:

```sql
DROP TABLE SIID_TESTES.EUL4_B110321141200Q1R1;
DROP TABLE SIID_TESTES.EUL4_B110322085606Q1R1;
DROP TABLE SIID_TESTES.EUL4_B110401095209Q1R1;
DROP TABLE SIID_TESTES.EUL4_B110401101850Q1R1;
DROP TABLE SIID_TESTES.EUL4_B110401102507Q1R1;
DROP TABLE SIID_TESTES.EUL4_B110401102915Q1R1;
DROP TABLE SIID_TESTES.EUL4_B110401111749Q1R1;
DROP TABLE SIID_TESTES.EUL4_B110401112553Q1R1;
DROP TABLE SIID_TESTES.EUL4_B110401113030Q1R1;
DROP TABLE SIID_TESTES.EUL4_B260506220828Q1R1;
DROP TABLE SIID_TESTES.EUL4_B260506220828Q2R1;
DROP TABLE SIID_TESTES.EUL4_B260506220828Q3R1;
DROP TABLE SIID_TESTES.EUL4_B260506220828Q4R1;
```

`EUL4_B260506220828Q1R1` is the one with 861 rows — the decision above
covers it too (drop all nine), but it's the one statement in this list
that actually destroys data rather than an already-empty table, worth a
second look before running.
