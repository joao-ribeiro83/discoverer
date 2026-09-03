# Master Plan Review

**Independent adversarial review** of `MASTER_IMPLEMENTATION_PLAN.md` v1.0.
**Date:** 2026-09-02 · **Reviewer:** not the plan's author.
**Method:** every claim checked against the working tree. Six review dimensions, specialists run
strictly one at a time. Detail in `review/A-architecture.md` … `review/G-context-efficiency.md`.

---

## Verdict

**The plan is sound in its judgement and unsafe in its detail.**

Its central strategic calls survive adversarial testing and several are better than the audit
they came from. *Integration and verification before features* (D-003) is right. *Fix the
measure set before the fan-trap guard* (D-030/D-031) is right, well evidenced, and would have
been got wrong by almost any other ordering. *Refuse rather than distort* (D-058) is the correct
instinct for a system whose failure mode is silently wrong money. *Two authorisation gates*
(D-016), *the plan type rather than an enum* (D-017), and *parenthesise everything* (D-051) were
each attacked as over-engineering and each held up under source inspection.

But the plan is not yet safe to execute, for six reasons. Four of them share one shape: **a gate
that passes without proving what it names.** That is the exact failure the plan was written to
fix — *"every verification mechanism reports success over a dead system"* — reproduced inside
the mechanisms designed to prevent it.

**Recommendation: do not begin implementation against v1.0.** Execute
`MASTER_IMPLEMENTATION_PLAN_FINAL.md` instead. The corrections are contained — one new Phase 0
stage, four resequenced items, six rewritten gates, and eleven prompt edits. **No phase is
deleted and no architectural decision is overturned.**

---

## Counts

| Severity | Count |
| -------- | ----- |
| **CRITICAL** | **6** |
| HIGH | 14 |
| MEDIUM | 18 |
| LOW | 8 |
| **Total plan defects** | **46** |

Separately: **9 plan claims verified correct** and recorded so they are not re-litigated, and
**4 suspected findings rejected** on inspection.

---

## The six CRITICAL findings

| ID | Severity | Phase/Stage | Finding | Evidence | Recommendation |
| -- | -------- | ----------- | ------- | -------- | -------------- |
| **R-01** | CRITICAL | 1.1 · 6.3 · D-015/016 | **The security folder set is a strict subset of the SQL folder set, and the plan instructs a session not to fix it.** RLS resolves over `def.items ∪ def.conditions`. Folders also reach the emitted SQL two other ways: through `def.formulaItems` (a calculated field naming an item in an unselected folder — its **column value lands in SELECT**) and through the BFS join-bridge spanning tree over `def.joins`, which `types/sql.ts:34` documents as *all joins in the business area*. A `FOLDER`-scoped policy on such a folder never fires. **This is live today, not a Phase 3 consequence.** | `map-execution.service.ts:293-295, 308` vs `context.ts:24-33, 62, 90, 126-129`, `from-clause.ts:104-126`, `sql-generator.ts:252-255`, `types/sql.ts:34`. Prompt `PHASE-01-01:108-112`: *"Do not 'fix' the security folder set to match the join path."* Undetected because `security_policy_rules` is empty | Reverse the instruction and state the **rule**, not the set: *any folder that can change the rows the user sees must resolve its policies, or the query refuses.* Compute it **once, as a pure function of `MapDefinition`**, and use the same function for RLS and for the planner. Add the gate test to 1.1 |
| **R-02** | CRITICAL | 1.1 vs 6.3 | **Sequencing.** RLS **fails open** — zero policies returns zero predicates. Today that is harmless because zero of 923 worksheets execute. Phase 1.1's entire purpose is to end that (*"~651 maps generate SQL"*), and the fail-closed fix lands in **6.3**, five phases and the two largest workstreams later. The estate serves live warehouse rows unfiltered throughout | `map-execution.service.ts:290-291`. Plan §7 lists *"two ordering constraints"*; this is a third and larger one | A blanket fail-closed at 1.1 would return zero rows for all 923 maps (the policy table is empty) — which is why it was deferred. **Fail closed per policy-bearing folder instead:** if any folder in the effective set is targeted by ≥1 policy rule *for anyone* and the executing user resolves none, refuse and name it. **Against today's empty table this is a no-op** — zero behaviour change — and becomes correct the moment the first policy is written. Ship it as 1.1's fifth change |
| **R-03** | CRITICAL | 0.3 Q2 · 3.2-3.4 · D-110 | **Phase 3 rests on four EUL columns nobody has ever seen, and the plan has no branch for "they are not there."** D-110 asks *which* columns carry `OneToOne` / `AllowDetailNoMaster` / `AllowMasterNoDetail` / `Mandatory` — presupposing they exist. The plan's own research says they are *"not attested offline… never been read from this estate"*, and the repository's authoritative schema document lists four `KEY_CONS` columns, none of them a flag. The flags are attested only in `EUL.dtd` — the **export** DTD, not the schema. If absent, D-033's *"unknown ⇒ FANNING"* makes **every join fan permanently** and the product becomes a refusal machine | `research/legacy-analysis.md:112`; `EUL_SCHEMA_GROUND_TRUTH.md:161-172, 258` (section tagged *"columns need live confirmation"*); `eul-schema-adapter.ts:128-135` probes only `KEY_ID`/`KEY_NAME`/`KEY_TYPE` | Rewrite D-110 as **yes/no first**. Extend 0.3 Q2 to probe `IHS_FK_LINKS` and `OBJ_JOIN_USGS` as well. **Write both outcomes into the plan now**: if absent, the default is to collect the flags by hand from a live Discoverer Administrator — **10 joins makes this realistic** — recorded as a MANUAL cutover item, with the permanent 1.1 refusal as the fallback |
| **R-04** | CRITICAL | 1.3 · 4.1-4.3 | **The plan's central testing strategy contradicts a standing data-handling decision in its own codebase, and inverts its own dependency order.** 1.3, 4.1, §5 and the manifest all require a *checked-in* corpus derived from the `d4wkdmp` dumps. The code says: *"the real dumps are customer report metadata and never committed."* `git ls-files` confirms none are tracked, and **Phase 0.1 itself gitignores them**. Separately, 1.3 *consumes* the fixture that 4.1 *creates* — three phases later. **4.2's `≥93 % exact` and 4.3's `≥99 % exact` gates therefore cannot run in CI** | `migrate/src/__tests__/d4wkdmp-differ.test.ts:18-19`; `git ls-files \| grep dump` → empty; `d4dumps/` = 552 untracked files; plan 0.1 scope | Settle it in **Phase 0** as a new Decision Register entry. **Recommended: an anonymised corpus** — commit the *(token, rendered)* pairs with identifiers replaced via a deterministic, gitignored mapping. Structure, arity, fixity and byte-class survive; the customer's vocabulary does not. **Move fixture creation to Phase 0** — it depends on nothing in Phases 1–3 and both 1.3 and 4.1 need it |
| **R-05** | CRITICAL | 3.3 prompt | **Phase 3.3's prompt does not name Phase 3.1 as a prerequisite** — its Prerequisites section reads, in full, *"Phase 3.2 — the planner cannot run without flags and predicates."* D-031 states the consequence: with `agg_function` NULL, every query classifies `\|M\| = 0`, takes the flat path, and **the guard ships "present, unit-tested and structurally inert."** A fresh session executing 3.3 from its prompt — the stated design goal — can pass every listed criterion and ship exactly that | `prompts/PHASE-03-03-query-planner.md` Prerequisites and Required-files sections; D-030, D-031 | Rewrite the Prerequisites to lead with 3.1 and the inertness warning, and add an acceptance criterion asserting `\|M\| ≥ 1` **on a real migrated map**, not a fixture |
| **R-06** | CRITICAL | none — absent from the plan | **The query builder's core interaction is drag-only, with no keyboard path.** `BusinessAreaTree.tsx:346-373` spreads `useDraggable`'s listeners onto a bare `<div>` — no button, no double-click, no menu. The page's `KeyboardSensor` serves `useSortable` reordering inside the canvas; there is no keyboard route from the source tree to the drop region. **A keyboard-only or motor-impaired user cannot build a report at all** (WCAG 2.5.7). `axe` cannot detect drag barriers, so 2.3's gate — *"Accessibility E2E passes in CI"* — passes over it | `BusinessAreaTree.tsx:346-373`; `MapBuilderPage.tsx:273-275`; axe coverage confirmed real but blind to this | Add a stage (**2.4**): every drag-only interaction gains a non-drag equivalent. Gate it with something axe cannot fake — *a Playwright spec that builds a two-column map using only the keyboard* |

**Why four of these are the same defect in different clothes.** R-02, R-03, R-05 and F-02 are
all **gates that pass without proving what they name**: `REFUSE > 0` passes on 271 pre-existing
disconnection failures; the a11y gate passes on five unexamined pages and a drag barrier; 3.3's
criteria pass on an inert guard; 2.3's *"no prose in an `<h*>`"* passes on an em-dash. The plan
diagnosed this pattern in the codebase and then reproduced it in its own acceptance criteria.

---

## HIGH findings

| ID | Phase | Finding | Evidence | Recommendation |
| -- | ----- | ------- | -------- | -------------- |
| R-07 | 3.4 · D-037 | The planner histogram is **per-outcome**, so 271 pre-existing `DISCONNECTED` refusals satisfy `REFUSE > 0 && FLAT < 923` while the fan-trap guard has never fired once. §1.11 step 10's enumeration omits the disconnection rule entirely | `legacy-analysis.md` §1.11 steps 1, 10 | Make it **per-rule**. Gate on **`REWRITE(n) > 0`** — the assertion currently missing and the only one that proves the rewrite path is reachable — plus a fall in `REFUSE(DISCONNECTED)` against 3.2's baseline |
| R-08 | 0.3 Q1 · D-040 | The orientation probe returns folder **names** — the same `[INFER]` evidence class already held. It cannot settle D-040. And **three** artefacts disagree, not two: the designated authority says *"the **parent/detail** folder"* — two opposed roles in one phrase, in a section tagged *"needs live confirmation"* | `EUL_SCHEMA_GROUND_TRUTH.md:165`; `eul-schema-adapter.ts:129`; `AUDIT_DETAILED_FINDINGS.md:891-892` | Replace with a **cardinality probe**: per join, compare `COUNT(*)` to `COUNT(DISTINCT key)` on each side. The side with duplicates is the detail. A measurement, not an inference. Run the `JP` predicate query first, since it supplies the columns |
| R-09 | 3.3 · D-017/018 | **The planner seam does not exist.** `ctx.usedFolderIds()` returns `[...aliases.keys()]` — an accumulator populated as a *side effect* of generation, order-dependent, with `rootId = required[0]` decided by whichever builder aliased first. A planner placed "between `loadMapDefinition` and `generateSql`" has no folder set to plan over | `context.ts:52-64`; `from-clause.ts:67, 72` | 3.3's **first** task is to make the folder set a pure function of `MapDefinition`. Add to acceptance: *"`aliasFor` no longer decides membership; it only names a folder the plan already contains."* Same function as R-01 |
| R-10 | 1.1 · 3.2 · 3.4 | **The multi-folder map count contradicts itself inside a gate.** 1.1 says 272 (and 651+272=923); 3.2 says 341; the research says *"271 of 341"*. If 341 is right, single-folder is 582 — and a session measuring 582/341 against a criterion demanding ~651/~272 cannot tell whether it passed | `PHASE-01-01:9,151` vs `PHASE-03-02:11` vs `legacy-analysis.md` §1.11 | Do not guess. Add a **Phase 0 baseline-measurement stage** and rewrite every count-quoting gate to reference the recorded baseline |
| R-11 | 1.2 · 4.3 · D-011 | D-011's measured counts are wrong — **18 shared / 10 runtime-only**, not 19/11 — and **`custom_functions` exists only in `migrate`**. D-057 and Phase 4.3 require the *backend* to resolve `[2,n]` to a migrated `custom_functions` row at query time. No phase adds that binding | Measured across both `schema.ts` files | Correct the counts. Add to 1.2: *"`core` exports `custom_functions`; backend re-exports it — 4.3 depends on it."* Add it to 4.3's prerequisites |
| R-12 | 1.2 · D-011 | *"Drift becomes a compile error"* is not established, and **1.2's stated gate cannot be built under either design.** If the tables are re-exported there are no two definitions to mismatch; if they stay parallel, two `pgTable` calls with different columns are simply two valid values — TypeScript raises nothing | D-011; 1.2 acceptance | Force the choice. If re-export: gate on *"`backend/src/db/schema.ts` contains no `pgTable` call for any of the 18 shared tables"* — grep-checkable. Also add the **reciprocal** ESLint rule: D-012 constrains `migrate → backend`, the direction already clean, and leaves `backend → core/migration/` open |
| R-13 | 6.1 | 6.1's scope and gate both **pass while a blacklisted token still refreshes.** `POST /api/auth/refresh` has **no `preHandler` at all**, so the blacklist is structurally unreachable; the role is copied from the presented token; and the 7-day window resets on every refresh, so a weekly-refreshed token never expires | `routes/auth.ts:143-200`; `plugins/auth.ts:67-78` | Name all three in 6.1's scope. Add two gates: *a token blacklisted by logout is rejected by `/api/auth/refresh`*, and *a token cannot be refreshed indefinitely past its original issue* |
| R-14 | 6.2 → 1.2 | **Five** ungated `GET`-by-id routes, not four entity types — 6.2 omits `GET /api/items/:id/descendants`. And they stay open through Phases 2–5, while Phase 2 ships the first UI that surfaces the ids. The middleware **already exists and is exported** | `folders.ts:196`, `items.ts:175`, `items.ts:531`, `joins.ts:151`, `hierarchies.ts:142`; `business-area-auth.ts:141-190` | Move entity scoping into **1.2**, which is already editing route files. Five call sites of existing middleware. Leave SEC-04 in 6.2 |
| R-15 | 3.2 · 3.3 | **The modules Phase 3.3 rewrites have no tests.** `backend/src/lib/sql/` has no dedicated test files at all — the emitter is covered only indirectly through one hand-built fixture. §8's *"unit tests are genuinely good already"* is false for exactly the code about to be replaced | `sql-generator.test.ts:285-295` (`mkDef`); no test files under `lib/sql/` | Correct §8. Add **characterisation tests to 3.2, before the rewrite**: the single-folder short-circuit, the BFS spanning tree, the disconnection refusal, the null-endpoint drop. Cheapest insurance in the plan |
| R-16 | 1.1 · 6.3 | **RLS has one gate; three of the six tests it needs exist in no phase** — the formula-reached folder, the bridge folder, and *"an export carries the same predicates as the on-screen query"* (7.3 asserts only that rows match, which passes if both are equally unfiltered) | Plan 6.3 acceptance; 7.3 acceptance | Write a named **RLS conformance suite** in 1.1, extended in 6.3. Six tests, listed in `review/D-testing.md` §D-09 |
| R-17 | 2.2 · §9 | **The error path bypasses i18n at every call site.** `getErrorMessage(err, fallback = 'Something went wrong')` hard-codes English and is used across 28 files with no translated fallback. Locale parity is genuinely perfect (1 100 keys × 4, CI-gated) — and cannot catch a string that never reaches the locale files. This is a Portuguese estate | `lib/api.ts:54` | 2.2: *"`getErrorMessage` takes a required translated fallback; the `kind` taxonomy maps to locale keys."* §9: add a lint for user-facing literals outside `t()` |
| R-18 | 3.3 · D-036 | **The builder lets a user compose a query the planner will refuse.** `addItem` guards only `cross-business-area` — no folder or join-path check — and there is **no validate/preview** before Run. D-036's refusal UI is entirely reactive: build it, run it against production Oracle, wait, read the explanation | `store/mapBuilder.ts:338-347, 199` | Add to **3.3**: expose the planner as a **validate-only** call (`POST /api/maps/plan`) — it is already being built to emit a plan rather than execute. The builder runs it on every canvas change and surfaces the refusal inline, naming the rule |
| R-19 | 2.1 · 5.3 · 7.1 · D-007 | **Three stages instruct a mid-session model switch, which D-007 forbids** because it discards the prompt cache and re-bills at write price. A session following the prompt does the forbidden thing; a session following D-007 cannot follow the prompt | plan `:329, :519, :866`; prompts `PHASE-02-01:3`, `PHASE-05-03:3`, `PHASE-07-01:3` | **Split each into two stages with one model each** (see `MASTER_IMPLEMENTATION_PLAN_FINAL.md` §10). Add to §10: *no stage may name two models* |
| R-20 | D-005 · manifest | **D-005's rule is right but its diagnosis is wrong, which makes the rule unusable.** This session's data: the agent that died had the broadest, least-constrained brief; the most expensive *successful* one read 35 files whole at 14 850 tokens/call, 10× the others. **Cost tracks bytes read per call; survival tracks output constraint — not parallelism and not breadth** | This session: 539 577 agent tokens, 4 usable results, 1 death at 117 739 with zero output | Replace D-005's operative text with the measured pattern: file list + closed questions + required output table + tool budget + *"return the table even if unfinished"*. Without all five, do it inline |

---

## MEDIUM and LOW

Recorded in full in the review artefacts; summarised by theme.

**Scope corrections (MEDIUM).** D-032 over-scopes the join model — `joins.left_folder_id` /
`right_folder_id` are **already `NOT NULL`**; only the predicate is missing, and *"all 10 joins
have NULL endpoints"* means null **item** endpoints (`A-05`). Phase 5.1 is not *"one fix"* —
grants are, but hierarchies need a four-hop chain, and `HI_SYS_GENERATED` likely answers D-112
more cheaply than the naming `GROUP BY` (`B-05`). *"Move the DB-bound tests"* is 21 of 33 files
with a load-bearing `maxWorkers: 1`, not hygiene (`D-06`).

**Sequencing (MEDIUM).** The `getConnection` leak fix and Oracle pool metrics land in 8.2, after
the two phases most likely to leak connections (`A-06`). No concurrency story for incremental
re-import against the database the app is serving (`A-07`). A planner refusal on a **scheduled**
workbook has no handling — refusals are a UI state, and a schedule has no UI at the moment it
runs (`A-08`, `D-10`).

**Gates that do not measure what they name (MEDIUM).** 2.3's *"no prose in an `<h*>`"* passes on
the actual mechanism, which is an em-dash plus a `title` tooltip invisible to touch and to screen
readers (`E-04`). *"Accessibility E2E passes"* passes while five routes — including
`/admin/security` — have no axe assertion (`E-06`). Coverage is not merely misreported: **no
`coverageThreshold` exists anywhere and CI never measures it** (`D-07`).

**Missing surfaces (MEDIUM).** No export history, though `export_jobs` and the gated download
route both exist (`E-08`). Run has no disabled-with-reason state — and 1.1's
`assertDataEntitlement` *creates* a reachable "may open, may not run" case (`E-09`).
`sqlPredicate` gains no validation at the moment 6.3 makes it load-bearing (`C-12`).

**Documentation drift (LOW).** `canAccessMap` has four early returns before the BA check, not
three — and the omitted one is the share path the decision is about (`A-12`). `docker.yml` has no
`branches:` key to repoint (`A-11`). 74 untracked paths, not 70 — and **2 705 staged deletions**
the plan never mentions, against a `CLAUDE.md` that still calls `.claude/skills/` a live asset
(`A-10`). `dashboard.test.tsx` pins the placeholder on two lines, and the string lives in a
locale file, so removal is a four-locale change (`A-13`, `D-08`). Conditions counted as 5 605 in
two prompts and 3 395 in a third — and **the 3 395 is the population D-072's central claim was
measured over** (`F-05`). Users counted as 18 in 6.2 and 17 in the cutover runbook (`F-05`).

---

## Verified correct — do not re-litigate

Attacked and held:

1. **D-031 / the axis-measure split is *given*, not inferred.** `workbook-parser.ts:2705-2706`
   reads both vectors; `EUL_SCHEMA_GROUND_TRUTH.md:1016-1017` grades tags `0x0123`/`0x0124` at
   872/2 and 856/2 against Oracle's own decoder. **Ordering 3.1 before the guard is correct and
   well evidenced.**
2. **D-017's plan type is not over-engineering.** WHERE genuinely goes from one clause to n+1 and
   folder aliases stop being 1:1 — verified in `context.ts` / `where-clause.ts`.
3. **D-016's two gates are not over-engineering.** Four early returns in `canAccessMap` confirm
   one corrected gate cannot cover it, and the public-map path does reach live execution.
4. **Six join operators and four booleans are not over-engineering** — columns, not code paths.
5. **SQL safety is genuinely sound.** Identifiers regex-validated and quoted, every runtime value
   bound, the formula parser an allowlist recursive-descent with literal escaping. **Protect it.**
6. **Exports are genuinely sound.** Ownership *and* live `canAccessMap` re-checked at download;
   `filePath` excluded from the response shape.
7. **§1.11 is a real decision procedure**, implementable as written, and D-034's single-branch
   case is arithmetically forced and correctly graded `[INFER]`.
8. **The formula parser exists.** `ConditionNode` covers the whole token grammar Phase 4 needs —
   *"only the renderer is missing"* stands. (Rename it in 4.1; `parseConditionTree` misleads.)
9. **36 of 36 prompts carry every required section**, exactly once. The prompt template is the
   strongest part of the execution layer. **Keep it unchanged.**

Also verified stronger than the plan credits: **error *kinds* are already distinguished**
(`getErrorKind` → CONFIG/CONNECT/TIMEOUT/QUERY/CANCELLED); **all 8 icon buttons carry accessible
names**; **axe coverage is real and per-feature**; **the Oracle fakes do simulate failure,
timeout and ORA-01013**; **locale parity is exact and CI-gated**; **3 700+ lines of real builder
and viewer** sit behind the placeholder page.

---

## Findings rejected

| Suspected | Verdict |
| --------- | ------- |
| *"The formula parser does not exist"* — `workbook-parser.ts:1086` is `parseConditionTree` | **REJECTED.** `ConditionNode:1054-1069` covers `[1,code]`, `[2,n]`, `[5,kind]`, `[6,n]`, `[8,n]`. Naming only |
| *"D-017's plan type is ceremony"* | **REJECTED** on source inspection |
| *"Two auth gates duplicate one corrected gate"* | **REJECTED** — four early returns |
| *"Six operators / four booleans are speculative generality"* | **REJECTED** — columns, not code |

---

## Answer to the review question

> *"Could a fresh Claude Code installation, using only the declared tooling, execute this plan
> phase by phase and realistically produce the intended system without discovering major missing
> requirements later?"*

**Against v1.0: no.** It would ship a fan-trap guard that never fires (R-05), against an estate
whose cardinality data may not exist (R-03), gated by a histogram that cannot tell the guard from
a pre-existing failure (R-07), while serving unfiltered rows for five phases (R-02) through a
folder set the plan instructs it to leave broken (R-01), verified by a corpus it is not allowed
to commit (R-04).

**Against `MASTER_IMPLEMENTATION_PLAN_FINAL.md`: yes**, with two caveats that are the user's to
accept, not the plan's to solve:

- **Phase 0.3 must reach the live EUL.** If it cannot, R-03's fallback decides whether Phase 3
  proceeds at all — and that is a human decision.
- **The corpus question (R-04) needs a data-handling answer**, not an engineering one.

Everything else is repaired in the final plan.
