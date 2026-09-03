# Claude Code — Minimal Tooling Manifest

**Purpose:** the smallest practical capability set that can execute
`MASTER_IMPLEMENTATION_PLAN.md`. **Explicit objective: allow the MegaPack to be removed.**

**Method:** grounded in what actually produced findings during the forensic audit and this
planning session, not in a survey of what exists. See `AUDIT_TOOLING_REQUIREMENTS.md` for the
measurements.

**Result: 19 plugins → 8. ~2 681 repository-local agents and skills → 0. MCP servers roughly
halved.**

---

## The evidence this rests on

| Capability | What it actually produced |
| ---------- | ------------------------- |
| **Bash / Read / Grep / Glob / Write** | Every source-level finding, in both the audit and this planning session. Including the `DisplayFormula` discovery that shrank the largest remaining task by ~3.5× |
| **context-mode** | Kept ~500 KB of psql, HTTP and JSON output out of context — a 404 KB introspection response, a 3 MB differ report, a 65 KB EUL analysis. **Without it the audit would not have fit** |
| **Claude_Browser** | F-06, F-08, F-13, F-26 — **nothing else would have found these.** They are invisible in source review |
| **claude-mem** | The startup index correctly warned that the repo's own EUL reference docs are fabricated, and about the `dcg` hook constraints. Prevented a wrong-source error |
| **Agent / Workflow** | 19 of 20 agents died on usage limits during the audit (~2.28 M tokens for one result). This session: 2 of 3 succeeded and each overturned a prior conclusion; **1 died at 138 k tokens with no output** |
| **Everything else** | Not invoked |

**The honest conclusion:** three capabilities did nearly all the work — sandboxed execution, a
browser, and the standard file tools.

---

## REQUIRED ACROSS PROJECT

| Name | Type | Phase | Purpose | Mandatory? |
| ---- | ---- | ----- | ------- | ---------- |
| Bash · Read · Write · Edit · Grep · Glob | built-in | all | Every source-level change and finding | **Yes** |
| `context-mode` | MCP | all | Sandboxed execution and indexing. **Context-critical on every phase touching data**: migration corpora, the 547-dump fixture, differ reports, psql result sets, 404 KB introspection payloads | **Yes** |
| `claude-mem` | MCP | all | Session memory across a multi-week, many-session plan. Prevents re-deriving the fabricated-EUL-docs trap and the `dcg` hook constraints every time | **Yes** |
| `typescript-lsp` | plugin | all | 100 % TypeScript monorepo. Phases 1.2, 3.x and 4.x perform cross-workspace refactors that touch `backend` and `core` together | **Yes** |
| `code-review` **or** `coderabbit` — **pick exactly one** | plugin | all | Review gate on high-risk changes: the scoping commit, the query planner, the token renderer, auth. **Two overlapping reviewers is waste** | **Yes (one)** |
| git via Bash | built-in | all | Commit-per-stage; the plan's resumability depends on it | **Yes** |

## PHASE-SPECIFIC

| Name | Type | Phase | Purpose | Mandatory? |
| ---- | ---- | ----- | ------- | ---------- |
| `Claude_Browser` | MCP | **2**, 5.2, 7.3 | The frontend is the weakest dimension and its defects are **invisible in source**. The verification loop for every UI change | **Yes for Phase 2** |
| `playwright` | plugin | 2.3, 7.3, 9.x | 9 E2E specs already exist and must enter CI. Also the a11y suite | **Yes for 2.3** |
| `context7` | MCP | 0.2, 6.x, 8.x | Current docs for `node-oracledb` thick-mode behaviour, Drizzle, Fastify, BullMQ, and CVE remediation. **Training data will be stale on these** | Yes |
| `security-guidance` | plugin | **6** | Remediation of the SEC-* set and the 11 npm advisories | Phase 6 only |
| `frontend-design` **or** `ui-ux-pro-max` — **pick exactly one** | plugin | 2, 7.3 | Building the missing Maps surface and the refusal UI. **Not both** | Phase 2 only |
| `github` | MCP | 0.1, 6.4, 8.x | CI is unwired and there is no remote (INF-04, DOC-04). **Currently failing auth — `400 Authorization header is badly formatted`. Fix it in 0.1 or use `gh` CLI via Bash instead** | Conditional |

## OPTIONAL

| Name | Type | Phase | Purpose | Mandatory? |
| ---- | ---- | ----- | ------- | ---------- |
| `ponytail` | plugin | all | Working style. A codebase with three parallel formula representations and a placeholder front page **does not need more abstraction** — the discipline is apt here | No |
| `Agent` (built-in) | built-in | rare | Only where breadth genuinely exceeds one context. **Serially, never in parallel** (D-005) | No |

---

## REMOVE

| Item | Reason |
| ---- | ------ |
| `.claude/agents/` — **138 sub-agents** | Zero invocations across eleven sessions; **8 217 tokens per turn** when enabled. Already deleted in the working tree. **Commit the deletion** in Phase 0.1 |
| `.claude/skills/` — **~2 543 skills** | Same. 352 KB of descriptions for zero invocations |
| `superpowers` | Its own doctrine says to invoke a skill before any action; **nothing in it was used across a full forensic audit or this planning session.** Large surface, unproven value here |
| `code-modernization` | Aimed at COBOL/.NET-style uplift. **Note:** two of its agents *were* used productively in this planning session (`legacy-analyst`, `architecture-critic`) and each overturned an audit conclusion — so **keep it until Phase 3 lands**, then remove. It has no role in implementation |
| `feature-dev` | Overlaps `code-review` and the planning workflow already in use |
| `code-simplifier` | Overlaps `ponytail` and `code-review` |
| `jdtls-lsp`, `pyright-lsp` | **No Java or Python in this repository.** Pure overhead |
| `claude-md-management` | One `CLAUDE.md` per workspace, both short. Manual editing is cheaper |
| `andrej-karpathy-skills` | No demonstrated relevance to an Oracle BI migration |
| `claude-in-chrome` | Fully redundant with `Claude_Browser`, which was sufficient throughout. Also carries the user's **real logged-in sessions** — unnecessary exposure |
| `visualize`, `mcp-registry`, `scheduled-tasks`, `terminal` | Unused; no phase requires them |
| `coderabbit` **or** `code-review` | Keep one |
| `frontend-design` **or** `ui-ux-pro-max` | Keep one |

---

## Capability gaps — these must be BUILT, not installed

They matter more than any plugin above.

| Gap | Why | Phase |
| --- | --- | ----- |
| **Migration output verifier** | `scoreReadiness()` reported "ready" over a dead system (F-12) | **1.3** |
| **The four seam tests** | 1 654 tests missed a 100 % failure | **1.3** |
| **Planner-decision histogram** | A guard that never fires is indistinguishable from one not wired in | **3.4** |
| **Token-formula corpus harness** | 49 819 formulas need a four-bucket partition, not a percentage | **4.1, 4.5** |
| **`d4wkdmp` differ in CI** | *"The single highest-leverage change available to this project's testing story."* Runs only by hand today | **1.3** |
| **Result-set differ (Neo vs Discoverer)** | **The only test that proves the migration** | **9.1** |
| **Oracle boot-time version gate** | Nothing detects the server version | 8.1 |
| **Credential-file TTL sweep** | Nine plaintext CSVs a week old on disk | **0.2** |

---

## Rules for using agents on this project

1. **Never fan out.** Run specialists **strictly one at a time, foreground.** The audit lost
   two full waves to usage limits; this planning session lost one agent at 138 k tokens.
2. **Only where breadth exceeds one context** — a security sweep across every route, a
   documentation reconciliation across `docs/**`, a legacy-semantics dig across vendor PDFs
   and shipped SQL.
3. **Never for work the main session can do in a few steps.** Most of the audit's CRITICAL
   findings — and this session's most valuable discovery — came from targeted `grep`, `psql`
   and `curl`, not from delegation.
4. **Checkpoint after each one.** Extract the findings, write them to a durable artefact,
   discard the raw output, *then* invoke the next.
5. **Every stage in the master plan is single-context work.** The Agents column in the
   roadmap matrix is empty by design.
6. **Route mechanical work to Haiku** — bulk renames, i18n key sweeps, formatting, log triage —
   per the repository's own token-guard rule.

---

## The wider point

This project's decisive findings came from `psql`, `curl`, a browser and careful reading. The
MegaPack contributed nothing to any of them. **A leaner toolset will make the implementation
phases both cheaper and easier to reason about** — which is exactly what a codebase with
three competing formula representations and a placeholder front page needs.
