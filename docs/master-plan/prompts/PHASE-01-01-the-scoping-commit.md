# PHASE 1.1 — The scoping commit

**Model:** Opus · **Effort:** max

> ## ⚠ READ THIS FIRST
>
> **This is the single most dangerous commit in the plan.**
>
> Today, the estate's multi-folder maps fail loudly at `from-clause.ts:105-107` with *"No join path
> connects…"*. **That failure is an accidental fan-trap guard.** There is no deliberate one
> anywhere in the codebase. The entire purpose of this stage is to remove the thing that
> breaks those maps.
>
> Oracle's own worked example shows **2×–3× inflation on two measures simultaneously**. A
> real join in this estate — `M M67 1 → M M67`, header to lines — would return every order
> total multiplied by its line count. **A £2.4M quarter would report as £9.6M, silently**, in
> a system whose users have fifteen years of trained trust in these numbers.
>
> **FIVE changes. ONE commit. Splitting them ships a system that returns wrong money — or
> leaks rows.**

## Purpose

Make one migrated worksheet execute — without breaking row-level security, without opening an
authorisation bypass, and without ever emitting an inflated aggregate.

## Scope — all five, together

### 1. Derived query scope

`loadMapDefinition()` derives the folder set from the map's **referenced items** (plus folders
reachable through its joins), not from `maps.business_area_id`. That column becomes **nullable
and advisory** — UI grouping only.

### 2. RLS follows the derived folder set

`backend/src/services/map-execution.service.ts:296-305` matches business-area-scoped policy
rules by **direct equality** on the map's BA column:

```ts
const businessAreaId = def.map.businessAreaId;
if (rule.targetType === 'BUSINESS_AREA' && rule.targetId === businessAreaId)
```

Make that column nullable and `rule.targetId === null` **never matches** — BA-scoped RLS stops
applying, the query runs **unfiltered**, and **no test catches it** because
`security_policy_rules` is empty.

Resolve those rules against the derived folder set instead: a rule fires if any used folder's
owning BA — or a BA it is shared into via `folder_business_areas` — equals `rule.targetId`.

### 3. Two authorisation gates

`backend/src/services/map.service.ts:786-813` — `canAccessMap` has five grant paths and
**four return before any BA check** — admin, owner, public **and the explicit share**. The share
path is the one this decision is about, so do not omit it when reasoning about the fix. Appending the folder rule to the
last branch leaves **map sharing as business-area grant escalation**: I own a map over folders
in a BA you were never granted, I share it with you, you read the data.

- `canAccessMap` → "may you see this map object"
- **new** `assertDataEntitlement(userId, folderIds)` → "may you read the data it touches",
  running **unconditionally** after it on every execute and export path, non-admin, no
  exceptions.

The home already exists: `backend/src/middleware/business-area-auth.ts:99` —
`resolveBusinessAreaId: (entityId) => Promise<string | null>` becomes `=> Promise<string[]>`
(four implementations at `:102-141`, consumed at `:170-188`), and the single
`userHasPermission` call becomes an **all-of** check.

### 4. The interim aggregate refusal

In `buildFromClause`, before anything else:

```ts
if (required.length > 1 && ctx.hasAggregates) {
  throw new SqlGenerationError(
    `Multi-folder aggregate queries are refused until the fan-trap planner lands. Folders: ${...}`
  );
}
```

Three lines. **Deleted in Phase 3.4, not before.**

### 5. The effective folder set, and fail-closed per policy-bearing folder ⟐ NEW

> **This closes a live row-level-security bypass that exists in the code today.** It is in this
> commit because changes 1–3 are what make it exploitable at scale.

**The bypass.** RLS resolves over `def.items ∪ def.conditions`
(`map-execution.service.ts:293-295`). Folders reach the emitted SQL two *other* ways:

- **Calculated-field references.** `def.formulaItems` is **every item row the loader fetched**
  (`sql-generator.ts:252-255`), not the map's selected items. A formula naming an item in
  folder X routes `resolveFormulaReference → itemExpression → aliasFor(X)`
  (`context.ts:126-129, 90`), so **X's column value lands in SELECT** and X never enters the
  RLS set.
- **Join bridges.** `from-clause.ts:104-126` builds a BFS spanning tree over `def.joins`, which
  `types/sql.ts:34` documents as **all joins available in the business area**. An `INNER` bridge
  filters the result set.

Nothing catches it because `security_policy_rules` is empty, so no test exercises the path.

**Build:**

1. **`effectiveFolderSet(def)`** — one pure function of `MapDefinition`, per the rule above.
   Use it for the RLS predicate set. Phase 3.3 will use the same function for the planner.
2. **Fail closed per policy-bearing folder.** If any folder in that set is targeted by ≥1
   `security_policy_rules` row **for anyone**, and the executing user resolves no predicate for
   it, **refuse**, naming the folder.

   > **Against today's empty policy table this is a no-op.** Zero behaviour change; every map
   > that would run still runs. It becomes correct the instant the first policy is written —
   > which is the instant the current code becomes dangerous.
   >
   > Do **not** implement a global fail-closed here. `getUserPolicies` returning empty currently
   > means "no predicates" (`map-execution.service.ts:290-291`); flipping that globally would
   > return **zero rows for every map in the estate**. The full treatment is Phase 6.3 (D-090);
   > this is the interim that costs nothing (D-116).

## Prerequisites

Phase 0 complete — **all five stages**:

- **0.3**, whose Q1 cardinality probe settles the master/detail orientation by measurement.
- **0.4**, whose baseline supplies the counts this stage's acceptance criteria assert against.
  The source documents disagree (272 / 341 / "271 of 341"), so **assert against the recorded
  baseline, never a literal.**

## Required files to read first

- `docs/master-plan/research/architecture-analysis.md` **B1, B2, B3** — the authoritative brief
- `docs/master-plan/research/legacy-analysis.md` §1 (why the guard matters) and §1.11
- `docs/master-plan/DECISION_REGISTER.md` D-013 to D-018, **and D-115/D-116**
- `docs/master-plan/research/baseline-counts.md` — Phase 0.4's measured counts
- `backend/src/lib/sql/context.ts` (the alias accumulator and `resolveFormulaReference`)
- `backend/src/types/sql.ts` (`MapDefinition`, esp. `formulaItems` and the `joins` comment)
- `backend/src/services/sql-generator.ts` (266 lines — read whole)
- `backend/src/services/map-execution.service.ts:280-320`
- `backend/src/services/map.service.ts:780-820`
- `backend/src/middleware/business-area-auth.ts`
- `backend/src/lib/sql/from-clause.ts`

## Required tooling

**Skills:** none. **Agents:** none — single-context work.
**Plugins / MCPs:** `context-mode` (psql verification), `typescript-lsp` (the
`resolveBusinessAreaId` signature change touches four implementations and two consumers),
`code-review` **or** `coderabbit` on the finished diff — **this commit warrants a review gate**.

## Implementation instructions

- **Write all five changes together, commit once.** If you must stop mid-way, leave the
  working tree uncommitted rather than committing a partial change.
- **Write `effectiveFolderSet(def)` and route BOTH consumers through it (D-115).** Do not record
  the old invariant as a comment — **it described a bypass.** The rule is:

  > **Any folder that can change the rows the user sees must resolve its policies, or the query
  > refuses.**

  A folder contributing a column qualifies. An `INNER`-joined bridge qualifies — it *filters*
  the result set, so its policy changes what the user sees. A master-side `OUTER` bridge
  contributing no column does not.

  Return two named sets so the distinction is explicit and testable:
  - `columnBearingFolderIds` — `def.items`, `def.conditions`, **and folders reached through
    resolved calculated-field references**;
  - `joinPathFolderIds` — the BFS bridges over `def.joins`, tagged with their join type.

  **RLS resolves over `columnBearing` ∪ every `INNER` bridge. FROM resolves over the union.**
- The Drizzle migration making the column nullable is generated, not hand-written.
- Keep `maps.business_area_id` populated as advisory data; do not null the existing rows.

## Tests

Every one of these is a **gate**, not a nice-to-have:

1. A **single-folder** migrated map executes end to end against the live Oracle and returns
   rows.
2. **A BA-scoped RLS policy still fires on a map with `business_area_id IS NULL`.**
   **Without this test, the column stays `NOT NULL` and this stage is NOT done.**
3. An owner / public / shared map **still fails** `assertDataEntitlement` when the user lacks a
   folder's BA grant.
4. A multi-folder **aggregate** map refuses loudly, naming the folders.
5. A multi-folder **non-aggregate** map is unaffected by the refusal.

**The RLS conformance suite (D-115/D-116) — six tests, all gates:**

6. A user with **no** policy sees nothing where a policy-bearing folder is involved.
7. A **BA-scoped** policy fires on a map with `business_area_id IS NULL` (this is test 2 above;
   keep it in the suite).
8. **A folder reached ONLY through a calculated-field reference has its policy applied, or the
   query refuses.** Build the map deliberately: a calculated field naming an item in a
   policy-bearing folder that is in neither `def.items` nor `def.conditions`.
9. **An `INNER`-joined bridge folder's policy is applied.**
10. **A policy-bearing folder the executing user cannot resolve causes a refusal, not an
    unfiltered query.**
11. **An export carries the same predicates as the on-screen query.** Assert the predicates, not
    just that the rows match — equal-but-unfiltered passes a row comparison.

Tests 8, 9 and 11 exist in no other stage of this plan.

## Security checks

- Test 2 and test 3 are the security checks. Do not proceed without both.
- Confirm the security predicate's unconditional bracketing still holds — an `OR` in a user
  condition must not escape it.
- Confirm admin bypass is still deliberate and still logged.

## Validation

```bash
cd discoverer-neo && npm run typecheck --workspaces && npm test --workspace backend
```

Then, against the live stack: execute a known single-folder migrated map and assert rows;
execute a known multi-folder aggregate map and assert the new refusal message.

## Acceptance criteria

- [ ] **MANUAL — no Oracle is reachable from CI.** A single-folder migrated worksheet executes
      and returns rows. **Record the map id, the generated SQL, the row count and the timestamp
      in the checkpoint.** A number in a durable artefact is what separates this from the green
      suites this plan distrusts
- [ ] The RLS-with-NULL-BA test exists and passes
- [ ] The data-entitlement bypass test exists and passes
- [ ] A multi-folder aggregate map refuses, naming the folders
- [ ] Single-folder maps generate SQL and multi-folder aggregates refuse, **in the proportions
      Phase 0.4 recorded**. Do NOT assert against a literal — the source documents disagree
      (272 in this prompt's v1.0 vs 341 in Phase 3.2's vs "271 of 341" in the research)
- [ ] All **five** changes are in **one commit**
- [ ] `effectiveFolderSet(def)` exists, is the **only** derivation of the folder set, and is
      consumed by the RLS predicate builder
- [ ] All six RLS conformance tests pass
- [ ] The per-policy-bearing-folder refusal is in place and is a **no-op against the current
      empty policy table** — the same maps run as before

## Documentation updates

- `docs/developer-guide/architecture.md` — the two-gate authorisation model and the derived
  scope rule
- `docs/admin-guide/security.md` — what changed for business-area grants

## Git checkpoint

**One commit**, message naming all five changes and citing D-014, D-015, D-016, D-115 and D-116.
Push.

## Handover artefacts

- The commit SHA recorded in `MASTER_PLAN_GENERATION_CHECKPOINT.md`
- The measured counts: how many maps generate SQL, how many refuse, and why

## Explicitly out of scope

- **The fan-trap planner.** Phase 3.3.
- **`join_predicates` and the join flags.** Phase 3.2.
- Deleting the interim refusal. Phase 3.4.
- `GET /api/maps` visibility. Phase 1.2.
- The seam tests. Phase 1.3.
- Any formula work. Phase 4.

## Resume instructions

Read the checkpoint. If the commit exists and all five tests pass, this stage is done — go to
`PHASE-01-02-visibility-and-schema.md`. If the working tree has partial changes, **finish all
four before committing.**

## TOKEN-BUDGET SAFE EXECUTION

1. Read the source files first, then write all five changes, then test.
2. **No specialist agents in parallel — and none needed here at all.**
3. **Checkpoint on progress, not only on completion.** After each of the five changes, append
   one line to the checkpoint naming what is now written and what is not. A 5-hour limit landing
   mid-stage must leave a tree that is resumable from the checkpoint alone.
4. Persist the measured map counts into the checkpoint — they are the baseline Phase 3.4
   compares against.
5. Commit once, coherently.
6. **If interrupted mid-change, do NOT commit.** Record in the checkpoint exactly which of the
   five changes are written, and leave the tree dirty. A partial commit here is worse than no
   commit.
7. If interrupted, summarise the incomplete work in the checkpoint before the session ends.
