# PHASE 4.5 — Compile the estate

**Model:** Opus · **Effort:** high

## Purpose

Compile all **49 819 stored calculated fields**, publish the partition, and make unresolved
formulas **block** migration readiness.

## Scope

1. Run the renderer over every `map_calculated_fields.formula` in the target database.
2. Publish the four-bucket partition: `COMPILED` / `COMPILED_UNVERIFIED` /
   `QUARANTINED(reason)` / `FAILED`.
3. **Feed `QUARANTINED` and `FAILED` into `scoreReadiness()` as blockers, not notes.**
4. Implement **dual storage** (D-055): keep the token form as lossless provenance alongside the
   compiled expression.
5. **WB-05** — `map_calculated_fields.data_type` is NULL because the *transformer* drops it.
   Fix the transformer.
6. **BE-05** — a calculated field mixing an aggregate with a bare column is omitted from GROUP
   BY, producing `ORA-00979`. Fix it, using the `containsAggregate` flag the renderer now sets.

## Why dual storage

The token form is lossless provenance — it enables re-import, diffing and forensic work, and
the schema already keeps `source_element_id` / `source_attrs` for exactly this reason.
**Improving the renderer must never require re-migrating.**

## Prerequisites

Phase 4.4. Phase 1.3 (the readiness scorer already emits blockers).

## Required files to read first

- `docs/master-plan/research/formula-decoder-analysis.md` §5, §7 stage 5
- `docs/master-plan/DECISION_REGISTER.md` D-055, D-059, D-071
- `migrate/src/services/assessment.ts` — `scoreReadiness()`
- `migrate/src/services/transformers/transform.ts` — the calculated-field write path and the
  `data_type` drop
- `backend/src/lib/sql/group-by-clause.ts` — for BE-05
- Phase 1.3's baseline bucket counts in `MASTER_PLAN_GENERATION_CHECKPOINT.md`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` — **essential**; 49 819 rows.

## Implementation instructions

- Compile as a **`dn-migrate verify` sub-check**, not a one-off script — it must be re-runnable
  as the renderer improves (D-070).
- Dual storage: add the compiled column; **keep the token column**. Compile lazily or in a
  batch, but never destroy the token form.
- **Readiness must refuse to report "ready" while `FAILED > 0`.** That is this stage's
  defining assertion.
- `QUARANTINED` counts should be reported per reason, so the next improvement is obvious.
- BE-05: a formula containing an aggregate **and** a bare column must place the bare column in
  GROUP BY. `containsAggregate` from the renderer's AST tells you which.

## Tests

- The compile run produces a partition summing to 49 819
- `FAILED = 0`
- **Readiness reports blockers when `FAILED > 0`** (force it with a fixture)
- The token form survives compilation
- `data_type` is non-null after a re-import
- A mixed aggregate/bare-column formula emits valid SQL, not `ORA-00979`

## Security checks

- The compile run reads customer formulas at scale — **do not log formula bodies** into shared
  logs or the audit trail. Log ids and reasons.
- Confirm the audit redactor from Phase 0.2 covers anything this stage writes.

## Validation

```bash
cd discoverer-neo && npx dn-migrate verify --target <connection>
```

```sql
SELECT compile_status, count(*) FROM map_calculated_fields GROUP BY 1;
SELECT count(*) FROM map_calculated_fields WHERE data_type IS NULL;
```

## Acceptance criteria

- [ ] All 49 819 formulas fall into exactly one bucket, summing correctly
- [ ] **`FAILED = 0`**
- [ ] **Readiness refuses to report "ready" while `FAILED > 0`**
- [ ] `QUARANTINED` is reported per reason
- [ ] The token form is retained alongside the compiled expression
- [ ] `data_type` is non-null after a re-import
- [ ] A mixed aggregate/bare-column formula no longer produces `ORA-00979`
- [ ] Formula bodies are not logged

## Documentation updates

- `docs/migration/` — the partition, how to read it, and what each quarantine reason means
- `docs/troubleshooting/` — the quarantine reasons, user-facing
- Phase 2.2's refusal UI renders these — keep the wording aligned

## Git checkpoint

Dual storage; the compile run; readiness blockers; `data_type`; BE-05. Push after each.

## Handover artefacts

- **The final partition.** This is the number that says how much of the estate actually works.
- The per-reason quarantine breakdown, as the backlog for any future fidelity work.

## Explicitly out of scope

- Conditions referencing calculated fields — schema change, Phase 5.3.
- Result-set equivalence. Phase 9.1.
- Any new function support beyond what Phase 4.3 attested.

## Resume instructions

Read the checkpoint, run `dn-migrate verify`, read the partition. If `FAILED = 0` and readiness
blocks on quarantines, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Dual storage → compile run → readiness → the two bug fixes. Commit each.
2. **No specialist agents.**
3. Use `context-mode` for the 49 819-row run — never read results into context.
4. **Checkpoint the partition immediately** — it is the phase's deliverable.
5. Commit coherently.
6. Leave CI green and readiness honest.
7. If interrupted, record the partition as far as it ran and whether dual storage is committed.
