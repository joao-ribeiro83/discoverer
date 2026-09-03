# Discoverer Neo — Minimum Tooling Requirements

**Audit date:** 2026-09-01
**Purpose:** determine the *smallest* set of skills, agents and MCP/plugin capabilities
needed to execute the future Master Implementation Plan — so the MegaPack can be removed
and only what earns its place remains.

**Method:** this is not a survey of what exists. It is grounded in **what was actually
used, and what actually produced findings, during this audit** — plus what the plan's
known phases will demand.

---

## 1. Current inventory

### Repository-local (the MegaPack)

| Item | Status |
| --- | --- |
| `.claude/agents/` — 138 sub-agents | **Deleted in the working tree, still in HEAD** (2 705 uncommitted deletions) |
| `.claude/skills/` — ~2 543 skills | Same — tracked in git, absent from disk |
| Remaining `.claude/` on disk | `launch.json`, `settings.local.json`, `worktrees/`, one `.jsonold` — **32 KB total** |

**Finding (documentation drift):** `CLAUDE.md` still describes both directories as present
and explains how to re-enable them. They are gone from disk. Either commit the deletion and
update `CLAUDE.md`, or restore them — but do not leave the tree and the docs disagreeing.

**Evidence of value: zero.** No agent and no skill from either directory was invoked during
this audit, and `CLAUDE.md` itself records that they went unused across ten prior sessions
while costing 8 217 tokens per turn. **Recommendation: commit the deletion permanently.**

### Installed plugins — 19

`andrej-karpathy-skills` · `claude-md-management` · `claude-mem` · `code-modernization` ·
`code-review` · `code-simplifier` · `coderabbit` · `context-mode` · `feature-dev` ·
`frontend-design` · `github` · `jdtls-lsp` · `playwright` · `ponytail` · `pyright-lsp` ·
`security-guidance` · `superpowers` · `typescript-lsp` · `ui-ux-pro-max`

### MCP servers

Active: `context7`, `Claude_Browser`, `playwright`, `claude-in-chrome`, `visualize`,
`context-mode`, `claude-mem`, `ccd_*`, `mcp-registry`, `scheduled-tasks`, `terminal`.
**Failed this session:** `github` (`400 … Authorization header is badly formatted`).

---

## 2. What actually earned its place in this audit

| Capability | What it produced |
| --- | --- |
| **Bash / Read / Grep / Glob / Write** | Every source-level finding |
| **context-mode** (`ctx_batch_execute`, `ctx_execute`) | Kept ~500 KB of psql, HTTP and JSON output out of context. The 404 KB introspection response, the 3 MB differ report and the 65 KB EUL analysis were all processed in-sandbox. **Without this the audit would not have fit.** |
| **Claude_Browser** | F-06 (Maps placeholder), F-08 (Run button inert), F-13 (placeholder KPIs), F-26 (duplicate checkbox). **Nothing else would have found these** — they are invisible in source review. |
| **claude-mem** (session memory) | The startup index correctly warned that the repo's own EUL reference docs are fabricated, and about the `dcg` hook constraints. Saved real time and prevented a wrong-source error. |
| **Workflow / Agent** | Attempted twice; **19 of 20 agents died on account usage limits**, burning ~2.3 M tokens for one usable result (the 17 infrastructure findings, which were high quality). Value real but cost extreme. |
| **Everything else** | Not invoked. |

**The honest conclusion:** three capabilities did nearly all the work — sandboxed
execution, a browser, and the standard file tools.

---

## 3. Required capability set

| Capability | Type | Name | Why needed | Phases | Always? |
| --- | --- | --- | --- | --- | --- |
| Sandboxed execution & indexing | MCP | `context-mode` | Migration corpora, 3 MB differ reports, 404 KB introspection payloads, psql result sets. Context-critical on every phase touching data. | All | **Yes** |
| Browser automation | MCP | `Claude_Browser` | The frontend is the weakest area and its defects are invisible in source. Verification loop for every UI change. | 1, 2, 4 | **Yes** |
| Session memory | MCP | `claude-mem` | Multi-session plan spanning weeks; prevents re-deriving the EUL-doc trap and hook constraints each time. | All | **Yes** |
| TypeScript language server | Plugin | `typescript-lsp` | 100 % TS monorepo; cross-workspace refactors (R1, R2 touch backend + migrate together). | All | **Yes** |
| Current library docs | MCP | `context7` | Oracle `node-oracledb` version behaviour, Drizzle, Fastify, BullMQ, React Router CVE remediation. Training data will be stale on these. | 0, 3, 4 | Yes |
| E2E browser testing | Plugin | `playwright` | 9 specs already exist and must enter CI. | 1, 2, 4 | Phase-gated |
| Security review | Plugin | `security-guidance` | Phase 3 remediation of F-03 and the INF-05 CVE set. | 3 | Phase-only |
| Code review | Plugin | `code-review` **or** `coderabbit` — **pick one** | Review gate on high-risk changes (SQL generation, auth, migration). | All | Yes (one) |
| Frontend design | Plugin | `frontend-design` **or** `ui-ux-pro-max` — **pick one** | Phase 1–2 build out the missing Maps surface and dashboard. | 1, 2 | Phase-only |
| GitHub integration | MCP | `github` | CI is unwired and has no remote (INF-04). Needed to establish one. **Currently failing auth — fix or drop.** | 0, 4 | Phase-only |
| Working style | Plugin | `ponytail` | Actively shaped this session; a codebase with three parallel formula representations does not need more abstraction. | All | Optional |

---

## 4. Recommended: remove

| Item | Reason |
| --- | --- |
| `.claude/agents/` (138) | Zero use in eleven sessions; 8 217 tokens/turn when enabled. **Commit the deletion.** |
| `.claude/skills/` (~2 543) | Same. 352 KB of descriptions for zero invocations. |
| `superpowers` | Its own doctrine says to invoke a skill before any action; nothing in it was used across a full forensic audit. Large surface, unproven value here. |
| `code-modernization` | Aimed at COBOL/.NET-style uplift. This project is a greenfield TypeScript app with a bespoke binary-format problem — the workbook parser is not a use case any generic modernisation agent improves on. |
| `feature-dev` | Overlaps `code-review` and the planning workflow already in use. |
| `code-simplifier` | Overlaps `ponytail` and `code-review`. |
| `jdtls-lsp`, `pyright-lsp` | **No Java or Python in this repository.** Pure overhead. |
| `claude-md-management` | One `CLAUDE.md` per workspace, both short. Manual editing is cheaper. |
| `andrej-karpathy-skills` | No demonstrated relevance to an Oracle BI migration. |
| `claude-in-chrome` | Fully redundant with `Claude_Browser`, which was sufficient throughout. Also carries the user's real logged-in sessions — unnecessary exposure. |
| `visualize`, `mcp-registry`, `scheduled-tasks`, `terminal` | Unused; no phase requires them. |
| `coderabbit` **or** `code-review` | Keep one, not both. |
| `frontend-design` **or** `ui-ux-pro-max` | Keep one, not both. |

**Net effect:** 19 plugins → **8**; ~2 681 repo-local agents and skills → **0**; MCP servers
roughly halved.

---

## 5. Sub-agents and workflows — a cost warning grounded in this session

The Workflow tool was used twice, exactly as the task requested. Both waves were destroyed
by account usage limits:

| Wave | Agents | Completed | Subagent tokens | Result |
| --- | --- | --- | --- | --- |
| 1 | 10 | **0** | 1 181 602 | Nothing |
| 2 | 11 | **1** | 1 098 719 | 17 infrastructure findings |

**~2.28 M tokens for one domain's output.** The one agent that finished did excellent work
— its findings are among the strongest in this audit — so the *quality* case for
specialists is proven. The *cost* case is not.

**Recommendation for the implementation plan:**

- **Do not fan out ten high-effort agents in one wave.** Run 3–4 at a time, or sequentially.
- Use a specialist only where breadth genuinely exceeds one context: a security sweep across
  every route, a per-route IDOR audit, a documentation reconciliation across `docs/**`.
- **Never** use a subagent for work the main session can do in a few steps — most of this
  audit's CRITICAL findings came from targeted `psql` and `curl`, not from delegation.
- The four highest-value remaining tasks (fix F-01, build the token decoder, wire the Maps
  page, add the four seam tests) are all **single-context** work.

---

## 6. Capability gaps — things needed that no plugin provides

These must be **built**, not installed. They matter more than the tooling above.

| Gap | Why | Phase |
| --- | --- | --- |
| **Oracle version/dialect probe** | Nothing detects the server version; F-09 hinges on it | 0 |
| **Migration output verifier** | `scoreReadiness()` reported "ready" over a dead system (F-12) | 0 |
| **Token formula corpus harness** | 49 819 formulas need a compile-rate metric (F-02) | 2 |
| **`d4wkdmp` differ in CI** | The best verification asset in the repo runs only by hand | 1 |
| **Result-set differ (Neo vs Discoverer)** | The only test that proves the migration | 3 |
| **Credential-file TTL sweep** | INF-07: nine plaintext CSVs a week old | 3 |

---

## 7. Recommended model class per phase

| Phase | Work | Model | Rationale |
| --- | --- | --- | --- |
| **0 — Make it true** | F-01 scoping, `/api/maps`, config guard, Oracle pagination, CI, the four seam tests | **Opus** | Highest-stakes reasoning; a wrong scoping fix re-breaks 923 maps |
| **1 — Make it reachable** | Maps list, wire Run, remove placeholders | **Sonnet** (Opus for the API contract) | Well-specified UI construction |
| **2 — Make it faithful** | Token decoder, calculation metadata, hierarchies, crosstab population | **Opus** | Novel parsing against an undocumented binary format — the hardest work remaining |
| **3 — Make it safe** | Key rotation, CORS, CVEs, credential TTL, RLS verification | **Opus** for the design, **Sonnet** for the edits | Security reasoning warrants the stronger model |
| **4 — Make it operable** | Prove prod compose, Oracle/queue metrics, backups, readiness split | **Sonnet** | Mostly configuration with clear success criteria |
| Bulk mechanical | Renames, i18n key sweeps, formatting, log triage | **Haiku** | Per the repo's own `CLAUDE.md` token-guard rule |

---

## 8. Minimum set — the answer

**Keep eight capabilities:**

1. `context-mode` — essential; the audit could not have been completed without it
2. `Claude_Browser` — essential; found four findings nothing else could
3. `claude-mem` — essential for a multi-session plan
4. `typescript-lsp` — essential for a TS monorepo
5. `context7` — Oracle driver and framework currency
6. `playwright` — E2E specs exist and must enter CI
7. `code-review` *or* `coderabbit` (one)
8. `security-guidance` — Phase 3 only
9. *(optional)* `ponytail` — working style
10. *(conditional)* `github` — required for CI, currently failing auth

**Delete:** all 138 repository agents, all ~2 543 repository skills, and 11 of the 19
plugins.

**The wider point:** this audit's decisive findings came from `psql`, `curl`, a browser and
careful reading. The MegaPack contributed nothing to any of them. A leaner toolset will
make the implementation phases both cheaper and easier to reason about — which is exactly
what a project with three competing formula representations and a placeholder front page
needs.
