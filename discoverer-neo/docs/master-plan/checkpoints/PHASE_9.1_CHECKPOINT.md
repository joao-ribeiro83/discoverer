# Phase 9.1 checkpoint — result-set equivalence

The equivalence report is [`docs/migration/result-equivalence.md`](../../migration/result-equivalence.md).
Accepted differences and the defects found are in
[`docs/decisions/accepted-result-differences.md`](../../decisions/accepted-result-differences.md).

## Status

| Item | State |
|---|---|
| Differ — normalise, diff as multisets, choose the sample, tally | Done — `backend/src/lib/result-diff.ts`, 15 tests; every normalisation rule has a test that alters one value |
| Harness over the live estate | Done — `backend/src/scripts/diff-results.ts`, read-only on both databases |
| Legacy output reached | Partly — Discoverer's own statements kept by its scheduler, for 4 sheets. Discoverer Desktop itself was not run |
| Stratified sample from `QPP_STATS` usage | Done — 635 used worksheets, 28 with a reference, 8 excluded because another account produced theirs. Multi-folder and master–detail: no comparable worksheet |
| A verdict per sampled worksheet | Done — MATCH 2, MISMATCH 20, REFUSED 4, NOT_COMPARABLE 2 (2026-09-16 20:41 UTC) |
| Master–detail aggregate matches the source system | Done — 4 392 650.47 on both sides; the naive join would be 291.04× (re-run 2026-09-16) |
| A `SELECT DISTINCT` worksheet's row count matches | **Not met** — the 12 `DISTINCT` worksheets had only old, weak counts, or timed out |
| A worksheet with calculated fields matches | **Partly** — two match Discoverer's statement row for row, both with 0 rows |
| Normalisation documented and tested | Done — the run's real-data check did not run, because no match had rows |
| Mismatches reported with both values | Done — counts in the report; the one row-level mismatch's rows stay in the container's `/tmp` |
| No result data committed or logged | Done |
| The weaker reference labelled | Done — `QPP_ROW_COUNT` is labelled WEAK wherever it appears |

## Defects found

Four defects, reported and classified. The first two were fixed by other work
during the phase.

- Calculation literals never bound (`ORA-01008`) — fixed, `cdb779c`, `ec02167`, `6816ba4`.
- Workbook conditions, parameters and calculations on every sheet — fixed, `60b8a31`, re-imported 2026-09-15.
- A date condition with `TO_DATE(:parameter)` bounds does not migrate — open. Neo returns 46 rows where Discoverer returns 0.
- `M61_V10` fails with `ORA-01722` — open.

## Resume here

1. Read the equivalence report, then this file.
2. The first uncompared strata are multi-folder and master–detail worksheets,
   and any row-level comparison that has rows — `SELECT DISTINCT`, calculated.
   The estate's recorded output cannot reach them. Discoverer Desktop can:
   `DIS4USR.EXE /CONNECT … /OPENDB … /SHEET … /PARAMETER … /EXPORT CSV … /BATCH`.
   Two operator steps come first: put the EUL password on the Windows host, and
   set `HKCU\Software\Oracle\Discoverer 4\Database\QPPCreateNewStats = 0`, so
   the runs do not write to the source's `QPP_STATS`.
3. Re-measure with the command in the report. Run it detached, with
   `--timeout-s 1800`.

## Traps met

- A container stop kills a detached run without a word. On 2026-09-15 the
  fan-trap check had waited 7 hours inside Oracle when the stack stopped.
  Re-run the next day with a 1-hour cap, it passed in minutes.
- After a statement outlives its budget, a new pooled connection can take longer
  than the pool's 10 s wait. The harness now retries rather than stopping.
- This account cannot read `V$SESSION`, so a query left running on the source
  cannot be seen from here.
- Selecting a legacy statement's calculation columns makes Oracle evaluate the
  worksheet's calculations — hours, as Discoverer's own run took. Its item
  columns alone return quickly.
