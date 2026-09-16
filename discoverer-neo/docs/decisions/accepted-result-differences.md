# Accepted result differences (Phase 9.1)

**Date:** 2026-09-15 · **Status:** decided
**Context:** [`docs/migration/result-equivalence.md`](../migration/result-equivalence.md) — the
equivalence report. Harness `backend/src/scripts/diff-results.ts`, differ
`backend/src/lib/result-diff.ts`.

Phase 9.1 compares what Neo returns with what Discoverer returned. This page
lists every difference we accept, and why. Any other difference is a defect.
The defects found so far are listed at the end, so nobody reads them as
accepted.

## Accepted

### 1. Row-level security fails closed (D-090)

Neo refuses a map when no active policy covers a folder it reads. Discoverer
returned the rows. This is Neo's one deliberate incompatibility, because
Discoverer's own row-level security failed open by construction.

This estate has no row-level security to reproduce (Phase 6.3 measured it). So
the harness runs with `ROW_LEVEL_FAIL_MODE=OPEN`. Over an empty policy table,
OPEN adds no predicate and returns the rows Discoverer returned. A live deploy
still refuses every map until policies exist, or until OPEN is set on purpose.

### 2. Values the differ treats as equal

These are differences of representation, not of answer. The normaliser absorbs
them and nothing else.

| Reference shows | Neo returns | Why they are equal |
| --- | --- | --- |
| NULL | `''` | Oracle stores an empty string as NULL |
| `SEGURO␣␣␣` | `SEGURO` | CHAR padding |
| U+0092 | `’` | CP1252 punctuation decoded as ISO-8859-1; the estate is `WE8ISO8859P1` |
| `e` + combining acute | `é` | Unicode composition (NFC) |
| `0.30000000000000004` | `0.3` | binary noise below 15 significant digits |
| `100,10` | `100.1` | rounded (Oracle `ROUND`) to the digits the reference can show — never finer |
| a date with no time | the same date at 13:45 | only when the reference prints no time |

Every rule has a test that changes one value — a cent, an accent, a day, a NULL
into zero — and requires a mismatch that shows both values
(`backend/src/__tests__/result-diff.test.ts`). The harness repeats that check on
real rows whenever a run produces a match that has rows.

### 3. Order among rows that tie on the sort

Oracle may return rows that tie on the `ORDER BY` in any order, in Discoverer as
in Neo. Order is compared on the sort columns only.

## Decisions about the references

- **A statement Discoverer's scheduler kept** (`EUL4_B<stamp>Q<n>V1`) counts as
  Discoverer's answer only when exactly one scheduled run owns its stamp, when it
  was generated after the workbook's last save (so it describes the worksheet Neo
  migrated), and when re-executing it reproduces the rows the scheduler stored
  (`…R1`). Reading those tables to verify, in memory and never persisted, is not
  migrating them: [`scheduled-result-retention.md`](scheduled-result-retention.md)
  stands.
- **A recorded row count** (`EUL4_QPP_STATS.QS_NUM_ROWS`) is a weak reference and
  is labelled WEAK wherever it is quoted. A count that differs is not a defect by
  itself: the recordings span 2010–2026, the data moves, and the estate's own
  recordings of one sheet differ from each other. A count that matches cannot see
  a changed value.
- **Row counts cannot test the fan-trap guard.** The rewrite changes totals, not
  how many rows a grouped worksheet returns. The guard's proof is an aggregate
  compared with the source system — Phase 3.4's reference query, re-run here.
- **Neo runs as the map's migrated owner** (`maps.created_by`), through the
  entitlement gate a user's execution uses, on the Oracle account Discoverer's
  scheduler used. With no row-level security in the estate, the rows cannot
  depend on the user beyond object privileges, which both sides share.

## Not accepted — defects found

Phase 9.1 reports and classifies defects; it does not fix them. Each went to
separate follow-up work.

| Defect | Evidence | Status |
| --- | --- | --- |
| Calculation literals are never bound | The renderer turns literals into `:v1…` binds; `dn-migrate verify --compile` persisted only the SQL text; Phase 7.2 made that text the execution path. `M61_V10` failed with `ORA-01008`, 24 binds unbound. When measured: 43 980 of 48 002 compiled calculations, shown on 653 active maps. | Fixed — `cdb779c` stores and binds the literals, `ec02167` binds a parameter only a calculation names, `6816ba4` binds number literals as numbers |
| Workbook conditions, parameters and calculations on every sheet | Discoverer's own statements for the four `GD_M.M58D_V09.DIS` sheets each read one table. Neo gave each sheet 10 conditions over 3 folders, 41 calculations where the sheet shows 17, and parameters Discoverer's scheduled runs never supplied, and refused the sheets (`DISCONNECTED`). 347 of 570 maps in multi-sheet workbooks filtered a folder none of their columns use. This overturns Phase 7.2's reading that the source never wired the join: Discoverer never needed it. | Fixed — `60b8a31`, applied by the live re-import of 2026-09-15; follow-ups `4ff9a5e`, `69484f7`, `d1d1fa5` |
| A date condition whose bounds are `TO_DATE(:parameter)` does not migrate | Discoverer's statement for "MAPA 58D - RECIBOS NÃO VENCIDOS" has four filters, one of them `BETWEEN TO_DATE(<DT Inicio>) AND TO_DATE(<DT Fim>) + 0.99999` on a date item. Neo's map holds the other three. With the scheduled run's parameters, Discoverer returns 0 rows and Neo returns 46. | Open |
| `M61_V10` fails in Oracle with `ORA-01722` | Its binds are all bound. The cause, as diagnosed: a multi-value parameter migrated as one `STRING` compared with `=`, and a calculation condition compares dates as text because the calculation has no data type. Found while comparing; its reference came from another account, so no verdict is claimed. | Open |
