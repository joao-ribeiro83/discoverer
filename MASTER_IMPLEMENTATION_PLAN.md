# Discoverer Neo — Master Implementation Plan

**Version:** 1.0 · **Created:** 2026-09-02 · **Supersedes:**
`DISCOVERER_NEO_SESSION_PLAN.md`, `DISCOVERER_NEO_EXECUTION_PLAN.md`,
`DISCOVERER_NEO_WORKSHEET_FIDELITY_PLAN.md` (retained as evidence of prior reasoning, not as
specifications — see D-001).

**Built from:** the eight `AUDIT_*.md` forensic documents, plus five research artefacts in
`docs/master-plan/research/` produced during planning. **Two of those overturned conclusions
in the audit itself.**

**Governing register:** `docs/master-plan/DECISION_REGISTER.md`. Do not reopen a decision
there without evidence that contradicts its Evidence column.

**Execution prompts:** `docs/master-plan/prompts/PHASE-<NN>-<NN>-<slug>.md`. One per stage,
self-contained.

---

## 1. Where the project actually is

> Discoverer Neo is a substantial, well-engineered body of work that **does not currently
> function as a product**. Roughly **60 % built, ~15 % integrated, 0 % delivered.**

The metadata layer, the SQL generation architecture, the Oracle connectivity and above all
the reverse-engineered `.DIS` workbook parser are real and careful — the parser is
**validated against Oracle's own `d4wkdmp.exe` decoder across 544 workbooks with zero
failures**. But the migrated estate of **923 worksheets is unreachable** through three
independent defects, and the production security posture rests on an encryption key
published in this repository.

**The failure is integration and verification, not design.** That single sentence sets the
shape of this plan: Phases 0–2 add almost no features.

### The four facts that drive every decision below

1. **Nothing has been committed.** 70 untracked paths, no git remote, CI pointed at a branch
   that does not exist. One `git clean` ends the project's most valuable work.
2. **Today's broken multi-folder queries are an accidental safety guard.** There is no
   fan-trap detection anywhere. Fixing the joins first — the most tempting change in the
   codebase — turns 341 loud failures into **silently inflated aggregates**: a £2.4M quarter
   reporting as £9.6M, in a system whose users have fifteen years of trained trust in these
   numbers.
3. **Every verification mechanism reports success over a dead system.** The readiness scorer
   returns `75 / "ready-with-warnings" / blockers: []`; 1 654 tests pass; the coverage
   artefact claims >80 %. *No component is responsible for asserting end-to-end truth.*
4. **The hardest remaining engineering task is ~3.5× smaller than the audit thought.** Only
   **56** built-in function codes appear in the whole estate (not ~199), **10 of them cover
   93.5 %**, and Oracle's own dumps carry **37 971 rendered `DisplayFormula` strings** paired
   1:1 with the token form — turning the decoder from research into fitting.

---

## 2. Target architecture

Keep the shape. Change seven things.

```
                        ┌───────────────────────────────────────────┐
   Browser ── nginx ───►│ frontend  React 19 · Vite · TS            │
                        │  TanStack Query/Table/Virtual · Zustand   │
                        │  shadcn/ui · dnd-kit · i18n ×4 · 3 themes │
                        └────────────────────┬──────────────────────┘
                                             │ REST + Bearer JWT
                        ┌────────────────────▼──────────────────────┐
                        │ backend  Fastify 5 · TypeScript           │
                        │  routes → services → lib/sql              │
                        │  ┌─────────────────────────────────────┐  │
                        │  │ TWO AUTH GATES (D-016)              │  │
                        │  │  canAccessMap        → the object   │  │
                        │  │  assertDataEntitlement → the data   │  │
                        │  └─────────────────────────────────────┘  │
                        │  ┌─────────────────────────────────────┐  │
                        │  │ QUERY PLANNER (D-017)  ★ NEW        │  │
                        │  │  FLAT | REWRITE(n) | REFUSE(rule)   │  │
                        │  │  emits a PLAN, not a verdict        │  │
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
              │  db/schema.ts     ← SINGLE shared schema (D-011)    │
              │  semantics/       ← canonical AST · token renderer  │
              │                     · SQL emitter · row evaluator   │
              │                     · join + fan-trap planner       │
              │  migration/       ← eul-reader → adapter →          │
              │                     transformers → runner → writer  │
              │                     + verify (post-commit, D-070)   │
              │  workbook-parser.ts   ← the .DIS decoder (protect)  │
              │  d4wkdmp differ       ← promoted into CI            │
              └─────────────────────────────────────────────────────┘
                 backend re-exports core's schema; ESLint forbids
                 the reverse import direction (D-012)
```

### The seven changes

| # | Change | Decision | Phase |
| - | ------ | -------- | ----- |
| 1 | **Query scope derives from referenced items**; `maps.business_area_id` becomes advisory | D-013 | 1.1 |
| 2 | **Two authorisation gates**; BA-scoped RLS resolves against the derived folder set | D-015, D-016 | 1.1 |
| 3 | **A query planner** emitting a plan, with FLAT as an explicit decision | D-017, D-018 | 3.3 |
| 4 | **`joins` folder-to-folder + `join_predicates`** with an operator; four booleans; derived `join_type` | D-032 | 3.2 |
| 5 | **The token renderer**, emitting into the existing AST and allowlist | D-050, D-054 | 4 |
| 6 | **One shared schema** in `core`, re-exported by backend; drift becomes a compile error | D-011 | 1.2 |
| 7 | **Post-commit migration verification** with a re-runnable `verify` subcommand feeding blockers | D-070, D-071 | 1.3, 4.5 |

### Explicitly NOT changing

No stack change · no microservices · no new runtime process · **no fourth npm workspace**
(D-011) · no document store · no Oracle dialect capability table (D-019) · no condition
expression tree yet (D-072 + `negated` boolean covers the entire measured corpus).

---

## 3. Phase map

```
0  Secure the work          ── nothing else is safe until this is done
1  Make it run              ── the scoping commit and its three blockers
2  Make it reachable        ── the product's front door
3  Make the numbers right   ── the fan-trap programme      ★ highest stakes
4  Make the formulas run    ── the token decoder           ★ largest task
5  Make it faithful         ── metadata fidelity
6  Make it safe             ── security tiers 2–4
7  Make it whole            ── workbooks, scheduling, exports
8  Make it operable         ── production readiness
9  Prove it                 ── cutover validation
```

**Hard ordering constraints** (violating any of these produces silently wrong numbers or
lost work):

- **0 before everything.** Uncommitted work, and a key that decrypts every stored password.
- **1.1 is one commit.** Scoping + RLS fix + two-gate auth + the aggregate refusal (D-014).
- **3.1 before 3.3.** `agg_function` is NULL everywhere; without it the guard is inert (D-031).
- **3.2 and 3.3 before 3.4.** Guard before enabling multi-folder joins (D-030).
- **1.2's `group_id` write fix before 1.3's seam tests** (D-072).
- **6.1's redaction before 6.4's read auditing** (D-093).
- **Phase 0.3's probe gates Phase 3 entirely** — five open decisions (D-040, D-110–D-113).

**Parallelisable in principle** — Phase 2 (frontend) is independent of Phases 3–4 once 1.2
lands; Phase 6 is independent of 3–5; Phase 8 is independent of everything after 1.
**But execute serially anyway while the token budget is the limiting factor** (D-005). The
independence is recorded so that a session which finishes early knows what it may safely
start next, not as an instruction to run concurrent agents.

---

# PHASES

---

## Phase 0 — Secure the work and establish truth

**Objective.** Make the work durable, remove the credential exposure, and answer the five
read-only questions that gate everything else.
**Why this phase exists.** 70 untracked paths and no remote; an encryption key published in
this repository; and five open decisions that, answered wrongly, produce correct-looking
wrong numbers.
**Dependencies.** None. **This is the entry point.**
**Risks.** None of consequence — 0.1 and 0.3 are additive or read-only. 0.2 rotates
credentials, so schedule the Oracle rotation with whoever owns that estate.
**Parallelisation.** 0.1 → 0.2 → 0.3 strictly (0.2 must not be committed before 0.1 gives it
somewhere to go).

### 0.1 — Commit the tree and wire CI · `Model: Sonnet · Effort: medium`

**Scope.** Review all 70 untracked paths; `.gitignore` the ~40 MB of dumps, `storage/`,
`backups/`, `credentials/`; delete the junk path `frontend/[A-Z][a-z][a-zA-Z`; commit
everything else; add a remote; **repoint `.github/workflows/{ci,docker}.yml` from `main` to
`master`** (or rename the branch) and make CI run.
**Deliverables.** A committed tree with a remote; a green CI run; `.gitignore` updated;
`CLAUDE.md` corrected where it describes the deleted `.claude/agents/` and `.claude/skills/`
as present.
**Acceptance.** `git status --porcelain` shows nothing unexpected; `git remote -v` non-empty;
**a CI run exists and passes** (`typecheck` + `lint` + all three test suites).
**Findings closed.** DOC-04, INF-04, INF-06, INF-14, and the `CLAUDE.md` documentation drift.

### 0.2 — Credential remediation, tier 0 · `Model: Opus · Effort: high`

**Scope.** Redact audit-log bodies **by substring** not exact key (`password`, `secret`,
`token`, `credential`); **purge** the 174 Oracle + 5 user cleartext passwords already in
`audit_log`; make the app **refuse to boot in production** with a default `ENCRYPTION_KEY` or
`JWT_SECRET`; add both to `.env.example`; rotate and re-encrypt stored Oracle credentials;
add a TTL + boot sweep for the nine plaintext credential CSVs; remove the seed data source
carrying a placeholder credential.
**Deliverables.** The redactor fix + a purge migration; a production config guard;
`.env.example` updated; a rotation runbook in `docs/deployment/configuration.md`.
**Acceptance.** A test proves `passwordEnc` and `newPassword` are redacted; `SELECT` over
`audit_log` finds **zero** cleartext credentials; the app **fails to boot** in `production`
with either default; no credential CSVs older than the TTL survive a boot.
**Findings closed.** SEC-02, F-03, INF-08, INF-07, F-17.
**Risk.** Rotation invalidates stored Oracle passwords — coordinate before running.

### 0.3 — The read-only EUL probe · `Model: Opus · Effort: high`

**Scope.** Five read-only queries against the live EUL (`10.236.141.201:1530`, SID `COSEC`,
owner `SIID_TESTES`, thick mode). **No writes. No migration run.**

| Q | Query | Settles |
| - | ----- | ------- |
| 1 | Join `eul4_key_cons` to `eul4_objs` on both `key_obj_id` and `fk_obj_id_remote`, 10 rows | **D-040** — is `KEY_OBJ_ID` detail or master? |
| 2 | `ALL_TAB_COLUMNS` for `EUL4_KEY_CONS` + `SELECT *` on 10 rows | **D-110** — the four join flag columns |
| 3 | `ALL_TAB_COLUMNS` for `EUL4_EXPRESSIONS` + a `GROUP BY` on each candidate | **D-111** — the default-aggregate column |
| 4 | `GROUP BY` on hierarchy naming over the 502 `IBH` rows | **D-112** — how many are date-template boilerplate |
| 5 | `ALL_TAB_COLUMNS` for `EUL4_QPP_STATS` | **D-113** — does it record returned row counts? |

Also: `SELECT * FROM eul4_expressions WHERE exp_type='JP'` (10 rows) to confirm the join
predicate shape and whether multi-column joins are one row or *n*.

**Deliverables.** `docs/master-plan/research/eul-probe-results.md` with the raw output and a
verdict per question; **the Decision Register updated** — D-040 and D-110–D-113 move from
`OPEN` to `FIXED`; if Q1 confirms the inversion, a one-line fix to
`migrate/src/services/eul-schema-adapter.ts:129-130` **plus a regression test**.
**Acceptance.** All five questions answered from live data or explicitly recorded as
unanswerable with the reason. **`eul-schema-adapter.ts`'s orientation is proven correct or
corrected.**
**Risk.** If the EUL is unreachable, Phase 3 cannot start. Escalate immediately rather than
proceeding on assumption.

---

## Phase 1 — Make it run

**Objective.** One migrated worksheet executes and returns correct rows — and the system can
prove it.
**Why this phase exists.** Zero of 923 worksheets execute, and no test spans migration →
generation → execution. This is the **highest-leverage work in the entire project**.
**Dependencies.** Phase 0.
**Risks.** **This phase contains the single most dangerous commit in the plan.** See 1.1.
**Parallelisation.** Strictly 1.1 → 1.2 → 1.3.

### 1.1 — The scoping commit · `Model: Opus · Effort: max`

> **Four changes, ONE commit. Splitting them ships a system that returns wrong money.**

**Scope.**
1. `loadMapDefinition()` derives the folder set from the map's **referenced items** (plus
   folders reachable through its joins), not from `maps.business_area_id`. Make that column
   nullable and advisory.
2. **RLS follows the derived folder set** — `map-execution.service.ts:296-305` currently
   matches BA-scoped rules by direct equality on the map's BA column; `null` would never
   match and **the query would run unfiltered, silently** (D-015).
3. **Two authorisation gates** — `canAccessMap` (object) plus a new **unconditional**
   `assertDataEntitlement(userId, folderIds)` (data). `middleware/business-area-auth.ts:99`'s
   `resolveBusinessAreaId` becomes `=> Promise<string[]>` and `userHasPermission` becomes an
   all-of check (D-016).
4. **The interim refusal** — in `buildFromClause`, if
   `required.length > 1 && ctx.hasAggregates`, throw naming the folders and the reason
   ("multi-folder aggregate queries are refused until the fan-trap planner lands"). Deleted
   in 3.4 (D-014).

**Deliverables.** The four changes; a Drizzle migration making the column nullable; tests
for each.
**Acceptance.**
- A **single-folder** migrated map executes end to end against the live Oracle and returns
  rows.
- A test asserts a **BA-scoped RLS policy still fires** when `business_area_id IS NULL`.
  **Without this test, the column stays `NOT NULL` and the stage is not done.**
- A test asserts an owner/public/shared map **still fails** `assertDataEntitlement` when the
  user lacks a folder's BA grant.
- A multi-folder aggregate map **refuses loudly**, naming the folders.
- ~651 single-folder maps generate SQL; ~272 multi-folder maps refuse with the new message.

**Findings closed.** F-01, F-02b, BE-12 (partially — folder sharing union), and *pre-empts*
LEG-04.

### 1.2 — Visibility, schema unification and the write-path fixes · `Model: Opus · Effort: high`

**Scope.** `GET /api/maps` stops hiding the migrated estate (add an `all` scope, admin-visible
by default); `GET /api/maps/{id}` returns totals, layout and page setup (F-32); **saving a map
stops destroying its totals** (BE-02, 19 632 rows exposed); **unify the schema** — the 19
shared tables move to `core`'s `db/schema.ts`, backend re-exports and adds its 11
runtime-only tables (D-011), and the `no-restricted-imports` ESLint rule lands (D-012);
**add the missing `group_id` column to the migrate schema and fix the write path** (D-072);
`loadMapDefinition` unions `folder_business_areas` (BE-12).
**Deliverables.** The above, plus the package rename to `@discoverer-neo/core`.
**Acceptance.** `GET /api/maps` returns 923 for an admin; a round-trip save preserves totals;
`npm run typecheck --workspaces` is clean **and a deliberate column mismatch between the two
schema files now fails typecheck**; re-imported conditions carry non-null `group_id`.
**Findings closed.** F-07, F-32, BE-02, BE-10, BE-12.
**Why `group_id` is here and not later.** The seam tests in 1.3 would otherwise pin
conditions whose parenthesisation was discarded at import.

### 1.3 — The four seam tests and the verification harness · `Model: Opus · Effort: high`

**Scope.** The four tests that would have caught every CRITICAL finding, plus a re-runnable
`dn-migrate verify` subcommand (D-070) that runs them against a real target.

1. **Migration → execution contract.** For every migrated map: `loadMapDefinition()` +
   `generateSql()` must not throw. Catches F-01 and F-04.
2. **Formula compile rate.** Every `map_calculated_fields.formula` compiles or is quarantined
   with a reason. Converts F-02 from an unknown into a tracked number.
3. **Referential closure.** Every `map_item` resolves to an item, folder and data source
   **within the map's query scope**.
4. **Source ↔ target reconciliation** with declared expected-loss allowances. Catches
   hierarchies 508 → 0 and grants 138 → 60 automatically.

Plus: **`scoreReadiness()` inspects its own output and emits blockers, not notes** (D-071);
a `COMPLETED_WITH_BLOCKERS` migration status; **promote the `d4wkdmp` differ into CI** with a
checked-in fixture corpus; fix or delete the one failing async-execution test and its leaked
handles (F-23).
**Acceptance.** All four tests run in CI. **The readiness scorer refuses to report "ready"
against today's database state** — this is the stage's defining test. The differ gates the
build on agreement rates.
**Findings closed.** F-21, F-12, F-22, F-23, F-30, and the audit's testing §6 Tier 1.

---

## Phase 2 — Make it reachable

**Objective.** A user can find, open, run and read a migrated worksheet without typing a UUID.
**Why this phase exists.** ~11 000 lines of working backend sit behind a page that says
*"This page is coming soon."*
**Dependencies.** 1.2 (the `/api/maps` fix).
**Parallelisation.** Independent of Phases 3–4. Execute serially anyway (D-005).

### 2.1 — The Maps list · `Model: Sonnet · Effort: high` *(Opus for the API contract)*

**Scope.** Replace the 22-line placeholder with a real list: search, business-area filter,
`mine | shared | all` tabs, recency sort, create action, row actions (open, view, share,
schedule, export, delete with confirmation). **Flat worksheet list — workbook grouping lands
in 7.1** (D-100).
**Acceptance.** All 923 migrated worksheets are findable and openable from `/maps`; empty
states tell the truth (D-101/R2 — *"923 worksheets exist; none are shared with you"*, never
*"No maps yet"*).
**Findings closed.** F-06.

### 2.2 — Wire Run, and the error surface · `Model: Opus · Effort: high`

**Scope.** Make **Run** work: parameter prompt, loading state, success and error states
carrying the backend's `kind` (`CONFIG` / `ORACLE` / `AUTH`); a **global error boundary**; a
disabled state **with a stated reason**; and the first version of the **refusal UI** (D-036) —
a refusal renders as an explanation with a next step, never a generic error.
**Acceptance.** Clicking Run on a migrated worksheet issues a request and renders rows, a
parameter prompt, or an explained refusal. **No path produces silence.**
**Findings closed.** F-08; UX R3, R4.

### 2.3 — Dashboard truth pass · `Model: Sonnet · Effort: medium`

**Scope.** Remove every placeholder rendered in a value slot; implement the endpoints worth
implementing (workspace execution count) and delete the cards that are not; **delete
`frontend/src/__tests__/dashboard.test.tsx:93`**, which asserts the placeholder text; fix the
raw `->` in shipped copy; fix the duplicated login checkbox (F-26).
**Acceptance.** No `<h*>` in the dashboard contains prose. The scheduling card reflects that
scheduling **exists**. Accessibility E2E passes in CI.
**Findings closed.** F-13, F-26, F-30.

---

## Phase 3 — Make the numbers right  ★ highest stakes

**Objective.** Multi-folder queries produce **arithmetically correct** aggregates, or refuse.
**Why this phase exists.** There is no fan-trap guard. Oracle's own worked example shows
**2×–3× inflation on two measures simultaneously**. This is the phase where getting the order
wrong ships wrong money.
**Dependencies.** Phase 0.3 (**gating** — D-040, D-110, D-111), Phase 1.
**Inputs.** `research/legacy-analysis.md` §1.11 — a numbered, implementable decision
procedure derived from Oracle's own verbatim SQL across four vendor releases. **The rewrite
is a specification exercise, not a research one.**
**Risks.** The highest in the plan. Mitigated by strict ordering and by D-037's histogram.

### 3.1 — Populate the measure set · `Model: Opus · Effort: high`

**Scope.** Populate `map_items.agg_function` and the axis/measure split **from the workbook
parser** — the `.DIS` query request carries two literal vectors, `0x0123` axis and `0x0124`
measure, and the spec calls the split *given, not inferred*. The EUL column is UNKNOWN;
D-111 may supply it as a cross-check.
**Why first.** With `agg_function` NULL everywhere, every query classifies `|M| = 0` and takes
the flat path — **the guard would ship present, unit-tested and structurally inert** (D-031).
**Acceptance.** `agg_function` is non-null on the measure items of a re-imported corpus, and a
count of measures per map is reportable. **A test asserts the split is non-empty across the
estate.**
**Findings closed.** LEG-05.

### 3.2 — The join model · `Model: Opus · Effort: max`

**Scope.** `joins` becomes folder-to-folder; add `join_predicates` (1..n column pairs, each
with an **operator** — `=`, `<`, `>`, `<=`, `>=`, `<>`); store `one_to_one`,
`allow_master_no_detail`, `allow_detail_no_master`, `mandatory` as four booleans; **derive**
`join_type` and stop storing it; read `EXPRESSIONS.EXP_TYPE='JP'` in the reader; a join with
no predicate becomes an **explicit refusal naming the join** (D-039).
**Constraints.** Orientation per D-040 **as settled by 0.3**. `mandatory` has no join-type
effect (D-032 note). `(True, True)` maps to a **refusal, not `FULL`** (D-038). `KEY_TYPE` is a
probed column defaulting to `INNER` — do not treat the existing values as read.
**Acceptance.** All 10 estate joins carry non-null endpoints and a predicate; a unit test
covers each flag combination's emitted SQL; the `(True,True)` case refuses.
**Findings closed.** MIG-01, LEG-02, LEG-03.

### 3.3 — The query planner · `Model: Opus · Effort: max`

**Scope.** Implement `research/legacy-analysis.md` §1.11 steps 0–10 as a planner between
`loadMapDefinition()` and `generateSql()`.

**Write the plan type first — it is the design artefact of this whole replan** (D-017). It
must carry: branches; each branch's folders; its join predicate; its **branch-local**
conditions and parameters; its group keys; its per-measure aggregate **and re-aggregate**
function; and the outer key set. A `{kind, branches}` enum is the ceremony version and will
not survive contact with the rewrite.

**Also:** invert `FLAT` from the emitter's default to an explicit planner decision
(`from-clause.ts:73-76` short-circuits today — D-018); detect the **single-branch** master-side
fan trap (D-034); apply the four refusal rules R1–R4; re-aggregate `SUM→SUM`, `COUNT→SUM`,
`MIN→MIN`, `MAX→MAX` and **refuse `AVG` / `COUNT DISTINCT` / `STDDEV` / `VARIANCE`** (D-035);
record the decision on every execution; suppress totals spanning differing branches as NULL.
**Acceptance.** Unit tests reproduce Oracle's documented worked example — including the
2×–3× inflation the guard prevents. Every refusal names its rule. **Assume-fanning is the
default** (D-033).
**Findings closed.** LEG-04.

### 3.4 — Enable multi-folder generation · `Model: Opus · Effort: high`

**Scope.** Delete 1.1's interim refusal; let the planner drive; extend migration verification
to emit the **planner-decision histogram** across all 923 maps.
**Acceptance.** **`REFUSE > 0 && FLAT < 923`** (D-037) — a guard that never fires is
indistinguishable from one that is not wired in. A known master–detail join in this estate
(`M M67 1 → M M67`, header to lines) produces the **correct** total, verified against the
source system.
**Findings closed.** BE-01, and LEG-04 is now proven rather than pre-empted.

---

## Phase 4 — Make the formulas execute  ★ largest task

**Objective.** The estate's 49 819 calculated fields compile to SQL, or are quarantined with
a stated reason.
**Why this phase exists.** 83 % of worksheets carry a formula stored in Discoverer token form
that no backend parser reads.
**Dependencies.** Phase 1. (Independent of Phase 3; sequence after it because Phase 3 is
higher-stakes.)
**Inputs.** `research/formula-decoder-analysis.md`. **The lexer and parser already exist**
(`workbook-parser.ts:1086-1185`) — only the renderer is missing.

### 4.1 — Corpus fixture, code fitting and the spec · `Model: Opus · Effort: max`

**Scope.** Extract the **37 971 aligned `(IOFormula, DisplayFormula)` pairs** from the 547
dumps into a checked-in fixture; **derive** name, arity and fixity for the **56** used codes
from that evidence; classify the 7 371 unrendered `IOFormula` entries; settle the dump
character encoding (`PR�MIO` appears — load-bearing for exact-match comparison on a
Portuguese estate); **write the implementation spec** (D-004).
**Acceptance.** Fixture committed. Every one of the 56 codes has an **attested** arity and
fixity, or is explicitly marked refuse-only. **No code is guessed** — this repository has a
documented history of fabricated names reaching production code.

### 4.2 — The top-10 renderer · `Model: Opus · Effort: max`

**Scope.** Render the 10 codes covering 93.5 % of uses, **fully parenthesised** (D-051 — this
removes the precedence problem entirely), emitting into the **existing AST and allowlist**
(D-054). Resolve `[6,n]` and `[8,n]` through the workbook element table.
**Acceptance.** **≥ 93 % of the aligned corpus renders exactly equal to `DisplayFormula`.**

### 4.3 — The tail, custom functions and date literals · `Model: Opus · Effort: high`

**Scope.** The remaining 46 codes; `[2,n]` resolution to migrated `custom_functions` — note
these are **workbook-local `IoId`s (17–411)**, not the 112 777-style EUL ids, and only ~100 of
the 593 are referenced (D-057); `[5,4]` date literals (9 062 uses).
**Acceptance.** **≥ 99 % exact match; `FAILED = 0`.** Registered PL/SQL functions are callable,
with identifier validation and no string splicing.
**Findings closed.** LEG-matrix "registered functions not callable".

### 4.4 — Calculation-reference expansion and the CI gate · `Model: Opus · Effort: high`

**Scope.** Recursive expansion **at render time** with cycle detection (D-056); wire the
four-bucket partition into CI.
**Acceptance.** The 2 536 known WB-04 chains resolve. CI fails on any bucket regression.
**Findings closed.** WB-04, BE-09 (the two hand-written parsers converge on one AST).

### 4.5 — Compile the estate · `Model: Opus · Effort: high`

**Scope.** Compile all 49 819 stored formulas; publish the partition; feed `QUARANTINED` and
`FAILED` into readiness as **blockers**.
**Acceptance.** Readiness **refuses to report "ready"** while `FAILED > 0`.
**Findings closed.** F-02, WB-03, WB-01 (reports regenerated), WB-05, BE-05.

---

## Phase 5 — Make it faithful

**Objective.** Recover the metadata the migration lost, and populate the schema Neo already
has.
**Why this phase exists.** *"Most of that loss is population, not modelling"* — the schema
already models crosstab edges, conditional formats, worksheet identity, sort rank and
percentages, and simply has no rows.
**Dependencies.** Phase 1. 5.1 benefits from 0.3's Q4.

### 5.1 — The EUL4 object-link resolver · `Model: Opus · Effort: high`

**Scope.** One fix — EUL4 binds via `EUL4_BA_OBJ_LINKS`, not a column — recovers **both**
hierarchies (508 → 0) and grants (138 → 60) (D-073). **Regenerate date hierarchies natively;
migrate only user-authored ones** (D-074) — 0.3's Q4 says how many of the 502 `IBH` are
boilerplate, and **may shrink this work by two orders of magnitude**.
**Acceptance.** User-authored hierarchies migrate with correct parent/child structure; grants
reconcile to 138 minus a **declared, justified** allowance; the reconciliation test from 1.3
passes without an exception.
**Findings closed.** MIG-03/F-10, F-11, MIG-06, MIG-07.

### 5.2 — Item classes and lists of values · `Model: Opus · Effort: high`

**Scope.** An `item_classes` model carrying **three orthogonal capabilities** — LOV,
alternative sort, drill-to-detail — not a `has_lov` boolean. **LOV values are live, not
stored**: `SELECT DISTINCT col FROM table` plus a cache flag and a cardinality hint. *"A
target that migrates LOVs as static enums is wrong on day one."*
**Why it matters more than it looks.** It is a dependency of migrating any surviving
row-level security (D-077), and its immediate payload is **7 521 parameters and 5 605
conditions currently rendering as free-text boxes**.
**Findings closed.** LEG-06.

### 5.3 — Condition fidelity · `Model: Sonnet` *(Opus for the parser change)* · `Effort: high`

**Scope.** Add `negated boolean` to `map_conditions` and honour it — **this covers the entire
measured corpus** (depth 0 = 92.6 %, depth 1 = 7.3 %, depth 2 = 7 instances, depth ≥ 3 =
**zero**), and closes the parser's `NOT` refusal (D-072); add the case-sensitivity column the
parser already reads; make `item_id` nullable + add `calculated_field_id` + a CHECK, so
conditions can reference calculations (D-013/M4).
**Explicitly NOT in scope.** The `parent_id` expression tree. It waits for
`EUL4_SUB_QUERIES` to have a reader — subquery nodes are its real justification, not depth.
**Findings closed.** F-25, F-20's real gap (the missing column), F-27/MIG-05.

### 5.4 — Population fidelity · `Model: Sonnet · Effort: high`

**Scope.** Multi-BA folder links into `folder_business_areas` — **no schema change needed**
(D-075); re-import worksheet layouts (expect 923, not 24 — the gap is stale data, not a code
defect); the `data_type` transformer drop (WB-05); conditional formats; sort rank, sort group,
column widths, alignment, word wrap; title-token substitution.
**Acceptance.** `map_layouts` count equals `maps` count. The reconciliation test's expected-loss
allowances shrink.
**Findings closed.** F-04 (data), WB-05, MIG-08, and the LEG-matrix "schema ready" band.

---

## Phase 6 — Make it safe

**Objective.** Pass an enterprise security bar.
**Dependencies.** Phase 0.2 (tier 0 already done). Independent of 3–5.
**Inputs.** `research/security-analysis.md`.

### 6.1 — Token lifecycle · `Model: Opus · Effort: high`
Refresh checks the logout blacklist and **re-reads role and account status from the
database** (SEC-01); separate revocable refresh tokens (SEC-12); login rate limiting and
account lockout (SEC-05).
**Acceptance.** A deactivated user's refresh fails within one token lifetime, not fourteen days.

### 6.2 — Object-level authorisation · `Model: Opus · Effort: high`
Entity scoping on `GET` by id for folders, items, joins and hierarchies (SEC-03 — the pattern
exists in the maps routes); `custom_sql` validation on **UPDATE**, not just create (SEC-04).
**Acceptance.** A non-admin cannot read a folder outside their granted business areas.

### 6.3 — RLS, fail-closed · `Model: Opus · Effort: max`
Make RLS **fail closed** — *Neo's one deliberate incompatibility with Discoverer* (D-090);
refuse to execute against a COMPLEX folder carrying a policy until the predicate can be proven
injected (SEC-06); **do not build a reader against `EUL4_ASM_POLICIES`** (D-077 — it is
Automated Summary Management); look for surviving RLS in the **7 depth-2 `OR`-of-`AND`
conditions**; document the summary/RLS bypass invariant beside the planner's plan type (D-021).
**Acceptance.** A user with no policy sees **nothing**, and removing a policy does not open
access.

### 6.4 — Exposure surface and hygiene · `Model: Sonnet · Effort: medium`
CORS allowlist (INF-13); `/metrics` off the public listener (INF-09); remove the `0.0.0.0`
port publications (INF-12); map raw `ORA-` text to the `kind` taxonomy with a correlation id
(SEC-07, BE-11); host validation on the connect descriptor (SEC-10); **read auditing —
strictly after 6.1's redaction is proven** (SEC-11, D-093); dependency and secret scanning in
CI, clearing the 11 advisories (INF-05); handle decryption failure (F-16).

---

## Phase 7 — Make it whole

**Objective.** The product matches the user's mental model and covers the remaining feature
surface.
**Dependencies.** Phase 2, and 1.1 shipped with tests (D-020).

### 7.1 — The `workbooks` aggregate · `Model: Opus` *(schema)* / `Sonnet` *(UI)* · `Effort: high`
564 workbooks above the 923 worksheets; `map_layouts` already carries `worksheet_index` and
`worksheet_guid` for exactly this. **Keep it out of the authorisation path** (D-020).

### 7.2 — Scheduled workbook migration · `Model: Sonnet · Effort: high`
Read `EUL4_BATCH_REPORTS/_SHEETS/_QUERIES/_PARAMS` and `EUL4_BR_RUNS` into the **existing**
scheduler (an 816-line service and a 727-line page already work). Decide retention for the
nine materialised `EUL4_B*Q*R1` historical result tables **before the source is
decommissioned** — that is a MANUAL classification.

### 7.3 — Exports and crosstab rendering · `Model: Sonnet · Effort: medium`
Prove XLSX and CSV against real migrated worksheets; wire `CrosstabTable.tsx` once `axis_edge`
is populated by a user building a crosstab (**not** by migration — Discoverer records no edge,
so NULL is *correct*); conditional-format rendering; hierarchy drill UI; print/PDF honouring
the 923 already-migrated `map_page_setup` rows.

---

## Phase 8 — Make it operable

**Objective.** The production stack runs, is observable, and can be restored.
**Dependencies.** Phase 0.1 (CI). Independent of 3–7.

### 8.1 — Prove the production stack · `Model: Sonnet · Effort: high`
Run `docker-compose.prod.yml` end to end — it is multi-stage, non-root, resource-limited and
healthchecked, and **has never been run** (INF-03). Fix `/health`, which returns
`200 status:"ok"` **even when Postgres and Redis are down** (INF-02).

### 8.2 — Observability · `Model: Sonnet · Effort: medium`
Add the Oracle pool, scheduler queue and migration-progress metrics (INF-10); fix the
`getConnection` leak when its own timeout wins the race (BE-04); bound the process-local
async result cache that grows forever (BE-03); add a pagination tiebreaker (BE-06 — 186 maps
have no sort at all).

### 8.3 — Durability · `Model: Sonnet · Effort: medium`
Scheduled `pg_dump` via the existing, good `scripts/backup.sh` (INF-17); Redis AOF rather than
RDB-only with a 1-hour worst-case window while it is the system of record for jobs (INF-11);
a transaction around `importFromOracle` (BE-08).

### 8.4 — Documentation reconciliation · `Model: Sonnet · Effort: high`
`docs/api/endpoints.md` is **51 % accurate** — 23 phantom endpoints, 56 real ones
undocumented. Generate it from the live Swagger at `/api/docs` instead (DOC-05). Retire or
mark the stale plans and status documents (DOC-01, DOC-02). Update all four locales.

---

## Phase 9 — Prove it

**Objective.** Demonstrate that migrated worksheets **behave correctly**, and that cutover is
reversible.
**Dependencies.** Phases 3, 4, 5.
**Why this phase exists.** *"The current success criterion is 'rows were imported.' It must
become 'the new system reproduces the old system's output.'"*

### 9.1 — Result-set equivalence · `Model: Opus · Effort: max`
Run the same worksheet in legacy Discoverer and in Neo and **diff the result sets**. Use
`EUL4_QPP_STATS`' **7 316 recorded executions** to choose the worksheets that actually matter,
and — if 0.3's Q5 confirms it records returned row counts — as an **independent oracle for
the fan-trap guard**, which is otherwise unverifiable from this repository alone.
**This is the only test that proves the migration.** The team has already built this class of
tool once (the `d4wkdmp` differ); apply the same pattern to **results**, not metadata.

### 9.2 — Incremental re-import · `Model: Opus · Effort: high`
A delta path, so the source can keep changing while the target is validated (D-079). Today
the only partial route is `reimport-maps`.

### 9.3 — Cutover runbook · `Model: Sonnet · Effort: medium`
Migrate into a **fresh** database promoted by connection-string switch, never in place
(D-078); `pg_dump` before every run; record the source `EUL4_VERSIONS` state and the migrating
commit SHA in `migration_log`; keep legacy read-only-live through a parallel-run period;
re-provision user credentials (D-094); delete the UTF-16 dumps so nobody mistakes them for
restore points.

---

## 4. The migration programme

Migration is **not** a final feature. It runs across Phases 0, 1, 3, 4, 5 and 9.

| Concern | Where | State |
| ------- | ----- | ----- |
| Source discovery · EUL extraction · version detection | — | **Works.** `detect` instant, `analyze` 45.8 s, `run` 20–21 s |
| Workbook decoding | — | **Works, and is validated against Oracle's own decoder.** Protect it |
| Transformation | 3.1, 5.1, 5.4 | Where fidelity is lost — **population, not modelling** |
| Worksheet fidelity | 4, 5.4 | Formulas (Phase 4) and the "schema ready" band (5.4) |
| Target import | 1.2 | Schema unification; `group_id` write path |
| **Validation** | 1.3, 3.4, 4.5, 9.1 | **The weakest link. Fix verification before features** |
| Reconciliation | 1.3 | Source ↔ target with declared expected-loss allowances |
| Idempotency | — | **Works.** The re-run guard is real and tested |
| Partial failures | — | **Works.** Rollback is transactional and the log survives it |
| Rollback / recovery | 9.3 | Fresh-database + connection-switch |
| Re-import | 9.2 | **Missing.** No delta path |
| Cutover | 9.3 | Runbook |

### Compatibility classification

| Class | Meaning | Examples |
| ----- | ------- | -------- |
| **EXACT** | Reproduce bit-for-bit | `SELECT DISTINCT` (372→372) · joins (10→10) · custom functions (593→593) · page setup (923→923) · parameters · totals · sorts · format masks |
| **SEMANTIC** | Same result, different mechanism | Fan-trap resolution · calculated fields (token → SQL) · conditions · hierarchies · grants · item classes |
| **MODERN EQUIVALENT** | Deliberately different, better | Summary folders → **Oracle's own query rewrite** (D-076) · `EUL4_PLAN_TABLE` → `DBMS_XPLAN` · stateless HTTP vs client-server sessions · bcrypt vs EUL passwords · XLSX/CSV vs PDF/HTML/text · **RLS fails closed** (D-090) |
| **UNSUPPORTED** | Will not do | Percentages, graphs, crosstab axis edge — **ABSENT IN SOURCE**, nothing to recover · fonts and colours · show-nulls-as · `EUL4_SEQUENCES`/`_GATEWAYS`/`_FREQ_UNITS` |
| **MANUAL** | Human decision at cutover | The nine `EUL4_B*Q*R1` historical result tables — **decide retention before decommissioning the source** · user credential re-provisioning · the date-hierarchy regeneration decision (D-074) |

> **The "ABSENT IN SOURCE" band matters more than its size.** Scoring those as gaps — as the
> audit's first pass did — would have funded work with nothing to recover. **Score this matrix
> against the parser and the container, not against the migrated data.** An empty target
> column has four distinct causes — absent in source, parser gap, transformer drop, stale
> build — with wildly different costs.

---

## 5. The legacy validation programme

**How the plan proves migrated worksheets behave correctly:**

| Tier | Test | Phase | Status today |
| ---- | ---- | ----- | ------------ |
| **1 — Structural** | Row counts source vs target with declared expected-loss; referential closure within query scope | 1.3 | **Missing** — would have caught F-01 alone |
| **2 — Generative** | `loadMapDefinition()` + `generateSql()` for all 923; formula compile rate over all 49 819 | 1.3, 4.5 | **Missing — the absent gate** |
| **2b — Decision** | The planner-decision histogram; `REFUSE > 0 && FLAT < 923` | 3.4 | New (D-037) |
| **3 — Executional** | Stratified sample against live Oracle, chosen by `EUL4_QPP_STATS`' 7 316 executions | 9.1 | **Missing** |
| **4 — Output equivalence** | Same worksheet in legacy Discoverer and in Neo, result sets diffed | 9.1 | **Missing — the real bar** |

**Existing evidence to build on, not duplicate:**
- **`d4wkdmp.exe`** and **547 reference dumps** — Oracle's own decoder. Already proves the
  parser at 99.5–100 % on item identity, functions, parameters and condition formulas.
- **`DisplayFormula`** — 37 971 rendered formulas, the exact oracle for the token renderer.
- **`DISCVR4/VIDSTR4.DIS`** — Oracle's own sample workbook, the crosstab positive control.
- **The differ harness** — *"the single highest-leverage change available to this project's
  testing story"* is to check in a fixture corpus and gate CI on its agreement rates.

---

## 6. The frontend programme

Treated as a product, not a set of CRUD pages. Full contract in `research/ux-analysis.md`.

| Area | Phase |
| ---- | ----- |
| Information architecture · navigation | 2.1, 7.1 |
| Maps list / browse | 2.1 |
| Map viewer · Run · parameter prompts | 2.2 |
| Error states · refusal UI · global boundary | 2.2 |
| Dashboard | 2.3 |
| Map builder · query builder | exists; extended in 5.2, 7.3 |
| Data exploration · crosstab · drill | 7.3 |
| Conditional formatting | 7.3 |
| Administration surfaces | exist and are substantial |
| Migration UI (bucket partition, histogram) | 4.5, 3.4 |
| Scheduling UI | exists; wired in 7.2 |
| Exports | 7.3 |
| Security UI | exists; extended in 6.3 |
| Loading / empty / error states | 2.1–2.3 |
| Accessibility | 2.3, then a dedicated pass |
| Responsive · theming · localisation | exist and are good — **protect them** |
| User preferences | exists |
| Design system / token pass | after Phase 7 |

**Four rules, non-negotiable:** no placeholder in a value slot · empty states tell the truth ·
no silent failure · refusals are a first-class state with a next step. **Governed, not
free-form** — refuse drag-anywhere canvases; the governed semantic layer *is* the thing being
migrated.

---

## 7. The security programme

Full model in `research/security-analysis.md`.

| Concern | Phase |
| ------- | ----- |
| Secrets · credential encryption | **0.2** |
| Cleartext credentials in `audit_log` | **0.2** |
| Object-level access (IDOR) | 6.2 |
| Authorization (two gates) | **1.1** |
| Row-level security | **1.1** (must not regress), 6.3 (fail-closed) |
| Authentication · token lifecycle | 6.1 |
| SQL safety | **already sound — protect it** |
| Audit logging | 0.2 (redaction), 6.4 (reads) |
| Rate limiting | 6.1 |
| Security headers · CORS | 6.4 |
| Dependencies | 6.4 |
| Docker | 6.4, 8.1 |
| Exports | **already sound** — ownership-gated, UUID paths, no traversal |
| Operational security | 8.3, 9.3 |

**Two ordering constraints:** the RLS and two-gate fixes ship **with** the scoping commit
(they are caused by it); redaction ships **before** read auditing (auditing more requests
with an exact-match redactor multiplies the exposure).

---

## 8. The testing programme

| Class | Phase | Note |
| ----- | ----- | ---- |
| Unit | throughout | Genuinely good already. `generateSql(def)` is pure and properly unit-testable |
| Integration | throughout | 14 real files exist |
| **Migration → execution seam** | **1.3** | **The absent test that would have caught every CRITICAL finding** |
| **Formula compile rate** | **1.3, 4.5** | Four-bucket partition; `FAILED = 0` |
| **Referential closure** | **1.3** | Within query scope |
| **Source ↔ target reconciliation** | **1.3** | Declared expected-loss allowances |
| **Planner-decision histogram** | **3.4** | `REFUSE > 0 && FLAT < 923` |
| Oracle integration | 9.1 | `oracledb` is mocked throughout today |
| API | throughout | |
| Frontend | 2.x | Remove the tests that pin placeholders |
| E2E | 2.3 | 9 Playwright specs exist and have **never run in CI** |
| Security | 6.x | RLS fail-closed is the key one |
| Performance | 8.2 | `PERFORMANCE.md` exists; no reproducible benchmark |
| Compatibility / regression | 1.3 onward | **The `d4wkdmp` differ, promoted into CI** |
| Export correctness | 7.3 | |

**Hygiene, once:** move infrastructure-dependent tests out of the unit directory (~250 s of
the run is DB-bound work presented as a unit suite); gate on **branch** coverage (56.1 %, not
the claimed >80 %), not lines; regenerate coverage in CI.

**How expected behaviour is established for migration:** Oracle's own decoder output (tiers 1–2)
and Oracle's own running system (tiers 3–4). Not from our own fixtures — *"every test verifies
a component against its own fixtures, and no test verifies the system against reality."*

---

## 9. The documentation programme

| Category | Phase | Note |
| -------- | ----- | ---- |
| Architecture | 1.1, 3.3 | Record the plan type and the summary/RLS invariant |
| Development | 0.1 | Correct `CLAUDE.md`'s claims about `.claude/agents/` and `skills/` |
| **API** | **8.4** | Generate from live Swagger — the hand-written file is **51 % accurate** |
| Migration | 4.1, 5.x, 9.3 | Decoder spec; compatibility classification; cutover runbook |
| Deployment | 0.2, 8.1 | Key rotation; the production stack, once proven |
| Administration | 5.2, 6.3 | Item classes; the RLS model |
| User guide | 2.x, 3.3 | **The refusal explanation page** (D-036) |
| Security | 0.2, 6.x | The consolidated model |
| Operations | 8.2, 8.3 | Metrics; backup and restore |
| Troubleshooting | 3.3, 4.5 | Refusal rules; formula quarantine reasons |

All four locales (`en`, `es-ES`, `fr-FR`, `pt-PT`) stay in sync — they are complete today.

---

## 10. Model and effort strategy

**Opus** — architecture, legacy semantics, migration semantics, SQL generation, security
design, complex UI interaction, final review.
**Sonnet** — CRUD, straightforward implementation, ordinary tests, documentation, repetitive
refactoring.
**No Fable.** **Do not switch model or effort mid-session** (D-007) — a switch discards the
prompt cache and re-bills the whole context at write price.

---

## 11. Final roadmap matrix

| Phase | Stage | Objective | Deps | Model | Effort | Skills | Agents | MCP/Plugins | Deliverables | Quality gate |
| ----- | ----- | --------- | ---- | ----- | ------ | ------ | ------ | ----------- | ------------ | ------------ |
| 0 | 0.1 | Commit the tree, wire CI | — | Sonnet | med | — | — | git (Bash) | Committed tree, remote, green CI | CI passes on `master` |
| 0 | 0.2 | Credential remediation tier 0 | 0.1 | **Opus** | high | — | — | context-mode | Redactor, purge, boot guard, rotation | Zero cleartext in `audit_log`; prod boot refuses defaults |
| 0 | 0.3 | Read-only EUL probe | 0.1 | **Opus** | high | — | — | context-mode | `eul-probe-results.md`; D-040/D-110–113 closed | All 5 answered from live data |
| 1 | 1.1 | **The scoping commit** | 0.3 | **Opus** | **max** | — | — | context-mode | Derived scope + RLS + 2 gates + refusal | 1 map executes; RLS test with NULL BA; multi-folder refuses |
| 1 | 1.2 | Visibility, schema unification | 1.1 | **Opus** | high | — | — | typescript-lsp | `/api/maps`, schema merge, `group_id` | 923 visible; schema drift fails typecheck |
| 1 | 1.3 | Four seam tests + verifier | 1.2 | **Opus** | high | — | — | context-mode | Seam tests, `dn-migrate verify`, differ in CI | **Readiness refuses "ready" today** |
| 2 | 2.1 | Maps list | 1.2 | Sonnet | high | frontend-design | — | Claude_Browser | Real list, filters, actions | 923 findable; truthful empty state |
| 2 | 2.2 | Wire Run + error surface | 2.1 | **Opus** | high | frontend-design | — | Claude_Browser | Run, prompts, boundary, refusal UI | No path produces silence |
| 2 | 2.3 | Dashboard truth pass | 2.2 | Sonnet | med | — | — | Claude_Browser, playwright | Placeholders gone; a11y fixes | No prose in `<h*>`; a11y E2E green |
| 3 | 3.1 | Populate the measure set | 0.3, 1.3 | **Opus** | high | — | — | context-mode | `agg_function` + axis/measure split | Non-null measures across the estate |
| 3 | 3.2 | Join model | 3.1 | **Opus** | **max** | — | — | typescript-lsp | `join_predicates`, 4 flags, operator | 10 joins carry predicates; flag matrix tested |
| 3 | 3.3 | **The query planner** | 3.2 | **Opus** | **max** | — | — | context-mode | Plan type, planner, refusal rules | Oracle's worked example reproduced |
| 3 | 3.4 | Enable multi-folder | 3.3 | **Opus** | high | — | — | context-mode | Interim refusal removed; histogram | **`REFUSE > 0 && FLAT < 923`** |
| 4 | 4.1 | Corpus fixture + code fitting | 1.3 | **Opus** | **max** | — | — | context-mode | Fixture, 56-code table, spec | Every code attested or refuse-only |
| 4 | 4.2 | Top-10 renderer | 4.1 | **Opus** | **max** | — | — | typescript-lsp | Renderer, fully parenthesised | **≥ 93 % exact vs `DisplayFormula`** |
| 4 | 4.3 | Tail + custom fns + dates | 4.2 | **Opus** | high | — | — | context-mode | 46 codes, `[2,n]`, `[5,4]` | **≥ 99 % exact; `FAILED = 0`** |
| 4 | 4.4 | Calc-ref expansion + CI gate | 4.3 | **Opus** | high | — | — | context-mode | Recursive expansion, CI gate | 2 536 chains resolve |
| 4 | 4.5 | Compile the estate | 4.4 | **Opus** | high | — | — | context-mode | Four-bucket partition as blockers | Readiness refuses while `FAILED > 0` |
| 5 | 5.1 | EUL4 object-link resolver | 1.3 | **Opus** | high | — | — | context-mode | Hierarchies + grants | Reconciliation passes without exception |
| 5 | 5.2 | Item classes / LOVs | 5.1 | **Opus** | high | — | — | context-mode | `item_classes`, live LOVs | Parameters render pick-lists |
| 5 | 5.3 | Condition fidelity | 5.1 | Sonnet* | high | — | — | typescript-lsp | `negated`, case-sensitivity, calc refs | `NOT` no longer refused |
| 5 | 5.4 | Population fidelity | 5.1 | Sonnet | high | — | — | context-mode | Multi-BA, layouts, formats, widths | `map_layouts` count = `maps` count |
| 6 | 6.1 | Token lifecycle | 0.2 | **Opus** | high | — | — | context7 | Blacklist, refresh tokens, lockout | Deactivated refresh fails immediately |
| 6 | 6.2 | Object-level authz | 6.1 | **Opus** | high | — | — | typescript-lsp | Entity scoping, UPDATE validation | Non-admin cannot read foreign folders |
| 6 | 6.3 | RLS fail-closed | 6.2, 5.2 | **Opus** | **max** | — | — | context-mode | Fail-closed, COMPLEX refusal | No policy ⇒ no rows |
| 6 | 6.4 | Exposure + hygiene | 6.3 | Sonnet | med | — | — | context7 | CORS, metrics, CVEs, read audit | 0 high advisories; scanning in CI |
| 7 | 7.1 | `workbooks` aggregate | 2.3, 1.1 | Opus/Sonnet | high | — | — | typescript-lsp | Table + UI | 564 workbooks browse |
| 7 | 7.2 | Scheduled workbooks | 7.1 | Sonnet | high | — | — | context-mode | `EUL4_BATCH_*` migrated | Schedules run from migrated defs |
| 7 | 7.3 | Exports, crosstab, drill | 7.1, 5.x | Sonnet | med | frontend-design | — | Claude_Browser | XLSX/CSV, crosstab, formats, print | Export matches on-screen rows |
| 8 | 8.1 | Prove the prod stack | 0.1 | Sonnet | high | — | — | context-mode | `compose.prod` run; `/health` fixed | Health red when deps are down |
| 8 | 8.2 | Observability | 8.1 | Sonnet | med | — | — | — | Pool/queue/migration metrics | Metrics present under load |
| 8 | 8.3 | Durability | 8.1 | Sonnet | med | — | — | — | Backups, Redis AOF, txn | Restore proven from a real dump |
| 8 | 8.4 | Documentation | 8.1 | Sonnet | high | — | — | context-mode | API docs from Swagger; stale docs retired | Docs match live routes |
| 9 | 9.1 | Result-set equivalence | 3.4, 4.5, 5.x | **Opus** | **max** | — | — | context-mode | Neo vs Discoverer differ | Sampled worksheets match |
| 9 | 9.2 | Incremental re-import | 9.1 | **Opus** | high | — | — | context-mode | Delta path | Re-import changes only |
| 9 | 9.3 | Cutover runbook | 9.2 | Sonnet | med | — | — | — | Runbook, rollback, re-provisioning | Rehearsed once end to end |

\* Opus for the parser change within 5.3.

**Agents column is empty by design.** Every stage is single-context work.
`AUDIT_TOOLING_REQUIREMENTS.md` §5: *"The four highest-value remaining tasks are all
single-context work."* **Execute specialist agents serially if you use them at all** — the
token budget, not parallelism, is the limiting factor (D-005).

---

## 12. Traceability

Every finding maps to a phase, or is explicitly rejected.

**CRITICAL** — `F-01`→1.1 · `F-02`→4.5 · `F-02b`→1.1 · `F-03`→0.2 · `DOC-04`→0.1 ·
`DOC-01`→8.4 · `SEC-02`→0.2 · `F-06`→2.1 · `F-07`→1.2 · `MIG-01`→3.2 · `LEG-04`→3.3 ·
`LEG-02`→3.2 · `BE-01`→3.4

**HIGH** — `DOC-02`→8.4 · `DOC-05`→8.4 · `SEC-01`→6.1 · `SEC-03`→6.2 · `SEC-04`→6.2 ·
`F-08`→2.2 · `LEG-05`→3.1 · `BE-02`→1.2 · `BE-03`→8.2 · `MIG-03`/`F-10`→5.1 · `F-12`→1.3 ·
`WB-01`→4.5 · `WB-03`→4.x · `F-21`→1.3 · `INF-02`→8.1 · `INF-03`→8.1 · `INF-04`→0.1 ·
`INF-05`→6.4 · `INF-06`→0.1

**MEDIUM** — `SEC-06`→6.3 · `MIG-06`→5.1 · `WB-05`→5.4 · `WB-04`→4.4

**Remaining** — `LEG-03`→3.2 · `LEG-06`→5.2 · `MIG-07`→5.1 · `BE-05`→4.5 · `BE-07`→3.3 ·
`BE-04`→8.2 · `BE-06`→8.2 · `BE-08`→8.3 · `BE-12`→1.1/1.2 · `F-11`→5.1 · `F-13`→2.3 ·
`F-14`→8.2 · `F-16`→6.4 · `F-17`→0.2 · `F-22`→1.3 · `F-23`→1.3 · `BE-09`→4.4 · `BE-10`→1.2 ·
`BE-11`→6.4 · `F-25`→5.3 · `F-27`/`MIG-05`→5.3 + **corrected by D-077** · `MIG-08`→5.4 ·
`F-32`→1.2 · `INF-08`→0.2 · `INF-09`→6.4 · `INF-10`→8.2 · `INF-11`→8.3 · `INF-12`→6.4 ·
`INF-13`→6.4 · `INF-14`→0.1 · `SEC-05`→6.1 · `SEC-07`→6.4 · `SEC-10`→6.4 · `SEC-11`→6.4 ·
`SEC-12`→6.1 · `INF-07`→0.2 · `F-26`→2.3 · `F-30`→2.3

**REJECTED — do not fund** (D-002): `F-09` · `F-18` · `F-19` · `F-20` (the *finding*; the
missing column is real → 5.3) · `F-05` · crosstab "loss" · `F-04` (the *code* claim; the data
re-import is real → 5.4) · `F-15` · lockfile drift

**Findings discovered during planning** — `A-1`/`D-040`→0.3 · `A-2`/`D-077`→6.3 ·
`B-1`/`D-015`→1.1 · `B-2`/`D-016`→1.1 · `B-3`/`D-014`→1.1 · `B-6`/`D-031`→3.1 ·
`B-11`/`D-072`→1.2 · `C-1`–`C-11`→Phase 4

**Positives to protect — not defects, and no phase may regress them**

`F-24` the PostgreSQL schema already models far more Discoverer semantics than the data
contains — crosstab edges, `map_type`, total kind and placement, format targets, sort rank and
group, column widths, alignment, word wrap, and **provenance** via `source_element_id` /
`source_attrs`. **Phases 5.4 and 7.3 populate and render it; neither may remove modelled
capability to match unpopulated data.** ·
`INF-17` `backup.sh` / `restore.sh` are real and good — Phase 8.3 uses them rather than
replacing them ·
the workbook parser and its `d4wkdmp` differ ·
bind variables everywhere and identifier **rejection** rather than escaping ·
unconditional security-predicate bracketing ·
ownership-gated exports with UUID paths and no traversal ·
admin-gated migration routes · the API's credential redaction ·
the `!migrat` sentinel failing closed ·
`ResultsTable`'s drop-to-plain-grid on re-sort ·
four complete locales and three themes ·
`test-database-guard.test.ts`
