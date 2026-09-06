# Phase 3.4 checkpoint — enable multi-folder generation

**Status: INCOMPLETE. The interim refusal is removed and the guard is not yet
proven on real data.** That is the state the stage prompt names as the most
dangerous this codebase can be left in, so read the blocker below first.

---

## The blocker, stated plainly

`join_predicates` holds **0 rows** for all 10 joins in the estate. A join with
no predicate cannot be written, so **no query in this estate can take the
rewrite path**. The histogram's first assertion — `REWRITE(n) > 0` — fails, and
it fails correctly.

This is Phase 3.3's own recorded known limit #4: *"The ten live joins still
carry no predicates. Phase 3.2's re-import tool has not been run against the
live EUL."* Phase 3.4 could not close it, because the predicates exist only in
the source EUL and the tool that reads them writes to the estate.

**One command clears it.** The connection config was built from the data source
already stored in the target (decrypted with the app's own `ENCRYPTION_KEY`) and
left at `/tmp/eul-conn.json` inside the backend container:

```bash
docker exec -e ORACLE_THICK_MODE=true -e ORACLE_CLIENT_PATH=/opt/oracle/instantclient discoverer-neo-backend sh -c 'cd /app/migrate && /app/node_modules/.bin/tsx src/bin.ts reimport-joins --connection /tmp/eul-conn.json --target "$DATABASE_URL"'
```

Its `--dry-run` has already been run against the live EUL and reports **10 joins
read, 10 written, 21 predicates, 0 skipped**. Delete `/tmp/eul-conn.json`
afterwards — it holds a live password in plain text.

Then re-run `npm run verify --workspace backend` and read the histogram.

---

## The histogram — the phase's deliverable

Measured 2026-09-06 against the live `discoverer_neo` target, over all 924
active maps:

| Bucket | Count |
| --- | --- |
| `FLAT` | **116** |
| `REWRITE(n)` | **0** |
| `REFUSE(DISCONNECTED)` | **26** |
| `REFUSE(NO_PREDICATE)` | **13** |
| `REFUSE(R1)` … `REFUSE(R4)`, `REFUSE(REAGG)` | **0** |
| `ERROR` | 0 |
| `notDecided` | **769** |
| — of which, maps with a non-empty measure set | 49 |

**Read `notDecided` first.** 769 maps carry an unrendered Discoverer token
(`Unknown item reference "1,102"`) and throw inside `loadMapDefinition` before
the planner sees them. That is Phase 4's work and is explicitly out of this
stage's scope — but it means every count above is a **floor**, not a
like-for-like reading. In particular `REFUSE(DISCONNECTED) = 26` against Phase
0.4's baseline of 271 is **not** evidence that Phase 3.2 reduced it: most of the
341 multi-folder maps never reached a decision at all. The seam prints this
caveat next to the number for exactly that reason.

### The three assertions, and how each stands

| # | Assertion | Result |
| --- | --- | --- |
| 1 | `REWRITE(n) > 0` — the rewrite path is reachable | **FAIL.** 0. No join carries a predicate |
| 2 | `REFUSE(DISCONNECTED)` below the 271 baseline | Reads 26, but coverage is 155/924 — a floor, not a reading |
| 3 | A fan-trap rule fired, or the run says none could | Recorded in words: *"no fan-trap rule (R1-R4, REAGG) fired: no map in this estate reached a trigger condition"* |

The v1.0 gate this replaced — `REFUSE > 0 && FLAT < 923` — **would have passed
this run.** `REFUSE` is 39 and `FLAT` is 116. It would have reported success
over a guard that has never once fired. That is the review's point (R-07/B-03),
and this run is the demonstration of it.

---

## What shipped

### The interim refusal is gone (commit `e820132`)

D-014's three lines in `buildFromClause`, the `hasAggregates` option that fed
them, the `MULTI_FOLDER_AGGREGATE` refusal code, its copy in four locales, its
documentation section in four languages, and every test that pinned it.

`generateSql` now dispatches on the plan: REFUSE throws by rule, REWRITE calls
`renderRewrite`, FLAT takes the join it always did.

**Three defects had to be fixed before the refusal could safely go.** Each was
masked by it:

1. **A branch is a subtree, not one hop.** `renderBranch` joined only its
   immediate detail folder, so a deeper branch aliased folders in the SELECT
   that never appeared in the FROM. It now spans its own folder set, rooted at
   the master, every edge outer — the same computation the flat clause does,
   and `joinOnClause` refuses `NO_PREDICATE` by name from inside it.
2. **The planner could not see an aggregate inside a drawn calculation.** `M` is
   built from columns; a formula's `AVG` is not one. The interim refusal covered
   that gap because it read `select.hasAggregates`, which *does* see formulas.
   Without it, such a map would have fallen through step 0 to the flat path and
   printed the inflated number. The formula now counts at step 0 and refuses as
   `REAGG` over a fan. Zero maps in this estate are affected — the fix is for
   the ones authored tomorrow.
3. **Totals would have reused the fanning FROM.** A total re-runs the main
   query's FROM without its GROUP BY, and on a rewritten query that is the very
   join the rewrite exists to avoid. §1.6 already blanked totals spanning
   branches; this widens it to every total on a rewrite. Blank with a stated
   reason, never a wrong number.

The rewrite also emits `ORDER BY` against its own select-list aliases, so a sort
survives the shape change and pagination stays deterministic. A sort on a
*hidden* item is dropped — the outer query has no column to sort on. Recorded in
`docs/troubleshooting/refusals.md`.

### The histogram (commit `0ab8355`)

Seam 6 (`planner-live`) in `dn-migrate verify`, one bucket per rule.
`decideMap` in the backend plans, generates, and reports whichever refusal fires
first by name — because `DISCONNECTED` and `NO_PREDICATE` are raised by the
emitter, and a histogram of planner verdicts alone files both under `FLAT`.

Its tests prove assertion 1 falsifiable **both** ways: one estate with no fan
(FAIL), and one migrated map carrying a real master/detail join with a
master-side measure (PASS, `rewrite >= 1`). Without the second, `REWRITE > 0`
would be a gate nothing in CI could ever turn green.

### `dn-migrate` can now reach this EUL (commit `4d5d85b`)

The CLI ran the Oracle driver in thin mode only, and this estate's EUL account
uses a 12c password verifier thin mode cannot authenticate
(`NJS-116: password verifier type 0x939`). So `dn-migrate` could not read its
own source at all — the original migration only ever ran because the *backend's*
pool initialises the Oracle client and the CLI's did not. Gated on
`ORACLE_THICK_MODE`, same contract as the backend's pool.

### Documentation (commit `d25e70d`)

`docs/migration/verify.md` gained the histogram section, with the **real
measured output** rather than an invented sample. `docs/user-guide/` explains
the blank totals. `docs/troubleshooting/` explains what a rewritten worksheet
does differently, and lost its section for a refusal that no longer exists.

---

## The refusal UI, browser-validated (review R-18 / F-04)

Phase 2.2 built the refusal panel against Phase 1.1's single generic message.
No stage re-validated it. Checked here, against the live app on :5174:

| Rule | Panel | Rule name | Folders / joins | Next step |
| --- | --- | --- | --- | --- |
| `NO_JOIN_PATH` (DISCONNECTED) | amber | ✓ *"These folders are not connected, so the worksheet was not run"* | ✓ *"Folders involved: M M118 1"* | ✓ |
| `JOIN_NO_PREDICATE` | amber | ✓ *"A join in this worksheet has no join condition, so it was not run"* | ✓ *"Joins involved: M M166 -> M M166 Coseg"* | ✓ |
| `FAN_TRAP_R1`–`R4`, `REAGG` | **not reachable** — every fan-trap rule needs a join predicate | | | |

The five fan-trap rules are covered by unit tests and by translated copy in all
four locales, but **have not been seen in a browser**. They become reachable the
moment the re-import above runs.

**Two things were found and both were environment, not code.** The backend
container had been up 31 hours, from before Phase 3.2: it was executing a
`loadMapDefinition` that still selected `joins.left_item_id`, a column Phase 3.2
dropped, so every execute returned `500 Internal Server Error` — including the
refusals. It also 404'd `POST /api/maps/plan`. After a restart with the built
`core` copied in, both work. **A stale dev container makes every refusal look
like a server error**; check `docker logs` before believing a 500 here.

---

## Still open, in the order that matters

1. **Run the join re-import.** One command, above. Until then assertion 1 fails
   and the guard is unproven on real data.
2. **Verify a real master–detail total against the source.** `M M67 1 -> M M67`
   (header to lines) is this estate's named pair. It cannot be attempted before
   (1): the join has no predicate, so it refuses rather than executing. Phase
   0.3's Q10 — whether `EUL4_QPP_STATS` records returned row counts, which would
   be the only independent oracle in this repository — is still unanswered.
3. **Browser-validate the five fan-trap refusals.** Blocked on (1).
4. **Re-read the histogram after (1)** and record it here, replacing the table
   above.

Out of scope and deliberately not attempted: formula compilation (Phase 4, and
the cause of all 769 `notDecided`), hierarchies and item classes (Phase 5),
result-set equivalence (Phase 9.1).
