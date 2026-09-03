# Architecture Analysis — adversarial review of the proposed target architecture

**Produced:** 2026-09-02 by `code-modernization:architecture-critic` (Opus, 108 k subagent
tokens, 30 tool uses), reviewing ten propositions P1–P10 against the live source,
`AUDIT_ARCHITECTURE_ASSESSMENT.md` and `research/legacy-analysis.md`.

**Verdict:** P1, P4, P7, P8 correct — take them. P2 and P5 correct in intent, **wrong in
detail in ways that will bite**. P3's contents justified, its container not. P6 and P9
misprioritised.

---

## The propositions reviewed

| P | Proposition | Outcome |
| - | ----------- | ------- |
| P1 | Keep three workspaces; no microservices, no new runtime process | **ACCEPT** |
| P2 | Query scope from referenced items; `maps.business_area_id` nullable/advisory | **ACCEPT with 3 blockers** |
| P3 | New `@discoverer-neo/semantics` workspace (AST, token parser, emitter, evaluator, planner, shared schema) | **REJECT the workspace, ACCEPT the contents** |
| P4 | `joins` folder-to-folder + `join_predicates`; four booleans; derive `join_type` | **ACCEPT + operator column** |
| P5 | Query planner between `loadMapDefinition()` and `generateSql()` | **ACCEPT — but output a plan, not a verdict** |
| P6 | Oracle dialect capability layer | **DEMOTE to a boot-time version check** |
| P7 | Migration output verification feeding readiness blockers | **ACCEPT + decision histogram + post-commit** |
| P8 | `workbooks` aggregate above `maps` | **ACCEPT, sequence after P2** |
| P9 | Condition expression tree replacing flat `group_id` | **DEFER — one boolean gets 100 % of this corpus** |
| P10 | `item_classes` / LOV model | **ACCEPT, delete the stated rationale** |

---

## BLOCKERS — all three land in the scoping commit

### B1. P2 silently disables row-level security

`backend/src/services/map-execution.service.ts:296-305` matches business-area-scoped policy
rules by **direct equality** against the map's BA column:

```ts
const businessAreaId = def.map.businessAreaId;
if (rule.targetType === 'BUSINESS_AREA' && rule.targetId === businessAreaId)
```

Make that column nullable and `rule.targetId === null` never matches. BA-scoped RLS stops
applying, the query runs **unfiltered**, and there is no error, no warning and a green test
suite — because `security_policy_rules` is empty, so no test would catch it.
`legacy-analysis.md:1005,1015` is emphatic that Discoverer's own RLS already failed open by
construction and that **Neo's one deliberate incompatibility must be to fail closed.** P2 as
drafted moves toward the anti-pattern.

**Required, same commit:** resolve `targetType='BUSINESS_AREA'` rules against the *derived
folder set P2 already computes* — a rule fires if any used folder's owning BA (or shared BA)
equals `rule.targetId`. Add a test asserting a BA-scoped policy still fires on a map with
`business_area_id IS NULL`. **Until that test exists, the column stays `NOT NULL`.**

**Secondary invariant to write down now:** `usedFolderIds` is built from `def.items` +
`def.conditions` only (`map-execution.service.ts:293-295`). That matches the legacy trigger
(item presence from the folder, `legacy-analysis.md:994`) — but under P5 the planner adds
folders to FROM that carry no selected item. Record the invariant, or someone will "fix" it
into the join-path folder set and change security semantics by accident.

### B2. P2's "strictly stricter" claim is false, and the new rule has no home

`backend/src/services/map.service.ts:786-813` — `canAccessMap` has four grant paths and
**three return before any BA check**:

```ts
if (user.role === 'ADMIN') return true;
if (map.createdBy === user.sub) return true;
if (map.isPublic && (action === 'VIEW' || action === 'EXPORT')) return true;
// map_shares…
const { hasPermission } = await userHasPermission(user.sub, map.businessAreaId, action);
```

Bolt the folder-set rule into the final branch and owner/public/shared maps bypass it
entirely — **map sharing becomes business-area grant escalation**: I own a map over folders
in a BA you were never granted, I share it, you read the data. The migrated estate happens
to route through the BA check (`transform.ts:672` writes `isPublic: false`, `:667` sets
`createdBy`), so P2 genuinely tightens things *today* — but the design must not depend on
that.

**Required:** two gates, not one.
- `canAccessMap` → "may you see this map object"
- **new** `assertDataEntitlement(userId, folderIds)` → "may you read the data it touches",
  running **unconditionally** after it on every execute/export path, non-admin, no exceptions.

**The home already exists and needs a shape change.**
`backend/src/middleware/business-area-auth.ts:99` is built around one entity → one BA:

```ts
resolveBusinessAreaId: (entityId: string) => Promise<string | null>;   // 4 impls at :102-141, consumed :170-188
```

P2 makes that `Promise<string[]>` and turns the single `userHasPermission` call into an
all-of check. Small diff — but it is the actual boundary, and the proposal did not name it.

### B3. P2 removes the loud failure that is currently masking LEG-04

272 multi-folder maps fail today at `backend/src/lib/sql/from-clause.ts:107` ("No join path
connects…"). P2 makes them loadable. `buildFromClause` will then emit a flat inner join
across folders and `select-clause` will emit `SUM(...)` over the inflated cross-product.
Oracle's own worked example puts the inflation at **2×–3× on two measures simultaneously**
(`legacy-analysis.md:73`).

The plan sequences the guard *after* the scoping fix — correct — but **P2 is what deletes the
accidental guard**, and that leaves a window.

**Required, same commit — three lines:** in `buildFromClause`, if
`required.length > 1 && ctx.hasAggregates`, throw `SqlGenerationError` naming the folders and
the reason ("multi-folder aggregate queries are refused until the fan-trap planner lands").
Delete them when P5 ships. **Without this, "fix scoping" is a commit that can return inflated
money.**

---

## HIGH

### H1. Delete P3's fourth workspace. Keep its contents.

The two Drizzle schemas were diffed mechanically. Of the 20 tables `migrate` declares,
**2 differ from backend, by 4 columns**: `users` (backend-only `locale`, `theme`,
`color_palette`) and `map_conditions` (backend-only `group_id`). Everything else is
column-identical. **Neither file is the DDL** — `backend/drizzle/0000..0009*.sql` is. Both TS
files are *typed views* over one physical schema, and migrate's is a strict subset minus one
column it should have.

So BE-10 is not "two schemas that can disagree about the database". It is "one type
declaration is a subset of the other". A fourth npm workspace to fix a subset relation buys
a `tsc --build` project reference, a `dist/` both consumers must resolve, a version field
two packages can skew on, and a **diamond** in a graph that is today a straight line
(`backend→semantics`, `migrate→semantics`, `backend→migrate`).

**Instead:** `migrate` is already the smaller, dependency-free package, and `backend` already
depends on it in production (`backend/package.json:31`, used at
`backend/src/services/migration.service.ts:35`). Put the 19 shared tables in
`migrate/src/db/schema.ts` as the single definition; `backend/src/db/schema.ts` re-exports
them and adds its 11 runtime-only tables. **Drift becomes a compile error.** Zero new
workspaces, zero new build edges, and the edge already points the right way.

Same for the AST/parser/emitter/evaluator/planner: `migrate/src/semantics/`, exported from
the package. The one surviving argument for P3 is comprehension — a query planner inside a
package named "migrate" is a real cost at 3am. **Answer that with a rename**
(`@discoverer-neo/core`, migration pipeline as a subpath): one commit, no new build edge.

> The abstraction that matters is the AST shape, not the module boundary around it. Adding a
> package is the most expensive way to express "these two files should agree", and the
> measurement says they nearly do.

### H2. The dependency-direction rule is unwritten and unenforced

`migrate/package.json:31-40` has no backend dependency — the only thing keeping `dn-migrate`
runnable without a Fastify app. Nothing enforces it; one relative
`import '../../../backend/src/...'` compiles fine. **Add a `no-restricted-imports` ESLint
rule in `migrate/`. Five lines, worth more than the workspace P3 proposed.**

### H3. P5 is a real boundary — but its output must be a plan, not a verdict

The justification is not "a decision stage" (that invites "it's an `if`"). It is **arity**:

- `legacy-analysis.md:342-348` puts conditions and parameters **inside each branch's inline
  view**, and `:269` states the arithmetic: a branch filter placed in the outer query
  silently drops master rows from the *other* branch. Today `buildWhereClause` is called
  once and yields one clause, whose binds are reused verbatim by the totals queries
  (`sql-generator.ts:57,:89`). The planner changes WHERE from 1 clause to **n+1**.
- `GenerationContext` assigns one alias per folder. The rewrite repeats the master folder
  inside every branch (`legacy-analysis.md:146,:153`), so aliases stop being 1:1 with
  folders. That is a change to `lib/sql/context.ts`, not a branch in `generateSql`.
- GROUP BY takes `(hasAggregates, nonAggregateExprs)` (`sql-generator.ts:66`;
  `group-by-clause.ts` is 11 lines). Per-branch grouping keys have nowhere to go.

**The plan type must carry:** branches; each branch's folders; its join predicate; its local
conditions and parameters; its group keys; its per-measure aggregate **and re-aggregate**
function; and the outer key set.

> **Write that type first. It is the actual design artefact of this whole replan.**

**One correction to the emitter:** `legacy-analysis.md:192` requires the flat path to be *"a
deliberate fast path with an explicit predicate, not a default that fan-trap detection has to
remember to override."* Today it **is** the default — `from-clause.ts:73-76` short-circuits
on `required.length === 1` before anything else. **Invert it:** the planner decides FLAT; the
emitter never decides it for itself.

### H4. P5's decision record has no reader, and P7 does not read it

`query_execution_log` exists (`backend/src/db/schema.ts:1173`), written at
`map-execution.service.ts:497` — a column is all the runtime record needs. But that covers
only queries someone ran. What proves the guard is live is a **corpus decision histogram over
all 923 maps**, and P7 as drafted checks only "does SQL generate" and "does the formula
compile".

**Merge them:** P7 emits the planner-decision histogram (FLAT / REWRITE(n) / REFUSE(rule))
across the estate and asserts **`REFUSE > 0 && FLAT < 923`**. A guard that fires zero times
is indistinguishable from a guard that is not wired in — and this project's documented
failure mode is exactly three mechanisms reporting success over a non-functional system
(`AUDIT_ARCHITECTURE_ASSESSMENT.md:198-207`).

### H5. The planner's input is NULL everywhere — the guard would ship structurally inert

`legacy-analysis.md:578`: *"Neo cannot even tell which items those are, because
`agg_function` is NULL everywhere."* §1.11's measure set `M` is defined by aggregation
(`:576`). With `agg_function` NULL, **every query classifies as `|M| = 0` and takes step 0's
flat path.** You would ship a guard that is present, unit-tested and inert.

The data exists: the axis/measure split is two literal vectors on the `.DIS` query request
(`0x0123` axis / `0x0124` measure) and the spec calls it **given, not inferred**
(`legacy-analysis.md:291`). It comes from the **workbook parser**, not the EUL — §3.2 says
the EUL column is UNKNOWN.

> **Add "populate `map_items.agg_function` and the axis/measure split from the parser" as a
> named step BEFORE the guard.**

### H6. P4 is right — note what it removes

`sql-generator.ts:242-243` silently drops any join with a null endpoint:

```ts
joins: joinRows.flatMap((j) => { if (!j.leftItemId || !j.rightItemId) return []; …
```

The dropped join then surfaces as "No join path connects…" — loud, but for the wrong reason
and unattributable. When `join_predicates` lands, make a join with no predicate an **explicit
refusal naming the join**, so the 272 failures become diagnosable rather than merely noisy.

### H7. `join_predicates` needs an operator column

`legacy-analysis.md:442`: Discoverer supports `=` plus `<, >, <=, >=, <>` on joins, quoting
the Join Wizard's own operator table. P4 describes predicates as "1..n column pairs" with no
operator. **Add `operator`, and have the planner refuse the rewrite over a non-equi branch** —
step 7 assumes an equi key to group and outer-join on. Cheap now; a migration later.

### H8. A legal, common aggregate forces a refusal — budget for the conversation

`legacy-analysis.md:355`: `AVG`, `COUNT DISTINCT`, `STDDEV`, `VARIANCE` cannot re-aggregate
across a fan and must refuse. **The estate has 282 `COUNT DISTINCT` totals** (`:267`). P5
lists `REFUSE(reason)` as an outcome but nowhere acknowledges that ordinary user behaviour
triggers it. Needs an error message that explains the arithmetic and a documentation page —
or the first support ticket is *"your product can't average"*.

---

## MEDIUM

### M1. P9 is over-prioritised. The 80 % version is one boolean.

Measured over all 3 395 live conditions (`legacy-analysis.md:904-910`):
**depth 0 = 92.6 % · depth 1 = 7.3 % · depth 2 = 7 instances · depth ≥ 3 = zero.**
The existing flat `group_id` + `logic_operator` model (`where-clause.ts:194-219`) covers
depth ≤ 1 and, via groups, depth 2.

The actual hard ceiling is **`NOT`**, a per-node flag in Oracle's own object model
(`DCBImportedFilterNode::IsNot`, `legacy-analysis.md:894-896`), which the parser refuses
outright today.

**80 % version: add `negated boolean` to `map_conditions` and honour it in
`where-clause.ts`.** That closes the parser's refusal and covers the entire measured corpus.
Build the `parent_id` tree when `EUL4_SUB_QUERIES` gets a reader — the tree's real
justification is `SUBQUERY` nodes (`:928-940`), not nesting depth, and those tables' contents
are currently UNKNOWN with no reader.

### M1b. BE-10 drift has already cost data

`migrate/src/db/schema.ts:285-296` has **no `group_id` column**. Every one of the 5 605
migrated conditions imports with `group_id = NULL`, and `where-clause.ts:200` makes each its
own singleton group — **parenthesisation is discarded at import.**

Precise about the damage: SQL's `AND`-binds-tighter precedence accidentally reproduces the
`OR`-of-`AND`s shape, which is the only depth-2 shape measured (7 instances) *and* the RLS
predicate shape (`:912,:984-986`) — so nothing on this corpus is currently wrong. It is a
latent landmine for any `AND`-of-`OR`s and for anything the parser emits in future.
**The drift BE-10 predicts has already silently dropped structure on import. Fix the write
path before redesigning the model.**

### M2. P10 is right; its stated justification is the weakest reason to do it

Two constraints the proposal omitted:
- An item class is a **shared property bundle with three orthogonal capabilities** — LOV,
  alternative sort, drill-to-detail (`legacy-analysis.md:702-705`). A boolean `has_lov` loses
  two.
- **LOV values are live, not stored**: *"A target that migrates LOVs as static enums is wrong
  on day one"* (`:730`). It is `SELECT DISTINCT col FROM table` plus a cache flag and a
  cardinality hint.

The RLS justification is a misread: `:975` uses the item class only so the *administrator*
can pick usernames from a dropdown while authoring the condition in Administrator — and §8.5
says do not port that mechanism at all. **Delete the RLS rationale; keep the feature.** Its
real payload is 7 521 parameters and 5 605 conditions currently rendering as free-text boxes.

### M3. The summary/RLS bypass invariant has no home

`legacy-analysis.md:1002-1004`: a summary or materialised view derived from an RLS-bearing
folder contains only its creator's rows, and Oracle documents this as a real bypass — *"the
fastest path through the system is also the one that leaks."* Neo has no result caching today
(`backend/src/lib/metadata-cache.ts:16-23` states the rule and caches only entity metadata),
so nothing leaks yet. **The finding is that the proposal has no document where the invariant
lives**, so the first person to add a result cache or a rollup will not know it exists.
Put it beside P5's plan type.

### M4. Conditions on calculated fields do not need the tree

`backend/src/db/schema.ts:774-776` — `map_conditions.item_id` is `NOT NULL` with an FK to
`items`, so a condition can never reference a calculated field, while the legacy spec says
conditions on calculations *are* supported, with one carve-out for aggregate calculated items
(`legacy-analysis.md:918`). P9 bundles this with the tree rewrite. **It is independent:** make
`item_id` nullable, add `calculated_field_id`, add a CHECK that exactly one is set.

### M5. P7's transaction boundary is unspecified, and the wrong choice is tempting

Either (a) the migration is one transaction and a blocker rolls it back — a very long
Postgres transaction over 923 maps × 49 819 formulas — or (b) verification runs post-commit
against a committed, known-broken estate.

**Choose (b) explicitly and say so.** This project's lesson is that the value is in
*knowing*; a rollback destroys the evidence needed to debug. Add a `COMPLETED_WITH_BLOCKERS`
status. And prefer a **re-runnable `dn-migrate verify` subcommand** over a phase welded into
the runner — the estate is already migrated, so the first thing wanted is to verify without
re-importing.

### M6. P8 is correct; keep it out of the authorisation path

`map_shares` is per-map. If `workbooks` arrives and sharing migrates to the workbook, a
second authorisation model lands while P2 is changing the first. **Sequence P8 after P2 has
shipped and has tests.**

### M7. P6 is correct but is not a P1

The live server is 12.2.0.1.0, so `pagination.ts`'s `OFFSET/FETCH` is correct for this
customer today. Resolve-once-at-pool-creation is the right design. **Do not build a
capability table with one row** — a boot-time version check that refuses < 12.1 loudly is the
whole feature until a second estate exists.

---

## Nits

- P4's `mandatory` has **no join-type effect** — it unlocks join trimming and summary
  eligibility only (`legacy-analysis.md:422`). Store it; keep it out of the `join_type`
  derivation.
- `(AllowMasterNoDetail, AllowDetailNoMaster) = (True, True)` is `[ASSUMED]` and
  inexpressible in Oracle 8 `(+)` (`:432`). The enum already has `FULL`
  (`from-clause.ts:10`). **Map that combination to a refusal, not to `FULL`.**
- `explainSql` interpolates `statementId` into a string literal behind a
  `^[A-Za-z0-9_]{1,30}$` guard (`sql-generator.ts:139-149`) — the one documented exception to
  "every value is a bind". Fine as is; **do not let the planner add a second.**
- **Untrusted-content scan: clean.** Grep for instruction-shaped strings across `backend/src`
  and `migrate/src` returns only three legitimate uses of "false positives" describing
  byte-scanning heuristics (`workbook-parser.ts:519,:824`, `testing/workbook-fixture.ts:28`).

---

## Sequencing — the revised order

Proposed: commit → probe EUL → fix scoping (P2) → seam tests → guard (P4/P5) → enable
multi-folder.

**Three moves, plus one insertion:**

1. **The `buildFromClause` refusal moves INTO the P2 commit** (B3). Prevents a window where
   272 newly-loadable maps return silently inflated aggregates.
2. **The EUL probe becomes a named gate on P4, not a parallel task.** It must include the
   `EUL4_KEY_CONS` column list (`legacy-analysis.md:117-121`), the 10-row orientation join
   (`:402-410`), and the 10 `JP` expressions (`:458`). Two artefacts in this repo disagree
   about which end is master — `eul-schema-adapter.ts:129-130` vs the audit's patch (`:396`).
   Prevents an inverted master/detail, which produces **correct-looking wrong numbers rather
   than an error** (`:398`) and flips `allow_master_no_detail`/`allow_detail_no_master` at the
   same time.
3. **Populate the measure set before the guard, not with it** (H5). Prevents shipping an
   inert guard and believing it works.
4. **Insert M1b's `group_id` write fix before the seam tests**, or the seam tests pin
   conditions that lost their structure at import.

**What must NOT move:** "make it run first"
(`AUDIT_ARCHITECTURE_ASSESSMENT.md:313-316`) and P2-before-P5 are both right. You cannot test
a fan-trap guard against 923 maps that cannot load a folder set.

---

## Delete outright

| Item | Reason |
| ---- | ------ |
| **P3's fourth workspace** — the container, not the contents | H1 |
| **P10's RLS justification** — keep the feature, delete the reason | M2 |
| **P6's status as P1** — demote until a second Oracle version appears | M7 |
| **P9's tree, for now** — replaced by one `negated` boolean + the `group_id` write fix | M1, M1b |

Everything else in P1–P10 earns its place.

---

## The single most important sentence in this review

> **Make the flat multi-folder aggregate refusal ship in the same commit as the
> `maps.business_area_id` scoping fix.**
>
> Every other finding costs time or rework. That one is the only place in the plan where a
> correct-looking intermediate state can return a wrong number for money. Today's 272 broken
> maps are an accidental fan-trap guard, and P2's entire purpose is to remove the thing that
> breaks them — so the deliberate guard has to arrive on the same commit, not the same
> milestone.
