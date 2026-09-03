# PHASE 5.4 — Population fidelity

**Model:** Sonnet · **Effort:** high

## Purpose

Fill the schema Neo already has. **The cheapest fidelity available in the project.**

> *"Most of that loss is population, not modelling: the schema already models crosstab edges,
> conditional formats, worksheet identity, sort rank and percentages, and simply has no rows."*
>
> These need **a transformer fix, not a redesign.**

## Scope

1. **Multi-BA folder links.** `EUL4_BA_OBJ_LINKS` is genuinely M:N — one folder can live in
   several business areas — and the migrator writes only `folders.business_area_id`. Write the
   first link there and **every additional link to `folder_business_areas`**, the table that
   already exists for Neo's own sharing feature. **No schema change needed** (D-075).
2. **Worksheet layouts.** Only 24 of 923 are in the database — **stale data, not a code
   defect.** `transform.ts:1570-1573` names the old behaviour as a fixed bug; current writers
   push unconditionally. **`POST /api/migration/reimport-maps` should produce 923.** Expect
   `count(*) = 923`, `worksheet_index = 923`, `source_attrs = 24`.
3. **`data_type`** — dropped by the transformer (WB-05), if Phase 4.5 did not already fix it.
4. **Conditional formats** — `map_conditional_formats` and `map_format_target CELL|ROW` exist
   with **0 rows**. Exception highlighting is a headline Discoverer feature.
5. **Sort rank, sort group, column widths, alignment, word wrap, heading format masks** —
   all columns exist; population unverified.
6. **Title token substitution** — the viewer prints `&Date (&Time) &Dt Início &Dt Fim`
   literally.
7. **MIG-08** — the 171 skipped items are one folder with no business area, **absent in
   source**. Confirm and declare it as an expected loss; do not chase it.

## What NOT to chase — ABSENT IN SOURCE

These are **not** losses. The `.DIS` container does not carry them, and scoring them as gaps
would fund work with nothing to recover:

- **Crosstab row-vs-column edge** — Discoverer records no edge at all. `axis_edge` NULL on all
  25 960 rows is **correct**; Neo sets it when a *user* builds a crosstab.
- **Percentages** — live in Discoverer's query layer (`DCBPercentageRequest` in `DCB.DLL`), not
  the workbook body.
- **Graphs** — `CLASS.GRAPH = 0x0272` is empty on every workbook in the corpus. `graph: null`
  is correct.
- **`crosstabs: 0`** is a **true property of this estate**, verified against Oracle's own
  sample workbook. Detection works.

## Prerequisites

Phase 5.1.

## Required files to read first

- `AUDIT_LEGACY_COMPATIBILITY_MATRIX.md` §C and the "Rows corrected" table — **the
  authoritative brief for what is and is not recoverable**
- `docs/master-plan/DECISION_REGISTER.md` D-075
- `docs/master-plan/research/architecture-analysis.md` §3.1 / R3
- `migrate/src/services/transformers/transform.ts` — around `:1570` and the `map_items` write
  path
- `migrate/src/services/map-reimport.ts`
- `backend/src/db/schema.ts` — `map_conditional_formats`, `map_layouts`, `map_items`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode`.

## Implementation instructions

- **Start with the re-import.** Item 2 may need no code at all — run
  `POST /api/migration/reimport-maps` and measure. If layouts reach 923, that item is done.
- Multi-BA links need no schema change; also **union `folder_business_areas` into
  `loadMapDefinition`'s folder load** if Phase 1.2 did not already (BE-12).
- Title tokens (`&Date`, `&Time`, and named parameters) substitute at **render** time, not
  migration time — the values are per-execution.
- For each population item, **measure before and after.** A column that was already populated
  needs no work.

## Tests

- A folder in three business areas produces one owning row and two `folder_business_areas` rows
- **`map_layouts` count equals `maps` count**
- Conditional formats migrate and reach `map_conditional_formats`
- Sort rank, sort group, widths, alignment and wrap are populated where the source has them
- A title with tokens renders substituted values, not literals
- Phase 1.3's reconciliation test's expected-loss allowances **shrink**

## Security checks

- Multi-BA folder links **widen visibility**. Confirm `assertDataEntitlement` still requires
  entitlement to *every* BA a folder belongs to, not any one of them — otherwise this is a
  quiet authorisation widening.

## Validation

```bash
cd discoverer-neo && npm test --workspace migrate
npx dn-migrate verify --target <connection>
```

```sql
SELECT count(*) FROM map_layouts;                    -- expect 923
SELECT count(*) FROM map_conditional_formats;        -- expect > 0
SELECT count(*) FROM folder_business_areas;          -- expect > 0
SELECT count(*) FROM map_items WHERE sort_rank IS NOT NULL;
```

## Acceptance criteria

- [ ] `map_layouts` count equals `maps` count (923)
- [ ] Multi-BA folder links are written to `folder_business_areas`
- [ ] **Entitlement requires every BA of a folder, not any**
- [ ] Conditional formats are populated
- [ ] Sort rank, sort group, widths, alignment, wrap populated where the source has them
- [ ] Title tokens substitute at render time
- [ ] `data_type` is non-null
- [ ] The 171 skipped items are **declared** as absent in source
- [ ] **Nothing in the ABSENT IN SOURCE list was chased**
- [ ] Reconciliation allowances shrink

## Documentation updates

- `docs/decisions/eul-fidelity-decisions.md` — the ABSENT IN SOURCE band, so nobody funds it
  later
- `docs/admin-guide/metadata-management.md` — multi-BA folders

## Git checkpoint

Re-import measurement; multi-BA; conditional formats; the `map_items` columns; title tokens.
Push after each.

## Handover artefacts

- A before/after population table for every column touched
- The shrunken reconciliation allowances

## Explicitly out of scope

- **Conditional-format *rendering*.** Phase 7.3 — this stage populates the data.
- Crosstab axis edge, percentages, graphs — **absent in source.**
- The `workbooks` aggregate. Phase 7.1.

## Resume instructions

Read the checkpoint, run the four SQL counts. Resume at the first unchecked criterion.

## TOKEN-BUDGET SAFE EXECUTION

1. **Re-import and measure first** — item 2 may already be done, and the measurements scope
   everything else.
2. **No specialist agents.** Route bulk transformer edits to a **Haiku** sub-agent only if they
   exceed a few files — one agent.
3. Use `context-mode` for migration output.
4. Checkpoint the before/after table as you go.
5. Commit coherently.
6. Leave the migrate suite green.
7. If interrupted, record the population state of each column.
