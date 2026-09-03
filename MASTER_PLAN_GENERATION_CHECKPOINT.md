# Master Plan Generation — Checkpoint

**STATUS: COMPLETE**
**Last updated:** 2026-09-02

---

## FINAL RESULT

| Deliverable | Path |
| ----------- | ---- |
| **Master Implementation Plan** | `MASTER_IMPLEMENTATION_PLAN.md` — 9 phases, **36 stages** |
| **Minimal tooling manifest** | `CLAUDE_CODE_MINIMAL_TOOLING_MANIFEST.md` — 19 plugins → **8**, ~2 681 repo agents/skills → **0** |
| **Decision register** | `docs/master-plan/DECISION_REGISTER.md` — **64 decisions**, 5 open (all closed by Phase 0.3) |
| **Phase prompts** | `docs/master-plan/prompts/` — **36 self-contained prompts** |
| **Research artefacts** | `docs/master-plan/research/` — 6 documents |

### §25 completion test — all 14 pass

| # | Test | Result |
| - | ---- | ------ |
| 1 | Every major audit finding maps to a phase or is explicitly rejected | **PASS — 83/83 traced** |
| 2 | Every high/critical security issue maps to a mitigation | **PASS** — Tier 0 → 0.2, Tier 1 → 1.1 + 6.2, Tier 2 → 6.1, Tier 3 → 6.3, Tier 4 → 6.4 |
| 3 | Every major migration gap maps to a solution or an explicit manual process | **PASS** — 5 MANUAL items named, 3 surfaced as blocking checkpoints in 9.3 |
| 4 | Every major legacy compatibility requirement maps to validation | **PASS** — 5 validation tiers, tiers 1–2b in 1.3/3.4/4.5, tiers 3–4 in 9.1 |
| 5 | Every major architectural decision is recorded | **PASS — 64 decisions** |
| 6 | Every phase has a model | **PASS** |
| 7 | Every phase has effort | **PASS** |
| 8 | Every phase has required tooling | **PASS** |
| 9 | Every phase has a self-contained execution prompt | **PASS — 36/36** |
| 10 | Every phase has quality gates | **PASS** |
| 11 | Every phase has a resumability strategy | **PASS** — all 36 carry `Resume instructions` + `TOKEN-BUDGET SAFE EXECUTION` |
| 12 | The tooling manifest is minimal | **PASS** |
| 13 | The plan does not depend on Fable | **PASS** — mentioned only as an exclusion |
| 14 | The plan does not require simultaneous specialist-agent execution | **PASS** — the Agents column is empty by design |

### Unresolved issues

1. **Five decisions are OPEN and gate Phase 3 entirely** — D-040 (join orientation), D-110
   (`KEY_CONS` flag columns), D-111 (default-aggregate column), D-112 (date-hierarchy count),
   D-113 (`QPP_STATS` row counts). **All five are answered by read-only queries in Phase 0.3.**
2. **Nine legacy questions need a live Discoverer 4.1 Plus with SQL Inspector, or an SME** —
   `AVG` re-aggregation across a fan, branch-local filter placement,
   `DisableAutoOuterJoinsOnFilters`, `EUL4_SUB_QUERIES` contents, `EUL4_DOMAINS` column
   semantics, whether 4.1 rewrote or only warned, the both-outer-joins combination, multi-column
   `JP` shape, grouped hierarchy levels. **Where no answer arrives: refuse loudly, never
   approximate.**
3. **Phase 9.1 needs access to the legacy Discoverer system** or its recorded output. Without
   it, `EUL4_QPP_STATS` is a weaker oracle and must be labelled as such.
4. The `github` MCP fails auth (`400 Authorization header is badly formatted`). Phase 0.1 must
   fix it or use `gh` CLI via Bash.

### Recommended next step

**Execute `docs/master-plan/prompts/PHASE-00-01-commit-and-wire-ci.md`.**

Nothing else is safe until it is done: **70 untracked paths, no git remote, and CI pointed at a
branch that does not exist.** One `git clean` ends the project's most valuable work.

**Do not begin implementation of any later phase first.** The three hard ordering constraints
that produce silently wrong numbers if violated are recorded in
`MASTER_IMPLEMENTATION_PLAN.md` §3.
**Session goal:** Produce `MASTER_IMPLEMENTATION_PLAN.md`, `CLAUDE_CODE_MINIMAL_TOOLING_MANIFEST.md`,
`docs/master-plan/DECISION_REGISTER.md`, `docs/master-plan/research/*.md` and
`docs/master-plan/prompts/PHASE-*.md`. **No implementation in this session.**

---

## Execution rule in force

Specialist agents run **STRICTLY ONE AT A TIME**, foreground (`run_in_background: false`),
via the `Agent` tool. No `parallel()`, no fan-out, no background workflows. Rationale: the
5-hour rolling usage limit has already interrupted this work once; sequential agents with a
checkpoint write after each one is the only shape that survives an interruption without
losing completed analysis. This overrides the session's ultracode default.

After each specialist: extract → write to `docs/master-plan/research/<name>.md` → update this
checkpoint → discard raw output → only then invoke the next specialist.

---

## Stage log — all stages complete

### Deliverables

| Artefact | Status |
| -------- | ------ |
| `MASTER_IMPLEMENTATION_PLAN.md` | **DONE** — 9 phases, 36 stages, target architecture, all 7 programmes, roadmap matrix, full traceability |
| `CLAUDE_CODE_MINIMAL_TOOLING_MANIFEST.md` | **DONE** — 19 plugins → 8, ~2 681 repo agents/skills → 0 |
| `docs/master-plan/DECISION_REGISTER.md` | **DONE** — 60+ decisions across 7 groups, 5 open (all closed by Phase 0.3) |
| `docs/master-plan/research/codebase-inventory.md` | DONE |
| `docs/master-plan/research/legacy-analysis.md` | DONE (Stage A, agent) |
| `docs/master-plan/research/architecture-analysis.md` | DONE (Stage B, agent) |
| `docs/master-plan/research/formula-decoder-analysis.md` | DONE (Stage C, inline) |
| `docs/master-plan/research/security-analysis.md` | DONE (Stage D, inline) |
| `docs/master-plan/research/ux-analysis.md` | DONE (Stage F, inline) |
| `docs/master-plan/prompts/PHASE-00-* … PHASE-09-*` | **DONE — all 36** |

### Agent cost, for the record

| Stage | Agent | Tokens | Outcome |
| ----- | ----- | ------ | ------- |
| A | `code-modernization:legacy-analyst` (Opus) | 260 k | **Worth it** — overturned two audit conclusions |
| B | `code-modernization:architecture-critic` (Opus) | 108 k | **Worth it** — found 3 blockers that all land in one commit |
| C | `general-purpose` (Opus) | 138 k | **Died on the usage limit with no output** |
| C–F | inline | — | Stage C inline found `DisplayFormula`, shrinking the largest task ~3.5× |

**2 of 3 agents succeeded. The single most valuable discovery came from inline `grep`.** That
matches `AUDIT_TOOLING_REQUIREMENTS.md` §5 exactly, and is why the master plan's Agents column
is empty.

---

## Completed

| # | Item | Artefact |
| - | ---- | -------- |
| 0.1 | Confirmed no prior master-plan artefacts exist (fresh start) | — |
| 0.2 | Created `docs/master-plan/{research,prompts}/` | directories |
| 0.3 | Read all **8** audit documents in full | conclusions below |
| 0.4 | Extracted the complete finding register (79 findings, IDs + severities) | this file, §Finding register |
| 0.5 | Wrote this checkpoint | `MASTER_PLAN_GENERATION_CHECKPOINT.md` |
| 0.6 | Inventoried the live source tree, both Drizzle schemas, git state, CI, docs | `docs/master-plan/research/codebase-inventory.md` |
| **A** | **Legacy behavioural specification** — `code-modernization:legacy-analyst`, Opus, 260 k subagent tokens, 74 tool uses. Produced a 106 KB spec grounded in Oracle's shipped SQL, `EUL.dtd`, the 9.0.4/10.1.2/11.1.1 vendor PDFs and the validated parser. **Corrected the audit twice.** | `docs/master-plan/research/legacy-analysis.md` |
| **B** | **Adversarial architecture review** — `code-modernization:architecture-critic`, Opus, 108 k subagent tokens, 30 tool uses. Attacked ten target-architecture propositions P1–P10. **Found 3 blockers that all land in one commit.** | `docs/master-plan/research/architecture-analysis.md` |
| **C** | **Token-formula decoder scoping** — done **inline** after the specialist died on the usage limit. Measured the 547-dump corpus directly. **Found the reference rendering the audit missed, and shrank the task ~3.5×.** | `docs/master-plan/research/formula-decoder-analysis.md` |

## Pending

| Stage | Work | Specialist | Status |
| ----- | ---- | ---------- | ------ |
| D | Consolidated security model | `code-modernization:security-auditor` | **NEXT** |
| D | Consolidated security model | `code-modernization:security-auditor` | PENDING |
| E | Testing strategy | **direct** — the audit already specifies the four seam tests precisely; a specialist would restate | PENDING |
| F | UX direction | `gsd-ui-researcher` (one agent, not three) | PENDING |
| G | Integration / cross-phase | **direct** — low marginal value | PENDING |
| H | Decision register | direct | PENDING |
| I | `MASTER_IMPLEMENTATION_PLAN.md` | direct | PENDING |
| J | Phase prompts | direct | PENDING |
| K | Tooling manifest | direct | PENDING |
| L | Completion test (§25 of the brief) | direct | PENDING |

**Interrupted agent:** Stage C (`general-purpose`, Opus, formula-decoder spec) was **killed by
the account usage limit** after 138 k subagent tokens and 24 tool uses, producing **no
output**. Not retried as an agent.

**Revised approach for Stage C (decision D-004):** the essential facts are gathered **inline**
with targeted greps, and the full decoder specification is **moved out of planning and into
the first session of the formula phase itself**, where it belongs. Writing a complete
implementation spec is implementation work, not planning work — and it is the third agent
death on this task family (`AUDIT_TOOLING_REQUIREMENTS.md` §5 records 19 of 20 dying the same
way). The master plan defines the phase, its stages, its acceptance tests and its known
constraints; the phase's own first stage produces the spec.

**Result awaiting synthesis:** none.

**Note on agent pruning.** `AUDIT_TOOLING_REQUIREMENTS.md` §2 and §5 record that 19 of 20
specialist agents died on usage limits in the audit, burning ~2.28 M tokens for one usable
result, and that the audit's decisive findings came from `psql`, `curl`, a browser and
careful reading. The brief permits selective use ("DO NOT invoke every available agent").
Stages E and G are therefore done directly, and Stage F uses one agent rather than three.
Stage A justified its cost — it overturned two audit conclusions.

---

## Stage A conclusions — CORRECTIONS TO THE AUDIT

These supersede the corresponding audit statements. Full evidence in
`docs/master-plan/research/legacy-analysis.md`.

| # | Correction | Impact |
| - | ---------- | ------ |
| **A-1** | **Master/detail orientation is inverted in the code.** `migrate/src/services/eul-schema-adapter.ts:129-130` maps `KEY_OBJ_ID → masterFolderId`; Oracle's FK semantics plus 5 join records in `d4dumps\` say `KEY_OBJ_ID` is the **DETAIL** folder. `AUDIT_DETAILED_FINDINGS.md:891-892` agrees with the dumps. **Two artefacts in this repo disagree.** Orientation decides which side enters the fan-trap inline view, so an inversion yields correct-looking wrong numbers, not an error. | **Blocks all fan-trap work.** Settle with one read-only 10-row query before any code. |
| **A-2** | **`EUL4_ASM_POLICIES` is Automated Summary Management, not row-level security.** Proven three ways: `discoverer10g\sql\eulasm.sql:1-2` grants `create any materialized view` / `global query rewrite`; the ASM chapter is ch. 13 "Managing summary folders"; `EUL.dtd:385-399` shows `ASMPolicy` constrains **folders and summary objects**, carries no user and no predicate, and is a **per-EUL singleton** (`EUL.dtd:83`). | `AUDIT_LEGACY_COMPATIBILITY_MATRIX.md:64` and F-27 are a **misattribution**. Building an RLS reader against it yields a false sense that RLS was migrated. **Real 4.1 RLS** = a *mandatory advanced condition* whose predicate compares Oracle's `USER`, built on an item class over `SYS.ALL_USERS` (`9.0.4\B10270_01.pdf` pp. 11-15…11-19) — shape `(USER IN (…) AND col = 'X') OR (USER IN (…) AND col = 'Y')`. **Item classes (§5) are therefore a *dependency* of RLS, not a P1 nicety.** The 7 depth-2 `OR`-of-`AND` conditions in this estate are where surviving RLS would be. |
| **A-3** | **`OneToOne` defaults to `False` (= one-to-many), and fan-trap detection is its *only* effect** (`EUL.dtd:191-201`, stated in one sentence by Oracle). | **Every join is dangerous unless explicitly flagged one-to-one.** The guard's default must be "assume fanning". |
| **A-4** | `EUL4_OBJ_JOIN_USGS` is **complex-folder join usage**, not a cardinality source (`EUL.dtd:143,153-157`). | Removes a candidate the audit left open. |
| **A-5** | `KEY_TYPE` is a **probed** column that defaults to `INNER` when absent (`eul-schema-adapter.ts:134-135`). "All 10 live joins are INNER" is a **default, not a reading**. | Join type must be derived from `AllowMasterNoDetail` / `AllowDetailNoMaster`, stored as two booleans. Only 3 of 4 combinations are attested; both-true is `[ASSUMED]` unsupported. |
| **A-6** | **A fan trap can occur with ONE branch** — when a master-side measure is selected alongside a live fanning branch, the master's measure repeats once per detail row. This is exactly the £2.4M → £9.6M case. | The guard cannot key on "≥2 branches" alone. |
| **A-7** | The 508 hierarchies are **502 `IBH` + 6 `DBH`**, parent/child trees with derived depth and **no business-area column**. One `GROUP BY` would establish how many `IBH` are date-template instantiations. | **May shrink the hierarchy work by two orders of magnitude.** Cheap to check; do it before scoping. |
| **A-8** | Fan-trap resolution is **fully documented with verbatim SQL** across four vendor releases: one inline view per master–detail branch, GROUP BY pushed below the branch join, detail side outer-joined, branches joined on the master key, outer query re-aggregating. Four refusal conditions, cross-version stable. Re-aggregation: `SUM→SUM`, `COUNT→SUM`, `MIN→MIN`, `MAX→MAX`; **`AVG` / `COUNT DISTINCT` / `STDDEV` / `VARIANCE` must be refused.** | The guard is a **specification exercise, not a research one**. §1.11 of the legacy analysis is an implementable numbered decision procedure. |
| **A-9** | Summary folders in 4.1 were **already Oracle materialised views under `global query rewrite`**. | Classify as MODERN EQUIVALENT — let Oracle's own query rewrite do it; do not rebuild Discoverer's redirector. |
| **A-10** | `EXP_TYPE`: `CO` base, `CI` created, **`JP` join predicate** (10 rows for 10 joins, confirmed live). `OBJ_TYPE` has a third value, **`CUO`** (`Lineage.sql:333`). | Confirms the audit's one-line join-predicate recovery, and adds an `OBJ_TYPE` value the adapter may not handle. |

### Stage A open questions → these become Phase 0's first technical stage

Five are answerable by **read-only** `ALL_TAB_COLUMNS` and small `SELECT`s against the live
EUL. No migration run, no writes. They close the gaps that most constrain everything else,
so they must precede implementation.

| # | Question | Blocks |
| - | -------- | ------ |
| 1 | Is `KEY_OBJ_ID` the detail or the master? (10-row join, §2.2) | **All fan-trap work** |
| 2 | Which `EUL4_KEY_CONS` columns carry `OneToOne`, `AllowDetailNoMaster`, `AllowMasterNoDetail`, `Mandatory`? | The guard; join types |
| 3 | Which `EUL4_EXPRESSIONS` column carries the default aggregate? (probe, never guess) | LEG-05; the measure/axis split |
| 9 | How many of the 502 `IBH` hierarchies are date-template instantiations? | Hierarchy scope |
| 10 | Does `EUL4_QPP_STATS` record returned **row counts**? | The only independent oracle for fan-trap validation in this repo |

Nine further questions (4–8, 11–14) need a live 4.1 Plus with SQL Inspector or an SME.
Where no answer arrives, the rule is **refuse loudly**, never approximate.

---

## Stage B conclusions — THREE BLOCKERS, ALL IN ONE COMMIT

Full evidence in `docs/master-plan/research/architecture-analysis.md`.

**The single most important sentence produced by this whole planning session:**

> **The flat multi-folder aggregate refusal must ship in the SAME COMMIT as the
> `maps.business_area_id` scoping fix.** Today's 272 broken maps are an *accidental*
> fan-trap guard, and the scoping fix's entire purpose is to remove the thing that breaks
> them. It is the only place in the plan where a correct-looking intermediate state can
> return a wrong number for money.

| # | Blocker | Required in the scoping commit |
| - | ------- | ------------------------------ |
| **B-1** | **Making `maps.business_area_id` nullable silently disables row-level security.** `map-execution.service.ts:296-305` matches BA-scoped policy rules by direct equality on that column; `null` never matches, the query runs unfiltered, and **no test catches it** because `security_policy_rules` is empty. | Resolve BA-scoped rules against the *derived folder set*. Add a test asserting a BA-scoped policy still fires when `business_area_id IS NULL`. **Until that test exists, the column stays `NOT NULL`.** |
| **B-2** | **"Strictly stricter authorisation" is false.** `map.service.ts:786-813` — `canAccessMap` has four paths and **three return before any BA check** (admin, owner, public). Map sharing therefore becomes **business-area grant escalation**. | Two gates: `canAccessMap` (object) + a new **unconditional** `assertDataEntitlement(userId, folderIds)` (data). The home is `middleware/business-area-auth.ts:99` — change `resolveBusinessAreaId: => Promise<string \| null>` to `=> Promise<string[]>` and make `userHasPermission` an all-of check. |
| **B-3** | **The scoping fix deletes the accidental fan-trap guard.** `from-clause.ts:107` currently refuses 272 multi-folder maps. Once loadable, they emit a flat inner join and `SUM()` over an inflated cross-product — Oracle's own example shows **2×–3× inflation on two measures at once**. | Three lines in `buildFromClause`: `if (required.length > 1 && ctx.hasAggregates) throw` naming the folders and the reason. Delete when the planner ships. |

### Stage B design corrections

| # | Correction | Effect on the plan |
| - | ---------- | ------------------ |
| **B-4** | **No fourth workspace.** Measured: only **2 of 20** shared tables differ, by **4 columns** (`users`: locale/theme/color_palette; `map_conditions`: `group_id`). Neither TS file is the DDL — `backend/drizzle/*.sql` is. A new package buys a build edge, a `dist/`, a version skew and a dependency **diamond**. | Put the 19 shared tables in `migrate/src/db/schema.ts`; backend re-exports and adds its 11 runtime-only tables. **Drift becomes a compile error.** Put the AST/parser/emitter/evaluator/planner in `migrate/src/semantics/`. Answer the comprehension objection with a **rename** to `@discoverer-neo/core`. Add a 5-line `no-restricted-imports` ESLint rule in `migrate/` to enforce the dependency direction. |
| **B-5** | **The planner's output must be a query PLAN, not a verdict.** Justified by *arity*, not tidiness: WHERE goes from 1 clause to n+1 (`sql-generator.ts:57,:89`); folder aliases stop being 1:1 (`lib/sql/context.ts`); per-branch GROUP BY keys have nowhere to go (`group-by-clause.ts` is 11 lines). | The plan type must carry: branches, each branch's folders, join predicate, **branch-local** conditions and parameters, group keys, per-measure aggregate **and re-aggregate**, and the outer key set. **Write that type first — it is the design artefact of this replan.** Also **invert FLAT**: `from-clause.ts:73-76` makes it the default today; the planner must decide it explicitly. |
| **B-6** | **`agg_function` is NULL everywhere → the guard would ship structurally inert.** With no measures, every query classifies `\|M\| = 0` and takes the flat path. | **Populate `map_items.agg_function` and the axis/measure split from the parser BEFORE the guard.** The data is given, not inferred: two literal vectors on the `.DIS` query request (`0x0123` axis / `0x0124` measure). It comes from the parser, not the EUL. |
| **B-7** | **A guard that never fires is indistinguishable from one not wired in.** | Migration verification must emit a **planner-decision histogram** over all 923 maps and assert **`REFUSE > 0 && FLAT < 923`** — not just "SQL generated". |
| **B-8** | **`join_predicates` needs an `operator` column** (`=`, `<`, `>`, `<=`, `>=`, `<>`). The rewrite assumes an equi key. | Add it; refuse the rewrite over a non-equi branch. Also: a join with **no** predicate becomes an explicit refusal naming the join (today `sql-generator.ts:242-243` drops it silently, producing an unattributable "No join path" error). |
| **B-9** | **Refusal is common user behaviour.** `AVG`/`COUNT DISTINCT`/`STDDEV`/`VARIANCE` cannot re-aggregate across a fan, and **the estate has 282 `COUNT DISTINCT` totals**. | Budget an error message that explains the arithmetic, plus a documentation page. Otherwise the first support ticket is *"your product can't average"*. |
| **B-10** | **The condition tree is over-prioritised.** Measured over 3 395 live conditions: depth 0 = **92.6 %**, depth 1 = 7.3 %, depth 2 = **7 instances**, depth ≥ 3 = **zero**. The real ceiling is `NOT`, a per-node flag in Oracle's own model. | **80 % version: add `negated boolean` to `map_conditions`.** Defer the `parent_id` tree until `EUL4_SUB_QUERIES` has a reader — subquery nodes are its real justification, not depth. |
| **B-11** | **BE-10 drift has already cost data.** `migrate/src/db/schema.ts:285-296` has **no `group_id` column**, so all 5 605 migrated conditions import with `group_id = NULL` and **parenthesisation is discarded at import**. Harmless on this corpus only because SQL's `AND`-binds-tighter accidentally reproduces the one measured depth-2 shape. | Fix the **write path** before redesigning the model, and do it **before the seam tests**, or the seam tests pin conditions that lost their structure. |
| **B-12** | **Item classes: LOV values are live, not stored.** *"A target that migrates LOVs as static enums is wrong on day one."* An item class is three orthogonal capabilities — LOV, alternative sort, drill-to-detail — not a `has_lov` boolean. | Keep the feature; **delete the RLS rationale** (the item class only fed the *administrator's* dropdown while authoring, and §8.5 says do not port that mechanism). Its real payload is 7 521 parameters and 5 605 conditions currently rendering as free text. |
| **B-13** | **Conditions on calculated fields are independent of the tree.** `schema.ts:774-776` — `map_conditions.item_id` is `NOT NULL` FK → `items`. | Make `item_id` nullable, add `calculated_field_id`, add a CHECK that exactly one is set. Ship separately from B-10. |
| **B-14** | **Migration verification must run POST-COMMIT**, not inside the transaction. A rollback destroys the evidence needed to debug. | Add a `COMPLETED_WITH_BLOCKERS` status and a **re-runnable `dn-migrate verify` subcommand** rather than a phase welded into the runner — the estate is already migrated, so verifying without re-importing is the first thing wanted. |
| **B-15** | **The Oracle dialect layer is not a P1.** Live server is 12.2.0.1.0; `OFFSET/FETCH` is correct today. | **Do not build a capability table with one row.** A boot-time version check that refuses < 12.1 loudly is the whole feature until a second estate exists. |
| **B-16** | **`workbooks` must stay out of the authorisation path.** `map_shares` is per-map; workbook-level sharing would land a second authorisation model while the first is changing. | Sequence it after the scoping fix has shipped **with tests**. |
| **B-17** | The **summary/RLS bypass invariant** has no documented home: a materialised view derived from an RLS-bearing folder contains only its creator's rows — *"the fastest path through the system is also the one that leaks."* Neo has no result cache today, so nothing leaks **yet**. | Record the invariant beside the planner's plan type, so the first person to add a result cache or a rollup finds it. |

---

## Stage C conclusions — the formula task is ~3.5× smaller than the audit assumed

Full evidence in `docs/master-plan/research/formula-decoder-analysis.md`.

| # | Finding | Effect |
| - | ------- | ------ |
| **C-1** | **`IOFormula` is the raw token string, not a rendering.** `AUDIT_MIGRATION_ASSESSMENT.md` §10 proposes diffing a renderer against it — that proves round-tripping, not correctness. As a renderer oracle it is worthless. | Corrects the audit's stated test strategy. |
| **C-2** | **`DisplayFormula` exists — 37 971 instances across the 547 dumps, paired 1:1 with `IOFormula`.** Oracle's own rendered form: `DECODE(TO_CHAR(Feocurre,'YYYY'),TO_CHAR(Feapertu,'YYYY'),0,1)`. | **Turns the task from research into fitting.** Fixity, arity, argument order, parenthesisation and literal formatting are all directly observable. The acceptance test writes itself: render `IOFormula`, compare to `DisplayFormula`. |
| **C-3** | **Only 56 distinct `[1,n]` codes appear in the entire estate**, not the ~199 the audit scoped — and **10 codes cover 93.5 %** of 276 300 uses. 20 codes appear < 50 times; 6 appear ≤ 3 times. | The fixity table is a 56-row fit, stageable as "top 10 first". |
| **C-4** | **Exactly five namespaces exist** — `[1,` built-in (276 300), `[5,` literal (182 051), `[6,` item (168 304), `[2,` custom function (7 097), `[8,` parameter (4 861). Matches `workbook-parser.ts:1160-1183`'s switch with **no missing case**. | Removes the "a missed namespace is a silent wrong answer" risk. |
| **C-5** | **Three literal kinds**: `[5,2]` number (144 513), `[5,1]` string/format (28 476), **`[5,4]` date (9 062)**. | `[5,4]` is 5 % of literals — must be settled, not skipped. Its aligned `DisplayFormula` shows Oracle's rendering. |
| **C-6** | **`[2,n]` ids are workbook-local `IoId`s (range 17–411), not EUL ids.** The audit's "customer function ids start at 112 777" is the `Id` reached *after* the element-table indirection. **~100 distinct custom functions are actually referenced**, of 593 migrated. | Resolution is local and identical to `[6,n]`/`[8,n]`, which the parser already does. |
| **C-7** | **The lexer and parser are DONE** (`workbook-parser.ts:1086-1185`). The calculation and condition token languages are one language, already yielding a typed tree that maps unrecognised input to `unknown` rather than guessing. | **Only the renderer is missing.** |
| **C-8** | **Do NOT re-parse `DisplayFormula` as an intermediate form.** It is ambiguous — `NVL(R Com Tx Com Vig/100,0)` has a bare item name with spaces abutting an operator. | Render token tree → SQL **directly**; use `DisplayFormula` only as the fidelity oracle. |
| **C-9** | **Parenthesise every infix node unconditionally.** | **The operator-precedence problem dissolves entirely.** The precedence table the audit scoped is not needed at all — only *name*, *arity* and *fixity* for 56 codes. Cost: uglier SQL. Correct trade for a system whose failure mode is silently wrong numbers. |
| **C-10** | **Calculation-references-calculation semantics are known, not open.** `workbook-parser.ts:3050-3056`: Oracle's dump tool *recursively substitutes that calculation's formula*; the parser deliberately does not walk the chain. **WB-04's 2 536 "disagreements" are that unwalked chain — by design, not defects.** | Expand recursively with cycle detection, at **render** time not migration time, so improving the renderer needs no re-migration. |
| **C-11** | The compile-rate gate must be a **four-bucket partition with reasons** — `COMPILED` / `COMPILED_UNVERIFIED` / `QUARANTINED(reason)` / `FAILED` — with CI asserting **`FAILED = 0`**. Extend `migrate/src/scripts/diff-corpus.ts`, do not build a second harness. | A bare percentage is exactly this project's signature failure mode. **The checked-in differ reports are two code generations stale (WB-01) — regenerate before quoting any number.** |

### Stage C open questions (all local and read-only except #5)

1. What are the **7 371** `IOFormula` entries with no `DisplayFormula` — conditions, empties, or a gap?
2. Which of the 56 codes are infix vs prefix, and what is each arity? → corpus fit
3. `[5,4]` date-literal on-wire encoding (9 062 uses)?
4. Any `[1,n]` Oracle renders as something other than a plain call? (`[1,106]` bracket is one)
5. Do all ~100 referenced `[2,n]` resolve to migrated `custom_functions`?
6. **Dump character encoding** — `PR�MIO` appears in `DisplayFormula`. Load-bearing for exact-match comparison on a Portuguese estate.

---

### Stage B nits carried forward

- `mandatory` has **no** join-type effect — it unlocks join trimming and summary eligibility
  only. Store it; keep it out of the `join_type` derivation.
- `(AllowMasterNoDetail, AllowDetailNoMaster) = (True, True)` → **map to a refusal, not to
  `FULL`**. It is inexpressible in Oracle 8 `(+)` and no vendor text describes it.
- `explainSql` (`sql-generator.ts:139-149`) interpolates `statementId` behind a
  `^[A-Za-z0-9_]{1,30}$` guard — the one documented exception to "every value is a bind".
  Fine as is; **do not let the planner add a second.**
- Invariant to write down now: `usedFolderIds` is built from `def.items` + `def.conditions`
  only (`map-execution.service.ts:293-295`). That matches the legacy trigger. Under the
  planner, FROM will contain folders carrying no selected item — **do not "fix" the security
  folder set to match the join path.**
- Untrusted-content scan across `backend/src` and `migrate/src`: **clean**.

---

## Key conclusions already established (from the audit, verified evidence)

1. **Not a redesign job.** ~60% built, ~15% integrated, 0% delivered. The architecture is
   mostly right; the failure is *integration and verification*, not design.
2. **The `.DIS` workbook parser is the crown jewel** — validated against Oracle's own
   `d4wkdmp.exe` across 544 workbooks, 0 failures. Protect it. It is **uncommitted** (DOC-04).
3. **923 migrated worksheets are unreachable** through three independent defects: cannot be
   listed (F-07), cannot be executed (F-01), calculated fields cannot be compiled (F-02).
4. **651 of 923 maps are single-folder** → reachable by small fixes. The other 272 need a
   `joins` schema change first (MIG-01).
5. **Sequencing constraint that overrides everything (LEG-04):** do NOT fix joins first.
   There is no fan-trap guard. Fixing joins converts loud failures into silently wrong
   numbers (a £2.4M quarter reporting as £9.6M). Correct order: `join_predicates` schema +
   4 join flags → fan-trap guard → *then* enable multi-folder SQL.
6. **Security fails an enterprise bar on 4 serious issues**, two of them credential exposure:
   cleartext passwords in `audit_log` (SEC-02, 174+5 rows), public `ENCRYPTION_KEY` (F-03),
   refresh defeats logout and deprovisioning (SEC-01), IDOR on metadata reads (SEC-03).
7. **`maps.business_area_id NOT NULL` is the root cause of the top blocker** (F-02b).
8. **The readiness scorer reports "ready" over a totally unusable migration** (F-12). It is
   the most dangerous defect in the migration pipeline. Any plan must replace it with a
   verification harness that could not have reported green on today's state.
9. **Three formula representations exist and none of them reads the token form migration
   actually produces** (F-02, BE-09). The `migrate/` decoder must become canonical.
10. **508 hierarchies lost, 78 grants lost, 49 819 token-form calculated fields unparseable.**
11. **CI has never run** — workflows trigger on `main`, repo is on `master`, no git remote.
12. Six first-pass findings were **REFUTED** and must not be funded: F-09 (Oracle dialect),
    F-18 (calc fields extraction), F-19 (missing items), F-20 (case sensitivity),
    F-05 (run_id guard), crosstab "loss". Also F-04 (layout gap is stale data) and F-15.

---

## Decisions already made

| ID | Decision | Status |
| -- | -------- | ------ |
| D-000 | Specialists run serially, foreground, one at a time; checkpoint after each | FIXED (user constraint) |
| D-001 | Replan from audit evidence, not from `DISCOVERER_NEO_SESSION_PLAN.md` / `_EXECUTION_PLAN.md` | FIXED (audit §9) |
| D-002 | Refuted findings (F-09, F-18, F-19, F-20, F-05, crosstab, F-04, F-15) are explicitly out of scope | FIXED |
| D-003 | Model policy: Opus for architecture/migration semantics/SQL/security/complex UI; Sonnet for CRUD, docs, ordinary tests. No Fable. | FIXED (user constraint) |

## Unresolved decisions

- Whether `join_predicates` replaces or supplements the existing `joins` item-pair model.
- Whether the token-formula decoder lives in `migrate/` and is imported by the backend, or is
  extracted into a shared workspace package.
- Whether hierarchies are migrated as a new table or folded into existing metadata.
- Whether the frontend Maps surface is rebuilt or the placeholder is replaced in place.
- Target for RLS: fail-closed default vs explicit deny policy.

---

## Files created / updated this session

- `MASTER_PLAN_GENERATION_CHECKPOINT.md` (this file)
- `docs/master-plan/research/` (empty, created)
- `docs/master-plan/prompts/` (empty, created)

---

## Next recommended action

Read the remaining six audit documents and inventory the live source tree, then run
**Stage A** (`code-modernization:legacy-analyst`) as a single foreground agent.

---

## Finding register (79 findings, from `AUDIT_DETAILED_FINDINGS.md`)

Used for the §25 completeness test: every entry below must map to a phase or an explicit
rejection in `MASTER_IMPLEMENTATION_PLAN.md`.

### CRITICAL
`F-01` no worksheet executes (0/923) · `F-02` 49 819 token-form calc fields unparseable ·
`F-02b` `maps.business_area_id NOT NULL` flattens Discoverer · `F-03` public `ENCRYPTION_KEY` ·
`DOC-04` parser never committed, no remote · `DOC-01` session-plan checkmarks are acceptance
criteria not completion · `SEC-02` cleartext credentials in `audit_log` · `F-06` Maps page is a
placeholder · `F-07` `GET /api/maps` hides the estate · `MIG-01` every join discarded at query
time · `LEG-04` no fan-trap guard · `LEG-02` FROM builder only emits single-column equijoin ·
`BE-01` join graph sparse (subsumed by MIG-01)

### HIGH
`DOC-02` stale status doc · `DOC-05` API docs 51 % accurate · `SEC-01` refresh defeats logout +
deprovisioning · `SEC-03` IDOR on metadata reads · `SEC-04` `custom_sql` validation bypassed on
UPDATE · `F-08` Run button fires no request · `LEG-05` `agg_function` NULL on every row ·
`BE-02` saving a map destroys its totals · `BE-03` async results cached forever in a process
Map · `MIG-03`/`F-10` 508 hierarchies lost · `F-12` readiness scorer reports ready over an
unusable migration · `WB-01` differ reports obsolete · `WB-03` token→SQL renderer blocker gone ·
`F-21` no test bridges migration → execution · `INF-02` `/health` 200 when deps are down ·
`INF-03` production overlay never run · `INF-04` CI has never run · `INF-05` no dependency/image/
secret scanning, 11 advisories (6 high) · `INF-06` 20 MB dump untracked and un-gitignored

### MEDIUM
`SEC-06` RLS fails open; COMPLEX folders bypass · `MIG-06` 78 grants lost, 60 collapsed to VIEW ·
`WB-05` `data_type` dropped by the transformer · `WB-04` 2 536 calc-references-calc formula
disagreements (by design)

### Unlabelled severity (triage during planning)
`LEG-03` four join attributes not read or stored · `LEG-06` `EUL4_DOMAINS` has no target table ·
`MIG-07` grant branch is dead code · `BE-05` aggregate+bare column → ORA-00979 · `BE-07` totals
drop `SELECT DISTINCT` (372 maps) · `BE-04` `getConnection` leaks on timeout race · `BE-06`
pagination has no tiebreaker (186 maps) · `BE-08` `importFromOracle` has no transaction ·
`BE-12` `loadMapDefinition` ignores shared folders · `F-11` 78 of 138 grants lost · `F-13`
dashboard renders apology notes as KPIs · `F-14` `/tables` returns 404 KB unpaginated · `F-16`
decryption failure → bare 500 · `F-17` active seed data source with placeholder credential ·
`F-22` coverage artefact six weeks stale · `F-23` one backend test fails · `BE-09` two
hand-written formula parsers, drifted allowlists · `BE-10` schema drift `map_conditions.groupId` ·
`BE-11` `kind` taxonomy covers one endpoint, no correlation id · `F-25` `NOT` unrepresentable in
conditions · `F-27`/`MIG-05` `securityConditions: 0` means never read · `MIG-08` 171 skipped
items = one BA-less folder, absent in source · `F-32` map detail omits totals/layout/page setup ·
`INF-08` no production guard on insecure defaults · `INF-09` `/metrics` public on 443 ·
`INF-10` metrics miss Oracle pool/queue/migration · `INF-11` Redis RDB-only, 1 h window ·
`INF-12` compose publishes Postgres+Redis to `0.0.0.0` · `INF-13` CORS reflects any origin with
credentials · `INF-14` 40 MB dumps with no ignore rule · `SEC-05` no login rate limit or lockout ·
`SEC-07` raw `ORA-` text reaches clients · `SEC-10` host/port interpolated into connect
descriptor (SSRF, admin-gated) · `SEC-11` reads never audited · `SEC-12` access token is its own
refresh credential (~14 d) · `INF-07` nine plaintext credential CSVs on disk

### REFUTED / withdrawn — DO NOT FUND
`F-09` Oracle dialect (server is 12.2, `OFFSET/FETCH` valid) · `F-18` calc-field extraction
(all four fields *are* extracted) · `F-19` 1 137 "missing" items (they are hidden query items) ·
`F-20` condition case-sensitivity (it *is* extracted) · `F-05` run_id guard bypass · crosstab
support "lost" (`crosstabs: 0` is a true property of this estate) · `F-04` layout gap is stale
data · `F-15` `/documentation` 404 (correct path is `/api/docs`, returns 200) · lockfile drift

### Positives to protect
`F-24` the schema already models far more Discoverer semantics than the data contains ·
`INF-17` backup/restore tooling is real and good · verified-sound SQL security controls
(bind variables, identifier rejection, unconditional security-predicate bracketing,
ownership-gated exports with no path traversal, admin-gated migration routes,
`!migrat` sentinel fails closed)
