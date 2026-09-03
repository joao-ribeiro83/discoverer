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
