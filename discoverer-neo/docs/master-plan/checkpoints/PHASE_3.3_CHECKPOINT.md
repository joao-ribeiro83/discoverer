# Phase 3.3 checkpoint — the query planner (fan-trap guard)

**Status: complete.** All ten steps of `legacy-analysis.md` §1.11 are
implemented, and the Phase 1.1 interim multi-folder aggregate refusal (D-014)
**is still in place** — `from-clause.ts` still refuses every multi-folder
aggregate by name. Enabling multi-folder generation is Phase 3.4.

---

## The prerequisite, verified before any code was written

The phase brief required checking `map_items.agg_function` against the live
database rather than taking Phase 3.1 on trust. Measured 2026-09-05:

| | |
| --- | --- |
| `map_items` rows | 25 965 |
| carrying `agg_function` | **1 760**, all `SUM` |
| distinct maps with a measure | **402** |

Non-empty, so the guard has a measure set to see. Had this been zero, every
query would classify `|M| = 0`, take step 0's flat path, and the whole stage
would have shipped inert.

**The ten live joins were also checked**: all carry `one_to_one = false`, all
four flags false, and **zero predicate rows** — they have not been re-imported
since Phase 3.2 built the tool. Under D-033 that means every one classifies
FANNING, which is the safe reading, and the query that needs one refuses by
name (`JOIN_NO_PREDICATE`) rather than emitting a short `ON` clause.

---

## §1.11 steps 0–10 — what is implemented

| Step | Where | Note |
| --- | --- | --- |
| 0 · `\|M\| = 0` → flat | `planner.ts` | `FLAT(NO_MEASURES)` |
| 1 · build the subgraph, refuse if disconnected | `planner.ts` | `FLAT(DISCONNECTED)`; the FROM clause raises `NO_JOIN_PATH` by name, as before |
| 2 · orient master → detail from metadata | `planner.ts` `buildGraph` | `leftFolder` master, `rightFolder` detail (D-040). BFS never flips it |
| 3 · FANNING unless `one_to_one` | `planner.ts` | **assume fanning** (D-033) |
| 4 · live branches only | `planner.ts` `liveBranchesOf` | a branch whose subtree contributes no column is trimmed |
| 5 · fan candidate | `planner.ts` | ≥ 2 branches carrying a measure |
| 5a · master-side measure | `planner.ts` | **the single-branch trap** (D-034) |
| 6 · R1–R4 + REAGG | `planner.ts` `refuseR1toR3`, then R4, then re-aggregation | every refusal names its rule and its folders |
| 7 · branch construction | `planner.ts` `buildBranches` | branch-local conditions and parameters |
| 8 · outer + re-aggregate | `rewrite.ts` | `SUM→SUM`, `COUNT→SUM`, `MIN→MIN`, `MAX→MAX` |
| 9 · totals spanning branches → NULL | `totals.ts` | Oracle's second guard, §1.6 |
| 10 · record the decision | `query_execution_log.plan_decision` | migration `0015` |

---

## The artefacts

### The plan type — `backend/src/lib/sql/query-plan.ts`

The design artefact of the replan (D-017). Carries all seven required elements:
branches; each branch's folders; its join predicate; its branch-local
conditions and parameters; its group keys; its per-measure aggregate **and**
re-aggregate; and the outer key set.

Two invariants are recorded beside it:

- **the summary/RLS bypass (D-021)** — nothing leaks today because there is no
  result cache; the note names the rule for whoever adds one;
- **the security folder set is not the join path (D-115)** — the planner adds
  folders to FROM that carry no selected item, and the security set must not
  follow.

### The refusal-rule list — for the troubleshooting docs and the refusal UI

| Code | Rule | Refuses when |
| --- | --- | --- |
| `FAN_TRAP_R1` | different keys | two branches key on different master columns |
| `FAN_TRAP_R2` | detail–detail join | a direct edge between two branch subtrees |
| `FAN_TRAP_R3` | two detail axes | ≥ 2 branches contribute a non-aggregated column |
| `FAN_TRAP_R4` | two masters | ≥ 2 folders satisfy the branch test |
| `FAN_TRAP_REAGG` | not re-aggregatable | `AVG`, `COUNT DISTINCT`, `STDDEV`, `VARIANCE`, `MEDIAN`; or a drawn calculation that already aggregates |

Each has its own code because the five need genuinely different "what to
change" copy. Documented in `docs/troubleshooting/refusals.md` and translated
into all four locales.

---

## The seam this stage had to build first

`context.ts:62` used to be `usedFolderIds() { return [...this.aliases.keys()] }`
— an accumulator populated as a side effect of generation, which
`from-clause.ts` then read back and used `required[0]` as the FROM root. So the
root folder was whichever clause builder happened to alias one first, and a
planner placed ahead of generation had **nothing to plan over**.

Now: `effectiveFolderSet(def)` (D-115) is computed once, carried on the plan,
and handed to `GenerationContext`. `aliasFor` only *names* a folder the plan
already admits, and throws otherwise. `from-clause.ts`'s
`required.length === 1` short-circuit is **gone** — one folder produces a
spanning tree with no edges, so FLAT is a planner decision rather than the
emitter's default (D-018).

The execution service now plans once and shares `plan.folderSet` with the
entitlement gate, the security-predicate resolver and the generator. Those were
three independent derivations of the same thing.

---

## Proof the guard works, and is not inert

**Oracle's worked example, run for real** (`fan-trap-planner.test.ts`). The
ACCOUNT / SALES / BUDGET fixture is built in the test database with the numbers
Oracle's figures 9-19 / 9-20 pin down — three sales rows totalling 400, two
budget rows totalling 400 — and both statements are executed:

```
unguarded flat SELECT   ->  sales  800, budget 1200   (Oracle fig. 9-20)
planned rewrite         ->  sales  400, budget  400   (Oracle fig. 9-19)
```

Asserting the SQL text would only prove the emitter writes what the test
expects. Running it proves the arithmetic.

**Seam 6 — `checkPlannerLive`** (`migration-verify.ts`, wired into
`npm run verify --workspace backend` and into `migration-seams.test.ts`). It
plans maps that came out of a *migration*, loaded from the database through
`loadMapDefinition`, and **FAILS if not one of them classified a non-empty
measure set**. Every other fan-trap test in this repository builds its
`MapDefinition` by hand; a guard can pass all of them while having classified
nothing real. This is the one that cannot.

34 fan-trap tests, 3 seam-6 tests. The 26 FROM-clause characterisation tests
pass **unchanged**, which is what they were written for.

---

## Known limits, stated

1. **Multi-folder generation is still off.** `renderRewrite` is written, tested
   and proven, but `generateSql` does not call it — the D-014 interim refusal
   fires first. Phase 3.4 removes that refusal and wires the renderer in.
2. **A drawn calculated field refuses inside a rewrite.** Its formula may read
   columns from several branches and there is no rule for which one it belongs
   to. Zero such maps exist in this estate (48 drawn calculations sit on
   multi-folder maps, none of which aggregate). Phase 3.4's problem.
3. **A hidden item's folder does not enter the query.** Neo's SELECT clause
   skips hidden items, so a folder reached only by one is never aliased and
   cannot fan. Discoverer's query request names it. Narrower than the source,
   and safe — but recorded, because it is a real difference.
4. **The ten live joins still carry no predicates.** Phase 3.2's re-import tool
   has not been run against the live EUL. Until it is, any query needing one of
   them refuses by name rather than executing.
5. **A branch's own outer-join flags do not change the rewrite.** §1.4 property
   3 makes the detail side outer-joined *structurally*; a join flagged
   `allow_detail_no_master` inside a fan would keep detail rows without a
   master in the flat shape but not in the rewrite. No vendor text covers the
   combination and no join in this estate sets it.

---

## Validation

```
npm run typecheck --workspaces   # clean
npm test --workspace backend     # green
node scripts/i18n-check.mjs pt-PT fr-FR es-ES   # all checks passed
```

Migration `0015_record_plan_decision.sql` adds
`query_execution_log.plan_decision`, applied to the dev database and replayed
by the test-database setup script.
