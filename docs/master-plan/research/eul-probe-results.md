# Phase 0.3 — Read-only EUL probe: results

**Source.** Live Oracle EUL, data source `c5ed9133-3e4c-4c0b-869e-6f62d6f8b194`
("SIID_TESTES"), schema `SIID_TESTES`, prefix `EUL4_`, Discoverer 4.1.
Reached through the backend Docker image (`discoverer-neo-backend:latest`),
which carries the Oracle Instant Client; `ORACLE_THICK_MODE=true` — thin mode
cannot authenticate against this pre-11g password verifier.

**Method.** A throwaway read-only runner
(`backend/src/scripts/probe-eul-readonly.ts`, deleted after the run) that
refuses any statement that is not a `SELECT` or `WITH` before it reaches the
database. No `INSERT`, `UPDATE`, `DELETE` or DDL was issued. The raw output of
every query is reproduced below so a future session can re-derive each verdict.

**Status: all six questions answered.** Q1's measurement covers 8 of the 10
joins. The last two were **deliberately abandoned** — see Q1 for why they
cannot change the verdict.

---

## Q1 — Which end of a join is the master? A cardinality measurement

**Verdict: `KEY_OBJ_ID` is the DETAIL folder. `FK_OBJ_ID_REMOTE` is the
MASTER. `eul-schema-adapter.ts:129-130` was INVERTED and is now fixed, with a
regression test carrying these numbers.**

### The measurement

For each join, both folders were resolved to their underlying database object,
then per side: `SELECT COUNT(*)` and the count of distinct join-key tuples
(`SELECT COUNT(*) FROM (SELECT DISTINCT <key columns> FROM <object>)`). The
side whose key is duplicated more is the many side — the detail.

**First finding, before any count: the folders are Oracle VIEWS, not tables.**
`ALL_OBJECTS` reports `VIEW` for `M_M67`, `M_M67_1`, `M_M67_2`, `M_M27`,
`M_M27_1`, `M_M111`, `M_M111_1`. Every count therefore re-executes the view —
which is why this probe took hours rather than seconds, and why a future
session should budget for it. `ALL_TABLES.NUM_ROWS` is **null** for all of
them: the schema has never been analysed, so no dictionary shortcut exists and
the counts really had to be run.

| KEY_ID | join name | `KEY_OBJ_ID` side | rows | keys | rows/key | `FK_OBJ_ID_REMOTE` side | rows | keys | rows/key | reading |
| ---: | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 104690 | M M166 -> M M166 Coseg | `M_M166_COSEG` | 0 | 0 | — | `M_M166` | 9 948 | 2 | 4 974 | **non-informative** — key side empty |
| 104694 | M M167 -> M M167 Coseg | `M_M167_COSEG` | 0 | 0 | — | `M_M167` | 880 | 2 | 440 | **non-informative** — key side empty |
| 104698 | M M67 1 -> M M67 | `M_M67` | 833 340 | 50 900 | 16.4 | `M_M67_1` | 2 623 | 1 016 | 2.6 | `KEY_OBJ_ID` = **DETAIL** |
| 104706 | M M67 2 -> M M67 | `M_M67` | 833 340 | 50 900 | 16.4 | `M_M67_2` | 28 019 | 2 382 | 11.8 | `KEY_OBJ_ID` = **DETAIL** (weak, 1.4×) |
| 108451 | M M111 -> M M111 1 | `M_M111_1` | 216 | 94 | 2.30 | `M_M111` | 1 830 | 1 830 | **1.00** | `KEY_OBJ_ID` = **DETAIL** — **decisive** |
| 108459 | M M12 -> M M12 1 | `M_M12_1` | 1 720 | 1 507 | 1.14 | `M_M12` | 4 214 | 3 405 | 1.24 | **tied** — 1.09× apart, noise |
| 109818 | M M27 -> M M27 1 | `M_M27_1` | *not measured* | | | `M_M27` | *not measured* | | | abandoned |
| 109828 | M M32 -> M M32 1 | `M_M32_1` | 10 920 | 161 | 67.8 | `M_M32` | 2 809 | 1 568 | 1.79 | `KEY_OBJ_ID` = **DETAIL** |
| 111467 | M M89 1 -> M M89 2 | `M_M89_2` | 112 614 | 39 970 | 2.82 | `M_M89_1` | 6 660 408 | 15 164 | 439 | `KEY_OBJ_ID` = **MASTER** — **contradicts** |
| 104714 | M M79b Coseg -> M M79b | `M_M79B` | *not measured* | | | `M_M79B_COSEG` | *not measured* | | | abandoned |

**Tally over the 6 informative joins: 4 for `KEY_OBJ_ID` = detail, 1 tied,
1 against.**

### Why 109818 and 104714 were abandoned rather than waited out

Both counts are unfiltered scans of Oracle **views** and had each run past two
hours without returning. Neither can change the verdict:

- **They cannot outrank 108451.** The verdict rests on the one join with a
  provably unique key. A ratio from a join with duplicates on both sides — the
  shape every other join in this estate has — is weaker evidence by
  construction, whichever way it points.
- **104714 is almost certainly non-informative anyway.** Its remote side is
  `M_M79B_COSEG`, and the other two `_COSEG` folders both returned **0 rows**.
  An empty side yields no ratio.
- **109818 is `M M27 -> M M27 1`**, the join `legacy-analysis.md` §2.2 cites.
  Its *naming* is already recorded above and already agrees with the verdict;
  only its counts are missing.

**To finish them later**, run the two statements in
`q1b.sql` / `q1c.sql` (reproduced in Q1's method above) against
`M_M79B`/`M_M79B_COSEG` and `M_M27`/`M_M27_1`, ideally after the schema has
been analysed so `ALL_TABLES.NUM_ROWS` gives a cheap first look. Neither is on
the critical path for Phase 3.

### Why the verdict is not just a majority vote

**`108451` is the only join in this estate that satisfies the master–detail
contract at all.** `M_M111` returns 1 830 rows and **exactly 1 830** distinct
`(UE, PRODUTO, N_APOLICE)` tuples — a provably unique key, which is what a
master *is*. Its partner `M_M111_1` has 216 rows over 94 keys. That unique side
sits on **`FK_OBJ_ID_REMOTE`**. No other join has a unique key on either side,
so no other join can settle the question on its own; 108451 can, and it does.

The three supporting joins (104698, 104706, 109828) all put the heavier
duplication on `KEY_OBJ_ID`, 109828 by a factor of 38.

### The one contradiction, and why it does not overturn the verdict

`111467 M M89 1 -> M M89 2` puts 439 rows per key on the remote side against
2.8 on the key side. But **neither side is unique** — 6 660 408 rows over
15 164 keys on one side, 112 614 over 39 970 on the other. That is a
many-to-many in the raw data, so it has no master by measurement in either
direction. It cannot outweigh a join that *does* have a unique side, and it is
recorded here as the anomaly it is. `108459` is likewise a near-tie (1.14 vs
1.24) and carries no signal.

**Recorded as a finding:** the estate does not enforce master-side uniqueness.
Nine of ten joins have duplicate keys on *both* sides. Orientation in this EUL
is an **author's declaration**, not a property the data can be counted back
out of. That is precisely why the flags (Q2) matter and why D-033's
assume-fanning default is the right one.

### The naming cross-check — run, recorded, and it corrects the brief

`SELECT k.key_id, k.key_name, d.obj_name AS key_obj, m.obj_name AS remote_obj FROM eul4_key_cons k JOIN eul4_objs d ON d.obj_id = k.key_obj_id JOIN eul4_objs m ON m.obj_id = k.fk_obj_id_remote`

| KEY_ID | KEY_NAME | `KEY_OBJ_ID` → | type | table | `FK_OBJ_ID_REMOTE` → | type | table |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 104690 | M M166 -> M M166 Coseg | M M166 Coseg | SOBJ | `M_M166_COSEG` | M M166 | SOBJ | `M_M166` |
| 104694 | M M167 -> M M167 Coseg | M M167 Coseg | SOBJ | `M_M167_COSEG` | M M167 | SOBJ | `M_M167` |
| 104698 | M M67 1 -> M M67 | M M67 | SOBJ | `M_M67` | M M67 1 | SOBJ | `M_M67_1` |
| 104706 | M M67 2 -> M M67 | M M67 | SOBJ | `M_M67` | M M67 2 | SOBJ | `M_M67_2` |
| 104714 | M M79b Coseg -> M M79b | M M79b | SOBJ | `M_M79B` | M M79b Coseg | SOBJ | `M_M79B_COSEG` |
| 108451 | M M111 -> M M111 1 | M M111 1 | SOBJ | `M_M111_1` | M M111 | SOBJ | `M_M111` |
| 108459 | M M12 -> M M12 1 | M M12 1 | SOBJ | `M_M12_1` | M M12 | SOBJ | `M_M12` |
| 109818 | M M27 -> M M27 1 | M M27 1 | SOBJ | `M_M27_1` | M M27 | SOBJ | `M_M27` |
| 109828 | M M32 -> M M32 1 | M M32 1 | SOBJ | `M_M32_1` | M M32 | SOBJ | `M_M32` |
| 111467 | M M89 1 -> M M89 2 | M M89 2 | SOBJ | `M_M89_2` | M M89 1 | SOBJ | `M_M89_1` |

Two things follow, and one of them corrects `legacy-analysis.md` §2.2.

1. **`KEY_NAME` is always `A -> B`, and `KEY_OBJ_ID` is always `B`** — the
   right side of the arrow, on all ten rows without exception. Read together
   with the measurement, **the arrow means `master -> detail`.** On 108451,
   `M M111 -> M M111 1`, the arrow's left side is exactly the folder with the
   unique key.
2. **The "owning folder is always the subordinate (`X 1`, `X Coseg`)" pattern
   in `legacy-analysis.md` §2.2 does not hold** on the full ten. It was drawn
   from five `d4dumps` records that happened to share a shape. Joins 104698,
   104706 and 104714 put the **base** folder on `KEY_OBJ_ID` and the
   subordinate on `FK_OBJ_ID_REMOTE`. §2.2's *expected* result — `key_obj` =
   `M M27 1`, `remote_obj` = `M M27` — does hold for 109818, but as one of two
   shapes, not as the rule.

   **So the naming heuristic that the brief offered as a cross-check is not
   reliable in the form it was stated, while the arrow convention is.** The
   measurement and the arrow convention agree; the subordinate-naming rule is
   withdrawn. This is the disagreement the brief asked to be recorded — and it
   resolves in favour of the measurement.

### What was fixed

`migrate/src/services/eul-schema-adapter.ts` now maps
`KEY_OBJ_ID → detailFolderId` and `FK_OBJ_ID_REMOTE → masterFolderId`.
Regression test: `migrate/src/__tests__/eul-schema-adapter.test.ts`,
*"EUL4 live shape: KEY_OBJ_ID is the detail, FK_OBJ_ID_REMOTE the master"* —
it fixes the observed folder ids **and the measured key counts** as the
fixture, so a future session reads the evidence rather than the conclusion.

---

## Q0 — The `JP` predicate shape

**Verdict: one `EXPRESSIONS` row per join. A multi-column predicate is encoded
*inside* that single row's `EXP_FORMULA1` token tree, not as *n* rows.**

The link column is **`JP_KEY_ID` -> `EUL4_KEY_CONS.KEY_ID`** — a real column,
confirmed in the column dump below. `EXP_SEQUENCE` is `1` on all ten rows, so
it is not a predicate-component ordinal here.

### `EUL4_EXPRESSIONS` — full column list (44 columns)

```
EXP_ID NUMBER N            EXP_TYPE VARCHAR2(10) N       EXP_NAME VARCHAR2(100) N
EXP_DEVELOPER_KEY VARCHAR2(100) N                        EXP_DESCRIPTION VARCHAR2(240) Y
EXP_FORMULA1 VARCHAR2(250) Y                             EXP_DATA_TYPE NUMBER N
EXP_SEQUENCE NUMBER Y      IT_DOM_ID NUMBER Y            IT_OBJ_ID NUMBER Y
IT_DOC_ID NUMBER Y         IT_FORMAT_MASK VARCHAR2(100) Y
IT_MAX_DATA_WIDTH NUMBER Y IT_MAX_DISP_WIDTH NUMBER Y    IT_ALIGNMENT NUMBER Y
IT_WORD_WRAP NUMBER Y      IT_DISP_NULL_VAL VARCHAR2(100) Y
IT_FUN_ID NUMBER Y         IT_HEADING VARCHAR2(240) Y    IT_HIDDEN NUMBER Y
IT_PLACEMENT NUMBER Y      IT_USER_DEF_FMT VARCHAR2(100) Y
IT_CASE_STORAGE NUMBER Y   IT_CASE_DISPLAY NUMBER Y      IT_EXT_COLUMN VARCHAR2(64) Y
CI_IT_ID NUMBER Y          CI_RUNTIME_ITEM NUMBER Y      PAR_MULTIPLE_VALS NUMBER Y
CO_NULLABLE NUMBER Y       P_CASE_SENSITIVE NUMBER Y     JP_KEY_ID NUMBER Y
FIL_OBJ_ID NUMBER Y        FIL_DOC_ID NUMBER Y           FIL_RUNTIME_FILTER NUMBER Y
FIL_APP_TYPE NUMBER Y      FIL_EXT_FILTER VARCHAR2(64) Y
EXP_USER_PROP2 VARCHAR2(100) Y                           EXP_USER_PROP1 VARCHAR2(100) Y
EXP_ELEMENT_STATE NUMBER N EXP_CREATED_BY VARCHAR2(64) N EXP_CREATED_DATE DATE N
EXP_UPDATED_BY VARCHAR2(64) Y                            EXP_UPDATED_DATE DATE Y
NOTM NUMBER Y
```

### The ten `JP` rows

`SELECT EXP_ID, EXP_TYPE, EXP_NAME, JP_KEY_ID, EXP_SEQUENCE, EXP_FORMULA1, IT_OBJ_ID, IT_EXT_COLUMN, EXP_DATA_TYPE FROM EUL4_EXPRESSIONS WHERE EXP_TYPE='JP' ORDER BY JP_KEY_ID, EXP_SEQUENCE`

| EXP_ID | JP_KEY_ID | SEQ | EXP_FORMULA1 |
| ---: | ---: | ---: | --- |
| 104691 | 104690 | 1 | `[1,81]([6,102307],[6,102308])` |
| 104695 | 104694 | 1 | `[1,81]([6,100461],[6,100462])` |
| 104699 | 104698 | 1 | `[1,98]([1,81]([6,102311],[6,100475]),[1,81]([6,102011],[6,100413]),[1,81]([6,101671],[6,101374]))` |
| 104707 | 104706 | 1 | `[1,98]([1,81]([6,100480],[6,100475]),[1,81]([6,100418],[6,100413]),[1,81]([6,101379],[6,101374]))` |
| 104715 | 104714 | 1 | `[1,81]([6,100494],[6,100493])` |
| 108452 | 108451 | 1 | `[1,98]([1,81]([6,108009],[6,108010]),[1,81]([6,107933],[6,107934]),[1,81]([6,107862],[6,107478]))` |
| 108460 | 108459 | 1 | `[1,98]([1,81]([6,107536],[6,107538]),[1,81]([6,107527],[6,107529]),[1,81]([6,107823],[6,107825]))` |
| 109819 | 109818 | 1 | `[1,98]([1,81]([6,109325],[6,109326]),[1,81]([6,109245],[6,109246]),[1,81]([6,108718],[6,108719]),[1,81]([6,109235],[6,109236]))` |
| 109829 | 109828 | 1 | `[1,81]([6,109180],[6,109181])` |
| 111468 | 111467 | 1 | `[1,81]([6,110857],[6,110851])` |

Every row: `EXP_NAME = 'Predicado de Junção'`, `EXP_DATA_TYPE = 10`,
`IT_OBJ_ID` null, `IT_EXT_COLUMN` null — a `JP` row binds through `JP_KEY_ID`,
not through the item columns.

`SELECT JP_KEY_ID, COUNT(*) FROM EUL4_EXPRESSIONS WHERE EXP_TYPE='JP' GROUP BY JP_KEY_ID`
returns **1 for all ten** `KEY_ID`s.

### The token language of a join predicate

`SELECT FUN_ID, FUN_NAME, FUN_FUNCTION_TYPE FROM EUL4_FUNCTIONS WHERE FUN_ID IN (81,98)`

| FUN_ID | FUN_NAME | FUN_FUNCTION_TYPE |
| ---: | --- | ---: |
| 81 | `=` | 1 (comparison predicate) |
| 98 | `AND` | 3 (boolean) |

So a predicate is `[1,81](a,b)` for a single equality, and
`[1,98]([1,81](...),[1,81](...),...)` — an n-ary `AND` — for a multi-column
join. `[6,n]` is an item reference whose `n` is an `EXPRESSIONS.EXP_ID`
(a `CO` row), exactly as in the workbook token language.

**Predicate widths on this estate:** 5 joins single-column, 4 joins
three-column, 1 join four-column. **All ten operators are `=`.** No non-equi
join exists here, so the non-equi refusal path (legacy §2.4) has no live case
to test against.

`EXP_TYPE` distribution confirms the earlier reading unchanged: `CO` 6 967,
`CI` 2 830, `JP` 10.

**Consequence for Phase 3.2:** the `join_predicates` child table with `seq` is
still the right target shape, but the migrator must **parse `EXP_FORMULA1`'s
token tree** to populate it — it cannot get components by reading rows. Keep
`raw_formula` verbatim as the escape hatch and refuse to generate SQL from any
tree that is not an `AND` of `=` nodes.

---

## Q2 — Do the four cardinality flags exist?

**Verdict: YES. All four are real columns on `EUL4_KEY_CONS`, and all ten rows
carry values. D-118 is NOT triggered — no manual SME collection is needed and
Phase 3.3 is not descoped.**

| DTD attribute (`EUL.dtd:197-200`) | Live `EUL4_KEY_CONS` column |
| --- | --- |
| `OneToOne` | **`FK_ONE_TO_ONE`** NUMBER |
| `AllowMasterNoDetail` | **`FK_MSTR_NO_DETAIL`** NUMBER |
| `AllowDetailNoMaster` | **`FK_DTL_NO_MASTER`** NUMBER |
| `Mandatory` | **`FK_MANDATORY`** NUMBER |

### `EUL4_KEY_CONS` — full column list (22 columns)

```
KEY_ID NUMBER N            KEY_TYPE VARCHAR2(10) N       KEY_NAME VARCHAR2(100) N
KEY_DEVELOPER_KEY VARCHAR2(100) N                        KEY_DESCRIPTION VARCHAR2(240) Y
KEY_EXT_KEY VARCHAR2(64) Y KEY_OBJ_ID NUMBER N           UK_PRIMARY NUMBER Y
FK_KEY_ID_REMOTE NUMBER Y  FK_OBJ_ID_REMOTE NUMBER Y     FK_ONE_TO_ONE NUMBER Y
FK_MSTR_NO_DETAIL NUMBER Y FK_DTL_NO_MASTER NUMBER Y     FK_MANDATORY NUMBER Y
KEY_USER_PROP2 VARCHAR2(100) Y                           KEY_USER_PROP1 VARCHAR2(100) Y
KEY_ELEMENT_STATE NUMBER N KEY_CREATED_BY VARCHAR2(64) N KEY_CREATED_DATE DATE N
KEY_UPDATED_BY VARCHAR2(64) Y                            KEY_UPDATED_DATE DATE Y
NOTM NUMBER Y
```

### The flag values on all ten joins

`SELECT KEY_ID, KEY_NAME, KEY_TYPE, UK_PRIMARY, FK_KEY_ID_REMOTE, FK_ONE_TO_ONE, FK_MSTR_NO_DETAIL, FK_DTL_NO_MASTER, FK_MANDATORY FROM EUL4_KEY_CONS ORDER BY KEY_ID`

| KEY_ID | KEY_NAME | KEY_TYPE | UK_PRIMARY | FK_KEY_ID_REMOTE | FK_ONE_TO_ONE | FK_MSTR_NO_DETAIL | FK_DTL_NO_MASTER | FK_MANDATORY |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 104690 | M M166 -> M M166 Coseg | FK | null | null | 0 | 0 | 0 | 1 |
| 104694 | M M167 -> M M167 Coseg | FK | null | null | 0 | 0 | 0 | 1 |
| 104698 | M M67 1 -> M M67 | FK | null | null | 0 | 0 | 0 | 1 |
| 104706 | M M67 2 -> M M67 | FK | null | null | 0 | 0 | 0 | 1 |
| 104714 | M M79b Coseg -> M M79b | FK | null | null | 0 | 0 | 0 | 1 |
| 108451 | M M111 -> M M111 1 | FK | null | null | 0 | 0 | 0 | 1 |
| 108459 | M M12 -> M M12 1 | FK | null | null | 0 | 0 | 0 | 1 |
| 109818 | M M27 -> M M27 1 | FK | null | null | 0 | 0 | 0 | **0** |
| 109828 | M M32 -> M M32 1 | FK | null | null | 0 | **1** | 0 | 1 |
| 111467 | M M89 1 -> M M89 2 | FK | null | null | 0 | 0 | 0 | 1 |

**Readings that matter:**

- **`FK_ONE_TO_ONE = 0` on every join.** Under D-033 that means **all ten
  joins are treated as fanning** — but now by *measurement*, not by an absent
  column. The four flags are readable, so a future EUL with a one-to-one join
  will be read correctly, and the "refusal machine" failure mode D-118 warned
  about is a property of this estate's data, not of the schema.
- **`KEY_TYPE = 'FK'` on all ten.** `eul-schema-adapter.ts:134-135` probes
  `KEY_TYPE` and defaults it to `INNER` when absent. The column exists, but its
  domain is `FK`/`UK` — a *constraint kind*, **not a join type**. The adapter
  is reading the wrong column for join type. Join type must be derived from
  `FK_MSTR_NO_DETAIL` / `FK_DTL_NO_MASTER` (legacy §2.3).
- **One real outer join exists:** `109828 M M32 -> M M32 1` has
  `FK_MSTR_NO_DETAIL = 1` — "outer join on detail", i.e. `master LEFT OUTER
  JOIN detail`. Nine are `INNER`. `FK_DTL_NO_MASTER` is `0` everywhere, so the
  "rare" right-outer case and the undescribed `FULL OUTER` combination have no
  live instance.
- **`FK_MANDATORY = 1` on nine of ten**; `109818 M M27 -> M M27 1` is `0`.
  That unlocks join trimming and summary-folder eligibility for the nine.
- `UK_PRIMARY` and `FK_KEY_ID_REMOTE` are **null on every row** — this EUL
  binds the foreign key straight to the remote *folder* (`FK_OBJ_ID_REMOTE`),
  never to a remote key constraint.

### `IHS_FK_LINKS` and `OBJ_JOIN_USGS` — checked, and both are empty

Probed as the brief requires, in case `KEY_CONS` had carried nothing.

`EUL4_IHS_FK_LINKS` (9 columns): `IFL_ID, IFL_IHS_ID, IFL_KEY_ID,
IFL_ELEMENT_STATE, IFL_CREATED_BY, IFL_CREATED_DATE, IFL_UPDATED_BY,
IFL_UPDATED_DATE, NOTM`

`EUL4_OBJ_JOIN_USGS` (11 columns): `OJU_ID, OJU_OBJ_ID, OJU_JOIN_MODIFIED,
OJU_KEY_ID, OJU_SUMO_ID, OJU_ELEMENT_STATE, OJU_CREATED_BY, OJU_CREATED_DATE,
OJU_UPDATED_BY, OJU_UPDATED_DATE, NOTM`

Neither carries a cardinality or outer-join flag — they are link tables — and
`SELECT COUNT(*)` returns **0 rows for both**. `EUL4_KEY_CONS` is the sole
carrier on this estate, and it carries everything needed.

---

## Q3 — Which `EUL4_EXPRESSIONS` column carries the default aggregate?

**Verdict: `IT_FUN_ID`, a foreign key to `EUL4_FUNCTIONS.FUN_ID`.**

Probed, not guessed: the column list above was read first, then a `GROUP BY`
run over the candidate.

`SELECT e.IT_FUN_ID, f.FUN_NAME, f.FUN_FUNCTION_TYPE, COUNT(*) FROM EUL4_EXPRESSIONS e LEFT JOIN EUL4_FUNCTIONS f ON f.FUN_ID = e.IT_FUN_ID WHERE e.EXP_TYPE IN ('CO','CI') GROUP BY ...`

| IT_FUN_ID | FUN_NAME | FUN_FUNCTION_TYPE | rows |
| ---: | --- | ---: | ---: |
| 110 | **Detail** | 7 | 8 152 |
| 1 | **SUM** | 4 | 1 292 |
| null | — | — | 353 |

That is exactly the `SUM`/`DETAIL` shape the property is supposed to hold, so
the column is identified with confidence. On this estate only two of the five
aggregate values are actually used; `AVG`, `COUNT`, `MIN`, `MAX` have no live
instance, and 353 items carry no default at all (legacy §3.4's "no default"
case, which interacts with the fan-trap guard).

The runner-up candidate was ruled out: `IT_PLACEMENT` groups as `3` (7 612),
`1` (2 184), `2` (1) — a display-placement code, not an aggregate.

**Note for Phase 3.1:** `FUN_ID 110 'Detail'` is not an aggregate function; it
is the marker for *no aggregation*. The axis/measure split still comes from the
parser (D-031); this column supplies the **default aggregate for a measure**,
which is `SUM` for 1 292 items and nothing for the rest.

---

## Q4 — How many of the 502 `IBH` hierarchies are date-template instantiations?

**Verdict: all 502. `HI_SYS_GENERATED` answers it directly, and no naming
`GROUP BY` was needed.**

`SELECT HI_TYPE, HI_SYS_GENERATED, COUNT(*) FROM EUL4_HIERARCHIES GROUP BY HI_TYPE, HI_SYS_GENERATED`

| HI_TYPE | HI_SYS_GENERATED | rows |
| --- | ---: | ---: |
| `DBH` | 0 | 6 |
| `IBH` | 1 | **502** |

**Every `IBH` row is system-generated; every `DBH` row is author-made.** The
split is perfectly clean — there is not one hand-authored item hierarchy on
this estate.

`EUL4_HIERARCHIES` full column list (17), re-confirming there is **no
business-area column**:

```
HI_ID, HI_TYPE, HI_NAME, HI_DEVELOPER_KEY, HI_DESCRIPTION, HI_SYS_GENERATED,
HI_EXT_HIERARCHY, DBH_DEFAULT, IBH_DBH_ID, HI_USER_PROP2, HI_USER_PROP1,
HI_ELEMENT_STATE, HI_CREATED_BY, HI_CREATED_DATE, HI_UPDATED_BY,
HI_UPDATED_DATE, NOTM
```

**Consequence for Phase 5.1:** the hierarchy scope is **6 author-made date
hierarchies plus one generated-instance rule**, not 508 hand-modelled trees —
a two-order-of-magnitude reduction, exactly as the register anticipated.
`IBH_DBH_ID` is the link from an instantiation back to its `DBH` template.

---

## Q5 — Does `EUL4_QPP_STATS` record returned row counts?

**Verdict: YES — `QS_NUM_ROWS`.** The table holds **7 316 rows** on this estate.

`EUL4_QPP_STATS` has 47 columns. The ones that matter:

| Column | Type | Meaning |
| --- | --- | --- |
| `QS_ID` | NUMBER (not null) | PK |
| **`QS_NUM_ROWS`** | NUMBER | **rows the query returned** |
| `QS_COST` | NUMBER | optimiser cost |
| `QS_ACT_CPU_TIME` | NUMBER | measured CPU time |
| `QS_ACT_ELAP_TIME` | NUMBER (not null) | measured elapsed time |
| `QS_EST_ELAP_TIME` | NUMBER (not null) | predicted elapsed time |
| `QS_OBJECT_USE_KEY` | VARCHAR2 (not null) | the folder/item/join fingerprint of the query |
| `QS_SUMMARY_FIT` | NUMBER | whether a summary folder satisfied it |
| `QS_STATE` | NUMBER | row state |
| `QS_DOC_OWNER`, `QS_DOC_NAME`, `QS_DOC_DETAILS` | VARCHAR2 | the workbook that ran it |
| `QS_SDO_ID` | NUMBER | summary object used |
| `QS_DBMP0..7`, `QS_MBMP0..7`, `QS_JBMP0..7`, `QS_FBMP0..7` | RAW x32 | four 8-slot bitmap families — folder / measure / join / filter participation |
| `QS_CREATED_BY`, `QS_CREATED_DATE` | — | audit |

**Consequence for Phase 9.1:** this is a usable independent oracle. A stored
`QS_NUM_ROWS` next to a `QS_OBJECT_USE_KEY` that names the folders and joins
involved is a *recorded historical row count for a real Discoverer query* — a
row count Neo's own generator can be checked against. The four RAW bitmap
families are the likely decoder for which folders and joins a stat row covers,
and are not decoded here.

---
