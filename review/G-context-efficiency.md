# Review G — Context Efficiency

**§13 is a mandatory review dimension.** This session generated the only controlled data that
exists on the question, because it ran six reviews over the same repository using different
delegation strategies.

---

## The measurement

| Agent | Scope given | Tokens | Tool calls | Tokens/call | Output |
| ----- | ----------- | -----: | ---------: | ----------: | ------ |
| `architecture-critic` | Broad: *"challenge the target architecture, boundaries, coupling, DB, Oracle, workers, migration, scaling"* + 9 files + a "look for both over- and under-engineering" brief | **117 739** | 38 | 3 098 | **NOTHING** — died on the session limit |
| `security-auditor` | 9 named files, 8 closed questions, table output, ~40-call budget | 85 497 | 62 | 1 379 | Full, high quality |
| `test-engineer` | Inventory step + 7 closed questions, table output, ~40-call budget | 74 760 | 41 | 1 823 | Full, high quality |
| `gsd-ui-auditor` | 8 closed questions, table output, ~40-call budget | 83 387 | 43 | 1 939 | Full, high quality |
| `gsd-integration-checker` | 36 files, 4 required tables, ~45-call budget | **178 194** | **12** | **14 850** | Full, high quality |

**Total agent spend: 539 577 tokens for four usable results.** The failure cost 22 % of the
budget and returned nothing.

Reviews A, B, C2 and D2 were then done **inline** — and A produced the single most severe
finding in the entire review (A-01/C-02, a live RLS bypass), at a fraction of the cost, using
`grep` and `sed`.

---

## G-01 · The plan's D-005 is right, but for the wrong reason — and its rule is unusable

- **Severity:** HIGH
- **Phase/Stage:** D-005 · manifest "Rules for using agents" · §11 Agents column
- **Type:** INCORRECT

**Finding.** D-005 concludes *"specialists run strictly one at a time, foreground, and only where
breadth exceeds one context"*, from the evidence that *"19 of 20 agents died on usage limits"*.
The conclusion is right. The **diagnosis is wrong**, and the wrong diagnosis makes the rule
unusable in practice.

The data says the killer is **not parallelism, and not breadth**. It is **open-ended scope**:

- The one agent that died had the **broadest brief and the fewest constraints** — no closed
  questions, no output schema, no tool budget, no partial-return instruction.
- The most expensive *successful* agent (`integration-checker`, 178 k) had a **narrow** brief but
  read 36 files whole — **14 850 tokens per tool call, 10× the others**. Cost tracks *bytes read
  per call*, not call count and not conceptual breadth.
- The three cheapest successes all shared one shape: **named file list + closed questions +
  table-only output + a tool-call budget + "return the table even if unfinished."**

D-005's rule as written ("only where breadth exceeds one context") gives a session no way to
predict success, because breadth is not the variable. And the plan's §11 Agents column is empty
*by design*, so the rule is never exercised — leaving a future session with a prohibition and no
pattern.

**Recommendation.** Replace D-005's operative text with the measured pattern:

> **Agents survive when the prompt constrains the output, not when it constrains the topic.**
> Every dispatch must carry: (1) an explicit file list, (2) closed questions, (3) a required
> output table, (4) a tool-call budget, (5) *"return the table even if unfinished."* Without all
> five, do not dispatch — do it inline.
>
> **Cost tracks bytes read per tool call.** An agent asked to read many files whole is expensive
> even when its brief is narrow; tell it to `head` first and read ranges only where it finds
> something.
>
> **Never delegate what the calling session can already answer.** The mitigation half of the
> security review and the coverage half of the testing review were done inline precisely because
> the calling session already held the plan — delegating would have meant re-reading 57 KB into
> a fresh context to answer an answerable question.

---

## G-02 · The plan has no context-efficiency mechanism for its own largest artefacts

- **Severity:** MEDIUM
- **Phase/Stage:** 4.1 · 4.5 · 9.1 · 1.3
- **Type:** MISSING

**Finding.** §13 asks whether the plan reduces context consumption. Four stages handle payloads
far larger than a context window and **none of them says how**:

| Stage | Payload | Plan's instruction |
| ----- | ------- | ------------------ |
| 4.1 | 37 971 aligned formula pairs from 547 dumps | *"extract into a checked-in fixture"* |
| 4.5 | 49 819 formulas compiled, four-bucket partition | *"publish the partition"* |
| 9.1 | Result-set diffs, Neo vs Discoverer | *"diff the result sets"* |
| 1.3 | Source ↔ target reconciliation over 923 maps | *"declared expected-loss allowances"* |

Each names `context-mode` in the tooling column, which is right, but *"use context-mode"* is not
a method. A session that pipes a 37 971-row extraction through its own context will not finish
the stage.

**Recommendation.** Add one line to each of these four prompts, under implementation
instructions:

> **Never read the corpus into context.** Write a script, run it in the sandbox, and emit
> **only** the aggregate: counts per bucket, the top N failures with reasons, and the file path
> where the full result was written. The full result is an artefact on disk, not a tool result.

This is the single highest-leverage context change available to the plan, and it costs four
sentences.

---

## G-03 · Checkpointing is specified per stage but not per interruption

- **Severity:** MEDIUM
- **Phase/Stage:** all prompts
- **Type:** UNDER-ENGINEERING

**Finding.** All 36 prompts carry Git-checkpoint, handover-artefact and resume sections
(verified in Review F) — genuinely good. But the checkpoint is written **at stage end**. The
plan's own history says the binding constraint is the **5-hour usage limit**, which lands
mid-stage, and Phase 1.1's prompt is explicit that a partial commit there is *worse than no
commit*.

So the highest-risk stage in the plan is also the one where an interruption leaves the least
recoverable state: a dirty tree, and a checkpoint that still says "not started".

**Recommendation.** Add to every prompt's TOKEN-BUDGET SAFE EXECUTION block:

> **Checkpoint on progress, not only on completion.** After each discrete change — before the
> next file — append one line to the checkpoint naming what is now written and what is not.
> A stage interrupted at 60 % must be resumable from the checkpoint alone, without re-reading
> the diff.

For 1.1 specifically, where the four changes must land in one commit, add: *"record which of the
four are written after each one."* The prompt already says to leave the tree dirty; it does not
say to record what is in it.

---

## G-04 · Model and effort switching is forbidden by D-007 and required by three stages

- **Severity:** HIGH
- **Phase/Stage:** 2.1 · 5.3 · 7.1 · D-007
- **Type:** INCORRECT (this is also the Review I / §12 finding)

**Finding.** D-007 forbids mid-session model or effort switches because *"a switch discards the
prompt cache and re-bills the whole context at full write price."* Three stages instruct exactly
that:

```
plan:829  2.1 — Model: Sonnet · Effort: high  (Opus for the API contract)
plan:519  5.3 — Model: Sonnet (Opus for the parser change) · Effort: high
plan:866  7.1 — Model: Opus/Sonnet · Effort: high
prompts/PHASE-02-01:3  Effort: high (use Opus if the API contract needs changing)
prompts/PHASE-05-03:3  Model: Sonnet (Opus for the parser change)
prompts/PHASE-07-01:3  Model: Opus (schema) / Sonnet (UI)
```

A session following the prompt does the forbidden thing; a session following D-007 cannot follow
the prompt. Both the plan and the prompts carry the contradiction, so it cannot be resolved by
reading more carefully.

**Recommendation.** **Split each into two stages with one model each.** This is the only
resolution consistent with D-007, and it happens to improve all three:

- **2.1a** *(Opus, medium)* — the `/api/maps` contract and the list's data shape.
  **2.1b** *(Sonnet, medium)* — the list UI. Effort drops from high per **E-05**: the client
  method already exists.
- **5.3a** *(Opus, high)* — the parser change closing the `NOT` refusal.
  **5.3b** *(Sonnet, medium)* — the `negated` / case-sensitivity columns and the nullable
  `item_id` + `calculated_field_id` + CHECK.
- **7.1a** *(Opus, medium)* — the `workbooks` schema, kept out of the authorisation path
  (D-020).
  **7.1b** *(Sonnet, high)* — the browse UI.

**No stage may name two models.** Add that as a rule to §10.

---

## G-05 · Three planning documents duplicate the same content

- **Severity:** LOW
- **Phase/Stage:** artefact set
- **Type:** OVER-ENGINEERING

**Finding.** `MASTER_IMPLEMENTATION_PLAN.md` (935 lines) restates, at length, material that also
lives in `DECISION_REGISTER.md` (128 lines of tables) and in the 36 prompts (~5 000 lines). The
plan's §11 roadmap matrix repeats every stage's model, effort, deliverables and gate, which each
prompt also carries in its own header and acceptance section.

A future session that reads the plan **and** the register **and** its stage's prompt reads the
same facts three times — and, more dangerously, can read **three drifted versions** of them.
F-02's `272` vs `341` and G-04's model contradictions are both instances of exactly this drift.

**Recommendation.** Make each fact live in one place and reference it from the others:
- **Decision Register** — the only home for a decision and its evidence.
- **Prompts** — the only home for stage scope, gates and counts.
- **Master plan** — narrative, ordering and cross-phase constraints; its §11 matrix keeps
  *only* phase, stage, dependency and model, and cites the prompt for everything else.

Do not delete anything; remove the duplication. The stale-number class of defect this review
found four times is a direct product of it.

---

## Verified correct

- **Serial execution is right**, and this session confirms it — though for the reason in G-01,
  not the one D-005 gives.
- **The prompts' handover and resume sections are genuinely good** and are what made this
  review's own interruption (the usage limit at Review A) recoverable.
- **Persisting findings to files rather than holding them in context is correct** and was
  followed here: six review artefacts on disk, raw agent output discarded after extraction.
- **The empty Agents column in §11** is defensible for the implementation stages. Every stage
  is single-context work, and this review found nothing that changes that.
- **`context-mode` is correctly identified as mandatory** for the data-heavy phases — G-02 asks
  only that the plan say *how* to use it.
