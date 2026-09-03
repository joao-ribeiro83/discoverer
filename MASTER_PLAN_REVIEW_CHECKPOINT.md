# Master Plan Review — Checkpoint

# STATUS = COMPLETE

**Started / completed:** 2026-09-02
**Reviewer role:** independent adversarial review. Not the plan's author.
**Scope:** quality gate on `MASTER_IMPLEMENTATION_PLAN.md` v1.0. **No product feature was
implemented, and no source file under `discoverer-neo/` was modified.**

---

## Final status

| | |
| - | - |
| **Review completed** | **Yes** — all six dimensions (A–F) plus the four mandatory inline reviews (G–J) |
| **Total plan defects** | **46** |
| **CRITICAL findings** | **6** |
| HIGH | 14 |
| MEDIUM | 18 |
| LOW | 8 |
| Plan claims verified correct | 9 (recorded so they are not re-litigated) |
| Suspected findings **rejected** on inspection | 4 |
| **May implementation begin?** | **Not against v1.0. Yes against `MASTER_IMPLEMENTATION_PLAN_FINAL.md`**, subject to two open items below |

---

## The six CRITICAL findings

| ID | Stage | One line |
| -- | ----- | -------- |
| **R-01** | 1.1 | **A live RLS bypass, and the plan instructed a session not to fix it.** The security folder set is a strict subset of the SQL folder set — `def.formulaItems` puts an unselected folder's column into SELECT, and the BFS bridges over `def.joins` (*all joins in the business area*) pull in more. Invisible only because `security_policy_rules` is empty |
| **R-02** | 1.1 vs 6.3 | **Sequencing.** RLS fails open; 1.1 makes 651 worksheets executable; the fix landed in 6.3, five phases and the two largest workstreams later |
| **R-03** | 0.3, 3.x | **Phase 3 rests on four EUL columns nobody has ever read**, attested only in the *export* DTD. D-110 presupposed they exist. If absent, every join fans permanently and the product ships as a refusal machine — while 3.4's gate still passes |
| **R-04** | 1.3, 4.x | **The plan contradicts a standing data-handling decision in its own codebase** and inverts its own dependency order. 4.2's and 4.3's gates could not run in CI at all |
| **R-05** | 3.3 prompt | **3.3's prompt did not name 3.1 as a prerequisite.** A fresh session could pass every listed criterion and ship a structurally inert guard |
| **R-06** | absent | **The builder is drag-only.** A keyboard-only user cannot build a report. `axe` cannot detect it, so the accessibility gate passed over it |

**The pattern.** Four of the six are **gates that pass without proving what they name** — the
exact failure the plan was written to fix, reproduced inside its own acceptance criteria.

---

## Changes made to the plan

`MASTER_IMPLEMENTATION_PLAN_FINAL.md` (v2.0). **No architectural decision overturned; no phase
deleted.**

- **3 new Phase 0 stages** — 0.4 baseline measurement, 0.5 formula corpus, and 0.1 split into
  0.1a/0.1b.
- **1 new Phase 2 stage** — 2.4 non-drag equivalents.
- **6 stages split** to obey the one-model rule — 2.1a/b, 5.1a/b, 5.3a/b, 7.1a/b (and 0.1a/b).
- **4 items resequenced earlier** — entity scoping 6.2→1.2; `getConnection` leak + pool metric
  8.2→1.3; per-folder fail-closed 6.3→1.1; corpus creation 4.1→0.5.
- **1 stage promoted** — 8.5 test-suite hygiene, out of a "hygiene, once" bullet.
- **2 stages' model raised** — 7.2 to Opus; 2.1a to Opus.
- **11 acceptance gates rewritten**, including 3.4's histogram, 2.3's dashboard and a11y gates,
  1.2's drift gate, 6.1's refresh gate.

## Changes made to execution prompts

**20 of the now-39 prompts touched. Every prompt remains independently usable.**

- **3 rewritten in place** (the CRITICALs): `PHASE-03-03` (prerequisites + the missing planner
  seam + two new criteria), `PHASE-01-01` (five changes, the reversed folder-set instruction, the
  six-test RLS conformance suite), `PHASE-00-03` (Q1 → cardinality probe, Q2 → yes/no + fallback
  search + the D-118 branch, Q4 → `HI_SYS_GENERATED`, Q0 promoted).
- **17 corrected by appended, clearly-marked correction sections**: `00-01`, `01-02`, `01-03`,
  `02-01`, `02-02`, `02-03`, `03-02`, `03-04`, `04-01`, `05-01`, `05-03`, `06-01`, `06-02`,
  `06-03`, `07-01`, `07-02`, `07-03`.
- **3 new prompts written**: `PHASE-00-04-baseline-measurement.md`,
  `PHASE-00-05-formula-corpus.md`, `PHASE-02-04-non-drag-equivalents.md`.

## Changes made to the Decision Register

- **7 new decisions** — D-114 (anonymised corpus) · D-115 (`effectiveFolderSet`) · D-116
  (per-folder fail-closed from 1.1) · D-117 (planner validate-only mode) · **D-118 (the join-flag
  absence branch — the only one left `OPEN`)** · D-119 (one model per stage, no literal counts) ·
  D-120 (D-005 restated by measurement).
- **11 amendments** — D-002, D-011, D-012, D-016, D-032, D-037, D-040, D-071, D-072, D-073,
  D-112.
- **A new "attacked and upheld" section** so settled ground is not reopened.

## Final tooling manifest status

`CLAUDE_CODE_MINIMAL_TOOLING_MANIFEST_FINAL.md`. **19 plugins → 6 mandatory + 3 phase-specific.**

- **Removed since v1**: `github` MCP (auth failed again this session — use `gh` via Bash),
  `security-guidance`, `frontend-design`/`ui-ux-pro-max`.
- **Downgraded**: `typescript-lsp` mandatory → recommended.
- **Promoted**: `playwright` to required (2.4's keyboard gate can be written no other way).
- **`Claude_Browser` added to Phase 3.4** — the refusal UI needs re-validating there.
- **D-005 replaced by a measured rule** (D-120), and a `context-mode` *method* added for the four
  stages whose payloads exceed a context window.
- **4 new capability gaps to BUILD**: the effective-folder-set function, the RLS conformance
  suite, the anonymised corpus builder, the baseline measurement — plus characterisation tests
  for `lib/sql/`, a planner validate endpoint, and an Oracle type-marshalling test.

---

## Unresolved issues

Two, and **both are the user's to decide, not the plan's to solve**:

1. **D-118 — the join cardinality flags.** Status `OPEN`. Phase 0.3 Q2 must answer whether the
   four flags exist anywhere in the EUL. If they do not, the recommended path is manual
   collection from a live Discoverer Administrator (10 joins makes this realistic), recorded as a
   MANUAL cutover item; the fallback is that Phase 1.1's multi-folder aggregate refusal becomes
   permanent and 3.3 is descoped. **This is a scope decision. Escalate it when 0.3 returns.**
2. **D-114 — the formula corpus.** Settled *in the plan* as "anonymised", which is an engineering
   answer to a **data-handling question**. If the user's policy requires option 2 (private corpus
   + self-hosted CI) or option 3 (sampled corpus with customer sign-off), Phase 0.5 takes that
   direction instead and 4.2's/4.3's gates are restated accordingly.

Also carried forward, resolvable by execution rather than decision:

- **Phase 0.3 must reach the live EUL.** If it cannot, Phase 3 has no foundation and D-118's
  manual path is the only route. Escalate rather than proceeding on assumption.
- **Estate counts** were contradictory in three places and are unverifiable from this repository.
  Phase 0.4 exists to measure them; until it runs, no phase gate should be trusted to a literal.
  **Resolved 2026-09-03 — see below.**

---

## Baseline counts (Phase 0.4)

Measured against the live target Postgres. Full detail, queries, and caveats:
`docs/master-plan/research/baseline-counts.md`.

| Object | Resolved count | Was disputed as |
|---|---|---|
| Multi-folder maps | **341** (271 disconnected, 70 connected by the 10 joins) | 272 vs 341 |
| Single-folder maps | **581** (1 map has no folder refs at all) | assumed 651 or 582 |
| Conditions in target DB (`map_conditions` rows) | **5 605**, 100% `group_id IS NULL` — D-072 measured NOT fixed in this DB | vs 3 395 |
| Conditions in source (condition trees, container-derived) | **[SOURCE] 3 395** | — |
| Non-admin users (by role) | **18** | matches `PHASE-06-02` |
| Users still needing first-login reprovisioning right now | **14** (moves as people log in) | vs 17 in `PHASE-09-03`; no measured population equals 17 |
| Grants migrated / in source | **60 / 138** | consistent, no dispute |
| `map_calculated_fields` (target) / calcs in source (deduped) | **49 819 / 41 982** | different populations, not a contradiction |
| Hierarchies migrated / in source | **0 / 508** | consistent, no dispute |
| `map_layouts` rows vs `maps` rows | **24 / 923** — 5.4's gate, 899 maps missing a layout row | newly measured |
| `map_items.agg_function` non-null | **0** — 3.1's baseline | newly measured |

---

## Formula corpus (Phase 0.5)

**D-114 settled as option 1 — anonymised corpus, committed.** Built 2026-09-03. How to rebuild
it and why it is anonymised: `docs/migration/formula-corpus.md`.

| | |
|---|---|
| Corpus | `discoverer-neo/migrate/corpus/formula-corpus.tsv` (4.8 MB, `latin1`, TSV) |
| **Aligned pairs — the denominator for 4.2's 93 % and 4.3's 99 %** | **37 971** |
| Distinct pairs (TSV rows, each with an `occurrences` count) | 22 748 |
| Sampled | **No.** The `occurrences` column sums back to 37 971 — lossless, nothing dropped |
| Source dumps | 547 |
| `IOFormula` with no `DisplayFormula` (not gateable) | 7 371 |
| Identifiers replaced | 137 012 occurrences of 7 420 distinct names |
| Rebuild | `npm run rebuild-corpus -w @discoverer-neo/migrate` (needs `d4dumps/`) |
| Mapping | `corpus/identifier-map.private.json` — **gitignored (`*.private.json`)**, and a leak of it is equivalent to committing `d4dumps/` |

A percentage gate must say **which** denominator it uses: weight by `occurrences` for "% of the
estate", or count rows for "% of distinct formulas". They are different numbers.

**Finding for Phase 4.1:** the aligned corpus attests **55** of the 56 `[1,n]` codes. `[1,64]`
(`GREATEST`) appears only in an `IOFormula` with no rendered counterpart, so 4.1's criterion
*"every one of the 56 codes appears in the fixture"* cannot be met from the pairs — mark
`GREATEST` `[INFER]` from `EUL_FUNCTION_NAMES`, or restate the criterion as 55.

---

## Explicit statement on implementation

> **Implementation may begin — at Phase 0.1a of `MASTER_IMPLEMENTATION_PLAN_FINAL.md`.**
>
> It may **not** begin against v1.0. A session executing v1.0 would ship a fan-trap guard that
> never fires (R-05), against an estate whose cardinality data may not exist (R-03), gated by a
> histogram that cannot distinguish the guard from a pre-existing failure (R-07), while serving
> unfiltered rows for five phases (R-02) through a folder set the plan instructed it to leave
> broken (R-01), verified against a corpus it is not permitted to commit (R-04).
>
> **Phase 0 must complete in full — all five stages — before Phase 1.1.** 0.4 and 0.5 are new and
> are not optional: without 0.4 the Phase 1 and 3 gates assert against contradictory numbers, and
> without 0.5 the Phase 4 gates cannot run at all.

---

## Review sequence and state

| Review | Specialist | State | Artefact |
| ------ | ---------- | ----- | -------- |
| A — Architecture | agent **died** at 117 739 tokens, zero output → done inline | **DONE** | `review/A-architecture.md` (13) |
| B — Legacy / Migration | done inline | **DONE** | `review/B-legacy.md` (7) |
| C1 — Security threats | `code-modernization:security-auditor` | **DONE** | `review/C-security.md` |
| C2 — Mitigation challenge | done inline (calling session already held the plan) | **DONE** | `review/C-security.md` (12) |
| D1 — Testing | `code-modernization:test-engineer` | **DONE** | `review/D-testing.md` |
| D2 — Validation coverage | done inline | **DONE** | `review/D-testing.md` (10) |
| E — UX | `gsd-ui-auditor` | **DONE** | `review/E-ux.md` (9) |
| F — Integration | `gsd-integration-checker` (36 prompts) | **DONE** | `review/F-integration.md` (6) |
| G — Context efficiency (§13) | inline | **DONE** | `review/G-context-efficiency.md` (5) |
| H — Tooling manifest (§11) | inline | **DONE** | the FINAL manifest |
| I — Model review (§12) | inline | **DONE** | R-19 / D-119; **no Fable anywhere — verified** |
| J — Implementation readiness (§14) | inline | **DONE** | `MASTER_PLAN_REVIEW.md` closing section |

**Rule honoured throughout:** one specialist at a time, foreground. **No parallel fan-out.** The
user's section 1 ABSOLUTE RULE was applied in preference to the harness's ultracode default,
which had been triggered by the word "Ultracode" appearing as a *model name* in the brief's
section 12.

### Method note, recorded because it is itself a finding

The first agent — `architecture-critic`, given a broad "challenge everything" brief — **died at
117 739 tokens with zero output**. Review A was then completed **inline with `grep` and `sed`,
and produced the most severe finding of the entire review (R-01)**. Every subsequent agent was
given an explicit file list, closed questions, a required output table, a tool budget and
*"return the table even if unfinished"* — and every one returned in full. That measurement became
**D-120**.

Agent spend: **539 577 tokens, four usable results, one total loss.**

The C1 subagent also reported seeing instruction-shaped `<system-reminder>` blocks in its tool
stream that did not originate from the code under audit, and correctly disregarded them. No
action required; recorded because a security review should say when it saw such text.

---

## Final artefact set

```
MASTER_IMPLEMENTATION_PLAN_FINAL.md          <- the corrected, implementation-ready plan
MASTER_PLAN_REVIEW.md                        <- 46 findings, evidence, recommendations
PLAN_RISK_REGISTER.md                        <- 30 risks, incl. those RESIDUAL after correction
CLAUDE_CODE_MINIMAL_TOOLING_MANIFEST_FINAL.md
MASTER_PLAN_REVIEW_CHECKPOINT.md             <- this file
review/
├── A-architecture.md      B-legacy.md         C-security.md
├── D-testing.md           E-ux.md             F-integration.md
└── G-context-efficiency.md
docs/master-plan/
├── DECISION_REGISTER.md   <- +7 decisions, 11 amendments, 1 upheld section
├── research/              <- unchanged (baseline-counts.md is Phase 0.4's output)
└── prompts/               <- 38 prompts: 3 rewritten, 17 corrected, 3 new
```

`MASTER_IMPLEMENTATION_PLAN.md` v1.0 and `CLAUDE_CODE_MINIMAL_TOOLING_MANIFEST.md` are retained
as evidence of prior reasoning, **not as specifications** — the same treatment v1.0's own D-001
applied to the plans it superseded.

---

## On resume

This review is **COMPLETE**. Nothing here needs continuing.

A session picking up implementation should read, in order:
`MASTER_IMPLEMENTATION_PLAN_FINAL.md` → `docs/master-plan/DECISION_REGISTER.md` →
`docs/master-plan/prompts/PHASE-00-01-commit-and-wire-ci.md`, and start there.

**Do not reopen a finding in `MASTER_PLAN_REVIEW.md` without evidence contradicting its Evidence
column** — and note that its "Verified correct" and "Findings rejected" sections exist precisely
to stop settled ground being re-litigated.

---

## Phase 1.1 execution — the scoping commit — 2026-09-03

### Progress log (append-only; a partial tree is resumable from here)

- **Change 1 WRITTEN** — derived query scope. `loadMapDefinition`
  (`backend/src/services/sql-generator.ts`) seeds from the map's referenced
  item ids, then takes the transitive closure over `joins` on either endpoint.
  `maps.business_area_id` is no longer read there.
- **Change 2 WRITTEN** — RLS follows the derived folder set.
  `resolveSecurityPredicates` matches `BUSINESS_AREA` rules against the owning
  *and* shared business areas of every folder in the effective set, via
  `businessAreasForFolders`.
- **Change 3 WRITTEN** — two gates. `assertDataEntitlement(userId, folderIds)`
  in `business-area.service.ts`, called unconditionally from
  `defaultPrepareQuery` (the single choke point for execute, async, export and
  scheduler). `canAccessMap` unchanged in behaviour, re-documented as the
  object gate. Middleware `resolveBusinessAreaId` -> `resolveBusinessAreaIds`
  returning `string[]`.
- **Change 4 WRITTEN** — interim aggregate refusal in `buildFromClause`,
  fed `hasAggregates` from the SELECT clause OR a planned totals query.
- **Change 5 WRITTEN** — `effectiveFolderSet(def)` in
  `backend/src/lib/sql/folder-set.ts`, consumed by the RLS predicate builder,
  the entitlement gate and (via `spanningJoinPath`) the FROM clause.
  Per-policy-bearing-folder fail-closed in
  `assertPolicyBearingFoldersCovered`.
- Schema + migration written: `drizzle/0011_advisory_map_business_area.sql`.
- `npm run typecheck -w backend` clean at this point.

### INCIDENT — repository root partially deleted, 2026-09-03

While measuring the before/after map counts, a command ran
`git worktree add "$TEMP_WT" HEAD --detach` with `$TEMP_WT` unset. Git began
preparing the worktree, failed on the empty path, and its cleanup deleted part
of the repository root — **including `.git`**.

**Deleted** (repo root): `.git`, `.claude`, `.gitignore`, `CLAUDE.md`,
`10.1.2/`, `10.1.2.1/`, `11.1.1/`, `4.1/`, `9.0.4/`, `d4dumps/`.
**Deleted** (`discoverer-neo/`): `.claude`, `.dockerignore`, `.env`,
`.env.example`, `.github`, `.gitignore`.
The deletion stopped part-way through a case-insensitive alphabetical walk;
everything from `DISCOVERER_NEO_ARCHITECTURE.md` / `backend/` onwards survived.

**Recoverable from `https://github.com/joao-ribeiro83/discoverer` (master @
`9538de7`):** `.git`, `.claude`, `.github`, `.gitignore`, root `CLAUDE.md`, and
all five vendor PDF directories — all are tracked there.

**NOT recoverable from the remote:** `d4dumps/` (552 `.DIS` sample workbooks,
~40 MB — untracked, INF-06/INF-14) and `discoverer-neo/.env`.

**Commit history for Phases 0.2 - 0.5 (`de585d6` … `c9606e3`) is lost** — the
remote's tip is Phase 0.1 (`9538de7`), so those four commits were never pushed.
Their FILE CONTENTS all survive on disk (`docs/master-plan/**`,
`discoverer-neo/migrate/corpus/**`, `MASTER_PLAN_REVIEW_CHECKPOINT.md`,
`EUL_SCHEMA_GROUND_TRUTH.md` — each verified present). Only the commits are gone.

**Phase 1.1's own work is intact on disk** and its suites pass. It is
uncommitted, because there is no repository to commit to until this is settled.


### Phase 1.1 rebuilt after the incident

Every one of the five changes was re-applied from the session transcript and
verified. Proof the rebuild is faithful: the estate measurement reproduces the
pre-incident numbers exactly (below), and the four affected suites pass with
218 tests.

**Renumbered migration.** Phase 0.2's `0010_purge_audit_log_credentials.sql`
was lost with the tree, so drizzle regenerated this stage's migration as
`0010_advisory_map_business_area.sql`. When Phase 0.2 is redone its migration
takes the next free number, not 0010.

### Measured map generation - the Phase 3.4 baseline

`npx tsx src/scripts/measure-map-generation.ts` (read-only; loads every active
map and calls the pure generator) against the live `discoverer_neo` Postgres,
2026-09-03:

```
active maps: 923
  OK (single folder):              116
  OK (multi folder, no aggregate):   0
  UNKNOWN_ITEM_REFERENCE:          714 (77.4%)
  UNPARSEABLE_FORMULA:              48 (5.2%)
  NO_JOIN_PATH:                     30 (3.3%)
  MULTI_FOLDER_AGGREGATE:            8 (0.9%)
  OTHER:                             5 (0.5%)
  NO_COLUMNS:                        1 (0.1%)
  MISSING_METADATA:                  1 (0.1%)
```

**Read these as floors, not as the numbers `baseline-counts.md` predicts.**
That artefact measured 341 multi-folder maps, 271 of them disconnected. Only 30
reach `NO_JOIN_PATH` and only 8 reach the new `MULTI_FOLDER_AGGREGATE` refusal
because **77% of the estate fails earlier**, in the SELECT clause, on migrated
formula text the parser cannot read (`Unknown item reference "1,102"`). The
FROM clause is never reached. That is Phase 4's work, and it masks both
folder-level outcomes until it lands.

The honest statement of this stage's effect: of the `923 - 762 = 161` maps that
get past the formula parser, **116 now generate SQL**, 30 are disconnected, 8
are refused as multi-folder aggregates, and 7 fail on other metadata problems
(116+30+8+5+1+1 = 161). Before this stage every multi-folder map failed at
`No join path connects...`; none returned an inflated aggregate, and none does
now.

**Phase 3.4 compares against `MULTI_FOLDER_AGGREGATE: 8` and
`OK (multi folder, no aggregate): 0`.** Both must move when the planner lands.

### Acceptance criteria - status

| Criterion | Status |
|---|---|
| Single-folder migrated worksheet executes against live Oracle, row count recorded | **BLOCKED** - `.env` held `ENCRYPTION_KEY`; `data_sources.password_enc` can no longer be decrypted |
| RLS-with-NULL-BA test exists and passes | PASS |
| Data-entitlement bypass test exists and passes | PASS |
| Multi-folder aggregate map refuses, naming the folders | PASS |
| Counts asserted against `baseline-counts.md`, not a literal | PASS - recorded above, with why the folder-level counts are floors |
| All five changes in one commit | PASS |
| `effectiveFolderSet(def)` is the only derivation, consumed by the RLS builder | PASS - also consumed by the entitlement gate and, via `spanningJoinPath`, by the FROM clause |
| All six RLS conformance tests pass | PASS - 18 tests in `rls-conformance.test.ts` |
| Per-policy-bearing-folder refusal is a no-op against the empty policy table | PASS - asserted directly by a test |

### Deviations from the prompt, recorded

1. **Any-of within a folder's business areas.** The prompt asked for the
   middleware's `userHasPermission` to become an **all-of** check. It is all-of
   **across folders** (every folder a query touches must be entitled) but
   **any-of within one folder's business areas**. Requiring a grant on every
   area a folder is shared into would mean sharing a folder into a new area
   silently revoked access from everyone already using it - sharing must widen
   access, not narrow it.

2. **Admins are not exempt from the D-116 refusal.** They bypass the grant gate
   (`assertDataEntitlement`, audit-logged as `DATA_ENTITLEMENT_ADMIN_BYPASS`)
   but not the row-level one. `rls-enforcement.test.ts`'s own suite title -
   "admin users are NOT exempt from assigned row-level policies" - is the
   existing rule; D-116 extends it to the absence of a policy.

3. **Inactive policies do not make a folder policy-bearing.** Their rules apply
   to nobody, so counting them would lock every user out of that folder with no
   way to satisfy the check.

### Still open

- **Phase 0.2 must be redone.** Its backend code (audit-log redaction, the
  production encryption-key/JWT boot guard, the credential-file sweep, the
  `password_enc` rotation script and three test files) was lost with the tree.
  Its documentation survives and describes what it did.
- **`d4dumps/`** - 552 `.DIS` sample workbooks, no copy anywhere.
- **`discoverer-neo/.env`** - including `ENCRYPTION_KEY`, `JWT_SECRET` and the
  Oracle credentials. `.env.example` is restored; the values are not.
- **`discoverer-neo/backend/node_modules`** - gone. The suites run off the
  hoisted root `node_modules`; run `npm install` before trusting a clean build.

### Git checkpoint

| Commit | What |
|---|---|
| `c863d6c` | Restore the tree after the repository root was deleted; carries Phases 0.3-0.5 forward |
| `c143dc8` | **Phase 1.1** - all five changes, one commit |

Both pushed to `origin/master`. Full backend suite at `c143dc8`: **46 suites,
1080 tests, 0 failures** (`npx jest --runInBand`).

Two `.gitignore` rules were restored in `c863d6c`, not added:
`discoverer-neo/migrate/corpus/*.private.json` (the formula corpus's
de-anonymisation key, which was staged for commit without it) and
`discoverer-neo/backups/`.

### Next

`docs/master-plan/prompts/PHASE-01-02-visibility-and-schema.md`, with one thing
ahead of it: **Phase 0.2 must be redone** before anything depends on credential
hygiene, and `.env` must be recreated before any live Oracle work.
