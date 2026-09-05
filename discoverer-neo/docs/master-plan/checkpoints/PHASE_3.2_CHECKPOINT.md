# Phase 3.2 checkpoint — The join model

**Date:** 2026-09-05 · **Status:** code complete; **the live estate's 10 joins
are NOT yet re-imported** — see "The open gap" below
**Commits:** `e696a4c` characterisation tests · `c4a50c6` schema + migration +
derivation · `cd1f6a5` reader · `59efa5a` tests, re-import tool, docs

---

## What changed

A join was one item pair plus a stored `join_type`. It is now two folders, a
predicate of 1..n column pairs, and four flags — two of which the join type is
derived from.

```
joins                                 join_predicates
  left_folder_id    MASTER              join_id
  right_folder_id   DETAIL              seq            0-based, ANDed in order
  one_to_one                            left_item_id   master side, nullable
  allow_master_no_detail                right_item_id  detail side, nullable
  allow_detail_no_master                operator       = < > <= >= <>  (CHECK)
  mandatory
  predicate_formula   source token tree, verbatim
```

Gone: `join_type` (derived), `left_item_id` / `right_item_id` (the old single
pair), and the `join_type` Postgres enum type.

### The six scope items

| # | Item | State |
| - | ---- | ----- |
| 1 | `joins` folder-to-folder | already was (A-05); left alone |
| 2 | `join_predicates`, 1..n pairs with an operator | done |
| 3 | Four booleans stored | done |
| 4 | `join_type` derived, not stored | done |
| 5 | Reader reads `EXP_TYPE='JP'` | done |
| 6 | Predicate-less join refuses, naming the join | done |

## The handover query — and what it returns TODAY

```sql
SELECT j.name,
       lf.name AS master_folder, rf.name AS detail_folder,
       j.one_to_one, j.allow_master_no_detail, j.allow_detail_no_master,
       j.mandatory, count(p.id) AS predicates
FROM joins j
JOIN folders lf ON lf.id = j.left_folder_id
JOIN folders rf ON rf.id = j.right_folder_id
LEFT JOIN join_predicates p ON p.join_id = j.id
GROUP BY j.id, j.name, lf.name, rf.name, j.one_to_one,
         j.allow_master_no_detail, j.allow_detail_no_master, j.mandatory
ORDER BY j.name;
```

**The plan's query names `master_folder_id` / `detail_folder_id`. Those columns
do not exist and were never renamed** — A-05 established the folder columns
were already correct, and renaming them would ripple through the FROM clause,
the security folder set and the admin API for no gain. `left` is the master,
`right` the detail; the query above is the same query against the real names.

Against the dev database, 2026-09-05:

| name | master_folder | detail_folder | 1:1 | amnd | adnm | mand | predicates |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| M M111 -> M M111 1 | M M111 1 | M M111 | f | f | f | f | **0** |
| M M12 -> M M12 1 | M M12 1 | M M12 | f | f | f | f | **0** |
| M M166 -> M M166 Coseg | M M166 Coseg | M M166 | f | f | f | f | **0** |
| M M167 -> M M167 Coseg | M M167 Coseg | M M167 | f | f | f | f | **0** |
| M M27 -> M M27 1 | M M27 1 | M M27 | f | f | f | f | **0** |
| M M32 -> M M32 1 | M M32 1 | M M32 | f | f | f | f | **0** |
| M M67 1 -> M M67 | M M67 | M M67 1 | f | f | f | f | **0** |
| M M67 2 -> M M67 | M M67 | M M67 2 | f | f | f | f | **0** |
| M M79b Coseg -> M M79b | M M79b | M M79b Coseg | f | f | f | f | **0** |
| M M89 1 -> M M89 2 | M M89 2 | M M89 1 | f | f | f | f | **0** |

Ten rows, non-null folder endpoints on all ten, **zero predicates on all ten**.

## The open gap — the 10 rows still need `reimport-joins` run

These rows were written by the old reader and carry two defects the new code
cannot fix retroactively:

1. **No predicates**, because the old reader never read the `JP` expression.
2. **Inverted orientation.** `M M111 -> M M111 1` shows `master_folder` =
   `M M111 1`, which is the `KEY_OBJ_ID` side — the DETAIL. These rows predate
   the Phase 0.3 orientation fix. Every one of the ten is the wrong way round.
   `M_M111` is the folder with 1 830 rows over 1 830 distinct keys; it is the
   master, and it is sitting in the detail column.
3. All four flags read `false`, which is the migration default, not a reading.
   The estate's real values are `FK_MSTR_NO_DETAIL = 1` on `109828` and
   `FK_MANDATORY = 1` on nine of ten.

**Nothing downstream is wrong today**, because `sql-generator` dropped all ten
joins anyway. But Phase 3.3 must not build on these rows.

The fix is one command, against the live `SIID_TESTES` EUL:

```bash
cd discoverer-neo && npx dn-migrate reimport-joins --connection <config> --target <postgres url> --dry-run
```

Then without `--dry-run`. It replaces `joins` and `join_predicates` and touches
nothing else. **It was not run in this phase: no EUL credentials were available
to this session, and it rewrites live metadata.** It exits non-zero if any join
is skipped or arrives predicate-less, so the run is self-checking.

Expected after the run: ten rows, each with ≥ 1 predicate (five with one, four
with three, one with four), `allow_master_no_detail` true on `M M32 -> M M32 1`
only, `mandatory` true on nine, and every `master_folder` on the other side of
the arrow from today.

## Where the predicate comes from

`EUL4_KEY_CONS` has **no item columns at all** — that reading is now closed in
`EUL_SCHEMA_GROUND_TRUTH.md` §4.2 item 5. A join's columns live in one
`EUL4_EXPRESSIONS` row, `EXP_TYPE = 'JP'`, bound by `JP_KEY_ID`, with the whole
condition as a token tree in `EXP_FORMULA1`:

```
[1,81]([6,102307],[6,102308])                        single column
[1,98]([1,81](…),[1,81](…),[1,81](…))                three columns, ANDed
```

Ten `JP` rows against ten `KEY_CONS` rows, so a multi-column join is a compound
formula in ONE row, never several. `DEFAULT_ITEM_EXP_TYPES = [CO, CI]` was all
that excluded them.

The tree is read with `parseConditionTree` — the same parser as a workbook
condition, because it is the same language; `[6,n]` names an `EXP_ID` here
instead of a workbook element. The accepted grammar is deliberately narrow: an
optional n-ary `AND` over comparisons of two item references. Anything else
writes no components, keeps the raw formula, and refuses by name.

## Orientation, twice

Two separate orientation problems, both settled by measurement rather than by
reading the token order or the folder names:

- **The join's folders** — `FK_OBJ_ID_REMOTE` is the master (D-040). Already
  fixed in the reader at Phase 0.3; this phase adds the regression test that
  carries the estate's own folder names (`from-clause.test.ts`, section 7).
- **Each predicate component's two items** — nothing in the token language
  says which operand is the master. The reader looks each item's `IT_OBJ_ID`
  up against the join's two folders. When that reorders a **non-equi**
  comparison the operator is reversed with it (`a < b` → `b > a`), or the
  condition silently changes meaning. The estate has no non-equi join, so this
  path has no live case — it is covered by a unit test instead.

## The derivation

| `allow_master_no_detail` | `allow_detail_no_master` | emitted |
| --- | --- | --- |
| false | false | `INNER JOIN` |
| true | false | `LEFT OUTER JOIN` |
| false | true | `RIGHT OUTER JOIN` |
| true | true | **refusal** `JOIN_BOTH_OUTER` (D-038) |

`one_to_one` and `mandatory` are stored and excluded, with a test each proving
they change nothing. `FULL` is gone from the model, the API and the frontend
type: the flag pair that would mean it refuses.

## Two new refusals, both naming the JOIN

`JOIN_NO_PREDICATE` (D-039) and `JOIN_BOTH_OUTER` (D-038), with copy in all
four locales and a join list in `ExecutionRefusal`.

The loader no longer drops a predicate-less join. It keeps it, and
`buildFromClause` refuses when a query actually needs it — so a broken join
elsewhere in the business area does not break a query that avoids it. The old
silent drop is what turned this into *"No join path connects folder X…"*, which
271 of 341 multi-folder maps hit without ever learning which join was at fault.

## Characterisation tests came first (R-15 / D-02)

`backend/src/lib/sql/` had no dedicated tests at all — the modules Phase 3.3
replaces were exercised only through `sql-generator.test.ts`'s one `mkDef()`
fixture. `from-clause.test.ts` was committed FIRST (`e696a4c`), against the old
schema, pinning the single-folder short-circuit, the BFS spanning tree and its
LEFT/RIGHT flip, the disconnection refusal, and the interim multi-folder
refusal. The next commit changed the model; all twelve assertions stayed
still and only the fixture moved.

## Found on the way

- **`planned.join_predicates` was never set**, so a dry run under-reported what
  a real run would insert. Caught by the existing dry-run reconciliation test.
- **`create`/`update` returned the raw inserted row**, which no longer carries
  `join_type`. Both now read back the derived shape, so the admin API keeps its
  contract while the storage changed underneath it.
- **`setup-test-db.mjs` replays every migration from 0000**, so a later
  `DROP COLUMN` broke the replay against an existing test database. Undefined
  column/object is now tolerated when the database already existed, and stays
  fatal on a fresh one — which is what CI runs, and where an ordering bug in a
  new migration has to be caught.

## Explicitly still out of scope

The fan-trap guard (3.3). Enabling multi-folder generation (3.4) — Phase 1.1's
interim refusal stays in place. Forced joins as first-class data.
