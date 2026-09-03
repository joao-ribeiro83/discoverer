# PHASE 7.1 — The `workbooks` aggregate

**Model:** Opus *(schema)* / Sonnet *(UI)* · **Effort:** high

## Purpose

Match the user's mental model. **Discoverer users think in workbooks, share workbooks and
schedule workbooks** — Neo presents 564 workbooks as **923 unrelated maps** whose only link is
a name prefix (`GD_M.M27_V08 — M27 - Detalhe de Pagamentos`).

## Scope

1. A `workbooks` table with an **ordered** worksheet relation.
2. Populate it from migration. **`map_layouts` already carries `worksheet_index` and
   `worksheet_guid` for exactly this.**
3. A workbook browse view above the Maps list built in Phase 2.1.

## The constraint that matters

> **Keep `workbooks` out of the authorisation path** (D-020).
>
> `map_shares` is per-map. If sharing migrates to the workbook, a **second authorisation model
> lands while the first is still settling.** Sequence this after the Phase 1.1 scoping change
> has shipped **with tests** — which it has, if you are here.

Workbook-level sharing is a **later, separate decision**. This stage models the aggregate and
browses it; it does not move authorisation.

## Prerequisites

Phase 2.3. Phase 1.1 shipped with tests. Phase 5.4 (worksheet layouts populated at 923).

## Required files to read first

- `AUDIT_ARCHITECTURE_ASSESSMENT.md` §4 R6
- `docs/master-plan/DECISION_REGISTER.md` D-020, D-100
- `docs/master-plan/research/ux-analysis.md` §3 — the information architecture
- `backend/src/db/schema.ts` — `map_layouts` (`worksheet_index`, `worksheet_guid`), `maps`
- `migrate/src/services/transformers/transform.ts` — the workbook/worksheet split
- `frontend/src/pages/MapsListPage.tsx` — Phase 2.1's real list

## Required tooling

**Skills:** `frontend-design` **or** `ui-ux-pro-max` — exactly one, for the browse view.
**Agents:** none.
**Plugins / MCPs:** `typescript-lsp`, `Claude_Browser`.

## Implementation instructions

- The schema lives in `core`'s `db/schema.ts` per D-011, re-exported by backend.
- Populate from the existing parse — the workbook identity is already decoded; this is a
  transformer change plus a migration, not new parsing.
- The browse view sits **above** the flat list, which stays. `/maps` continues to work — the
  flat list is still the fastest way to find one worksheet by name.
- All four locales.

## Tests

- 564 workbooks are created from the estate
- Worksheets order correctly within a workbook, by `worksheet_index`
- **A workbook grants no access its worksheets did not already grant** — the authorisation test
- The browse view lists workbooks and drills to worksheets
- The flat Maps list still works

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

Then `Claude_Browser`: browse workbooks, drill into one, open a worksheet.

## Acceptance criteria

- [ ] 564 workbooks exist; every map belongs to one
- [ ] Worksheets order correctly within a workbook
- [ ] **A workbook grants no access its worksheets did not already grant**
- [ ] The browse view works and the flat list still works
- [ ] All four locales
- [ ] **No workbook-level share model was added**

## Documentation updates

- `docs/developer-guide/architecture.md` — the aggregate
- `docs/user-guide/getting-started.md` — workbook navigation
- All four locales

## Git checkpoint

Schema + migration; transformer; UI. Push after each.

## Handover artefacts

- The workbook count and the orphan-map count (expect 0)

## Explicitly out of scope

- **Workbook-level sharing.** A separate later decision.
- Workbook-level scheduling. Phase 7.2 migrates schedules as they are.
- Crosstab, drill, conditional formats. Phase 7.3.

## Resume instructions

Read the checkpoint, run the two SQL counts, browse in the UI.

## TOKEN-BUDGET SAFE EXECUTION

1. Schema → transformer → UI. Commit each.
2. **No specialist agents.**
3. Checkpoint after each commit.
4. Commit coherently; leave both suites green.
5. If interrupted, record whether the migration has been applied.

---

## ⟐ CORRECTION — split into two single-model stages (R-19 / G-04 / D-007)

This prompt's header reads **`Model: Opus (schema) / Sonnet (UI)`** — an instruction to switch
model mid-session, which **D-007 explicitly forbids** because it discards the prompt cache and
re-bills the whole context at write price.

- **7.1a — the `workbooks` schema** · `Model: Opus · Effort: medium`. `map_layouts` already
  carries `worksheet_index` and `worksheet_guid` for exactly this. **Keep it out of the
  authorisation path** (D-020) — `map_shares` is per-map, and a second authorisation model must
  not land while the first is still changing.
- **7.1b — the workbook browse UI** · `Model: Sonnet · Effort: high`.

**No stage may name two models (D-119).**

### Counts

The workbook and worksheet counts come from **Phase 0.4's recorded baseline**, not from a
literal in this prompt.
