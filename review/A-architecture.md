# Review A — Architecture Challenge

**Method:** the `code-modernization:architecture-critic` agent was dispatched first and **died
at 117 739 tokens with zero output** (session rate limit). That is the fourth such death on
this task family and is itself recorded as a finding in Review G. The review was then
performed **inline by targeted verification against source** — the method the plan's own
tooling manifest recommends (`CLAUDE_CODE_MINIMAL_TOOLING_MANIFEST.md` §Rules 3).

**Every claim below was checked against the working tree**, not against the audit or the plan.

---

## A-01 · The RLS folder set is a strict subset of the SQL folder set

- **Severity:** CRITICAL
- **Phase/Stage:** 1.1 · 6.3 · D-015 · D-016
- **Type:** MISSING (a live vulnerability neither the audit nor the plan names)

**Finding.** Two different collections decide "which folders does this query touch", and the
security one is smaller than the SQL one. Today. Not after Phase 3.

The security set is built from `def.items` and `def.conditions` only:

```
backend/src/services/map-execution.service.ts:293-295
  const usedFolderIds = new Set<string>();
  for (const entry of def.items)      usedFolderIds.add(entry.folder.id);
  for (const entry of def.conditions) usedFolderIds.add(entry.folder.id);
```

The SQL set is the alias map, which a **third** collection also feeds:

```
backend/src/lib/sql/context.ts:24-33   constructor
  for (const entry of def.formulaItems) {
    this.registerFolder(entry.folder);
    this.formulaItemsByName.set(entry.item.name.toUpperCase(), entry);
  }
backend/src/lib/sql/context.ts:126-129  resolveFormulaReference
  → itemExpression(entry.item, entry.folder)
backend/src/lib/sql/context.ts:90       → const alias = this.aliasFor(folder.id)
backend/src/lib/sql/context.ts:62       usedFolderIds() { return [...this.aliases.keys()] }
```

And `def.formulaItems` is **every item row the loader fetched**, not the map's selected items:

```
backend/src/services/sql-generator.ts:252-255
  formulaItems: itemRows.flatMap((item) => { ... })
```

**The exploit.** A map carries a calculated field whose formula names an item living in folder
X. X carries a `FOLDER`-scoped `security_policy_rules` row. X is not among the map's selected
items and not in any condition. Result: `resolveFormulaReference` aliases X, X enters
`usedFolderIds()`, X enters the FROM clause and is joined — and `map-execution.service.ts:308`
(`usedFolderIds.has(rule.targetId)`) never sees X, so **no security predicate for X is
emitted**. The user reads rows they hold no policy for.

**Why nothing caught it.** `security_policy_rules` is empty in this estate, so no test
exercises the path — the same blind spot D-015 identifies for the business-area branch, on the
folder branch, which D-015 does not cover.

**Why the plan makes it worse.** `docs/master-plan/prompts/PHASE-01-01-the-scoping-commit.md`
lines 108-112 instruct:

> *"Record this invariant … `usedFolderIds` is derived from `def.items` + `def.conditions`
> only … **Do not "fix" the security folder set to match the join path.**"*

Read literally, that instruction cements the bypass into a documented invariant. The
instruction's *reasoning* is sound — the Phase 3 planner will legitimately put join-path
folders in FROM that carry no selected item, and widening the security set to the whole join
path would over-filter. But the conclusion does not follow. The correct rule is not "security
uses the narrow set"; it is **"any folder whose columns can reach the result must either carry
its policy or cause a refusal."** A join-path folder contributes no columns; a
`formulaItems`-reached folder contributes a column value directly into SELECT.

**Recommendation.**
1. Treat this as a **CRITICAL finding in its own right** and add it to Phase 1.1's scope. It is
   caused by the same code the stage already opens.
2. Replace the comment-only invariant with **one function**, exported from
   `backend/src/lib/sql/`, returning two named sets: `columnBearingFolderIds` (items +
   conditions + folders reached through resolved formula references) and `joinPathFolderIds`.
   Security resolves against the first; FROM resolves against the union.
3. Add a Phase 1.1 gate test: a map with a calculated field referencing an item in an
   unselected, policy-bearing folder **must** emit that folder's predicate, or refuse.
4. Phase 6.3's fail-closed rule must cover this case explicitly, not only COMPLEX folders.

---

## A-02 · The planner seam the plan assumes does not exist

- **Severity:** HIGH
- **Phase/Stage:** 3.3 · D-017 · D-018
- **Type:** INCORRECT

**Finding.** The plan places the query planner *"between `loadMapDefinition()` and
`generateSql()`"* (§2 diagram; Phase 3.3 scope). At that point **the folder set does not yet
exist.** `ctx.usedFolderIds()` is not a property of the definition — it is an accumulator
populated as a side effect of generation:

```
backend/src/lib/sql/context.ts:52-64
  aliasFor(folderId) { ... this.aliases.set(folderId, alias) ... }
  usedFolderIds()    { return [...this.aliases.keys()] }
```

`from-clause.ts:67` reads `ctx.usedFolderIds()` and `from-clause.ts:72` takes
`rootId = required[0]` — so **the FROM root folder is whichever folder some earlier clause
builder aliased first.** The set is order-dependent and mutable, not a value.

A planner sitting before `generateSql()` therefore has to re-derive the folder set by its own
means, and the two derivations can disagree — reintroducing A-01 in a second place.

**Recommendation.** Phase 3.3's first task is not the plan type; it is to **make the folder set
a pure function of `MapDefinition`**, computed once, passed to both the planner and the
context. Add this to 3.3's scope explicitly and to its acceptance criteria: *"`aliasFor` no
longer decides membership; it only assigns a name to a folder the plan already contains."*
Without it, D-018's *"the emitter never decides FLAT for itself"* is not achievable — the
emitter still decides the input FLAT is computed from.

---

## A-03 · D-011's measured counts are wrong, and `custom_functions` breaks the re-export story

- **Severity:** HIGH
- **Phase/Stage:** 1.2 · 4.3 · D-011 · D-057
- **Type:** INCORRECT + MISSING

**Finding.** D-011 states *"the 19 shared tables live in `migrate/src/db/schema.ts` … backend
re-exports them and adds its 11 runtime-only tables"*, and that *"only 2 of 20 shared tables
differ, by 4 columns."*

Measured against the tree:

| Claim | Plan | Actual |
| ----- | ---- | ------ |
| Shared tables | 19 | **18** |
| Backend runtime-only | 11 | **10** |
| Migrate-only | 0 (implied) | **1 — `custom_functions`** |
| Backend total | — | 28 |
| Migrate total | — | 19 |

Backend-only, verified: `audit_log`, `data_sources`, `export_jobs`, `map_shares`,
`query_execution_log`, `schedule_parameters`, `scheduled_results`, `schedules`,
`security_policy_assignments`, `security_policy_rules`.

**The consequence is not the arithmetic.** It is `custom_functions`. That table exists **only
in `migrate/src/db/schema.ts`**. D-057 and Phase 4.3 require the *backend's* formula renderer
to resolve `[2,n]` through the workbook element table to a migrated `custom_functions` row —
from the backend, at query time. The backend has no binding for that table today, and
D-011's direction of travel (migrate is the source, backend re-exports) means 1.2 must
re-export it. The plan never says so, and 4.3 lists no schema work.

**Recommendation.** Correct the counts in D-011 and §2. Add to Phase 1.2's scope: *"`core`
exports `custom_functions`; backend re-exports it — Phase 4.3 depends on reading it at query
time."* Add to 4.3's prerequisites.

---

## A-04 · "Drift becomes a compile error" is not established

- **Severity:** HIGH
- **Phase/Stage:** 1.2 · D-011 · D-012
- **Type:** UNVERIFIABLE

**Finding.** D-011's payoff sentence is *"**Drift becomes a compile error.**"* A re-export
(`export * from '@discoverer-neo/core/db/schema'`) makes the two files *the same file*, so
drift becomes impossible rather than detected — which is stronger, and fine. But the plan's own
acceptance criterion for 1.2 asks for something else:

> *"a deliberate column mismatch **between the two schema files** now fails typecheck"*

If the tables are re-exported there are no longer two definitions to mismatch, so the test as
written cannot be constructed. If the backend instead keeps its own definitions and only
*compares* them, nothing in Drizzle or TypeScript structural typing makes a differing column
set a type error — two `pgTable` calls with different columns are simply two valid values.

The plan has not decided which of the two designs it means, and its acceptance test belongs to
neither.

**Recommendation.** Force the choice in 1.2 and rewrite the gate accordingly:
- **If re-export:** the gate is *"`backend/src/db/schema.ts` contains no `pgTable` call for any
  of the 18 shared tables"* — grep-checkable, and the ESLint rule enforces it thereafter.
- **If parallel definitions:** the gate needs a generated conformance test (compare Drizzle
  table metadata at runtime), which is real work the plan does not fund.

Also: D-012's `no-restricted-imports` rule is placed in `migrate/` to stop `migrate → backend`.
That is the direction that is **already** clean. Nothing constrains `backend → core` to import
only from the schema subpath, so backend can reach into `core/migration/` and take a Fastify-free
package into the request path. Add the reciprocal rule.

---

## A-05 · D-032 over-scopes the join change; the folder endpoints already exist

- **Severity:** MEDIUM
- **Phase/Stage:** 3.2 · D-032 · MIG-01 · LEG-02
- **Type:** OVER-ENGINEERING / INCORRECT

**Finding.** D-032 says to *"replace the item-pair `joins` model with folder-to-folder `joins`"*
and MIG-01 says *"all 10 migrated joins have NULL endpoints."* The schema says otherwise:

```
backend/src/db/schema.ts — joins
  leftFolderId : uuid('left_folder_id').notNull().references(folders.id)
  rightFolderId: uuid('right_folder_id').notNull().references(folders.id)
  leftItemId   : uuid('left_item_id').references(items.id)      // nullable
  rightItemId  : uuid('right_item_id').references(items.id)     // nullable
  joinType     : joinTypeEnum('join_type').notNull()
```

The joins table is **already folder-to-folder**, with both folder columns `NOT NULL`. The NULL
endpoints are the **item** columns — the predicate. And `sql-generator.ts:242-243` drops a join
on null *item* ids even though its folder endpoints are present and usable:

```
joins: joinRows.flatMap((j) => {
  if (!j.leftItemId || !j.rightItemId) return [];
```

**So 3.2 is smaller than described** — add `join_predicates`, add the four flags, derive and
drop `join_type` — and D-039's refusal is a change at `sql-generator.ts:242`, not a modelling
change. But the plan's framing risks a session rewriting working columns.

**Recommendation.** Restate D-032 as *"the joins table is already folder-to-folder; the missing
element is the **predicate**"*, and restate MIG-01 as *"null **item** endpoints"*. Keep
`left_folder_id` / `right_folder_id` untouched. Note in 3.2 that `join_type` is `NOT NULL`
today, so deriving it requires a migration that drops the constraint before the column.

---

## A-06 · Observability lands after the two riskiest phases have shipped

- **Severity:** MEDIUM
- **Phase/Stage:** 8.2 vs 3.3 / 4.5
- **Type:** UNDER-ENGINEERING

**Finding.** Phase 8.2 adds pool, queue and migration metrics, and fixes the `getConnection`
leak (BE-04) and the unbounded async result cache (BE-03). It runs **after** Phase 3 ships the
query planner and Phase 4 compiles 49 819 formulas against live Oracle. Those are the two
phases most likely to hold connections open, retry, and blow memory — and they run with no
pool metrics and a known connection leak still in place.

The plan notes Phase 8 *"is independent of everything after 1"* but then schedules it last.

**Recommendation.** Pull **BE-04 (the `getConnection` leak) and the Oracle pool metric** out of
8.2 into **Phase 1.3**, alongside the verification harness. They are small, they are the
instrument the riskiest phases need, and 1.3 is already the stage that builds measurement
apparatus. Leave the rest of 8.2 where it is.

---

## A-07 · No concurrency story between migration and the live application

- **Severity:** MEDIUM
- **Phase/Stage:** 9.2 · 9.3 · D-078 · D-079
- **Type:** MISSING

**Finding.** D-078 migrates into a fresh database promoted by connection-string switch, which
is right. D-079 adds incremental re-import *"so the source can keep changing while the target
is validated."* Nothing in the plan says what happens when an incremental re-import runs
**against the database the application is currently serving** — which is the only interesting
case, since the point is to keep validating a live target.

`importFromOracle` gets a transaction only in 8.3 (BE-08), and 8.3 is scheduled after 9.x in
dependency terms but before it in phase order. Meanwhile Phase 1.2 makes saving a map preserve
its totals — so a user editing a map while a delta re-import rewrites the same rows is a real
sequence with no stated resolution.

**Recommendation.** Add to 9.2's scope: a **migration lock** (a row in `migration_log` claimed
for the duration, checked by the write paths) and a stated policy — either *re-import is
offline-only* (simplest, and consistent with D-078's fresh-database posture) or *re-import
never touches a map modified since its last import*. Name the choice; do not leave it to the
executing session.

---

## A-08 · A refusal that breaks a scheduled workbook has no handling

- **Severity:** MEDIUM
- **Phase/Stage:** 3.3 · 3.4 · 7.2 · D-035 · D-036
- **Type:** MISSING

**Finding.** D-035 refuses `AVG`, `COUNT DISTINCT`, `STDDEV` and `VARIANCE` across a fan, and
notes *"the estate has 282 `COUNT DISTINCT` totals."* D-036 makes a refusal a first-class **UI**
state. Phase 7.2 migrates `EUL4_BATCH_REPORTS` into the existing scheduler.

A scheduled workbook has no UI at the moment it runs. When the planner refuses, the job fails
on a timer, unattended, possibly nightly, with the refusal text in a job record nobody reads.
The plan has no story for this, and 7.2's acceptance is only *"schedules run from migrated
defs."*

**Recommendation.** Add to 7.2: a **pre-flight planner pass over every migrated schedule at
import time**, producing a report of schedules that will refuse — before the first run. Add to
its acceptance: *"no migrated schedule is activated whose definition the planner refuses;
those import as `DISABLED` with the refusal reason."*

---

## A-09 · `maps.business_area_id` advisory-but-populated is two sources of truth

- **Severity:** LOW
- **Phase/Stage:** 1.1 · D-013
- **Type:** UNDER-ENGINEERING

**Finding.** 1.1 makes the column nullable and advisory but instructs *"Keep
`maps.business_area_id` populated as advisory data; do not null the existing rows."* Nothing
then keeps it consistent with the derived folder set. A map edited to reference folders in a
different BA keeps a stale advisory value, which the Maps list (2.1) then uses as its
business-area filter — so the filter and the data disagree, silently.

**Recommendation.** Either recompute the advisory value on save from the derived folder set
(one line in the save path), or drop it from the 2.1 filter and filter on the derived set.
State which in 1.1.

---

## A-10 · Phase 0.1 bundles 74 additions with 2 705 deletions, against a contradicted instruction

- **Severity:** MEDIUM
- **Phase/Stage:** 0.1
- **Type:** INCORRECT

**Finding.** The plan says *"70 untracked paths"*. Measured: **74 untracked**, and — not
mentioned anywhere in the plan — **2 705 deletions already staged in the working tree** (the
`.claude/agents/` and `.claude/skills/` removals). Phase 0.1's acceptance is
`git status --porcelain` showing nothing unexpected, which forces both into one commit.

Worse, the two governing documents disagree. `CLAUDE.md` (project instructions, and therefore
authoritative for any session) describes `.claude/skills/` as a **live asset**: *"Find one by
reading `.claude/skills/SKILL_INDEX.md` on demand"*, and `.claude/agents-off/` as recoverable
by renaming. The tooling manifest says **REMOVE** both. A session executing 0.1 is told by one
file to preserve what another tells it to delete — and the deletion is 2 705 files, irreversible
once committed and pushed with no remote history behind it.

**Recommendation.** Split 0.1 into two commits with an explicit ordering:
1. **Commit the additions first** (the 74 untracked paths, `.gitignore`, the junk path removal).
   This is the commit that makes the work durable and must not be blocked on a policy question.
2. **Then** the `.claude/` deletion, as its own commit, *after* `CLAUDE.md` is corrected in the
   same commit so the tree is self-consistent.

Add to 0.1's acceptance: *"`CLAUDE.md` no longer describes deleted directories as present"* —
the plan already names this, but as a deliverable of the same commit that deletes them.

---

## A-11 · `docker.yml` has no branch filter to repoint

- **Severity:** LOW
- **Phase/Stage:** 0.1
- **Type:** INCORRECT

**Finding.** The plan and its prompt say *"repoint `.github/workflows/{ci,docker}.yml` from
`main` to `master`"*. `ci.yml` does carry `branches: [main]` twice (lines 5 and 7) and needs
it. `docker.yml` carries **no `branches:` key at all** — it triggers on
`release: types: [published]` and `workflow_dispatch`. There is nothing to repoint.

**Recommendation.** Correct the scope to `ci.yml` only, and note that `docker.yml` is
release-triggered so 0.1's *"a CI run exists and passes"* acceptance cannot come from it.

---

## A-12 · `canAccessMap` has four early returns before the BA check, not three

- **Severity:** LOW
- **Phase/Stage:** 1.1 · D-016
- **Type:** INCORRECT

**Finding.** D-016 and the 1.1 prompt say *"`canAccessMap` has four grant paths and **three**
return before any BA check (admin, owner, public)."* Verified at
`backend/src/services/map.service.ts:786-813`: the returns before `userHasPermission` are
**admin, owner, public, and the explicit share** — four. The share path is precisely the
escalation the decision is about (*"I share it with you, you read the data"*), so it is odd
that it is the one omitted from the count.

The conclusion is unaffected; the description is wrong in the security-critical document a
future session will read as authoritative.

**Recommendation.** Correct to "five grant paths, four of which return before any business-area
check (admin, owner, public, share)."

---

## A-13 · The dashboard placeholder appears twice; the plan names one line

- **Severity:** LOW
- **Phase/Stage:** 2.3 · D-101 · D-104
- **Type:** MISSING

**Finding.** The plan says *"delete `frontend/src/__tests__/dashboard.test.tsx:93`, which
asserts the placeholder text."* The test asserts **two** things that D-101 forbids:

```
frontend/src/__tests__/dashboard.test.tsx:92-93
  expect(await screen.findByText(/No maps yet/)).toBeInTheDocument()
  expect(screen.getByText(/Scheduling isn.t available yet/)).toBeInTheDocument()
```

Line 92 pins `"No maps yet"`, which D-101/R2 explicitly names as the wrong empty state
(*"923 worksheets exist; none are shared with you"*, never *"No maps yet"*). Deleting only
line 93 leaves the test enforcing the untruthful empty state.

**Recommendation.** 2.3's scope should say *"rewrite the empty-state assertion, delete the
scheduling assertion"* — the whole test case, not one line.

---

## Verified correct

Checked against source and confirmed as the plan describes:

- `from-clause.ts:73-76` — the single-folder short-circuit is at exactly those lines. D-018 is
  correctly located.
- `from-clause.ts:105-107` — *"No join path connects folder … to the rest of the query"*.
- `map-execution.service.ts:296-305` — BA-scoped rules matched by direct equality on
  `def.map.businessAreaId`. D-015's mechanism is exactly as described.
- `business-area-auth.ts:99` — `resolveBusinessAreaId: (entityId) => Promise<string | null>`,
  with four implementations (folder, item, join, hierarchy) and the single `userHasPermission`
  consumer at ~:176. D-016's home is correctly identified.
- `eul-schema-adapter.ts:129-130` — maps `KEY_OBJ_ID → masterFolderId` and
  `FK_OBJ_ID_REMOTE → detailFolderId`, i.e. **the opposite of D-040's proposed orientation**.
  The disagreement D-040 describes is real, and Phase 0.3 Q1 is correctly scoped to settle it.
- `migrate/src/db/schema.ts` `mapConditions` — has **no** `group_id` column; backend's has
  `groupId` at `:787`. D-072 is exactly right, and its ordering ahead of the seam tests is
  justified.
- `sql-generator.ts:242-243` — null-endpoint joins are silently dropped. D-039 correct.
- `workbook-parser.ts:1054-1069` — the token parser is general over the grammar Phase 4 needs
  (`[1,code]` calls, `[2,n]` custom functions, `[5,kind]` literals, `[6,n]` items, `[8,n]`
  parameters). *"Only the renderer is missing"* is a fair statement. **One note:** it is named
  `parseConditionTree` and typed `ConditionNode`; Phase 4.1 should rename both, or a future
  reader will conclude the formula parser is absent.
- `workbook-parser.ts:3045-3060` — the comment describing Oracle's recursive substitution and
  marking chain-walking out of scope. D-056's evidence is real.
- `.github/workflows/ci.yml:5,7` — `branches: [main]`; the branch is `master`. INF-04 real.
- `git remote -v` — empty. DOC-04 real.
- `discoverer-neo/frontend/[A-Z][a-z][a-zA-Z` — the junk path exists.
- `scoreReadiness` at `migrate/src/services/assessment.ts:571`, consumed at `:636`. F-12's
  location correct.
- The architectural refusals hold up. **D-017's plan type is not over-engineering** — WHERE
  genuinely goes from one clause to n+1 and folder aliases stop being 1:1, both verified in
  `context.ts` / `where-clause.ts`. **Two authorisation gates are not over-engineering** —
  four early returns confirm one corrected gate cannot cover it. **Six join operators and four
  booleans are not over-engineering** — they are columns, not code paths.

---

## Not verifiable from this repository

Recorded so a later stage does not mistake them for confirmed:

- The 923 / 651 / 272 map counts, 49 819 formulas, 37 971 aligned pairs, 5 605 conditions,
  19 632 total rows, 174 cleartext credentials — all require the live Postgres. Every phase
  acceptance criterion that quotes one of these numbers is **unverifiable until Phase 0
  connects**. Phase 1.1's *"~651 generate SQL; ~272 refuse"* is a gate resting on an unmeasured
  baseline.
- **Recommendation:** Phase 0 must gain a stage — or 0.3 must gain a scope item — that
  **measures and records these baselines** before Phase 1.1 asserts against them.
