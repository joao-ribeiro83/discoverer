# Review F — Integration Challenge

**Method.** `gsd-integration-checker` over the 36 execution prompts in
`docs/master-plan/prompts/` — genuine breadth (≈4 900 lines) that the reviewing session had not
read. Returned in full, though expensively (178 194 tokens for 12 tool calls — see Review G).
All HIGH findings re-verified inline.

**Good news first, because it is real:** **36 of 36 prompts contain every required section** —
model + effort, prerequisites, files to read, tooling, tests, acceptance, git checkpoint,
handover artefacts, resume instructions, out-of-scope. The prompt *format* is sound and
consistently applied. The failures below are all content, not structure.

---

## F-01 · Phase 3.3's prompt does not name Phase 3.1 as a prerequisite

- **Severity:** CRITICAL
- **Phase/Stage:** 3.3 · D-030 · D-031
- **Type:** MISSING

**Finding.** Verified at `docs/master-plan/prompts/PHASE-03-03-query-planner.md`:

```
## Prerequisites

Phase 3.2 — the planner cannot run without flags and predicates.
```

That is the whole section. **Phase 3.1 is not named**, and it does not appear in the prompt's
"Required files to read first" either.

D-030 calls the order *"non-negotiable"*: populate the measure set → land predicates and flags →
build the guard → enable multi-folder. D-031 states the consequence in the bluntest terms in the
whole plan: with `agg_function` NULL everywhere, every query classifies `|M| = 0`, takes the flat
path, and **"the guard would ship present, unit-tested and structurally inert."**

A fresh session executing 3.3 from its prompt — which is the stated design goal, *"one per stage,
self-contained"* — can implement the planner correctly, write passing unit tests against
hand-built fixtures (which per D-02 is how every SQL test in this repository works), satisfy
every listed acceptance criterion, and ship an inert guard. **That is this project's signature
failure reproduced inside the prompt written to prevent it.**

The prompt does cite `DECISION_REGISTER.md D-030` in its reading list, so a thorough session
would find the ordering. But "the reader will notice it in a referenced document" is exactly the
standard the plan rejects everywhere else.

**Recommendation.** Rewrite 3.3's Prerequisites to:

> **Phase 3.1 — `map_items.agg_function` must be non-null on the measure items of a re-imported
> corpus. Verify this before writing any code: if `agg_function` is NULL across the estate, every
> query classifies `|M| = 0` and this entire stage ships structurally inert (D-031). Stop and
> complete 3.1.**
>
> Phase 3.2 — the planner cannot run without flags and predicates.

And add to 3.3's acceptance: *"a test asserts the planner classifies `|M| ≥ 1` on at least one
real migrated map, not only on a fixture."*

---

## F-02 · The multi-folder map count contradicts itself: 272 in Phase 1.1, 341 in Phase 3.2

- **Severity:** HIGH
- **Phase/Stage:** 1.1 · 3.2 · 3.4
- **Type:** INCORRECT

**Finding.** Verified:

| Source | Says |
| ------ | ---- |
| `PHASE-01-01-the-scoping-commit.md:9` | *"Today, **272** multi-folder maps fail loudly at `from-clause.ts:107`"* |
| `PHASE-01-01-the-scoping-commit.md:151` | acceptance: *"~651 single-folder maps generate SQL; **~272** multi-folder maps refuse"* |
| `PHASE-03-02-join-model.md:11` | *"`def.joins` is **always empty** and all **341** multi-folder maps fail"* |
| `research/legacy-analysis.md` §1.11 step 1 | *"**271 of 341** multi-folder maps in this estate hit this today"* |

The research is the most precise and most likely correct: **341 multi-folder maps, of which 271
hit the disconnection refusal.** The `272` in Phase 1.1 appears to be `271` conflated with the
multi-folder total.

**This is not a typo in prose — it is inside a gate.** 1.1's acceptance is arithmetic:
`651 + 272 = 923`. If 341 maps are multi-folder, single-folder is **582**, not 651. A session
executing 1.1 measures 582 and 341, compares against a criterion demanding ~651 and ~272,
and must decide whether it has failed the stage. Both readings are defensible from the plan,
which is the worst outcome for a gate.

It also propagates: 3.4's histogram expectation (B-03) is predicted from these numbers, and
Review A already flagged that none of them is verifiable without the live Postgres.

**Recommendation.** Do not guess which is right. Add a scope item to **Phase 0** — a
baseline-measurement step (see the consolidated recommendation in `MASTER_PLAN_REVIEW.md`) that
measures and records, in the checkpoint: total maps, single-folder, multi-folder, maps whose
folder set is connected by the 10 known joins, and maps declaring join usage in the container
(B-04). Then rewrite 1.1's, 3.2's and 3.4's criteria to reference **the recorded baseline**,
not a literal. Every phase gate that quotes an estate count should do the same.

---

## F-03 · Phase 1.3 gates CI on a fixture corpus that Phase 4.1 first creates

- **Severity:** CRITICAL
- **Phase/Stage:** 1.3 · 4.1 (compounds D-01)
- **Type:** MISSING (dependency inversion)

**Finding.** `PHASE-01-03` says: *"promote the d4wkdmp differ into CI **with a checked-in fixture
corpus**, gated on agreement rates"* — phrased as promoting something that exists.
`PHASE-04-01` says: *"Extract the aligned `(IOFormula, DisplayFormula)` pairs from the 547 dumps
in `E:\claude\discoverer\d4dumps\` **into a checked-in fixture** … The fixture must be checked in
and small enough to live in git."*

So the fixture is **created in Phase 4.1** and **consumed in Phase 1.3** — three phases earlier.

And per Review D's **D-01**, the raw dumps sit *outside* the `discoverer-neo` repository, are
untracked, are marked in the code as *"customer report metadata and never committed"*, and
Phase 0.1 explicitly `.gitignore`s them. So Phase 1.3's CI gate depends on an artefact that at
that point (a) does not exist, (b) is produced three phases later, and (c) may not be committable
at all.

**Recommendation.** Combine with D-01's resolution:
1. Settle the corpus question in **Phase 0** as a Decision Register entry (anonymised corpus
   recommended).
2. **Move fixture creation to Phase 0** or to the front of 1.3 — it is a data-extraction task
   with no dependency on Phases 1–3, and both 1.3 and 4.1 need it.
3. Rewrite 1.3's scope to say *"build the fixture corpus (per D-0xx), then gate CI on the
   differ's agreement rate"* — creation before promotion.
4. Rewrite 4.1's scope to *"extend the existing corpus with the aligned formula pairs"*.

---

## F-04 · Phase 3.3 hands refusal rules to a UI validated before Phase 3 existed

- **Severity:** HIGH
- **Phase/Stage:** 2.2 · 3.3 · 3.4 · D-036
- **Type:** MISSING

**Finding.** 3.3's handover artefacts include *"the refusal-rule list, for the troubleshooting
docs and **the refusal UI**"*. The refusal UI is built and browser-validated in **2.2**, against
Phase 1.1's single generic `SqlGenerationError` message. Phase 3.3 then produces structured,
rule-specific refusals (R1–R4, `REAGG`, per-folder naming) — and **no prompt in Phase 3
re-validates that the UI renders them.**

The assumption that a UI built for one generic message will render five structured ones with
folder lists is asserted, not tested. It also compounds **E-07**: the builder lets a user compose
a refusable query in the first place, with no pre-flight check.

**Recommendation.** Add to **3.4's** scope and acceptance: *"browser-validate the refusal UI
against one instance of each planner refusal rule; each renders its rule name, the folders
involved, and a next step."* 3.4 is the right home — it is the stage that first makes real
refusals reachable. Add `Claude_Browser` to 3.4's tooling row, which currently lists only
`context-mode`.

---

## F-05 · Two further count contradictions

- **Severity:** MEDIUM (conditions) · LOW (users)
- **Type:** INCORRECT

| Object | Prompt A | Prompt B |
| ------ | -------- | -------- |
| Conditions | `PHASE-01-02` / `PHASE-05-02`: **5 605** migrated conditions import with `group_id = NULL` | `PHASE-05-03`: the depth distribution is measured *"over all **3 395** live conditions"* |
| Non-admin users | `PHASE-06-02`: *"any of the **18** non-admin accounts"* | `PHASE-09-03`: *"every one of the **17** migrated users needs a credential"* |

The ~2 210 condition gap is never reconciled. It may be legitimate — 5 605 migrated vs 3 395
surviving after some filter — but neither prompt says so, and **5.3's depth statistics are the
sole evidence for D-072's central claim** that a `negated` boolean *"covers the entire measured
corpus."* If the 92.6 %/7.3 %/7-instances distribution was measured over 3 395 conditions and
2 210 were excluded, the claim covers 61 % of the corpus, not all of it.

The 18/17 user discrepancy is probably one admin, but 9.3 is a **cutover runbook** — the document
where an off-by-one means one person cannot log in on go-live day.

**Recommendation.** Reconcile both in the Phase 0 baseline measurement (F-02). For conditions
specifically, add to 5.3's prompt: *"state which population the depth distribution was measured
over, and what the difference from 5 605 is."* D-072 should not stand on an unexplained
subset.

---

## F-06 · The plan's declared parallelism is unusable as written

- **Severity:** LOW
- **Phase/Stage:** §3
- **Type:** INFORMATIONAL

**Finding.** §3 records which phases are independent *"so that a session which finishes early
knows what it may safely start next"* — Phase 2 after 1.2, Phase 6 independent of 3–5, Phase 8
independent of everything after 1. But the confirmed findings move three of those dependencies:

- **C-11** moves entity scoping (6.2) into 1.2 — Phase 6 is no longer fully independent.
- **A-06** moves the `getConnection` leak and pool metrics (8.2) into 1.3.
- **F-04** adds a Phase 2 deliverable (the refusal UI) to Phase 3.4's validation.

**Recommendation.** Regenerate §3's independence statement after integrating the corrections,
rather than leaving a stale map that a session might act on.

---

## Verified correct

- **36 of 36 prompts carry every required section**, exactly once. The prompt template is good
  and consistently applied — this is the single strongest thing about the plan's execution
  layer, and it should be preserved unchanged.
- Every prompt names one model and one effort, satisfying D-007.
- Every prompt has explicit **out-of-scope** and **resume** sections — the two that matter most
  for interruption resilience.
- Only one prompt (3.3) fails the fresh-session executability test on any of the five criteria
  (what to do / what to read / which model / how to know it is done / what to hand over), and it
  fails on a missing prerequisite rather than a structural gap.

---

## Note on the agent's own count

`gsd-integration-checker` reported *"35 of 35 conform fully."* **There are 36 original prompts**
(counted: 3 + 3 + 3 + 4 + 5 + 4 + 4 + 3 + 4 + 3), so it checked 35 and silently omitted one —
and its report gave no way to tell which.

The reviewing session therefore **re-ran the conformance check itself** over all 36, grepping for
each of the ten required sections. **Result: zero gaps.** The agent's conclusion was correct; its
denominator was not.

Recorded because it is an instance of the pattern this review keeps finding: *a check that
reports success without covering everything it names.* A silent cap on coverage reads as
"covered everything" when it did not — which is precisely what Review G's rule about **no silent
caps** exists to prevent, and it applies to review agents as much as to acceptance gates.
