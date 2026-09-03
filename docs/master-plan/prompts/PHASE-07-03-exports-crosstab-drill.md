# PHASE 7.3 — Exports, crosstab rendering, drill and formats

**Model:** Sonnet · **Effort:** medium

## Purpose

Finish the worksheet experience: exports that match the screen, crosstabs, drill, conditional
formatting and print.

## Scope

1. **Exports.** Prove XLSX and CSV against real migrated worksheets. `export_jobs` has **0
   rows** — nothing has ever run.
2. **Crosstab rendering.** `CrosstabTable.tsx` **exists** — wire it. But read the constraint
   below.
3. **Conditional formatting / exception highlighting** — schema ready and populated by
   Phase 5.4; no UI. A **headline Discoverer feature.**
4. **Hierarchy drill** — up, down, to-detail, now that Phase 5.1 migrated hierarchies.
5. **Print / PDF** honouring `map_page_setup` — **923 rows already migrated and entirely
   unused.**
6. **BE-07** — totals drop `SELECT DISTINCT`, so **372 maps would show totals that contradict
   their own rows.**

## The crosstab constraint — read before wiring

> **`crosstabs: 0` is a TRUE PROPERTY of this estate, not a detection failure.** Detection keys
> on Oracle's own class discriminator (`0x0384` table / `0x0385` crosstab) and is **verified
> working against Oracle's own sample workbook** `DISCVR4/VIDSTR4.DIS`.
>
> **`axis_edge` NULL on all 25 960 rows is CORRECT** — Discoverer records no row-vs-column edge
> at all. Neo sets it **when a user builds a crosstab**, not at migration.

So: wire `CrosstabTable.tsx` for **user-built** crosstabs. Do **not** try to infer an axis edge
from migrated data — there is nothing to infer from.

## Prerequisites

Phase 7.1. Phase 5.1 (hierarchies), Phase 5.4 (conditional formats, page setup populated).

## Required files to read first

- `docs/master-plan/research/ux-analysis.md` §5 P1 and §2
- `AUDIT_LEGACY_COMPATIBILITY_MATRIX.md` §C — **especially the crosstab rows and the "Rows
  corrected" table**
- `docs/master-plan/research/legacy-analysis.md` §4.4 — what drill does to the SQL
- `frontend/src/components/data-table/{ResultsTable,CrosstabTable}.tsx`
- `backend/src/services/exporters/`
- `backend/src/lib/sql/totals.ts` — for BE-07

## Required tooling

**Skills:** `frontend-design` **or** `ui-ux-pro-max` — exactly one.
**Agents:** none.
**Plugins / MCPs:** `Claude_Browser`, `playwright` (the export E2E spec exists).

## Implementation instructions

- **BE-07 first** — it is a correctness bug, and an export that carries contradictory totals is
  worse than no export. If a map is `SELECT DISTINCT`, its totals must be computed over the
  distinct set.
- Exports must reflect what the user sees, **including group breaks and subtotals**.
  `ResultsTable`'s docstring explains the semantics; the exporter must match.
- Drill changes the generated SQL — follow `legacy-analysis.md` §4.4. If a question there is
  UNKNOWN (grouped hierarchy levels and the GROUP BY), **refuse loudly** rather than guessing.
- Print honours `map_page_setup`: orientation, headers, footers — 923 rows are waiting.
- All four locales.

## Tests

- An XLSX export of a real migrated worksheet **matches the on-screen rows**, including totals
- **A `SELECT DISTINCT` map's totals match its own rows** (BE-07)
- A CSV export round-trips
- A user-built crosstab renders through `CrosstabTable`
- Conditional formats render at cell and row level
- Drill down changes the query and returns the expected grain
- Print layout honours the migrated page setup
- The existing export E2E spec passes in CI

## Security checks

- **Exports are ownership-gated with UUID-derived paths and no path traversal** — this is
  verified-sound today. **Do not regress it.**
- An export must apply the same RLS predicates as the on-screen query. Add a test: an
  unentitled user's export contains no rows they could not see.
- Large exports are a resource-exhaustion vector — confirm the job queue bounds them.

## Validation

```bash
cd discoverer-neo && npm test --workspace backend
cd frontend && npx playwright test export.spec.ts
```

Then `Claude_Browser`: run a worksheet, export it, open the file, compare.

## Acceptance criteria

- [ ] XLSX and CSV exports match the on-screen rows, including group breaks and totals
- [ ] **`SELECT DISTINCT` totals no longer contradict their rows** (372 maps)
- [ ] User-built crosstabs render
- [ ] **No attempt was made to infer `axis_edge` from migrated data**
- [ ] Conditional formats render at cell and row level
- [ ] Drill up / down / to-detail work, or refuse loudly where the semantics are UNKNOWN
- [ ] Print honours `map_page_setup`
- [ ] **Exports apply RLS**, with a test
- [ ] Export ownership gating and path safety are unregressed
- [ ] All four locales

## Documentation updates

- `docs/user-guide/{exporting-data,building-maps}.md` — crosstabs, drill, formats, print
- `docs/decisions/eul-fidelity-decisions.md` — **why `axis_edge` is NULL and correct**
- All four locales

## Git checkpoint

BE-07; exports; crosstab; formats; drill; print. Push after each.

## Handover artefacts

- An exported file alongside a screenshot of the same worksheet, as proof they match

## Explicitly out of scope

- PDF/HTML/text export formats — XLSX and CSV are the deliberate modern subset. Add PDF only on
  demand.
- Inferring crosstab edges from migrated data — **there is nothing to infer.**
- Bulk operations, saved views, column pinning, density control — later polish.

## Resume instructions

Read the checkpoint, export a worksheet and compare it to the screen.

## TOKEN-BUDGET SAFE EXECUTION

1. **BE-07 first** (correctness), then exports, then the rendering features.
2. **No specialist agents.**
3. Verify in the browser after each feature.
4. Checkpoint after each commit.
5. Commit coherently; leave CI green including the export E2E spec.
6. If interrupted, record which of the six scope items are complete.

---

## ⟐ ADDITIONS from the plan review (E-08 / D-09)

### 1. An export-history view

`export_jobs` is a real table and `routes/export.ts:81-110` is a correct, ownership-gated
download route that re-checks `canAccessMap` at request time. **There is no UI for any of it** —
no route, no component, nothing that lets a user see, re-download or cancel a previous export.
For an enterprise BI tool, *"where did my export go"* is a first-week question.

This is a list view over data that already exists. Add it.

### 2. The export gate must assert predicates, not rows

v1.0's gate is *"export matches on-screen rows."* **That passes if both are equally
unfiltered** — which, given the RLS gaps this review found, is the failure it should be
catching.

- [ ] **An export carries the same security predicates as the on-screen query.** This is test 11
      of the RLS conformance suite Phase 1.1 introduced; run it here against a real export.

### 3. Crosstab — the evidence, so a future estate is not blocked

`axis_edge` stays NULL from migration because Discoverer records no edge — correct, and D-002
rejects the "crosstab loss" finding on the grounds that `crosstabs: 0` is true of *this* estate.
**Record the evidence**: the container distinguishes the layouts at tag `0x01f8`
(`[0x0384]` table / `[0x0385]` crosstab, `EUL_SCHEMA_GROUND_TRUTH.md:1006`), and every worksheet
here is `0x0384`. **An estate containing `0x0385` reopens the question** — which is exactly what
D-002's "new evidence" escape clause needs in order to be usable.
