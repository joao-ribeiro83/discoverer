# PHASE 7.1b — The workbook browse UI

**Model:** Sonnet · **Effort:** high

## Purpose

Match the user's mental model. **Discoverer users think in workbooks, share workbooks and
schedule workbooks** — Neo presents 564 workbooks as **923 unrelated maps** whose only link is
a name prefix (`GD_M.M27_V08 — M27 - Detalhe de Pagamentos`).

## Scope

A workbook browse view above the Maps list built in Phase 2.1.

## Prerequisites

PHASE-07-01A-workbooks-schema.md must be shipped — the `workbooks` table and its population
from migration.

## Required files to read first

- `docs/master-plan/research/ux-analysis.md` §3 — the information architecture
- `frontend/src/pages/MapsListPage.tsx` — Phase 2.1's real list
- `backend/src/db/schema.ts` — `workbooks`, `maps` (for the data shape the UI consumes)

## Required tooling

**Skills:** graphify, `frontend-design` **or** `ui-ux-pro-max` — exactly one.
**Agents:** none.
**Plugins / MCPs:** `Claude_Browser`.
**Graphify:** `graphify query "how is the maps list UI structured and where should a workbook browse view sit above it"`.

## Implementation instructions

- The browse view sits **above** the flat list, which stays. `/maps` continues to work — the
  flat list is still the fastest way to find one worksheet by name.
- All four locales.

## Tests

- The browse view lists workbooks and drills to worksheets
- The flat Maps list still works

## Validation

`Claude_Browser`: browse workbooks, drill into one, open a worksheet.

## Acceptance criteria

- [ ] The browse view works and the flat list still works
- [ ] All four locales

## Documentation updates

- `docs/developer-guide/architecture.md` — the aggregate
- `docs/user-guide/getting-started.md` — workbook navigation
- All four locales

## Git checkpoint

UI. Push after commit.

## Explicitly out of scope

- **Workbook-level sharing.** A separate later decision.
- Workbook-level scheduling. Phase 7.2 migrates schedules as they are.
- Crosstab, drill, conditional formats. Phase 7.3.
- The schema and migration — see PHASE-07-01A-workbooks-schema.md.

## Resume instructions

Read the checkpoint, browse in the UI.

## TOKEN-BUDGET SAFE EXECUTION

1. UI only. Commit when done.
2. **No specialist agents.**
3. Checkpoint after commit.
