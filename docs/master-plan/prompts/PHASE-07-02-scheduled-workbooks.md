# PHASE 7.2 — Scheduled workbook migration

**Model:** Sonnet · **Effort:** high

## Purpose

Migrate the estate's scheduled workbooks into the scheduler that **already exists and works**.

> Source: `EUL4_BATCH_REPORTS` (19), `_SHEETS` (10), `_QUERIES` (13), `_PARAMS` (15),
> `EUL4_BR_RUNS` (14), plus **nine materialised `EUL4_B<ts>Q<n>R1` result tables**.
> Target: `schedules`, `schedule_parameters`, `scheduled_results` — **all 0 rows**.
>
> A **816-line `scheduler.service.ts`** and a **727-line `SchedulesPage.tsx`** exist and work.
> Nothing was ever migrated into them.

## Scope

1. Read `EUL4_BATCH_*` and `EUL4_BR_RUNS` into `schedules` and `schedule_parameters`.
2. Map Discoverer's frequency model onto the existing BullMQ scheduler.
3. **Decide retention for the nine `EUL4_B*Q*R1` historical result tables — before the source
   is decommissioned.**

## The MANUAL classification

The nine materialised result tables hold **historical batch output**. A modern job store
(`scheduled_results` + object storage) is the right replacement — **but the historical rows they
contain must be assessed for retention value before the source is decommissioned.**

**This is a human decision, not a technical one.** Surface the volume, the date range and the
content shape; **ask; record the answer in `docs/decisions/`.** Do not decide it silently, and
do not let the stage block on it — migrate the schedules regardless.

## Prerequisites

Phase 7.1. Phase 5.2 (parameters carry item classes, so scheduled parameters resolve).

## Required files to read first

- `AUDIT_LEGACY_COMPATIBILITY_MATRIX.md` §D — scheduled workbooks and scheduled result sets
- `AUDIT_MIGRATION_ASSESSMENT.md` §6 — the classification table
- `backend/src/services/scheduler.service.ts` (816 lines — **grep, read ranges**)
- `backend/src/db/schema.ts` — `schedules`, `schedule_parameters`, `scheduled_results`
- `migrate/src/services/eul-reader.ts`
- `migrate/EUL_SCHEMA_GROUND_TRUTH.md`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode`.

## Implementation instructions

- **Probe the `EUL4_BATCH_*` columns before modelling.** They are not documented in
  `EUL_SCHEMA_GROUND_TRUTH.md` yet. `ALL_TAB_COLUMNS` + `SELECT *` — the tables are small
  (10–19 rows). **Do not guess column names**; this repository has a documented history of
  fabricated schema reaching production code.
- A migrated schedule should arrive **disabled by default.** Silently starting 19 batch jobs
  against a customer's Oracle on first boot would be a genuine incident. Make enabling explicit.
- `EUL4_FREQ_UNITS` is EUL bookkeeping — map its meaning, do not migrate the table.

## Tests

- Batch reports migrate into `schedules` with correct frequency
- Scheduled parameters migrate and resolve
- **A migrated schedule is disabled until explicitly enabled**
- Enabling one produces a real run
- Run history from `EUL4_BR_RUNS` is preserved or explicitly declared lost

## Security checks

- **A migrated schedule runs a query as some principal.** Confirm it runs with the migrated
  owner's entitlement, through `assertDataEntitlement` — **not as an unscoped service
  account.** A scheduler that bypasses RLS is a data-exfiltration path.
- Scheduled export files inherit the ownership-gated, UUID-derived path model — confirm it.

## Validation

```bash
cd discoverer-neo && npm test --workspace backend && npm test --workspace migrate
```

```sql
SELECT count(*), count(*) FILTER (WHERE enabled) FROM schedules;
SELECT count(*) FROM schedule_parameters;
```

## Acceptance criteria

- [ ] Batch reports migrate with correct frequency and parameters
- [ ] **Every migrated schedule is disabled by default**
- [ ] **A schedule runs with its owner's entitlement, not a service account**
- [ ] Enabling one produces a real run
- [ ] Run history is preserved or the loss is declared
- [ ] **The nine result tables' retention question is surfaced to a human and the answer
      recorded in `docs/decisions/`**
- [ ] `EUL4_BATCH_*` columns are added to `EUL_SCHEMA_GROUND_TRUTH.md`

## Documentation updates

- `migrate/EUL_SCHEMA_GROUND_TRUTH.md` — the `EUL4_BATCH_*` columns
- `docs/user-guide/scheduling.md` — that migrated schedules arrive disabled
- `docs/decisions/` — the retention decision
- All four locales

## Git checkpoint

Probe results; reader; transformer; the disabled-by-default behaviour. Push after each.

## Handover artefacts

- The schedule count, and how many are enabled (expect 0)
- The retention decision, or the question if unanswered

## Explicitly out of scope

- Migrating the nine result tables' **contents** until the retention decision is made.
- Workbook-level scheduling. A later decision.
- Export format work. Phase 7.3.

## Resume instructions

Read the checkpoint, run the two SQL counts.

## TOKEN-BUDGET SAFE EXECUTION

1. **Probe columns first**, record them, then model.
2. **No specialist agents.**
3. Use `context-mode` for probes.
4. Checkpoint the probe results — they are durable value for `EUL_SCHEMA_GROUND_TRUTH.md`.
5. Commit coherently; leave both suites green.
6. **Never enable a migrated schedule to "test it" against the customer's Oracle** without
   saying so.
7. If interrupted, record the probe findings and the migration state.

---

## ⟐ CORRECTIONS from the plan review (A-08 / D-10 / R-32)

### Model raised to Opus

This stage now contains planner semantics, not CRUD. **`Model: Opus · Effort: high`.**

### A pre-flight planner pass at import time

**A refusal is a UI state (D-036). A schedule has no UI at the moment it runs.**

From Phase 3.3 onward the planner refuses on four rules plus the re-aggregation set — and D-035
notes the estate has **282 `COUNT DISTINCT` totals**, every one of which refuses across a fan.
If the Phase 0.3 probe found no cardinality flags (D-118), refusals are the common case, not the
edge case.

Without a pre-flight pass, a workbook that ran for years starts failing overnight, unattended,
with the reason in a job record nobody reads.

**Scope addition:** run the planner in **validate-only mode (D-117)** over every migrated
schedule *at import time*, and produce a report of the schedules that will refuse — before the
first run.

- [ ] **No migrated schedule is activated whose definition the planner refuses.** Those import as
      `DISABLED` with the refusal rule and folders recorded.
- [ ] **A scheduled run executes under the schedule owner's entitlements** — asserted with two
      users and one policy. Without this, a scheduled export is a route around Phase 1.1's
      `assertDataEntitlement`.

### Prerequisite added

**Phase 3.4** — the planner must be live and its decisions recorded before this stage can
pre-flight anything against it.
