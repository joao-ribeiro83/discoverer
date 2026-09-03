# PHASE 9.1 — Result-set equivalence

**Model:** Opus · **Effort:** max

## Purpose

**Prove the migration.** This is the only test that does.

> *"The current success criterion is 'rows were imported.' It must become **'the new system
> reproduces the old system's output.'**"*
>
> Everything before this proved that Neo reads Discoverer correctly. **This proves Neo answers
> the same question the same way.**

## Scope

1. **Run the same worksheet in legacy Discoverer and in Neo, and diff the result sets.**
2. Choose the worksheets that matter using **`EUL4_QPP_STATS`' 7 316 recorded executions** —
   the estate's own usage history.
3. If Phase 0.3's Q5 confirmed `QPP_STATS` records **returned row counts**, use it as an
   **independent oracle for the fan-trap guard** — otherwise the guard is unverifiable from
   this repository alone.
4. Report a per-worksheet verdict: **match / mismatch / refused / not comparable.**

## The pattern already exists

The team has built this class of tool once, and built it well: the **`d4wkdmp` differ** — 547
reference dumps from Oracle's own decoder, a dump parser, a differ and an aggregate report,
with 0 harness failures across 544 workbooks.

**Apply the same pattern to *results*, not metadata.** Do not invent a new architecture for it.

## Prerequisites

Phase 3.4 (the planner is live and proven). Phase 4.5 (formulas compile). Phase 5.x (metadata
fidelity). **Access to the legacy Discoverer system, or to its recorded output.**

## Required files to read first

- `AUDIT_MIGRATION_ASSESSMENT.md` §8 — the four validation tiers; this stage is **Tier 4**
- `docs/master-plan/research/legacy-analysis.md` §10 — the validation hooks, especially §10.1
- `docs/master-plan/research/eul-probe-results.md` — Q5
- `migrate/src/scripts/diff-corpus.ts`, `migrate/src/services/d4wkdmp-differ.ts` — **the
  pattern to copy**
- The Phase 3.4 planner-decision histogram in `MASTER_PLAN_GENERATION_CHECKPOINT.md`

## Required tooling

**Skills:** none.
**Agents:** none — but this is a stage where a specialist could help if the comparison sprawls.
**One at a time, foreground, if so.**
**Plugins / MCPs:** `context-mode` — **essential**; result sets are large and must never enter
context.

## Implementation instructions

- **Stratify the sample deliberately.** Use `QPP_STATS` to rank by real usage, then cover:
  single-folder and multi-folder; with and without calculated fields; with and without totals;
  `SELECT DISTINCT` and not; **and at least one known master–detail join** (`M M67 1 → M M67`).
  A sample that avoids the hard cases proves nothing.
- **Compare row sets, not row order**, unless the worksheet has a sort — then compare order too.
- **Normalise before comparing:** numeric precision, date formatting, NULL vs empty string,
  and character encoding. The estate is Portuguese; encoding differences will otherwise read as
  mismatches.
- **A mismatch is a finding, not a failure to hide.** Report it with both values.
- If legacy Discoverer is not reachable, say so plainly and fall back to `QPP_STATS`' recorded
  row counts as a **weaker** oracle — and **label it as weaker.**

## Tests

- The differ runs over the stratified sample and produces a verdict per worksheet
- **A known master–detail join's aggregate matches the source system** — the fan-trap proof
- A `SELECT DISTINCT` worksheet's row count matches
- A worksheet with calculated fields matches
- Normalisation does not mask a real difference — test it with a deliberately altered value

## Security checks

- **This stage handles real customer result data in bulk.** Do not write result sets into
  committed files. Store verdicts and counts; keep row-level data out of the repository and out
  of logs.
- Run comparisons with an account whose entitlement matches the legacy user, or the comparison
  is invalid **and** may expose rows the comparing user should not see.

## Validation

```bash
cd discoverer-neo && npx tsx migrate/src/scripts/diff-results.ts --sample <n>
```

## Acceptance criteria

- [ ] A stratified sample is chosen from real usage history, covering the hard cases
- [ ] Each sampled worksheet has a verdict: match / mismatch / refused / not comparable
- [ ] **A known master–detail join's aggregate matches the source system** — the fan-trap guard
      is independently proven
- [ ] Normalisation is documented and tested
- [ ] Mismatches are reported with both values, not hidden
- [ ] **No result-set data was committed or logged**
- [ ] If legacy access was unavailable, the weaker oracle is used and **labelled as weaker**

## Documentation updates

- `docs/migration/` — the validation strategy, the sample and the results
- `docs/decisions/` — any accepted difference, with its justification

## Git checkpoint

The differ; the sample selection; the results report. Push after each.

## Handover artefacts

- **The equivalence report.** This is the artefact that says whether the migration can be
  trusted, and it is the input to the cutover decision.
- The list of accepted differences, each with a reason.

## Explicitly out of scope

- Fixing every mismatch — some will be accepted differences (modern equivalents, deliberate
  incompatibilities like fail-closed RLS). **Report and classify; do not silently converge.**
- Incremental re-import. Phase 9.2.
- The cutover runbook. Phase 9.3.

## Resume instructions

Read the checkpoint and the equivalence report. Resume at the first uncompared stratum.

## TOKEN-BUDGET SAFE EXECUTION

1. Build the differ, run a **small** sample, read the verdicts, then widen.
2. **No parallel specialist execution.** If you delegate, one agent, foreground.
3. Use `context-mode` for every comparison — result sets must never enter context.
4. Checkpoint the verdict counts after each batch.
5. Commit coherently.
6. If interrupted, record which strata are compared and the running verdict counts.
