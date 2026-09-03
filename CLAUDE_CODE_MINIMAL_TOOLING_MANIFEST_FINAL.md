# Claude Code — Minimal Tooling Manifest (FINAL)

**Supersedes** `CLAUDE_CODE_MINIMAL_TOOLING_MANIFEST.md`, reviewed 2026-09-02.
**Purpose:** the smallest capability set that can execute `MASTER_IMPLEMENTATION_PLAN_FINAL.md`.
**Objective unchanged:** allow the MegaPack to be removed.

**Test applied to every retained item:** *would execution of the final Master Plan **materially
fail** without this capability?* Anything that merely helps is Optional, not Mandatory.

**Result: 19 plugins → 6 mandatory + 3 phase-specific. ~2 681 repository-local agents and skills
→ 0. Two MCP servers dropped from the previous manifest.**

---

## What changed from the previous manifest, and why

| Item | Was | Now | Reason |
| ---- | --- | --- | ------ |
| `typescript-lsp` | Mandatory | **Recommended** | Every cross-workspace fact this review needed came from `grep` and `sed`. It speeds up 1.2/3.x/4.x refactors; the plan does not *fail* without it |
| `security-guidance` | Phase 6 | **Removed** | Review C found Phase 6's work is sequencing corrections and five named code changes, not guidance-shaped. Nothing in it would have produced a finding |
| `frontend-design` / `ui-ux-pro-max` | Phase 2, pick one | **Removed** | Review E found the gaps are correctness, absence and accessibility — not visual design. The app already has shadcn/ui, three themes and four complete locales, which the plan says to **protect**, not restyle |
| `github` MCP | Conditional | **Removed — use `gh` via Bash** | Failed authentication again this session (`400 Authorization header is badly formatted`). The previous manifest already offered `gh` as the alternative. Stop carrying a broken server |
| `Agent` | Optional, "rare" | **Optional, with a required prompt shape** | See the measured rule below. The rule, not the frequency, is what determines whether a dispatch survives |
| `code-modernization` | "keep until Phase 3 lands" | **Keep until Phase 3 lands** — confirmed | Its `security-auditor` and `test-engineer` both returned high-value findings in *this* review. `architecture-critic` died. Keep the plugin, use the two that work |

---

## REQUIRED ACROSS PROJECT

| Name | Type | Phase | Why it would materially fail without it | Mandatory |
| ---- | ---- | ----- | --------------------------------------- | --------- |
| Bash · Read · Write · Edit · Grep · Glob | built-in | all | Every source-level finding in the audit, the plan, **and this review** — including the live RLS bypass (R-01), found with `grep` and `sed` | **Yes** |
| git via Bash | built-in | all | Commit-per-stage; the plan's resumability depends on it. Also `gh` for the remote and CI (replacing the broken `github` MCP) | **Yes** |
| `context-mode` | MCP | all | **Context-critical on four stages that handle payloads larger than a context window**: the 37 971-pair fixture (4.1/0.5), 49 819 formula compiles (4.5), the 923-map reconciliation (1.3), the result-set differ (9.1). See the usage rule below — the plan now says *how*, not just *what* | **Yes** |
| `claude-mem` | MCP | all | Session memory across a multi-week plan. It correctly warned that the repo's own EUL reference docs are fabricated — a wrong-source error that would have cost days | **Yes** |
| `code-review` **or** `coderabbit` — **exactly one** | plugin | all | Review gate on the four highest-risk diffs: the scoping commit (1.1, now five changes), the query planner (3.3), the token renderer (4.2), the auth work (6.1/6.2). **Two overlapping reviewers is waste** | **Yes (one)** |
| `playwright` | plugin | 1.3, 2.3, **2.4**, 7.3, 9.x | Promoted from phase-specific to required. 9 E2E specs must enter CI, the axe suite must extend to five uncovered routes, and **2.4's keyboard-only gate (R-06) can be written no other way** — `axe` cannot detect a drag barrier | **Yes** |

## RECOMMENDED — real value, not a failure point

| Name | Type | Phase | Purpose |
| ---- | ---- | ----- | ------- |
| `typescript-lsp` | plugin | 1.2, 3.x, 4.x | 100 % TypeScript monorepo; the `resolveBusinessAreaId` signature change alone touches four implementations and two consumers. Faster and safer than grep — but grep suffices |
| `ponytail` | plugin | all | A codebase with three parallel formula representations and a placeholder front page does not need more abstraction. The discipline is apt |

## PHASE-SPECIFIC

| Name | Type | Phase | Why | Mandatory |
| ---- | ---- | ----- | --- | --------- |
| `Claude_Browser` | MCP | **2**, **3.4**, 5.2, 7.3 | The frontend's defects are **invisible in source** — F-06, F-08, F-13, F-26 were found no other way. **New: 3.4 needs it**, to validate that the refusal UI built in 2.2 actually renders the planner's structured rules (R-18/F-04) | **Yes for 2 and 3.4** |
| `context7` | MCP | 0.2, 6.x, 8.x | Current docs for `node-oracledb` thick mode, Drizzle, Fastify, BullMQ, and CVE remediation. Training data will be stale | Yes |
| `code-modernization` | plugin | through Phase 3 | **Use only `security-auditor` and `test-engineer`** — both returned high-value findings in this review. `architecture-critic` died at 117 739 tokens with zero output; do not dispatch it. Remove the plugin once Phase 3 lands | Conditional |

## OPTIONAL

| Name | Type | Purpose |
| ---- | ---- | ------- |
| `Agent` (built-in) | built-in | Only under the prompt rule below. Never otherwise |

---

## REMOVE

| Item | Reason |
| ---- | ------ |
| `.claude/agents/` — **138 sub-agents** | Zero invocations across eleven sessions; 8 217 tokens per turn when enabled. **Already deleted in the working tree — 2 705 files staged.** Commit the deletion in **0.1b**, *with the `CLAUDE.md` correction in the same commit* (see R-41) |
| `.claude/skills/` — **~2 543 skills** | Same. 352 KB of descriptions for zero invocations |
| `superpowers` | Nothing in it was used across a full forensic audit, a planning session, **or this review**. Large surface, unproven value here |
| `feature-dev` | Overlaps `code-review` and the planning workflow already in use |
| `code-simplifier` | Overlaps `ponytail` and `code-review` |
| `jdtls-lsp`, `pyright-lsp` | **No Java or Python in this repository.** Pure overhead |
| `claude-md-management` | Two short `CLAUDE.md` files. Manual editing is cheaper |
| `andrej-karpathy-skills` | No demonstrated relevance to an Oracle BI migration |
| `claude-in-chrome` | Redundant with `Claude_Browser`, which was sufficient throughout. Also carries the user's **real logged-in sessions** — unnecessary exposure |
| `visualize`, `mcp-registry`, `scheduled-tasks`, `terminal` | Unused; no phase requires them |
| **`github` MCP** | **NEW.** Failing auth again this session. Use `gh` via Bash |
| **`security-guidance`** | **NEW.** Phase 6's work is sequencing and five named code changes |
| **`frontend-design` / `ui-ux-pro-max`** | **NEW.** The frontend gaps are correctness and accessibility. The design system exists and is to be protected |
| `code-review` **or** `coderabbit` | Keep exactly one |

---

## Capability gaps — these must be BUILT, not installed

They matter more than any plugin above. **Two are new from this review.**

| Gap | Why | Phase |
| --- | --- | ----- |
| **Effective-folder-set function** | **NEW (R-01).** One pure function of `MapDefinition` returning the folders that can change the user's rows. Today RLS and the SQL emitter compute this separately and disagree — a live bypass | **1.1** |
| **RLS conformance suite** | **NEW (R-16).** Six named tests. Three of them exist in no phase of the original plan | **1.1**, ext. 6.3 |
| **Anonymised formula corpus builder** | **NEW (R-04).** The dumps cannot be committed. Without an anonymised corpus, 4.2's and 4.3's gates cannot run in CI at all | **0.5** |
| **Baseline measurement** | **NEW (R-10).** Every estate count in the plan is unverified and three contradict each other. Gates must reference a recorded baseline, not a literal | **0.4** |
| Migration output verifier | `scoreReadiness()` reported "ready" over a dead system — and structurally **cannot** see execution (its three parameters are all source-side) | **1.3** |
| The four seam tests | 1 654 tests missed a 100 % failure | **1.3** |
| Characterisation tests for `lib/sql/` | **NEW (R-15).** The modules 3.3 rewrites have **no dedicated tests at all** | **3.2** |
| Planner-decision histogram, **per rule** | A guard that never fires is indistinguishable from one not wired in — and a per-*outcome* histogram cannot tell them apart | **3.4** |
| Planner validate-only endpoint | **NEW (R-18).** So the builder can refuse before Run, not after | **3.3** |
| `d4wkdmp` differ in CI | *"The single highest-leverage change available to this project's testing story."* Runs only by hand today | **1.3** |
| Result-set differ (Neo vs Discoverer) | **The only test that proves the migration** | **9.1** |
| Oracle type-marshalling conformance | **NEW (R-05/PR-05).** The fakes cannot exercise NUMBER precision, DATE coercion or LOBs — the silent-wrong-number class | **9.1** |
| Oracle boot-time version gate | Nothing detects the server version | 8.1 |
| Credential-file TTL sweep | Nine plaintext CSVs a week old on disk | **0.2** |

---

## Rules for using agents — restated from measurement

The previous manifest's rule was *"only where breadth exceeds one context."* **This session's
data shows breadth is not the variable.**

| Agent | Brief | Tokens | Calls | Tokens/call | Result |
| ----- | ----- | -----: | ----: | ----------: | ------ |
| `architecture-critic` | Broad, open-ended, no output schema | **117 739** | 38 | 3 098 | **Died. Zero output** |
| `security-auditor` | 9 files, 8 closed questions, table, budget | 85 497 | 62 | 1 379 | Full |
| `test-engineer` | Inventory + 7 closed questions, table, budget | 74 760 | 41 | 1 823 | Full |
| `gsd-ui-auditor` | 8 closed questions, table, budget | 83 387 | 43 | 1 939 | Full |
| `gsd-integration-checker` | 35 files read whole, 4 tables | **178 194** | **12** | **14 850** | Full, but 10× the cost per call |

**The rules that follow from it:**

1. **Constrain the output, not the topic.** Every dispatch carries all five of: an explicit file
   list · closed questions · a required output table · a tool-call budget · *"return the table
   even if unfinished."* **Missing any one — do it inline.**
2. **Cost tracks bytes read per call, not call count.** Tell an agent to `head` first and read
   ranges only where it finds something. The 35-file agent was narrow *and* expensive.
3. **Never delegate what the calling session can already answer.** The mitigation half of the
   security review and the coverage half of the testing review were done inline because the
   session already held the plan. Delegating would have meant re-reading 57 KB to answer an
   answerable question.
4. **Strictly one at a time, foreground.** Unchanged, and still right.
5. **Checkpoint after each one.** Extract findings to a durable artefact, discard the raw
   output, *then* dispatch the next. This review's own interruption was survivable only because
   of this.
6. **The Agents column in the roadmap is empty by design.** Every implementation stage is
   single-context work. This review found nothing that changes that.
7. **Route mechanical work to Haiku** — bulk renames, i18n key sweeps, formatting, log triage.

## Rule for `context-mode` — say how, not just what

Four stages handle payloads larger than a context window. Each of their prompts now carries:

> **Never read the corpus into context.** Write a script, run it in the sandbox, and emit **only**
> the aggregate — counts per bucket, the top N failures with reasons, and the path where the full
> result was written. The full result is an artefact on disk, not a tool result.

Without this, *"use `context-mode`"* is a tool name, not a method, and the stage does not finish.

---

## The wider point, unchanged and now better evidenced

This project's decisive findings — in the audit, in the planning session, and in this review —
came from `psql`, `curl`, a browser and careful reading. The most severe finding in this review
(a live row-level-security bypass) came from `grep` and `sed`, after the agent assigned to find
it had died. **A leaner toolset will make the implementation phases both cheaper and easier to
reason about.**
