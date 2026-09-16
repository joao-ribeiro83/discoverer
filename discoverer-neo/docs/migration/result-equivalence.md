# Result-set equivalence (Phase 9.1)

Does Neo return what Discoverer returned for the same worksheet? A migration
that imports every row can still answer every question differently. This page
records how Phase 9.1 tests that, what the estate made testable, and what the
test found. It is tier 4 of the validation strategy in
`AUDIT_MIGRATION_ASSESSMENT.md` §8.

Accepted differences, and the defects this work found, are in
[`docs/decisions/accepted-result-differences.md`](../decisions/accepted-result-differences.md).

## How it works

The pattern is the `d4wkdmp` harness's, applied to results instead of metadata:
a reference the legacy system produced, a normaliser, a differ, and an aggregate
report.

| File | Role |
| --- | --- |
| `backend/src/lib/result-diff.ts` | The pure half: normalise cells, diff two row sets as multisets, choose the sample, tally verdicts. Tested in `backend/src/__tests__/result-diff.test.ts`. |
| `backend/src/scripts/diff-results.ts` | The run: find the references, choose the sample, run each worksheet in Neo, compare, report. |
| `backend/src/scripts/probe-qpp-stats.ts` | The read-only probe that found what the legacy system left behind. |
| `backend/src/scripts/verify-fan-trap-m67.ts` | The fan-trap proof from Phase 3.4, re-run here. |

The run lives in `backend/`, not beside `migrate/src/scripts/diff-corpus.ts`,
for the reason `verify-migration.ts` does: only the backend can generate Neo's
SQL.

Each sampled worksheet gets one verdict:

| Verdict | Meaning |
| --- | --- |
| MATCH | Neo's result equals the reference, after normalisation. |
| MISMATCH | It does not — or Neo's statement failed where Discoverer answered. |
| REFUSED | Neo declined to run the worksheet, and said why. |
| NOT_COMPARABLE | No reference can speak for the worksheet, or the harness could not finish the comparison. |

### Running it

Both scripts are read-only against Postgres and against the source Oracle. They
run inside the backend container, which holds the Oracle client. Run them
detached: a legacy statement can take a long time, and a `docker exec` whose
client dies leaves the query running.

```bash
docker exec -d discoverer-neo-backend sh -c 'cd /app/backend && /app/node_modules/.bin/tsx src/scripts/diff-results.ts c5ed9133-3e4c-4c0b-869e-6f62d6f8b194 --sample 30 --timeout-s 1800 --report /tmp/diff-results.json --detail /tmp/diff-results-detail.json > /tmp/diff-results.log 2>&1'
```

```bash
docker exec -d discoverer-neo-backend sh -c 'cd /app/backend && /app/node_modules/.bin/tsx src/scripts/verify-fan-trap-m67.ts > /tmp/fan-trap.log 2>&1'
```

`--report` holds verdicts and counts. `--detail` holds both sides of each
row-level mismatch — customer data — so the script refuses any path outside
`/tmp`. Never copy it into the repository.

## What the legacy system left behind

Discoverer Desktop itself was not run. Four references exist without it.

| Reference | What it is | Strength | Reach here |
| --- | --- | --- | --- |
| `LEGACY_SQL` | A scheduled run leaves `EUL4_B<stamp>Q<n>V1`, a view over the statement Discoverer generated for that sheet, with that run's parameter values, beside `…R1`, the rows it stored. Re-executed, it is Discoverer's answer on today's data. | Strong | 4 sheets: one run of `GD_M.M58D_V09.DIS` on 2026-05-07. Other runs' views predate their workbook's last save, belong to no surviving run, or sit in a schema this account cannot read. |
| `QPP_ROW_COUNT` | `EUL4_QPP_STATS.QS_NUM_ROWS`, the row count Discoverer recorded for an execution. | **Weak** — a count, from the past | 7 316 recordings, 2010–2026. Usable only when the sheet has no parameters, or the run was scheduled and `EUL4_BATCH_PARAMS` kept its values. |
| `SOURCE_REFERENCE` | A hand-written query over the source tables. | Independent of Neo, but not Discoverer | The `M M67 1 → M M67` fan trap. |
| Discoverer Desktop | `DIS4USR.EXE /CONNECT … /OPENDB … /SHEET … /PARAMETER … /EXPORT CSV … /BATCH`. The switches are confirmed in its own message file, `DCMRESUS.MSB`. | Strongest | Not run. It needs the EUL password on the Windows host, and `QPPCreateNewStats = 0` under `HKCU\Software\Oracle\Discoverer 4\Database`, so it does not write to the source's `QPP_STATS`. Both are the operator's to do. |

A `LEGACY_SQL` statement is trusted only when exactly one scheduled run owns its
stamp, when it was generated after the workbook's last save, and when
re-executing it reproduces the rows the scheduler stored. The harness checks the
last condition on the statement's item columns first, because naming a
calculation column makes Oracle evaluate the worksheet's calculations — which
took Discoverer's own run six hours.

## Normalisation

A difference of representation is not a difference of answer. The normaliser
absorbs NULL against an empty string, CHAR padding, CP1252 read as ISO-8859-1,
Unicode composition, binary noise in numbers, digits the reference cannot show,
and a time of day the reference does not print — and nothing else. The table,
the reasons and the tests are in the decision record. Each rule's test changes
one value and requires a mismatch that shows both values. The run repeats that
check on real rows.

## The sample

`QPP_STATS` names 1 441 documents. 635 worksheets resolve to migrated maps, ranked
by recorded executions. The sample is drawn from the worksheets a reference can
speak for, most-used first, until it covers each hard case both ways:
single-folder and multi-folder, with and without calculations, with and without
totals, `SELECT DISTINCT` and not, and a master–detail join. It then adds every
`LEGACY_SQL` sheet and every scheduled run whose parameters were kept, whatever
their rank. A hard case no comparable worksheet covers is reported, not
dropped.

Neo runs each worksheet as its migrated owner, through the entitlement gate a
user's execution uses. The Oracle account must be the one Discoverer used for
the reference. A reference another account produced does not count: that
account resolves names to its own objects and holds its own grants, and a
comparison with broader rights could show rows the legacy user never saw.
Row-level security runs OPEN: see the decision record.

## Results — 2026-09-16

Measured on the estate as it stood at 20:41 UTC: after the per-sheet scoping
re-import, the bound-literal fixes and the first Phase 9.2 delta. Connected as
`SIID_TESTES`, statement budget 1 800 s.

**The fan-trap guard is proven against the source system.** `M M67 1 → M M67`,
a header total filtered by its lines: Oracle's reference query returns
4 392 650.47, Neo's rewrite returns 4 392 650.47, and the naive join would return
1 278 415 648.69 — 291.04 times too much. Same numbers as Phase 3.4.

**The sample.** 635 worksheets have recorded usage. 28 have a reference that can
speak for them. 8 more were produced by another account (`MAPTESTES`'s scheduled
runs) and are excluded. The planner generates SQL for 596 of the 635 and cannot
load 39.

| Verdict | `LEGACY_SQL` | `QPP_ROW_COUNT` (weak) | Total |
| --- | --- | --- | --- |
| MATCH | 2 | 0 | 2 |
| MISMATCH | 1 | 19 | 20 |
| REFUSED | 0 | 4 | 4 |
| NOT_COMPARABLE | 1 | 1 | 2 |

| Worksheet | Hard cases | Reference | Verdict | Rows: legacy / Neo | Why |
| --- | --- | --- | --- | --- | --- |
| GD_M.M58D_V09.DIS — MAPA 58D - CO-SEGURO | calculated | `LEGACY_SQL` | MATCH | 0 / 0 | |
| GD_M.M58D_V09.DIS — MAPA 58D - PARTICIPACAO RESULTADOS | calculated, totals | `LEGACY_SQL` | MATCH | 0 / 0 | |
| GD_M.M58D_V09.DIS — MAPA 58D - RECIBOS NÃO VENCIDOS | calculated, totals | `LEGACY_SQL` | MISMATCH | 0 / 46 | Neo lacks one of the statement's four filters — a date `BETWEEN` with `TO_DATE(:parameter)` bounds |
| GD_M.M58D_V09.DIS — MAPA 58D - RECIBOS VENCIDOS | calculated, totals | `LEGACY_SQL` | NOT_COMPARABLE | — | re-executed, the statement no longer returns 855 of the 861 rows it stored on 2026-05-07: the source data moved |
| GD_M.M132_V01.DIS — Folha 1, Folha 2, Folha 3 | calculated | weak | REFUSED ×3 | — | calculation "linha" is quarantined |
| GD_M.M113_V01 | calculated, totals | weak | REFUSED | — | calculation "EXPOSIÇÃO" is quarantined |
| GD_M.M16_V03 — M16 - Propostas em Aberto | calculated, totals, distinct | weak | NOT_COMPARABLE | — | Neo's statement outlived 1 800 s |
| GD_M.M25_V08 · V09 · V10 · V11 · V12 | calculated, totals, distinct | weak, 2013–2023 | MISMATCH ×5 | 136 · 74 · 74 · 26 · 45 / 126 each | |
| GD_M.M07_V01 · GD_M.M07_V02.DIS | calculated, distinct | weak, 2017–2018 | MISMATCH ×2 | 0 / 14 734 | |
| GD_M.M13_V01 · GD_M.M13_V01.DIS · GD_M.M13_V02.DIS | — | weak, 2011–2023 | MISMATCH ×3 | 447 · 0 · 2 664 / 2 668 | |
| GD_M.M123_V01.DIS — Mais de 2 · 7 · 10 dias | — | weak, 2021 | MISMATCH ×3 | 594 · 242 · 663 / 717 | |
| GD_M.M157_V01 — M157 - Entidades · Grupos | calculated, distinct | weak, 2015 | MISMATCH ×2 | 0 / 1 269 · 674 / 469 | |
| GD_M.M113_V02 | calculated, totals, distinct | weak, 2015 | MISMATCH | 0 / 5 480 | |
| GD_M.M163_V01 | calculated | weak, 2015 | MISMATCH | 0 / 17 306 | |
| GD_M.M172_V01.DIS | — | weak, 2022 | MISMATCH | 0 / 8 074 | |
| GD_M.M89_V04 — M89 - RCCs | calculated, totals, distinct | weak, 2015 | MISMATCH | 0 / 112 614 | |

**The weak reference carries no signal here.** None of its 19 mismatches is
evidence of a defect. The recordings are 3 to 15 years old. Nine of them
recorded 0 rows. The five versions of `M25` recorded five different counts,
where Neo returns 126 for each. The three `M123` sheets are named for an age in
days, so their answer moves every day.

**What is not covered.** No comparable worksheet is multi-folder, and none
crosses a master–detail join; the fan-trap proof above stands in for the
second. No worksheet matched with rows, so the run's own real-data check of the
normaliser did not run; the unit tests carry it. The most-used worksheets —
`GD_M.M05_V01` (105 runs), `GD_M.M117_V01` (71), `GD_M.M58D_V01 — MAPA 58D - RECIBOS VENCIDOS` (70),
`GD_M.M08_V01.DIS` (59), `GD_M.M61_V08` (55) — are parameterised, and no run of
theirs kept its values.

## What this proves, and what it does not

Proven: Neo's fan-trap rewrite reproduces the source system's total. Two
worksheets with calculations and totals reproduce Discoverer's own statement
row for row — but both return no rows with their scheduled parameters, so
their calculations were never compared on a value. The refusals Phase 9.1 found
were migration defects, and the largest are fixed. One real difference remains
open: a date filter that does not migrate adds rows.

Not proven: that Neo returns Discoverer's rows on a worksheet that returns rows,
for `SELECT DISTINCT`, multi-folder or calculated worksheets. The estate's
recorded output cannot say. **The migration is not yet proven equivalent.** The
next evidence has to come from Discoverer Desktop itself, run with the
parameter values Neo is given: that reaches the most-used worksheets and every
hard case, row for row. Its two gates are in the table of references above.
