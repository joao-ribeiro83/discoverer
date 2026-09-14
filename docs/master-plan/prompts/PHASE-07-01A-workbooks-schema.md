# PHASE 7.1a — The `workbooks` schema

**Model:** Opus · **Effort:** medium

## Purpose

Match the user's mental model. **Discoverer users think in workbooks, share workbooks and
schedule workbooks** — Neo presents 564 workbooks as **923 unrelated maps** whose only link is
a name prefix (`GD_M.M27_V08 — M27 - Detalhe de Pagamentos`).

## Scope

1. A `workbooks` table with an **ordered** worksheet relation.
2. Populate it from migration. **`map_layouts` already carries `worksheet_index` and
   `worksheet_guid` for exactly this.**

## The constraint that matters

> **Keep `workbooks` out of the authorisation path** (D-020).
>
> `map_shares` is per-map. If sharing migrates to the workbook, a **second authorisation model
> lands while the first is still settling.** Sequence this after the Phase 1.1 scoping change
> has shipped **with tests** — which it has, if you are here.

Workbook-level sharing is a **later, separate decision**. This stage models the aggregate; it
does not move authorisation.

## Prerequisites

Phase 2.3. Phase 1.1 shipped with tests. Phase 5.4 (worksheet layouts populated at 923).

## Required files to read first

- `AUDIT_ARCHITECTURE_ASSESSMENT.md` §4 R6
- `docs/master-plan/DECISION_REGISTER.md` D-020, D-100
- `backend/src/db/schema.ts` — `map_layouts` (`worksheet_index`, `worksheet_guid`), `maps`
- `migrate/src/services/transformers/transform.ts` — the workbook/worksheet split

## Required tooling

**Skills:** graphify.
**Agents:** none.
**Plugins / MCPs:** `typescript-lsp`.
**Graphify:** `graphify query "what populates the workbooks table from map layouts and worksheet indexes"` — finds the transformer and schema for workbook aggregation.

## Implementation instructions

- The schema lives in `core`'s `db/schema.ts` per D-011, re-exported by backend.
- Populate from the existing parse — the workbook identity is already decoded; this is a
  transformer change plus a migration, not new parsing.

## Tests

- 564 workbooks are created from the estate
- Worksheets order correctly within a workbook, by `worksheet_index`
- **A workbook grants no access its worksheets did not already grant** — the authorisation test

## Security checks

- **The critical one:** confirm listing or opening a workbook does **not** bypass
  `assertDataEntitlement` on its worksheets. Add an explicit test.
- Do not add a workbook-level share table in this stage.

## Validation

```bash
cd discoverer-neo && npm test --workspace backend && npm test --workspace migrate
```

```sql
SELECT count(*) FROM workbooks;                              -- expect 564
SELECT count(*) FROM maps WHERE workbook_id IS NULL;         -- expect 0
```

## Acceptance criteria

- [ ] 564 workbooks exist; every map belongs to one
- [ ] Worksheets order correctly within a workbook
- [ ] **A workbook grants no access its worksheets did not already grant**
- [ ] **No workbook-level share model was added**

## Git checkpoint

Schema + migration; transformer. Push after each.

## Handover artefacts

- The workbook count and the orphan-map count (expect 0)

## Explicitly out of scope

- **Workbook-level sharing.** A separate later decision.
- Workbook-level scheduling. Phase 7.2 migrates schedules as they are.
- Crosstab, drill, conditional formats. Phase 7.3.
- The browse UI — see PHASE-07-01B-workbooks-browse-ui.md.

## Resume instructions

Read the checkpoint, run the two SQL counts.

## TOKEN-BUDGET SAFE EXECUTION

1. Schema → transformer. Commit each.
2. **No specialist agents.**
3. Checkpoint after each commit.
4. Commit coherently; leave both suites green.
5. If interrupted, record whether the migration has been applied.

### Counts

The workbook and worksheet counts come from **Phase 0.4's recorded baseline**, not from a
literal in this prompt.
