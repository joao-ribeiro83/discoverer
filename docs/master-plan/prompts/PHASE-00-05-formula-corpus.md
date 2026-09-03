# PHASE 0.5 — The formula corpus decision and build

**Model:** Opus · **Effort:** high

> ## ⚠ WHY THIS STAGE EXISTS
>
> **The plan's central testing strategy conflicts with a standing data-handling decision in its
> own codebase, and v1.0 never noticed.**
>
> Four places require a *checked-in* corpus derived from Oracle's `d4wkdmp` dumps: Phase 1.3
> (*"promote the differ into CI with a checked-in fixture corpus"*), Phase 4.1 (*"extract the
> 37 971 aligned pairs into a checked-in fixture"*), the plan's §5 (*"the single highest-leverage
> change available to this project's testing story"*), and the tooling manifest's capability
> gaps.
>
> The codebase already decided otherwise, in writing:
>
> > `migrate/src/__tests__/d4wkdmp-differ.test.ts:18-19` — *"a hand-written dump text that is
> > grammatically faithful to real `d4wkdmp.exe -f` output but describes **placeholder data** …
> > **the real dumps are customer report metadata and never committed**."*
>
> Verified: `git ls-files | grep -i dump` tracks **nothing**; `d4dumps/` holds **552 untracked
> files**; and **Phase 0.1a gitignores them**. So the plan excludes the dumps in 0.1a and
> commits fixtures derived from them in 1.3 and 4.1.
>
> **The derived fixture is the same problem.** `DisplayFormula` is not a schema — it is the
> customer's business logic in the customer's own words. The plan's own examples (`PR?MIO`,
> `NVL(R Com Tx Com Vig/100,0)`) are customer item names inside customer formulas.
>
> **And v1.0 inverted its own dependency:** Phase 1.3 *consumed* the fixture that Phase 4.1
> *created*, three phases later.
>
> **The consequence is not theoretical.** Phase 4.2's gate is *"≥ 93% of the aligned corpus
> renders exactly equal to `DisplayFormula`"* and 4.3's is *"≥ 99% exact; `FAILED = 0`."* If the
> corpus cannot be committed, **neither gate can run in CI** — they become local, one-machine,
> unreproducible checks. Which is precisely the failure this plan diagnoses:
> *"every test verifies a component against its own fixtures, and no test verifies the system
> against reality."*

## Purpose

Settle **D-114**, then build the corpus so that Phases 1.3, 4.1, 4.2 and 4.3 all have something
real to gate on.

## Scope

### Part 1 — settle D-114

Three options. **The default is (1).** Record the choice and its reasoning in the Decision
Register before building anything.

1. **Anonymised corpus (recommended).** Commit the *(token form, rendered form)* pairs with every
   identifier replaced by a stable synthetic name, through a deterministic mapping that is itself
   gitignored. **Structure, arity, fixity and operator placement all survive** — everything the
   renderer is fitted against. The customer's vocabulary does not.
2. **Private corpus + self-hosted CI.** Keep `d4dumps/` out of the repository and run the gate on
   a runner with access to it. Reproducible for the team, not for a fresh clone, and it costs
   infrastructure this project does not have (there is no git remote at all yet).
3. **Sampled corpus with customer sign-off.** Smallest technical change; **needs a human decision
   this stage cannot make.** If the user wants this, escalate and wait.

> **If the user directs option 2 or 3, take it** — this is their data. Record the direction in
> D-114 and adjust 4.2's and 4.3's gates to say where the corpus lives and who can run them.

### Part 2 — build it (option 1)

- Extract the aligned `(IOFormula, DisplayFormula)` pairs from the 547 dumps in `d4dumps/`.
- Replace every identifier through a deterministic mapping that **preserves byte class and
  length**. This is not cosmetic: Phase 4.1 must settle the dump character encoding (`PR?MIO`
  appears, and exact-match comparison on a Portuguese estate depends on it). A mapping that
  normalises to ASCII destroys the evidence for that question.
- Commit the anonymised pairs. **Gitignore the mapping.**
- Write a `rebuild-corpus` script so the corpus can be regenerated when the dumps change.
- Write a round-trip test proving the mapping is deterministic and locally reversible.

## Prerequisites

Phase 0.1a — `d4dumps/` must be gitignored **before** anything derived from it is committed, so
the raw dumps can never be added by accident.

## Required files to read first

- `docs/master-plan/research/formula-decoder-analysis.md` — what the pairs are for
- `discoverer-neo/migrate/src/__tests__/d4wkdmp-differ.test.ts:1-30` — **the standing decision**
- `discoverer-neo/migrate/src/services/d4wkdmp-dump-parser.ts` — the existing parser; reuse it
- `discoverer-neo/migrate/src/scripts/diff-corpus.ts` — D-059 says extend this, not replace it
- `discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7 — the container format

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` — **essential and non-optional at this scale.**

## Implementation instructions

- **Never read the corpus into context.** 37 971 pairs will not fit and do not need to. Script
  the extraction and anonymisation in the sandbox; emit **only** the pair count, the distinct
  code count, the identifier-replacement count, and the path where the corpus was written.
- Reuse `d4wkdmp-dump-parser.ts`. Do not write a second parser.
- **Anonymise deterministically.** The same identifier must map to the same synthetic name across
  every dump, or calculation-reference chains (D-056, WB-04) stop resolving and Phase 4.4's gate
  becomes meaningless.
- **Preserve byte class and length.** A non-ASCII identifier maps to a non-ASCII identifier of
  the same byte length.
- Keep the corpus small enough to live in git comfortably. If it is not, store the pairs in a
  compact columnar form rather than dropping rows — **a sampled corpus changes what 4.2's 93%
  means**, and if you must sample, say so loudly in the artefact and in 4.2's gate.

## Tests

- [ ] A round-trip test: anonymise a known input twice and get identical output.
- [ ] A test proving no raw identifier from `d4dumps/` survives into the committed corpus. **Grep
      the corpus for a handful of known customer item names and assert zero hits.**

## Security checks

- **The mapping file must be gitignored, and the `.gitignore` entry committed in the same
  change.** A committed mapping makes the anonymisation worthless.
- Verify no raw dump file has been staged: `git ls-files | grep -i dump` must stay empty.
- The corpus is the *output* of a privacy control. Treat a leak of the mapping as equivalent to
  committing the dumps.

## Validation

```bash
cd discoverer-neo && npm test --workspace @discoverer-neo/core
git ls-files | grep -i "d4dumps\|\.txt$" | head
```

CI must be able to read the corpus without any local file.

## Acceptance criteria

- [ ] **D-114 is recorded in the Decision Register** with the option chosen and why
- [ ] The anonymised corpus is **committed and readable by CI**
- [ ] The mapping is **gitignored**, and the ignore rule is committed
- [ ] `rebuild-corpus` exists and is documented
- [ ] The round-trip and no-leak tests pass
- [ ] The pair count is recorded in the checkpoint — **Phase 4.2's percentage gate is meaningless
      without a denominator a future session can check**
- [ ] If the corpus was sampled for size, **the sampling is stated in the artefact and in 4.2's
      and 4.3's gates**

## Documentation updates

- `docs/master-plan/DECISION_REGISTER.md` — **D-114**
- `docs/migration/` — how to rebuild the corpus, and why it is anonymised

## Git checkpoint

One commit: the corpus, the rebuild script, the tests, the `.gitignore` rule, and D-114.

## Handover artefacts

- The corpus path and pair count, in the checkpoint
- **The option chosen for D-114**, so Phases 1.3, 4.1, 4.2 and 4.3 know where their gate's input
  lives

## Explicitly out of scope

- **The code fitting.** Deriving name, arity and fixity for the 56 codes is Phase 4.1. This stage
  produces the evidence; 4.1 reads it.
- The renderer. Phase 4.2.
- Committing raw dumps under any circumstances.

## Resume instructions

Read the checkpoint. If D-114 is recorded and the corpus is committed, this stage is done —
Phase 0 is complete, go to `PHASE-01-01-the-scoping-commit.md`. If D-114 is recorded but the
corpus is not built, build it. If D-114 is not recorded, settle it first — **do not build a
corpus under an unsettled data-handling decision.**

## TOKEN-BUDGET SAFE EXECUTION

1. Settle D-114 first. It is a decision, not a computation, and it is cheap.
2. **No specialist agents.**
3. Script everything. Emit counts and a path — never pairs.
4. **Checkpoint on progress, not only on completion.**
5. One commit at the end.
