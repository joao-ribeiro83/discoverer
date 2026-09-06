# Phase 3.4 checkpoint — enable multi-folder generation

**Status: the stage's work is complete and the rewrite is proven correct against
the source system. One acceptance gate stays red, and correctly so:
`REWRITE(n) > 0` over migrated maps.** The cause is Phase 4, not this guard, and
the histogram now says so in words rather than leaving a reader to guess.

---

## The headline: a real master–detail join, verified against Oracle

`legacy-analysis.md` §10.1 hook H3, run against the live source on 2026-09-06.
`backend/src/scripts/verify-fan-trap-m67.ts` builds a worksheet from **this
estate's own migrated metadata** — `M M67 1` (2 623 policy headers) joined to
`M M67` (833 340 receipt lines) on the three-column key the EUL records — puts
`SUM` on a header column and a filter on the detail, and asks Oracle three
questions:

| | Total |
| --- | --- |
| plan decision | **`REWRITE(2)`** |
| 1. Oracle reference (`EXISTS`, so no row can repeat) | **4 392 650.47** |
| 2. naive flat join — what Neo emitted before this stage | **1 278 415 648.69** |
| 3. Neo, rewritten | **4 392 650.47** |

**Neo matches the source system exactly. The unguarded join inflates by
291.04×.** This is the estate's own £2.4M-reports-as-£700M case, on real data.

The check asserts the naive number *differs* from the reference: if it agreed,
the shape would contain no fan and the test would be passing vacuously.

Neo's emitted SQL is Oracle's documented shape — the master aggregated alone at
key grain in `b0`, the filtered detail restricting the key set in `b1`, an
equi-join between them, and the outer `SUM` re-aggregating.

---

## The histogram — the phase's deliverable

Over all 924 active maps, after the join re-import:

| Bucket | Count |
| --- | --- |
| `FLAT` | **129** |
| `REWRITE(n)` | **0** |
| `REFUSE(DISCONNECTED)` | **26** |
| `REFUSE(NO_PREDICATE)` | **0** (was 13) |
| `REFUSE(R1)` … `REFUSE(R4)`, `REFUSE(REAGG)` | **0** |
| `ERROR` | 0 |
| `notDecided` | **769** |
| `fanCandidates` / `fanCandidatesDecided` | **25 / 1** |

### The three assertions

| # | Assertion | Result |
| --- | --- | --- |
| 1 | `REWRITE(n) > 0` | **FAIL — deliberately left failing** (see below) |
| 2 | `REFUSE(DISCONNECTED)` below the 271 baseline | Reads 26; coverage is 155/924, so a floor, not a reading |
| 3 | A fan-trap rule fired, or the run says none could | Recorded in words: *"no fan-trap rule (R1-R4, REAGG) fired: no map in this estate reached a trigger condition"* |

### Why assertion 1 fails, and why it was not weakened

Not the guard, and no longer the join model. Seam 6 now counts the maps that
*would* reach the fan test — multi-folder, connected by the known joins,
carrying a measure — **computed from the tables rather than through the
planner**, precisely so it includes maps the planner never sees:

> `fanCandidates 25 · fanCandidatesDecided 1`

Twenty-four of the twenty-five throw `Unknown item reference "1,nnn"` before the
planner runs. That is Phase 4's unrendered Discoverer token, explicitly out of
this stage's scope. The one that *does* decide is correctly `FLAT`: its measure
sits on the detail side, so nothing repeats.

`rewrite = 0` means two very different things depending on that pair. With zero
candidates the estate simply contains no fan trap. With candidates that never
arrive, the path is blocked upstream. The blocker line now states which — the
old wording could not tell them apart.

**The v1.0 gate would have passed both this run and the one before it.**
`REFUSE > 0 && FLAT < 923` holds (26 and 129). It would have reported success
over a guard that has never once fired on a migrated map. That is review
R-07/B-03's argument, demonstrated twice.

---

## What the join re-import changed

Phase 3.2's `dn-migrate reimport-joins` had never been run against the live EUL.
It was run here: **10 joins read, 10 written, 21 predicates, 0 skipped.**

- `join_predicates` went from **0 rows to 21**. Before, no join could be written
  at all, so no query could rewrite and 13 maps refused `NO_PREDICATE`.
- **Orientation was corrected on all ten.** Every join now has its master on the
  side its own name states — `M M67 1 -> M M67` has master `M M67 1`. Before,
  the pre-Phase-0.3 reading had them inverted, which is silent and wrong rather
  than an error.
- `NO_PREDICATE` 13 → 0, `FLAT` 116 → 129.

Getting there needed one code change: `dn-migrate` ran the Oracle driver in thin
mode only, and this EUL account uses a 12c password verifier thin mode cannot
authenticate (`NJS-116: password verifier type 0x939`). The CLI could not read
its own source at all — the original migration only ever ran because the
*backend's* pool initialises the client and the CLI's did not.

---

## What shipped

### The interim refusal is gone (commit `e820132`)

D-014's three lines in `buildFromClause`, the `hasAggregates` option that fed
them, the `MULTI_FOLDER_AGGREGATE` refusal code, its copy in four locales, its
documentation section in four languages, and every test that pinned it.
`generateSql` now dispatches on the plan.

**Three defects had to be fixed before the refusal could safely go.** Each was
masked by it:

1. **A branch is a subtree, not one hop.** `renderBranch` joined only its
   immediate detail folder, so a deeper branch aliased folders in the SELECT
   that never appeared in the FROM. It now spans its own folder set, rooted at
   the master, every edge outer.
2. **The planner could not see an aggregate inside a drawn calculation.** `M` is
   built from columns; a formula's `AVG` is not one. The interim refusal covered
   that gap because it read `select.hasAggregates`, which *does* see formulas.
   Without it, such a map would have fallen through step 0 to the flat path and
   printed the inflated number. Zero maps in this estate are affected — the fix
   is for the ones authored tomorrow.
3. **Totals would have reused the fanning FROM.** A total re-runs the main
   query's FROM without its GROUP BY. §1.6 already blanked totals spanning
   branches; this widens it to every total on a rewrite.

The rewrite also emits `ORDER BY` against its own select-list aliases. A sort on
a *hidden* item is dropped — the outer query has no column to sort on.

### The histogram (commits `0ab8355`, `9b3038c`)

Seam 6 in `dn-migrate verify`, one bucket per rule, plus the fan-candidate pair
that makes a zero interpretable. `decideMap` plans, generates, and reports
whichever refusal fires first by name — `DISCONNECTED` and `NO_PREDICATE` are
raised by the emitter, and a histogram of planner verdicts alone files both
under `FLAT`.

Its tests prove assertion 1 falsifiable **both** ways: one estate with no fan
(FAIL), and one migrated map carrying a real master/detail join with a
master-side measure (PASS). Without the second, `REWRITE > 0` would be a gate
nothing in CI could ever turn green.

### Security, on the rewrite path

`query-engine.test.ts` runs the whole execution service, not a fixture
`MapDefinition`, and asserts a security predicate lands **inside** the branch,
before its `GROUP BY`. A predicate left to the outer query is applied after the
rows it should have removed were already summed: right totals, for a row set the
user may not see.

---

## The refusal UI, browser-validated (review R-18 / F-04)

Phase 2.2 built the refusal panel against Phase 1.1's single generic message and
no stage re-validated it. Checked here against the live app, driven by real
migrated metadata. **Nothing was saved — the map count is unchanged at 924.**

| Rule | Where | Rule name | Folders / joins | Next step |
| --- | --- | --- | --- | --- |
| `NO_JOIN_PATH` (DISCONNECTED) | after Run | ✓ | ✓ *"Folders involved: M M118 1"* | ✓ |
| `JOIN_NO_PREDICATE` | after Run | ✓ | ✓ *"Joins involved: M M166 -> M M166 Coseg"* | ✓ |
| `FAN_TRAP_REAGG` | **on the canvas, before Run** | ✓ | ✓ *"Folders involved: M M67 1"* | ✓ *"Use Sum, Count, Minimum or Maximum…"* |
| `FAN_TRAP_R4` | **on the canvas, before Run** | ✓ | ✓ *"Folders involved: M M67 1, M M67 2"* | ✓ *"Split this into two worksheets…"* |
| `FAN_TRAP_R1`, `R2`, `R3` | **structurally impossible in this estate** | | | |

R1, R2 and R3 all require a candidate master with **two or more** fanning
branches — different keys, a detail-to-detail edge, or two detail axes. Each of
this estate's ten joins has a *distinct* master folder, so no folder is the
master side of more than one join and no candidate can have a second branch.
This is a fact about the estate, not a gap in the guard; the rules are covered
by unit tests and by translated copy in all four locales.

Both refusals reached through the canvas came from `POST /api/maps/plan` — the
Phase 3.3 preflight — so the user sees them **while composing**, not after a
round trip.

---

## A trap worth naming

Two apparent UI defects during that pass were both a **31-hour-stale dev
container**. `discoverer-neo-backend` was running a `loadMapDefinition` that
still selected `joins.left_item_id`, a column Phase 3.2 dropped, so every
execute returned `500 Internal Server Error` — including the refusals — and
`POST /api/maps/plan` 404'd. A stale container makes every refusal look like a
server error. Check `docker ps` uptime before believing a 500 here. Note that
`/app/migrate` is not bind-mounted, so a restart alone fails on
`joinPredicates`; `npm run build -w migrate` and `docker cp migrate/dist` first.

---

## Still open

1. **Phase 4 — formula rendering.** 769 maps, including 24 of the 25 fan
   candidates. This is what turns assertion 1 green, and nothing else will.
2. **Phase 0.3 Q10** — whether `EUL4_QPP_STATS` records returned row counts.
   Still unanswered. It would be a second, independent oracle; the `EXISTS`
   reference query used here is the first.
3. `mapsWithNoColumns = 25` and the two reconciliation drifts, both pre-existing
   and reported by other seams.

Out of scope and deliberately not attempted: formula compilation (Phase 4),
hierarchies and item classes (Phase 5), result-set equivalence (Phase 9.1).
