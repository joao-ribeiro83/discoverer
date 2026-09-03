# PHASE 9.2 — Incremental re-import

**Model:** Opus · **Effort:** high

## Purpose

Let the source keep changing while the target is validated.

> **There is no "migrate what changed" path.** Migration into a fresh database is safe and
> proven; migration into an already-migrated database is **correctly refused**. The only
> partial route is `POST /api/migration/reimport-maps`, which re-imports maps only.
>
> **This is a real gap for a production cutover**, where the source keeps changing throughout
> the validation period.

## Scope

1. A delta path: detect what changed in the EUL since a recorded point, and apply only that.
2. Record the source state at each run so the next delta has a baseline.
3. Preserve the existing re-run guard for full migrations — **do not weaken it.**

## Prerequisites

Phase 9.1 — you need to know the migration is correct before making it repeatable.

## Required files to read first

- `AUDIT_MIGRATION_ASSESSMENT.md` §4 and §9 — idempotency, re-runs, rollback
- `docs/master-plan/DECISION_REGISTER.md` D-078, D-079
- `migrate/src/services/migration-runner.ts:300-340` — **the re-run guard, which is real and
  tested**
- `migrate/src/services/map-reimport.ts` — the existing partial route
- `migrate/EUL_SCHEMA_GROUND_TRUTH.md` — `EUL4_VERSIONS`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode`.

## Implementation instructions

- **Establish what "changed" means from the EUL itself** before designing. Does EUL4 carry
  modification timestamps or version counters on its objects? Probe `ALL_TAB_COLUMNS` on the
  main tables. **If it does not, the delta must be a content diff** — say so and design for it
  rather than assuming a timestamp exists.
- Record in `migration_log`: the source `EUL4_VERSIONS` state and **the migrating commit SHA**
  (D-078), so any run is reproducible.
- **A delta must be transactional and reversible per object.** A half-applied delta is worse
  than no delta — it produces a target that matches neither the old nor the new source.
- **Deleted source objects are the hard case.** Decide explicitly: delete in target, soft-delete,
  or refuse and report. Deleting metadata that a worksheet references would break it. **Prefer
  refuse-and-report** — this codebase's established instinct.
- Re-run the Phase 1.3 verifier after every delta.

## Tests

- A delta after a source change applies only that change
- A delta with no source change is a no-op
- **A deleted source object is handled by the chosen policy, not silently ignored**
- A failed delta rolls back cleanly
- The full-migration re-run guard **still refuses**
- The verifier runs after a delta and reports honestly

## Security checks

- **A delta can change grants and security policies.** Apply the Phase 5.1 rule: **no migrated
  grant may be broader than its source.** Assert it on every delta, not just the first
  migration.
- A delta must not silently re-enable a schedule that an operator disabled (Phase 7.2).

## Validation

```bash
cd discoverer-neo && npx dn-migrate delta --target <connection> --dry-run
npx dn-migrate delta --target <connection>
npx dn-migrate verify --target <connection>
```

## Acceptance criteria

- [ ] A delta applies only what changed
- [ ] A no-change delta is a no-op
- [ ] Deleted source objects follow an explicit, documented policy
- [ ] A failed delta rolls back cleanly
- [ ] **The full-migration re-run guard is unweakened**
- [ ] `migration_log` records the source version state and the commit SHA
- [ ] **No grant is widened by a delta**
- [ ] Operator-disabled schedules stay disabled
- [ ] The verifier runs after every delta

## Documentation updates

- `docs/migration/` — the delta path, its limits and the deletion policy
- `docs/decisions/` — the deletion policy decision

## Git checkpoint

The change-detection probe; the delta engine; the deletion policy; verifier integration. Push
after each.

## Handover artefacts

- **What "changed" means in EUL4**, established from the source, for
  `EUL_SCHEMA_GROUND_TRUTH.md`
- The deletion policy decision

## Explicitly out of scope

- The cutover runbook. Phase 9.3.
- Bidirectional sync. **Neo never writes to the EUL.**

## Resume instructions

Read the checkpoint, run a dry-run delta. Resume at the first unchecked criterion.

## TOKEN-BUDGET SAFE EXECUTION

1. **Probe change detection first.** The answer determines the whole design.
2. **No specialist agents.**
3. Use `context-mode` for probes and delta output.
4. Checkpoint the change-detection finding immediately — it is durable value.
5. Commit coherently.
6. **Never run a non-dry-run delta against a target you have not backed up.**
7. If interrupted, record the change-detection finding and the delta engine's state.
