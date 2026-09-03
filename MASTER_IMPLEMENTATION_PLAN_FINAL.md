# Discoverer Neo — Master Implementation Plan (FINAL)

**Version:** 2.0 · **Created:** 2026-09-02 · **Supersedes:** `MASTER_IMPLEMENTATION_PLAN.md` v1.0.

**What changed and why.** v1.0 was subjected to an independent adversarial review
(`MASTER_PLAN_REVIEW.md`, detail in `review/`). Its strategic judgement survived; its detail did
not. **Six CRITICAL and fourteen HIGH findings are integrated below.** No architectural decision
is overturned and no phase is deleted. The changes are: **three new Phase 0 stages**, **six
stages split to obey the one-model rule**, **one new Phase 2 stage**, **four items resequenced
earlier**, and **eleven rewritten acceptance gates**.

**Every correction is marked ⟐ with its finding id.** Risks in `PLAN_RISK_REGISTER.md`.

**Governing register:** `docs/master-plan/DECISION_REGISTER.md`, plus the new decisions in §12
below. **Execution prompts:** `docs/master-plan/prompts/`.

---

## 1. Where the project actually is

> Discoverer Neo is a substantial, well-engineered body of work that **does not currently
> function as a product**. Roughly **60 % built, ~15 % integrated, 0 % delivered.**

The metadata layer, the SQL generation architecture, the Oracle connectivity and above all the
reverse-engineered `.DIS` workbook parser are real and careful — the parser is validated against
Oracle's own `d4wkdmp.exe` decoder across 544 workbooks with zero failures. The migrated estate
is unreachable through three independent defects, and the production security posture rests on
an encryption key published in this repository.

**The failure is integration and verification, not design.** Phases 0–2 add almost no features.

### The facts that drive every decision below

1. **Nothing has been committed.** ⟐**A-10:** 74 untracked paths — *and 2 705 staged
   deletions* — no git remote, CI pointed at a branch that does not exist. One `git clean` ends
   the project's most valuable work.
2. **Today's broken multi-folder queries are an accidental safety guard.** There is no fan-trap
   detection anywhere. Fixing the joins first turns loud failures into **silently inflated
   aggregates** — a £2.4M quarter reporting as £9.6M, in a system whose users have fifteen years
   of trained trust in these numbers.
3. **Every verification mechanism reports success over a dead system.** The readiness scorer
   returns `75 / "ready-with-warnings" / blockers: []`; 1 654 tests pass; the coverage artefact
   claims >80 %.
4. **The hardest remaining engineering task is ~3.5× smaller than the audit thought.** Only 56
   built-in function codes appear in the whole estate, 10 of them cover 93.5 %, and Oracle's own
   dumps carry 37 971 rendered `DisplayFormula` strings paired 1:1 with the token form.
5. ⟐**NEW — R-01/C-02.** **Row-level security is bypassable today.** The security folder set is
   a strict subset of the SQL folder set: a calculated field can pull an unselected folder's
   column into SELECT, and the join BFS can pull in a bridge folder — neither resolves its
   policies. It is invisible only because `security_policy_rules` is empty. **Phase 1.1 is the
   commit that makes it exploitable**, so 1.1 is where it is fixed.
6. ⟐**NEW — R-03.** **The fan-trap programme rests on four EUL columns nobody has ever read.**
   They are attested only in the *export* DTD. Phase 0.3 must answer whether they exist at all,
   and the plan now carries both outcomes.
7. ⟐**NEW — R-04/R-10.** **Two classes of number in v1.0 were unverified**: the estate counts
   (272 vs 341 multi-folder; 5 605 vs 3 395 conditions; 18 vs 17 users) and the formula corpus,
   which the codebase forbids committing. Phase 0 now measures the first and settles the second.

---

## 2. Target architecture

Keep the shape. Change **eight** things (was seven).

```
                        ┌───────────────────────────────────────────┐
   Browser ── nginx ───►│ frontend  React 19 · Vite · TS            │
                        │  TanStack Query/Table/Virtual · Zustand   │
                        │  shadcn/ui · dnd-kit · i18n ×4 · 3 themes │
                        │  + ErrorBoundary + route skeleton (R-33)  │
                        │  + non-drag equivalents      (R-06) ⟐NEW  │
                        └────────────────────┬──────────────────────┘
                                             │ REST + Bearer JWT
                        ┌────────────────────▼──────────────────────┐
                        │ backend  Fastify 5 · TypeScript           │
                        │  routes → services → lib/sql              │
                        │  ┌─────────────────────────────────────┐  │
                        │  │ effectiveFolderSet(def)   ★NEW ⟐R-01│  │
                        │  │  ONE pure function of MapDefinition │  │
                        │  │  → columnBearing | joinPath         │  │
                        │  │  consumed by RLS *and* the planner  │  │
                        │  └─────────────────────────────────────┘  │
                        │  ┌─────────────────────────────────────┐  │
                        │  │ TWO AUTH GATES (D-016)              │  │
                        │  │  canAccessMap        → the object   │  │
                        │  │  assertDataEntitlement → the data   │  │
                        │  └─────────────────────────────────────┘  │
                        │  ┌─────────────────────────────────────┐  │
                        │  │ QUERY PLANNER (D-017)               │  │
                        │  │  FLAT | REWRITE(n) | REFUSE(rule)   │  │
                        │  │  emits a PLAN, not a verdict        │  │
                        │  │  + validate-only mode  (R-18) ⟐NEW  │  │
                        │  └──────────────┬──────────────────────┘  │
                        │                 ▼  pure emitter           │
                        │      lib/sql/{select,where,from,group,    │
                        │               order,totals,paginate,      │
                        │               identifiers,security}       │
                        └───┬─────────────┬──────────────┬──────────┘
                            │             │              │
              ┌─────────────▼──┐ ┌────────▼──────┐ ┌─────▼─────────────┐
              │ PostgreSQL 16  │ │ Redis 7       │ │ Oracle (thick)    │
              │ Drizzle + SQL  │ │ BullMQ queues │ │ per-source pools  │
              │ migrations     │ │ + cache       │ │ boot version gate │
              └────────────────┘ └───────────────┘ └───────────────────┘
                            ▲
              ┌─────────────┴───────────────────────────────────────┐
              │ @discoverer-neo/core   (renamed from /migrate)      │
              │  db/schema.ts   ← 18 shared tables ⟐A-03            │
              │                   + custom_functions ⟐R-11          │
              │  semantics/     ← canonical AST · token renderer    │
              │                   · SQL emitter · row evaluator     │
              │                   · join + fan-trap planner         │
              │  migration/     ← eul-reader → adapter →            │
              │                   transformers → runner → writer    │
              │  workbook-parser.ts   ← the .DIS decoder (protect)  │
              │  d4wkdmp differ       ← promoted into CI            │
              └─────────────────────────────────────────────────────┘
        backend re-exports core's schema; ESLint forbids BOTH
        directions: migrate ↛ backend, and backend ↛ core/migration ⟐R-12
```

### The eight changes

| # | Change | Decision | Phase |
| - | ------ | -------- | ----- |
| 1 | **Query scope derives from referenced items**; `maps.business_area_id` becomes advisory | D-013 | 1.1 |
| 2 | **Two authorisation gates**; BA-scoped RLS resolves against the derived folder set | D-015, D-016 | 1.1 |
| 3 | ⟐**NEW. One `effectiveFolderSet(def)` function**, consumed by RLS and the planner, plus **per-policy-bearing-folder fail-closed** | **D-115, D-116** | **1.1** |
| 4 | **A query planner** emitting a plan, with FLAT explicit — **and a validate-only mode** | D-017, D-018, **D-117** | 3.3 |
| 5 | **`joins` gains `join_predicates`** with an operator, four booleans, derived `join_type`. ⟐**A-05: the folder endpoints already exist and are `NOT NULL` — do not touch them** | D-032 | 3.2 |
| 6 | **The token renderer**, emitting into the existing AST and allowlist | D-050, D-054 | 4 |
| 7 | **One shared schema** in `core`, re-exported by backend; **18 tables, and `custom_functions` among them** | D-011 (corrected) | 1.2 |
| 8 | **Post-commit migration verification** with a re-runnable `verify` subcommand | D-070, D-071 | 1.3, 4.5 |

### Explicitly NOT changing

No stack change · no microservices · no new runtime process · no fourth npm workspace (D-011) ·
no document store · no Oracle dialect capability table (D-019) · no condition expression tree yet
(D-072) · **no visual redesign — the design system, three themes and four locales are protected.**

---

## 3. Phase map

```
0  Secure and measure       ── nothing else is safe or checkable until this is done
1  Make it run              ── the scoping commit and its blockers
2  Make it reachable        ── the product's front door
3  Make the numbers right   ── the fan-trap programme      ★ highest stakes
4  Make the formulas run    ── the token decoder           ★ largest task
5  Make it faithful         ── metadata fidelity
6  Make it safe             ── security tiers 2–4
7  Make it whole            ── workbooks, scheduling, exports
8  Make it operable         ── production readiness
9  Prove it                 ── cutover validation
```

### Hard ordering constraints

Violating any of these produces silently wrong numbers, leaked data, or lost work.

- **0 before everything.** Uncommitted work; a key that decrypts every stored password; and
  ⟐**NEW** every count the later gates assert against.
- **1.1 is one commit.** Scoping + RLS fix + two gates + aggregate refusal + ⟐**NEW** the
  effective-folder-set function and per-folder fail-closed.
- ⟐**NEW — C-08/R-02: execution must not become reachable before RLS refuses on a
  policy-bearing folder it cannot resolve.** This is the third security ordering constraint and
  the largest. It is why the per-folder fail-closed ships *in* 1.1 rather than in 6.3.
- **3.1 before 3.3.** `agg_function` is NULL everywhere; without it the guard is inert (D-031).
  ⟐**R-05: this constraint was missing from 3.3's own prompt and is now stated there first.**
- **3.2 before 3.3 before 3.4.** Guard before enabling multi-folder joins (D-030).
- ⟐**NEW — R-15: 3.2's characterisation tests before 3.3's rewrite.** The modules 3.3 replaces
  have no dedicated tests today.
- **1.2's `group_id` write fix before 1.3's seam tests** (D-072).
- ⟐**NEW — R-04/F-03: 0.5's corpus before 1.3's CI gate.** v1.0 consumed in 1.3 a fixture that
  4.1 created.
- **6.1's redaction before 6.4's read auditing** (D-093).
- **Phase 0.3's probe gates Phase 3 entirely.**

### Parallelisation

Phase 2 is independent of 3–4 once 1.2 lands; Phase 8 is independent of everything after 1.
⟐**R-06/F-06: Phase 6 is no longer independent of 1** — entity scoping moved into 1.2 — and
Phase 3.4 now depends on a Phase 2 deliverable (the refusal UI). **Execute serially anyway**
while the token budget is the limiting factor (D-005).

---

# PHASES

---

## Phase 0 — Secure the work, and establish the numbers

**Objective.** Make the work durable, remove the credential exposure, answer the read-only
questions that gate everything else, **and measure the baselines every later gate asserts
against.**
**Dependencies.** None. **This is the entry point.**
**Parallelisation.** 0.1a → 0.1b → 0.2 → 0.3 → 0.4 → 0.5, strictly.

### ⟐ 0.1a — Commit the tree and wire CI · `Model: Sonnet · Effort: medium`

**Split from v1.0's 0.1 per R-41.** Durability must not be blocked on a policy question.

**Scope.** Review all **74** untracked paths; `.gitignore` the ~40 MB of dumps (`d4dumps/`),
`storage/`, `backups/`, `credentials/`; delete the junk path
`frontend/[A-Z][a-z][a-zA-Z`; commit everything else; add a remote (`gh` via Bash — the `github`
MCP fails auth); **repoint `.github/workflows/ci.yml` from `main` to `master`** and make CI run.
⟐**A-11: `docker.yml` carries no `branches:` key** — it triggers on `release: published` and
`workflow_dispatch`. Leave it alone; it cannot supply 0.1a's green run.
⟐**D-07:** add `--coverage` to the three CI test steps and set a **branch** threshold at the
measured baseline in each workspace; delete the committed `coverage/` artefact.

**Acceptance.** The additions are committed and pushed. A CI run exists and passes (`typecheck` +
`lint` + all three suites) **and reports branch coverage**.
**Findings closed.** DOC-04, INF-04, INF-06, INF-14.

### ⟐ 0.1b — Retire the agent and skill packs · `Model: Sonnet · Effort: low`

**Scope.** Commit the **2 705 staged deletions** of `.claude/agents/` and `.claude/skills/`
**in the same commit as the `CLAUDE.md` correction**, so the tree is never self-contradictory.
⟐**A-10: `CLAUDE.md` currently describes `.claude/skills/SKILL_INDEX.md` as a live, on-demand
asset while the manifest says delete.** Resolve that sentence, do not leave both.
**Acceptance.** `git status --porcelain` is clean; `CLAUDE.md` describes no deleted directory as
present.

### 0.2 — Credential remediation, tier 0 · `Model: Opus · Effort: high`

**Scope.** Redact audit-log bodies **by substring** not exact key (`password`, `secret`, `token`,
`credential`); **purge** the Oracle and user cleartext passwords already in `audit_log`; make the
app **refuse to boot in production** with a default `ENCRYPTION_KEY` or `JWT_SECRET`
(⟐**C-06: exactly `config.ts:52` and `config.ts:147`; `grep production config.ts` today matches
only the `NODE_ENV` enum at line 5**); add both to `.env.example`; rotate and re-encrypt stored
Oracle credentials; add a TTL + boot sweep for the plaintext credential CSVs; remove the seed
data source carrying a placeholder credential.
**Acceptance.** A test proves `passwordEnc` and `newPassword` are redacted; `SELECT` over
`audit_log` finds **zero** cleartext credentials; the app **fails to boot** in `production` with
either default; no credential CSVs older than the TTL survive a boot.
**Findings closed.** SEC-02, F-03, INF-08, INF-07, F-17.
**Risk.** Rotation invalidates stored Oracle passwords — coordinate before running.

### ⟐ 0.3 — The read-only EUL probe (rewritten) · `Model: Opus · Effort: high`

**Scope.** Read-only queries against the live EUL (`10.236.141.201:1530`, SID `COSEC`, owner
`SIID_TESTES`, thick mode). **No writes. No migration run.**

| Q | Query | Settles |
| - | ----- | ------- |
| **Q0** ⟐NEW | `SELECT * FROM eul4_expressions WHERE exp_type='JP'` — **run first**; it supplies Q1's columns. ⟐**B-06: the repo already records 10 `JP` rows for 10 joins**, so this is a confirmation and a column-structure inspection, not an open question | The predicate shape |
| **Q1** ⟐**REWRITTEN — R-08** | **A cardinality probe, not a name lookup.** For each of the 10 joins, resolve both folders to their tables and, using Q0's columns, compare `COUNT(*)` to `COUNT(DISTINCT <join column>)` on each side. **The side with duplicates is the DETAIL.** Keep v1.0's name query as a cross-check only | **D-040** — decisively, by measurement |
| **Q2** ⟐**REWRITTEN — R-03** | **First: does `EUL4_KEY_CONS` carry *any* cardinality or outer-join flag column?** `ALL_TAB_COLUMNS` + `SELECT *` on 10 rows. **If no: probe `EUL4_IHS_FK_LINKS` and `EUL4_OBJ_JOIN_USGS` too**, then report absence explicitly | **D-110** — including the "not there" answer |
| Q3 | `ALL_TAB_COLUMNS` for `EUL4_EXPRESSIONS` + a `GROUP BY` on each candidate | **D-111** — the default-aggregate column |
| **Q4** ⟐**IMPROVED — B-05** | Read **`HIERARCHIES.HI_SYS_GENERATED`** first — it likely answers this directly and more reliably than a naming pattern. Fall back to the naming `GROUP BY` over the 502 `IBH` rows | **D-112** |
| Q5 | `ALL_TAB_COLUMNS` for `EUL4_QPP_STATS` | **D-113** — does it record returned row counts? |

**⟐ The branch that v1.0 did not have.** If Q2 returns **absent everywhere**, D-033's
*"unknown ⇒ FANNING"* makes every join fan permanently and Phase 3 becomes a refusal machine.
**Record the outcome and take the stated branch immediately** — see **D-118** in §12.

**Deliverables.** `docs/master-plan/research/eul-probe-results.md` with raw output and a verdict
per question; the Decision Register updated; if Q1 confirms the inversion, a one-line fix to
`eul-schema-adapter.ts:129-130` **plus a regression test**.
**Acceptance.** All six answered from live data or explicitly recorded as unanswerable with the
reason. **`eul-schema-adapter.ts`'s orientation is proven correct or corrected, by measurement.**
**Risk.** If the EUL is unreachable, Phase 3 cannot start. **Escalate immediately.**

### ⟐ 0.4 — Baseline measurement · `Model: Sonnet · Effort: medium` **(NEW — R-10/F-02/F-05)**

**Why this stage exists.** Every estate count in v1.0 is unverified, and three contradict
themselves: **272 vs 341** multi-folder maps (and `651 + 272 = 923` is arithmetic on the disputed
number), **5 605 vs 3 395** conditions, **18 vs 17** users. Gates cannot assert against numbers
that disagree.

**Scope.** Measure and record, in `MASTER_PLAN_REVIEW_CHECKPOINT.md` and in
`research/baseline-counts.md`:
- total maps; single-folder; multi-folder; maps whose folder set is **connected by the 10 known
  joins**; maps declaring join usage in the container (⟐**B-04: tag `0x0127` shows only 24**);
- conditions total, and the population the depth distribution was measured over — ⟐**F-05: if
  the 92.6 %/7.3 % distribution covers 3 395 of 5 605, D-072's *"covers the entire measured
  corpus"* covers 61 %, not all, and must be restated**;
- users, admins and non-admins; calculated fields; formulas; hierarchies; grants;
- current `map_layouts` count vs `maps` count.

**Acceptance.** Every count in the plan and in the 39 prompts either matches the baseline or is
rewritten to reference it. **No gate anywhere quotes a literal count again.**

### ⟐ 0.5 — The formula corpus decision and build · `Model: Opus · Effort: high` **(NEW — R-04/F-03)**

**Why this stage exists.** v1.0's testing strategy requires a *checked-in* corpus derived from
the `d4wkdmp` dumps. The codebase forbids it: `d4wkdmp-differ.test.ts:18-19` records that *"the
real dumps are customer report metadata and never committed"*, `git ls-files` confirms none are
tracked, and **0.1a gitignores them**. Separately, v1.0 consumed the fixture in 1.3 and created
it in 4.1 — three phases later.

**Scope.** Settle **D-114** (§12), then build the corpus accordingly. **Default: anonymised.**
Extract the aligned `(IOFormula, DisplayFormula)` pairs from the 547 dumps in `d4dumps/`, replace
every identifier through a deterministic mapping that **preserves byte class and length**
(so 4.1's encoding question — `PR<?>MIO` — survives), commit the anonymised pairs, and gitignore
the mapping. Structure, arity, fixity and operator placement all survive; the customer's
vocabulary does not.

**Deliverables.** The committed corpus; the gitignored mapping; a `rebuild-corpus` script;
**D-114 recorded** with its reasoning.
**Acceptance.** The corpus is committed and CI can read it. A round-trip test proves the mapping
is deterministic and reversible locally. **⟐ Without this stage, 4.2's `≥93 %` and 4.3's `≥99 %`
gates cannot run in CI at all.**
**Context rule.** ⟐**G-02: never read the corpus into context.** Script it; emit counts and a
file path only.

---

## Phase 1 — Make it run

**Objective.** One migrated worksheet executes and returns correct rows — and the system can
prove it, **without opening a data-access hole.**
**Dependencies.** Phase 0, all five stages.
**Risks.** **This phase contains the single most dangerous commit in the plan.**

### ⟐ 1.1 — The scoping commit · `Model: Opus · Effort: max`

> **FIVE changes, ONE commit** (was four). **Splitting them ships a system that returns wrong
> money or leaks rows.**

**Scope.**

1. `loadMapDefinition()` derives the folder set from the map's **referenced items** (plus folders
   reachable through its joins), not from `maps.business_area_id`. Make that column nullable and
   advisory. ⟐**A-09: recompute the advisory value on save**, or 2.1's business-area filter and
   the data will disagree silently.
2. **RLS follows the derived folder set** — `map-execution.service.ts:296-305` matches BA-scoped
   rules by direct equality on the map's BA column; `null` would never match and the query would
   run unfiltered (D-015).
3. **Two authorisation gates** — `canAccessMap` (object) plus a new **unconditional**
   `assertDataEntitlement(userId, folderIds)` (data). ⟐**A-12: `canAccessMap` has *four* early
   returns before any BA check — admin, owner, public, *and share* — not three. The share path
   is the escalation the decision is about.** `business-area-auth.ts:99`'s
   `resolveBusinessAreaId` becomes `=> Promise<string[]>` and `userHasPermission` becomes an
   all-of check (D-016).
4. **The interim aggregate refusal** — in `buildFromClause`, if
   `required.length > 1 && ctx.hasAggregates`, throw naming the folders and the reason. Deleted
   in 3.4 (D-014).
5. ⟐**NEW — R-01/R-02/C-02/C-08/C-09. The effective folder set, and per-folder fail-closed.**
   - Write **one pure function of `MapDefinition`** returning two named sets:
     `columnBearingFolderIds` — items, conditions, **and folders reached through resolved
     calculated-field references** (`def.formulaItems` → `resolveFormulaReference` →
     `aliasFor`) — and `joinPathFolderIds` (the BFS bridges over `def.joins`, which
     `types/sql.ts:34` documents as *all joins in the business area*).
   - **RLS resolves over `columnBearing` ∪ every `INNER`-joined bridge** — an inner-joined
     bridge filters the result set, so its policy changes what the user sees.
   - **Fail closed per policy-bearing folder:** if any folder in that set is targeted by ≥1
     `security_policy_rules` row **for anyone**, and the executing user resolves no predicate
     for it, **refuse**, naming the folder. ⟐**Against today's empty policy table this is a
     no-op — zero behaviour change, all maps still run — and it becomes correct the moment the
     first policy is written.**
   - **⟐ REPLACES v1.0's instruction.** The 1.1 prompt said *"Do not fix the security folder set
     to match the join path."* That instruction is **reversed**. The rule is: *any folder that
     can change the rows the user sees must resolve its policies, or the query refuses.* A
     master-side `OUTER` bridge contributing no column is correctly excluded; a `formulaItems`
     folder is not.

**Deliverables.** The five changes; a Drizzle migration making the column nullable; the
`effectiveFolderSet` function; the RLS conformance suite; tests for each.

**Acceptance.** ⟐ All counts reference **0.4's baseline**, not literals.
- A **single-folder** migrated map executes end to end against live Oracle and returns rows.
  ⟐**D-04/PR-22: this is MANUAL — no Oracle is reachable from CI. Record the map id, the
  generated SQL, the row count and the timestamp in the checkpoint.** A number in a durable
  artefact is what distinguishes this from the green suites this plan distrusts.
- A test asserts a **BA-scoped RLS policy still fires** when `business_area_id IS NULL`.
  **Without this test the column stays `NOT NULL` and the stage is not done.**
- A test asserts an owner/public/shared map **still fails** `assertDataEntitlement` when the user
  lacks a folder's BA grant.
- A multi-folder aggregate map **refuses loudly**, naming the folders.
- ⟐**NEW — the RLS conformance suite (R-16), six tests:** (1) no policy ⇒ nothing;
  (2) BA-scoped policy fires with NULL BA; (3) **a folder reached only through a calculated-field
  reference has its policy applied or the query refuses**; (4) **an `INNER` bridge folder's
  policy is applied**; (5) **a policy-bearing folder the user cannot resolve causes a refusal,
  not an unfiltered query**; (6) **an export carries the same predicates as the on-screen
  query.** Three of these existed in no phase of v1.0.
- Single-folder maps generate SQL and multi-folder aggregates refuse, **in the proportions 0.4
  recorded**.

**Findings closed.** F-01, F-02b, BE-12 (partial), **C-01/C-02/C-05 (partially — full
fail-closed in 6.3)**, and *pre-empts* LEG-04.

### ⟐ 1.2 — Visibility, schema unification, write-path and entity scoping · `Model: Opus · Effort: high`

**Scope.** `GET /api/maps` stops hiding the migrated estate (add an `all` scope, admin-visible by
default); `GET /api/maps/{id}` returns totals, layout and page setup (F-32); **saving a map stops
destroying its totals** (BE-02); **unify the schema** — ⟐**A-03: the shared tables number 18, not
19, and the backend's runtime-only tables number 10, not 11. `custom_functions` exists only in
`migrate` and must be exported by `core` and re-exported by backend, because Phase 4.3 resolves
`[2,n]` against it at query time (R-11).** Land the `no-restricted-imports` rule (D-012)
⟐**and its reciprocal — D-012 constrains `migrate → backend`, the direction already clean, and
leaves `backend → core/migration/` wide open (R-12)**; add the missing `group_id` column to the
migrate schema and fix the write path (D-072); `loadMapDefinition` unions `folder_business_areas`
(BE-12).

⟐**NEW — moved from 6.2 (R-14/C-11). Entity scoping on `GET`-by-id, five routes:**
`folders.ts:196`, `items.ts:175`, **`items.ts:531` (`/descendants` — omitted from v1.0's
four-entity list)**, `joins.ts:151`, `hierarchies.ts:142`. All five carry
`preHandler: [fastify.authenticate]` and nothing else. **The middleware already exists and is
exported** (`business-area-auth.ts:141-190`) — this is five call sites, not new code. It moves
here because 1.2 is already editing route files and because **Phase 2 ships the first UI that
surfaces these ids.**

**Acceptance.** `GET /api/maps` returns the baseline map count for an admin; a round-trip save
preserves totals; `npm run typecheck --workspaces` is clean; ⟐**R-12: the drift gate is
grep-checkable — `backend/src/db/schema.ts` contains no `pgTable` call for any of the 18 shared
tables.** (v1.0's *"a deliberate column mismatch fails typecheck"* cannot be constructed under
either design.) Re-imported conditions carry non-null `group_id`. **A non-admin cannot read a
folder, item, item-descendant, join or hierarchy outside their granted business areas.**
**Findings closed.** F-07, F-32, BE-02, BE-10, BE-12, **SEC-03**.

### ⟐ 1.3 — Seam tests, the verifier, and the instruments · `Model: Opus · Effort: high`

**Scope.** The four seam tests, plus a re-runnable `dn-migrate verify` subcommand (D-070).

1. **Migration → execution contract.** For every migrated map: `loadMapDefinition()` +
   `generateSql()` must not throw.
2. **Formula compile rate.** Every `map_calculated_fields.formula` compiles or is quarantined
   with a reason.
3. **Referential closure.** Every `map_item` resolves within the map's query scope.
4. **Source ↔ target reconciliation** with declared expected-loss allowances.

Plus: ⟐**D-03/R-23: `scoreReadiness(eul, orphans, warnings)` takes only source-side parameters
— it structurally *cannot* see execution. D-071's fix is not arithmetic. Demote it to a
source-side pre-check and make `dn-migrate verify` the gate** (which D-070 already implies).
A `COMPLETED_WITH_BLOCKERS` migration status; **promote the `d4wkdmp` differ into CI against
0.5's corpus** ⟐(**not** a fixture 4.1 has yet to build — R-04/F-03); fix or delete the failing
async-execution test and its leaked handles (F-23).

⟐**NEW — moved from 8.2 (A-06/R-06).** The **`getConnection` leak when its own timeout wins the
race (BE-04)** and the **Oracle pool metric (INF-10, pool portion only)**. They are small, and
Phases 3 and 4 — which hold connections open across the estate — must not run without them.
1.3 is already the stage that builds measurement apparatus.

**Acceptance.** All four tests run in CI. **The verifier refuses to report "ready" against
today's database state** — the stage's defining test. The differ gates the build on agreement
rates **against the committed corpus**. Branch coverage is reported and thresholded.
**Findings closed.** F-21, F-12, F-22, F-23, F-30, **BE-04**, and the audit's testing §6 Tier 1.

---

## Phase 2 — Make it reachable

**Objective.** A user can find, open, run and read a migrated worksheet without typing a UUID —
**and can do it with a keyboard.**
**Dependencies.** 1.2.

### ⟐ 2.1a — The Maps list API contract · `Model: Opus · Effort: medium` **(split — R-19)**

v1.0 said *"Sonnet · high (Opus for the API contract)"*, which instructs the mid-session model
switch **D-007 forbids**. Split. This stage owns the contract: the `all` scope's response shape,
filter and sort parameters, and pagination with a tiebreaker (BE-06 — the baseline records how
many maps have no sort at all).

### ⟐ 2.1b — The Maps list UI · `Model: Sonnet · Effort: medium`

**Scope.** Replace the 23-line placeholder (`MapsListPage.tsx`, rendering
`locales/en/mapViewer.json:14-15` inside a `CardTitle`) with a real list: search, business-area
filter, `mine | shared | all` tabs, recency sort, create action, row actions. **Flat worksheet
list — workbook grouping lands in 7.1** (D-100).
⟐**E-05: `apiClient.maps.listByBusinessArea` already exists at `lib/api.ts:267-268` with zero
call sites.** This is wiring, not a new data layer — hence effort `high → medium`.
**Acceptance.** Every migrated worksheet is findable and openable from `/maps`; empty states tell
the truth (*"N worksheets exist; none are shared with you"*, never *"No maps yet"*).
**Findings closed.** F-06.

### ⟐ 2.2 — Wire Run, and the error surface · `Model: Opus · Effort: high`

**Scope.** Make **Run** work: parameter prompt, loading state, success and error states carrying
the backend's `kind`; a **global error boundary**; a disabled state **with a stated reason**; and
the first version of the **refusal UI** (D-036).

⟐**Three additions from Review E:**
- **E-02/R-33.** There is **no `ErrorBoundary` anywhere** in the frontend, **and every route is
  `<Suspense fallback={null}>` (`App.tsx:67`)** — so a slow or failed chunk load produces *no
  spinner, no error, nothing*. That is the exact silent-failure shape that let F-01 hide,
  sitting one line above every route. Add the boundary **and** a route skeleton.
- **E-03/R-17.** `getErrorMessage(err, fallback = 'Something went wrong')` at `lib/api.ts:54`
  hard-codes English and is used across **28 files**. Locale parity is perfect (1 100 keys × 4,
  CI-gated) and **cannot catch a string that never reaches the locale files.** Make the
  translated fallback **required**, and map the `kind` taxonomy to locale keys.
- **E-09.** Run's only disabled condition is `isPending`. Name the three real ones: no output
  columns, no data-source connection, **and insufficient entitlement — which 1.1's
  `assertDataEntitlement` newly creates.**

⟐**Do not rebuild what exists:** `getErrorKind()` already maps
`CONFIG / CONNECT / TIMEOUT / QUERY / CANCELLED` with per-kind copy
(`ExecutionPanel.tsx:37-46, 182-286`). **Extend it.**

**Acceptance.** Clicking Run issues a request and renders rows, a parameter prompt, or an
explained refusal. **No path produces silence.** A forced chunk-load failure renders a retry, not
a blank page. A non-English locale sees no English error text.
**Findings closed.** F-08; UX R3, R4.

### ⟐ 2.3 — Dashboard truth pass · `Model: Sonnet · Effort: medium`

**Scope.** Remove every placeholder rendered in a value slot; implement the endpoints worth
implementing and delete the cards that are not; fix the raw `->` in shipped copy; fix the
duplicated login checkbox (F-26).
⟐**E-04: the placeholder mechanism is not prose in an `<h*>`.** Three of four KPI cards render a
literal **em-dash `—`** with the reason hidden in a **`title` tooltip**
(`DashboardPage.tsx:58-64, 71-77, 83-89`) — invisible on touch and to screen readers.
⟐**A-13/D-08: `dashboard.test.tsx` pins the placeholder on *two* lines** — `:92` asserts
`/No maps yet/`, the empty state D-101/R2 forbids, and `:93` asserts the scheduling stub. **The
scheduling string lives in a locale file, so removing it is a four-locale change.**

**Acceptance.** ⟐**Gate rewritten:** *every KPI slot shows a real number or the card is removed —
no em-dash, no placeholder string, and no explanation hidden in a `title` attribute.* (v1.0's
*"no `<h*>` contains prose"* would have passed on the code unchanged.)
⟐**E-06: `every route in `App.tsx` has an axe assertion`** — five have none today, including
`/admin/security`. (v1.0's *"accessibility E2E passes"* is satisfied while they are unexamined.)
**Findings closed.** F-13, F-26, F-30.

### ⟐ 2.4 — Non-drag equivalents · `Model: Sonnet · Effort: medium` **(NEW — R-06/E-01)**

**Why this stage exists.** The only way to add a field to a report is to drag it:
`BusinessAreaTree.tsx:346-373` spreads `useDraggable`'s listeners onto a bare `<div>` — no
button, no double-click, no menu. The page's `KeyboardSensor` serves `useSortable` reordering
*inside* the canvas; there is no keyboard route from the source tree to the drop region.
**A keyboard-only or motor-impaired user cannot build a report at all** (WCAG 2.5.7). **`axe`
cannot detect drag barriers**, which is why the otherwise-good axe coverage passes over it.

**Scope.** Every drag-only interaction gains a non-drag equivalent — at minimum an "Add" control
on each tree row and a keyboard-reachable target selector. Audit the canvas and the panels for
the same pattern.
**Acceptance.** ⟐**A Playwright spec builds a two-column map using only the keyboard.** This gate
is deliberately not an axe assertion, because axe cannot see the defect.

---

## Phase 3 — Make the numbers right ★ highest stakes

**Objective.** Multi-folder queries produce **arithmetically correct** aggregates, or refuse.
**Dependencies.** Phase 0.3 (**gating**), 0.4, Phase 1.
**Inputs.** `research/legacy-analysis.md` §1.11 — a numbered, implementable decision procedure.
**⟐ Gating branch.** If 0.3 Q2 found no flag columns anywhere, **execute D-118 before 3.2.**

### 3.1 — Populate the measure set · `Model: Opus · Effort: high`

**Scope.** Populate `map_items.agg_function` and the axis/measure split **from the workbook
parser** — `workbook-parser.ts:2705-2706` reads `axisItemRefs` and `measureItemRefs` from the
`0x0123` / `0x0124` vectors, graded **[DUMP] 872/2 and 856/2** against Oracle's own decoder. The
split is *given, not inferred*.
**Why first.** With `agg_function` NULL everywhere, every query classifies `|M| = 0` and takes
the flat path — **the guard would ship present, unit-tested and structurally inert** (D-031).
**Acceptance.** `agg_function` is non-null on the measure items of a re-imported corpus, and a
count of measures per map is reportable. **A test asserts the split is non-empty across the
estate.**
**Findings closed.** LEG-05.

### ⟐ 3.2 — The join model, and characterisation tests · `Model: Opus · Effort: max`

⟐**A-05: scope corrected.** `joins.left_folder_id` and `right_folder_id` are **already
`NOT NULL` folder references** — the table *is* folder-to-folder. **Do not touch them.** MIG-01's
*"all 10 joins have NULL endpoints"* means null **item** endpoints, and `sql-generator.ts:242-243`
drops a join on those even though its folder endpoints are usable. **The missing element is the
predicate.**

**Scope.** Add `join_predicates` (1..n column pairs, each with an operator — `=`, `<`, `>`, `<=`,
`>=`, `<>`); store `one_to_one`, `allow_master_no_detail`, `allow_detail_no_master`, `mandatory`
as four booleans; **derive** `join_type` and stop storing it (⟐ note `join_type` is `NOT NULL`
today — the migration must drop the constraint before the column); read
`EXPRESSIONS.EXP_TYPE='JP'` in the reader; a join with no predicate becomes an **explicit
refusal naming the join** (D-039) — a change at `sql-generator.ts:242`, not a modelling change.

⟐**NEW — R-15/D-02. Characterisation tests, written BEFORE 3.3's rewrite.**
`backend/src/lib/sql/` has **no dedicated test files at all** — the emitter is covered only
indirectly, through one hand-built fixture (`sql-generator.test.ts:285-295`). §8's *"unit tests
are genuinely good already"* is false for exactly the modules 3.3 replaces. Pin the current
behaviour: the single-folder short-circuit (`from-clause.ts:73-76`), the BFS spanning tree, the
disconnection refusal (`:105-107`), and the null-endpoint drop. **This is the cheapest insurance
in the plan.**

⟐**NEW — B-04. Reconcile the three counts** and record them: maps spanning >1 folder, maps whose
folder set is connected by the 10 known joins, and maps declaring join usage in the container
(tag `0x0127` shows only 24). Adding predicates to 10 joins **cannot** connect a map whose
folders were never joined in Discoverer either. 3.4's expected histogram is predicted from this
reconciliation, not from `total − single-folder`.

**Constraints.** Orientation per D-040 **as settled by 0.3 Q1's cardinality probe**. `mandatory`
has no join-type effect. `(True, True)` maps to a **refusal, not `FULL`** (D-038). `KEY_TYPE` is
a probed column defaulting to `INNER` (`eul-schema-adapter.ts:134-135`) — *"all 10 joins are
INNER"* is a default, not a reading.
**Acceptance.** All 10 estate joins carry non-null endpoints and a predicate; a unit test covers
each flag combination's emitted SQL; the `(True,True)` case refuses; **the characterisation
tests pass against unchanged behaviour**; the three counts are recorded.
**Findings closed.** MIG-01, LEG-02, LEG-03.

### ⟐ 3.3 — The query planner · `Model: Opus · Effort: max`

> ⟐ **PREREQUISITE, STATED FIRST — R-05/F-01.** **Phase 3.1 must be complete and verified.**
> With `agg_function` NULL, every query classifies `|M| = 0`, takes step 0's flat path, and this
> entire stage ships **structurally inert** — passing every unit test against hand-built
> fixtures (which is how every SQL test in this repository works). v1.0's prompt named only 3.2
> as a prerequisite. **Verify `agg_function` is populated before writing any code.**
> Then: Phase 3.2 — the planner cannot run without flags and predicates.

**Scope.** Implement `research/legacy-analysis.md` §1.11 steps 0–10 as a planner between
`loadMapDefinition()` and `generateSql()`.

⟐**NEW, FIRST TASK — R-09/A-02. The seam does not exist yet.** `ctx.usedFolderIds()` returns
`[...this.aliases.keys()]` — an accumulator populated as a **side effect** of generation, and
`from-clause.ts:72` takes `rootId = required[0]`, so the FROM root depends on which builder
aliased first. **Make the folder set a pure function of `MapDefinition` — the same
`effectiveFolderSet` function 1.1 introduced — computed once and passed to both the planner and
the context.** Without this, D-018's *"the emitter never decides FLAT for itself"* is
unachievable: the emitter still decides the input FLAT is computed from.

**Write the plan type second — it is the design artefact of this replan** (D-017). It must carry:
branches; each branch's folders; its join predicate; its **branch-local** conditions and
parameters; its group keys; its per-measure aggregate **and re-aggregate** function; and the
outer key set.

**Also:** invert `FLAT` from the emitter's default to an explicit planner decision (D-018);
detect the **single-branch** master-side fan trap (D-034); apply refusal rules R1–R4;
re-aggregate `SUM→SUM`, `COUNT→SUM`, `MIN→MIN`, `MAX→MAX` and **refuse `AVG` /
`COUNT DISTINCT` / `STDDEV` / `VARIANCE`** (D-035); record the decision on every execution;
suppress totals spanning differing branches as NULL.

⟐**NEW — R-18/E-07. A validate-only mode (D-117).** Expose the planner as
`POST /api/maps/plan`, returning the plan without executing. The builder guards only
`cross-business-area` today (`store/mapBuilder.ts:338-347`) and has **no preview**, so a user
composes a refusable query, runs it against production Oracle, waits, and reads an explanation.
The planner is already being built to emit a plan rather than a verdict; the endpoint is a small
addition and turns every refusal from post-hoc into pre-flight.

**Acceptance.** Unit tests reproduce Oracle's documented worked example — including the 2×–3×
inflation the guard prevents. Every refusal names its rule. **Assume-fanning is the default**
(D-033). ⟐**A test asserts the planner classifies `|M| ≥ 1` on a real migrated map, not a
fixture.** ⟐**Adding an item that would cause a refusal is reported in the builder before Run.**
**Findings closed.** LEG-04.

### ⟐ 3.4 — Enable multi-folder generation · `Model: Opus · Effort: high`

**Scope.** Delete 1.1's interim refusal; let the planner drive; extend migration verification to
emit the planner-decision histogram.

⟐**Acceptance rewritten — R-07/B-03.** v1.0's gate was `REFUSE > 0 && FLAT < 923`. §1.11 step 1
keeps Neo's pre-existing disconnection refusal, which **271 of 341 multi-folder maps hit today**
— so that inequality is satisfied while the fan-trap guard has **never fired once**. That is
precisely the failure D-037 exists to prevent, reproduced inside D-037.

Make the histogram **per rule**, and add the disconnection and no-predicate rules to §1.11 step
10's enumeration, which omits them:

```
FLAT · REWRITE(n) · REFUSE(DISCONNECTED) · REFUSE(NO_PREDICATE) ·
REFUSE(R1) · REFUSE(R2) · REFUSE(R3) · REFUSE(R4) · REFUSE(REAGG)
```

**Three assertions replace the one:**
1. **`REWRITE(n) > 0`** — the rewrite path is reachable at all. *This is the assertion v1.0 was
   missing, and it is the important one.*
2. `REFUSE(DISCONNECTED)` has **fallen** against 3.2's recorded baseline — otherwise 3.2 did not
   fix what it claimed.
3. At least one fan-trap rule fired, **or** the run explicitly records that no map in the estate
   meets the trigger condition.

Plus: a known master–detail join in this estate (`M M67 1 → M M67`, header to lines) produces the
**correct** total, verified against the source system (**MANUAL** — live Oracle).
⟐**NEW — R-18/F-04: browser-validate the refusal UI** against one instance of each planner
refusal rule; each renders its rule name, the folders involved and a next step. The UI was built
in 2.2 against a single generic message and no v1.0 stage re-validated it. **Add `Claude_Browser`
to this stage's tooling.**
**Findings closed.** BE-01, LEG-04 proven rather than pre-empted.

---

## Phase 4 — Make the formulas execute ★ largest task

**Objective.** The estate's calculated fields compile to SQL, or are quarantined with a reason.
**Dependencies.** Phase 0.5 (**the corpus**), Phase 1.
**Inputs.** `research/formula-decoder-analysis.md`. **The lexer and parser already exist** —
⟐**note they are named `parseConditionTree` and typed `ConditionNode`
(`workbook-parser.ts:1054-1185`); the grammar is general over `[1,code]`, `[2,n]`, `[5,kind]`,
`[6,n]` and `[8,n]`, so *"only the renderer is missing"* is correct. Rename both in 4.1**, or a
future reader will conclude the formula parser is absent.
**Context rule.** ⟐**G-02: never read the corpus into context** in any Phase 4 stage. Script it;
emit bucket counts, the top N failures with reasons, and a file path.

### ⟐ 4.1 — Code fitting and the spec · `Model: Opus · Effort: max`

⟐**Corpus extraction moved to 0.5 (R-04/F-03).** This stage now **consumes** the committed
corpus rather than creating it.

**Scope.** **Derive** name, arity and fixity for the 56 used codes from the corpus; classify the
unrendered `IOFormula` entries; settle the dump character encoding (the anonymisation mapping in
0.5 preserves byte class, so this is still answerable); rename `parseConditionTree` /
`ConditionNode`; **write the implementation spec** (D-004).
**Acceptance.** Every one of the 56 codes has an **attested** arity and fixity, or is explicitly
marked refuse-only. **No code is guessed** — this repository has a documented history of
fabricated names reaching production code.

### 4.2 — The top-10 renderer · `Model: Opus · Effort: max`
**Scope.** Render the 10 codes covering 93.5 % of uses, **fully parenthesised** (D-051), emitting
into the existing AST and allowlist (D-054). Resolve `[6,n]` and `[8,n]` through the element
table.
**Acceptance.** **≥ 93 % of the corpus renders exactly equal to `DisplayFormula`.** ⟐**This gate
runs in CI only because 0.5 made the corpus committable.**

### ⟐ 4.3 — The tail, custom functions and date literals · `Model: Opus · Effort: high`
**Prerequisite.** ⟐**R-11: `custom_functions` must be exported by `core` and re-exported by
backend (Phase 1.2).** It exists only in `migrate` today, and this stage resolves `[2,n]` against
it **from the backend, at query time**.
**Scope.** The remaining 46 codes; `[2,n]` resolution to migrated `custom_functions` — these are
**workbook-local `IoId`s (17–411)**, not EUL ids (D-057); `[5,4]` date literals.
**Acceptance.** **≥ 99 % exact match; `FAILED = 0`.** Registered PL/SQL functions are callable,
with identifier validation and no string splicing.

### 4.4 — Calculation-reference expansion and the CI gate · `Model: Opus · Effort: high`
Recursive expansion **at render time** with cycle detection (D-056); the four-bucket partition
wired into CI. **Acceptance.** The known WB-04 chains resolve. CI fails on any bucket regression.

### 4.5 — Compile the estate · `Model: Opus · Effort: high`
Compile all stored formulas; publish the partition; feed `QUARANTINED` and `FAILED` into the
verifier as **blockers**. **Acceptance.** The verifier **refuses to report "ready"** while
`FAILED > 0`.

---

## Phase 5 — Make it faithful

**Objective.** Recover the metadata the migration lost, and populate the schema Neo already has.
**Dependencies.** Phase 1; 0.3 Q4; 0.4.

### ⟐ 5.1a — Grants · `Model: Opus · Effort: medium` **(split — B-05)**
The genuine one-line fix: EUL4 binds via `EUL4_BA_OBJ_LINKS`, not a column.
**Acceptance.** Grants reconcile to the baseline minus a **declared, justified** allowance.

### ⟐ 5.1b — Hierarchies · `Model: Opus · Effort: high` **(split — B-05)**
⟐**Not "one fix".** `HIERARCHIES.BA_ID` **does not exist**. The chain is four hops: hierarchy →
`HI_NODES` → `IG_EXP_LINKS` (`IEL_TYPE='HIL'`, `HIL_HN_ID` → `HIL_EXP_ID`) →
`EXPRESSIONS.IT_OBJ_ID` → `BA_OBJ_LINKS`. **State a rule for a hierarchy spanning two business
areas.** **Regenerate date hierarchies natively; migrate only user-authored ones** (D-074) —
0.3 Q4's `HI_SYS_GENERATED` reading says how many are boilerplate and may shrink this by two
orders of magnitude.
**Acceptance.** User-authored hierarchies migrate with correct parent/child structure; 1.3's
reconciliation test passes without an exception.
**Findings closed.** MIG-03/F-10, F-11, MIG-06, MIG-07.

### 5.2 — Item classes and lists of values · `Model: Opus · Effort: high`
An `item_classes` model carrying **three orthogonal capabilities** — LOV, alternative sort,
drill-to-detail — not a `has_lov` boolean. **LOV values are live, not stored.** A dependency of
migrating any surviving row-level security (D-077); its immediate payload is the parameters and
conditions currently rendering as free-text boxes. **Findings closed.** LEG-06.

### ⟐ 5.3a — The condition parser change · `Model: Opus · Effort: high` **(split — R-19)**
Close the parser's `NOT` refusal (D-072).

### ⟐ 5.3b — Condition schema fidelity · `Model: Sonnet · Effort: medium`
Add `negated boolean` to `map_conditions` and honour it; add the case-sensitivity column the
parser already reads; make `item_id` nullable + add `calculated_field_id` + a CHECK (D-013/M4).
⟐**F-05: restate D-072's claim against 0.4's baseline.** *"Covers the entire measured corpus"*
rests on a depth distribution measured over 3 395 conditions while two other prompts count
5 605. If the gap is real, the claim covers 61 %, not all.
**Explicitly NOT in scope.** The `parent_id` expression tree — it waits for `EUL4_SUB_QUERIES`.
**Findings closed.** F-25, F-20's real gap, F-27/MIG-05.

### 5.4 — Population fidelity · `Model: Sonnet · Effort: high`
Multi-BA folder links into `folder_business_areas` — **no schema change needed** (D-075);
re-import worksheet layouts; the `data_type` transformer drop (WB-05); conditional formats; sort
rank and group, column widths, alignment, word wrap; title-token substitution.
**Acceptance.** `map_layouts` count equals `maps` count, **per 0.4's baseline**.

---

## Phase 6 — Make it safe

**Objective.** Pass an enterprise security bar.
**Dependencies.** 0.2; **1.1 and 1.2**, which now carry the fail-closed interim and entity
scoping. **Inputs.** `research/security-analysis.md`, `review/C-security.md`.

### ⟐ 6.1 — Token lifecycle · `Model: Opus · Effort: high`
⟐**Scope corrected — R-13/C-03/C-10.** v1.0 read *"refresh checks the logout blacklist"*, which
describes adding a call. The actual state is **three defects on one route**
(`routes/auth.ts:143-200`):
1. **`POST /api/auth/refresh` has no `preHandler` at all**, so `isTokenBlacklisted` — wired into
   the `fastify.authenticate` decorator (`plugins/auth.ts:67-78`) — **never runs**. Logout
   provides no revocation.
2. The role is **copied from the presented token** and never re-read from the database.
3. The 7-day grace window **resets on every refresh**, so a weekly-refreshed token never expires.

Plus separate revocable refresh tokens (SEC-12); login rate limiting and account lockout
(SEC-05).
⟐**Acceptance rewritten.** v1.0's *"a deactivated user's refresh fails within one token
lifetime"* passes while a blacklisted token still refreshes. Add: **a token blacklisted by logout
is rejected by `/api/auth/refresh`** (this proves the preHandler exists), and **a token cannot be
refreshed indefinitely past its original issue.**

### ⟐ 6.2 — Object-level authorisation (reduced) · `Model: Opus · Effort: medium`
⟐ Entity scoping **moved to 1.2** (R-14). This stage retains `custom_sql` validation on
**UPDATE**, not just create (SEC-04), and any entity route added since.

### ⟐ 6.3 — RLS, fail-closed · `Model: Opus · Effort: max`
Make RLS **fail closed** — *Neo's one deliberate incompatibility with Discoverer* (D-090),
completing the per-folder interim 1.1 shipped; refuse to execute against a COMPLEX folder
carrying a policy until the predicate can be proven injected (SEC-06); **do not build a reader
against `EUL4_ASM_POLICIES`** (D-077); look for surviving RLS in the depth-2 `OR`-of-`AND`
conditions; document the summary/RLS bypass invariant beside the plan type (D-021).
⟐**NEW — R-15/C-12. Validate `sqlPredicate` on write.** It is raw SQL spliced into every WHERE
(`where-clause.ts:247-294`), admin-gated and therefore fine today — **but this stage makes it the
control the entire data-access model rests on.** Reject SQL comments and anything closing the
generator's bracketing; test that a `UNION` or a comment is refused at the API. **Record that
admin is the trust boundary for RLS content** — the plan states this nowhere.
⟐ Extend the **RLS conformance suite** from 1.1 with the COMPLEX-folder cases.
⟐ Add `/admin/security` to the axe coverage this stage changes (E-06).
**Acceptance.** A user with no policy sees **nothing**, and removing a policy does not open
access. All six conformance tests pass.

### 6.4 — Exposure surface and hygiene · `Model: Sonnet · Effort: medium`
CORS allowlist (INF-13); `/metrics` off the public listener (INF-09); remove the `0.0.0.0` port
publications (INF-12); map raw `ORA-` text to the `kind` taxonomy with a correlation id (SEC-07,
BE-11); host validation on the connect descriptor (SEC-10); **read auditing — strictly after
6.1's redaction is proven** (SEC-11, D-093); dependency and secret scanning in CI (INF-05);
handle decryption failure (F-16).

---

## Phase 7 — Make it whole

**Dependencies.** Phase 2, and 1.1 shipped with tests (D-020).

### ⟐ 7.1a — The `workbooks` schema · `Model: Opus · Effort: medium` **(split — R-19)**
`map_layouts` already carries `worksheet_index` and `worksheet_guid`. **Keep it out of the
authorisation path** (D-020).

### ⟐ 7.1b — The workbook browse UI · `Model: Sonnet · Effort: high`

### ⟐ 7.2 — Scheduled workbook migration · `Model: Opus · Effort: high` **(model raised — A-08)**
Read `EUL4_BATCH_REPORTS/_SHEETS/_QUERIES/_PARAMS` and `EUL4_BR_RUNS` into the existing scheduler
(an 816-line service and a 727-line page already work). Decide retention for the nine
materialised `EUL4_B*Q*R1` historical result tables **before the source is decommissioned** — a
MANUAL classification.
⟐**NEW — A-08/D-10/PR-32. A pre-flight planner pass at import time.** A refusal is a **UI**
state (D-036), and a schedule has no UI at the moment it runs. Without this, a workbook that ran
for years starts failing overnight, unattended, with the reason in a job record nobody reads —
and D-035's `COUNT DISTINCT` refusals make that likely. **The model rises to Opus because this
is planner semantics, not CRUD.**
⟐**Acceptance:** *no migrated schedule is activated whose definition the planner refuses; those
import as `DISABLED` with the refusal reason recorded.* And: *a scheduled run executes under the
schedule owner's entitlements*, asserted with two users and one policy.

### ⟐ 7.3 — Exports, crosstab and drill · `Model: Sonnet · Effort: medium`
Prove XLSX and CSV against real migrated worksheets; wire `CrosstabTable.tsx` once `axis_edge` is
populated by a user building a crosstab (**not** by migration — Discoverer records no edge, so
NULL is *correct*); conditional-format rendering; hierarchy drill UI; print/PDF honouring the
migrated `map_page_setup` rows.
⟐**NEW — E-08. An export-history view.** `export_jobs` and the ownership-gated download route
both exist (`routes/export.ts:81-110`); there is no UI anywhere. *"Where did my export go"* is a
first-week question.
⟐**Acceptance strengthened:** *"export matches on-screen rows"* passes if both are equally
unfiltered. Add the conformance test: **an export carries the same predicates as the on-screen
query.**

---

## Phase 8 — Make it operable

**Dependencies.** 0.1a (CI). Independent of 3–7.

### 8.1 — Prove the production stack · `Model: Sonnet · Effort: high`
Run `docker-compose.prod.yml` end to end — it is multi-stage, non-root, resource-limited and
healthchecked, and **has never been run** (INF-03). Fix `/health`, which returns `200 status:"ok"`
**even when Postgres and Redis are down** (INF-02). Add the Oracle boot-time version gate
(D-019).

### ⟐ 8.2 — Observability (reduced) · `Model: Sonnet · Effort: medium`
⟐ The `getConnection` leak (BE-04) and the Oracle pool metric **moved to 1.3** (R-06) — Phases 3
and 4 must not run without them. This stage retains the scheduler-queue and migration-progress
metrics (INF-10), the unbounded process-local async result cache (BE-03), and the pagination
tiebreaker (BE-06).

### 8.3 — Durability · `Model: Sonnet · Effort: medium`
Scheduled `pg_dump` via the existing, good `scripts/backup.sh` (INF-17); Redis AOF rather than
RDB-only while it is the system of record for jobs (INF-11); a transaction around
`importFromOracle` (BE-08).

### 8.4 — Documentation reconciliation · `Model: Sonnet · Effort: high`
`docs/api/endpoints.md` is 51 % accurate — generate it from the live Swagger at `/api/docs`
instead (DOC-05). Retire or mark the stale plans and status documents (DOC-01, DOC-02). Update
all four locales.

### ⟐ 8.5 — Test-suite hygiene · `Model: Sonnet · Effort: high` **(promoted from §8 — D-06/R-24)**
⟐**Not hygiene. 21 of 33 backend "unit" files connect to real Postgres**, and
`jest.config.js`'s `maxWorkers: 1` is **load-bearing** — they share one throwaway database and
race otherwise. Relocating them without giving each a transaction or a schema-per-worker will
surface flakiness the serialisation is hiding. **State the approach; do not just move files.**

---

## Phase 9 — Prove it

**Dependencies.** Phases 3, 4, 5.

### ⟐ 9.1 — Result-set equivalence · `Model: Opus · Effort: max`
Run the same worksheet in legacy Discoverer and in Neo and **diff the result sets**. Use
`EUL4_QPP_STATS`' recorded executions to choose the worksheets that matter, and — if 0.3 Q5
confirms it records returned row counts — as an **independent oracle for the fan-trap guard**,
which is otherwise unverifiable from this repository alone. **This is the only test that proves
the migration.**
⟐**NEW — D-05/PR-05. An Oracle type-marshalling conformance test.** `oracledb` is never reached
in any test or in CI; every fake row contains whatever JS value the test author typed. One table,
one row, one column per Oracle type the estate uses, asserting what the driver returns. It is the
only place the plan catches NUMBER precision loss or DATE coercion — a silent-wrong-number class
that bears directly on 3.3's re-aggregation and 4.3's date literals.
**Context rule.** ⟐ Diff in the sandbox; emit mismatch counts and a file path.

### ⟐ 9.2 — Incremental re-import · `Model: Opus · Effort: high`
A delta path, so the source can keep changing while the target is validated (D-079).
⟐**NEW — A-07/PR-47. A migration lock and a stated policy.** Nothing in v1.0 says what happens
when a delta re-import runs against the database the application is serving — which is the only
interesting case. **Default: re-import is offline-only**, consistent with D-078's fresh-database
posture. Claim a row in `migration_log` for the duration and have the write paths check it. Name
the choice; do not leave it to the executing session.

### 9.3 — Cutover runbook · `Model: Sonnet · Effort: medium`
Migrate into a **fresh** database promoted by connection-string switch, never in place (D-078);
`pg_dump` before every run; record the source `EUL4_VERSIONS` state and the migrating commit SHA
in `migration_log`; keep legacy read-only-live through a parallel-run period; re-provision user
credentials (D-094) — ⟐**F-05: use 0.4's user count, not the 18/17 that two prompts disagree on;
in a go-live runbook an off-by-one means one person cannot log in**; delete the UTF-16 dumps so
nobody mistakes them for restore points.

---

## 10. Model and effort strategy

**Opus** — architecture, legacy semantics, migration semantics, SQL generation, security design,
complex UI interaction, final review.
**Sonnet** — CRUD, straightforward implementation, ordinary tests, documentation, repetitive
refactoring.
**No Fable.** **Do not switch model or effort mid-session** (D-007).

⟐**NEW RULE — R-19/G-04: no stage may name two models.** v1.0 had three stages instructing the
mid-session switch D-007 forbids (2.1, 5.3, 7.1) — a session following the prompt did the
forbidden thing, and a session following D-007 could not follow the prompt. **All three are now
split into single-model stages** (2.1a/2.1b, 5.3a/5.3b, 7.1a/7.1b), which happens to improve all
three.

---

## 11. Final roadmap matrix

⟐ Per **G-05**, this matrix now carries **only** phase, stage, dependency, model and effort.
Scope, deliverables, counts and gates live in the prompts — the single-home rule that prevents
the drift this review found four times.

| Phase | Stage | Deps | Model | Effort | Change |
| ----- | ----- | ---- | ----- | ------ | ------ |
| 0 | 0.1a Commit + CI | — | Sonnet | med | ⟐ split |
| 0 | 0.1b Retire packs | 0.1a | Sonnet | low | ⟐ split |
| 0 | 0.2 Credentials | 0.1a | Opus | high | |
| 0 | 0.3 EUL probe | 0.1a | Opus | high | ⟐ Q1, Q2, Q4 rewritten; Q0 added |
| 0 | **0.4 Baselines** | 0.3 | Sonnet | med | ⟐ **NEW** |
| 0 | **0.5 Corpus** | 0.1a | Opus | high | ⟐ **NEW** |
| 1 | 1.1 Scoping commit | 0.3, 0.4 | Opus | **max** | ⟐ 5 changes; RLS suite |
| 1 | 1.2 Visibility + schema + scoping | 1.1 | Opus | high | ⟐ +entity scoping |
| 1 | 1.3 Seam tests + verifier | 1.2, 0.5 | Opus | high | ⟐ +BE-04, pool metric |
| 2 | 2.1a Maps API contract | 1.2 | **Opus** | med | ⟐ split |
| 2 | 2.1b Maps list UI | 2.1a | Sonnet | med | ⟐ split, effort ↓ |
| 2 | 2.2 Run + errors | 2.1b | Opus | high | ⟐ +boundary, i18n, disabled |
| 2 | 2.3 Dashboard truth | 2.2 | Sonnet | med | ⟐ gates rewritten |
| 2 | **2.4 Non-drag equivalents** | 2.2 | Sonnet | med | ⟐ **NEW** |
| 3 | 3.1 Measure set | 0.3, 1.3 | Opus | high | |
| 3 | 3.2 Join model + characterisation | 3.1 | Opus | **max** | ⟐ scope corrected |
| 3 | 3.3 Query planner | **3.1**, 3.2 | Opus | **max** | ⟐ prereq fixed; validate mode |
| 3 | 3.4 Enable multi-folder | 3.3 | Opus | high | ⟐ per-rule histogram |
| 4 | 4.1 Code fitting + spec | 0.5, 1.3 | Opus | **max** | ⟐ extraction moved to 0.5 |
| 4 | 4.2 Top-10 renderer | 4.1 | Opus | **max** | |
| 4 | 4.3 Tail + custom fns | 4.2, **1.2** | Opus | high | ⟐ +`custom_functions` dep |
| 4 | 4.4 Calc expansion + CI | 4.3 | Opus | high | |
| 4 | 4.5 Compile the estate | 4.4 | Opus | high | |
| 5 | 5.1a Grants | 1.3 | Opus | med | ⟐ split |
| 5 | 5.1b Hierarchies | 1.3, 0.3 | Opus | high | ⟐ split, four-hop |
| 5 | 5.2 Item classes / LOVs | 5.1a | Opus | high | |
| 5 | 5.3a Condition parser | 5.1a | **Opus** | high | ⟐ split |
| 5 | 5.3b Condition schema | 5.3a | Sonnet | med | ⟐ split |
| 5 | 5.4 Population fidelity | 5.1b | Sonnet | high | |
| 6 | 6.1 Token lifecycle | 0.2 | Opus | high | ⟐ scope + gates rewritten |
| 6 | 6.2 Object-level authz | 1.2 | Opus | med | ⟐ reduced |
| 6 | 6.3 RLS fail-closed | 6.2, 5.2, 1.1 | Opus | **max** | ⟐ +predicate validation |
| 6 | 6.4 Exposure + hygiene | 6.3 | Sonnet | med | |
| 7 | 7.1a Workbooks schema | 2.3, 1.1 | **Opus** | med | ⟐ split |
| 7 | 7.1b Workbook UI | 7.1a | Sonnet | high | ⟐ split |
| 7 | 7.2 Scheduled workbooks | 7.1a, 3.4 | **Opus** | high | ⟐ model ↑, pre-flight |
| 7 | 7.3 Exports, crosstab, drill | 7.1b, 5.x | Sonnet | med | ⟐ +export history |
| 8 | 8.1 Prove prod stack | 0.1a | Sonnet | high | |
| 8 | 8.2 Observability | 8.1 | Sonnet | med | ⟐ reduced |
| 8 | 8.3 Durability | 8.1 | Sonnet | med | |
| 8 | 8.4 Documentation | 8.1 | Sonnet | high | |
| 8 | **8.5 Test hygiene** | 1.3 | Sonnet | high | ⟐ **promoted** |
| 9 | 9.1 Result equivalence | 3.4, 4.5, 5.x | Opus | **max** | ⟐ +type marshalling |
| 9 | 9.2 Incremental re-import | 9.1 | Opus | high | ⟐ +migration lock |
| 9 | 9.3 Cutover runbook | 9.2 | Sonnet | med | |

**Agents column removed.** Every stage is single-context work. Use agents only under the manifest's
five-part prompt rule, serially. ⟐**G-01: what kills an agent is unconstrained output, not
breadth.**

---

## 12. New decisions

Add to `docs/master-plan/DECISION_REGISTER.md`.

| ID | Decision | Reason | Evidence | Status |
| -- | -------- | ------ | -------- | ------ |
| **D-114** | **The formula corpus is committed in anonymised form** — identifiers replaced through a deterministic, byte-class-preserving, gitignored mapping | The dumps are customer report metadata the codebase already refuses to commit, and 0.1a gitignores them. Without an anonymised corpus, 4.2's and 4.3's gates cannot run in CI at all | `d4wkdmp-differ.test.ts:18-19`; `git ls-files` empty; review R-04 | FIXED |
| **D-115** | **One `effectiveFolderSet(def)` function**, a pure function of `MapDefinition`, returns `columnBearingFolderIds` and `joinPathFolderIds`; **RLS and the planner both consume it** | Two independent derivations exist today and disagree — `def.formulaItems` and BFS bridges reach SQL without reaching RLS. A live bypass | `map-execution.service.ts:293-295` vs `context.ts:24-33,126-129`; review R-01 | FIXED |
| **D-116** | **RLS fails closed per policy-bearing folder from Phase 1.1**, not from 6.3 | Global fail-closed at 1.1 would return zero rows for every map (the policy table is empty). Per-folder is a **no-op today** and correct the moment the first policy is written. Otherwise five phases serve unfiltered live data | `map-execution.service.ts:290-291`; review R-02 | FIXED |
| **D-117** | **The planner exposes a validate-only mode** (`POST /api/maps/plan`) | The builder guards only `cross-business-area` and has no preview, so refusals are discovered after running against production Oracle. The planner already emits a plan rather than a verdict | `store/mapBuilder.ts:338-347`; review R-18 | FIXED |
| **D-118** | **If 0.3 Q2 finds no cardinality flag columns anywhere**, the default is to **collect the four flags for the 10 joins by hand from a live Discoverer Administrator**, recorded as a MANUAL cutover item. Fallback: 1.1's aggregate refusal becomes permanent | D-033 makes an absent flag mean FANNING, so absence turns the product into a refusal machine — and 3.4's original gate would not have detected it. **Ten joins makes manual collection realistic** | `legacy-analysis.md:112`; `EUL_SCHEMA_GROUND_TRUTH.md:161-172`; review R-03 | **OPEN → Phase 0.3** |
| **D-119** | **No stage names two models**, and no gate quotes a literal estate count | D-007 forbids mid-session switches, yet three stages instructed one. Three count contradictions were found across the prompts, one of them inside a gate | plan `:329,:519,:866`; `PHASE-01-01:151` vs `PHASE-03-02:11`; review R-19, R-10 | FIXED |
| **D-120** | **D-005 restated:** agents survive when the **output** is constrained — file list, closed questions, required table, tool budget, "return even if unfinished." Cost tracks **bytes read per call** | Measured: the one agent that died had the broadest, least-constrained brief (117 739 tokens, zero output); the most expensive success read 35 files whole at 14 850 tokens/call | This review; review R-20 | FIXED |

---

## 13. What did not change

Recorded so a future session does not reopen settled ground. Each was **attacked in this review
and held**:

- **D-003** integration and verification before features.
- **D-030 / D-031** the fan-trap ordering, and 3.1 before the guard — verified against
  `workbook-parser.ts:2705-2706` and the dump-agreement grades.
- **D-017** the plan type over an enum — WHERE genuinely goes to n+1 clauses.
- **D-016** two authorisation gates — four early returns confirm one gate cannot cover it.
- **D-051** parenthesise everything.
- **D-058** refuse rather than distort.
- **D-010** keep the stack. **D-011** no fourth workspace (counts corrected). **D-078** fresh-database cutover.
- **SQL safety and the export path** — both verified sound and to be protected.
- **The 35-prompt template** — all 35 carry every required section. **Keep it unchanged.**
