# Cutover and rollback

The full, rehearsed, step-by-step procedure lives in
[`docs/deployment/cutover-runbook.md`](../deployment/cutover-runbook.md) —
this page is the migration-specific summary.

## The mechanism

Migrate into a **fresh** Postgres database with `dn-migrate run`, verify it,
then promote it by pointing the backend's `DATABASE_URL` at it and
restarting. **Never migrate into the database the live deployment is already
using** (D-078) — if the new run is wrong, the old database was never
touched, and rollback is switching `DATABASE_URL` back.

## Reproducibility

Every non-dry-run records the source EUL's `EUL4_VERSIONS` state and the
migrating commit SHA into `migration_log.detail`
(`sourceStateDetail()`, `migrate/src/services/migration-runner.ts:382`) —
automatically, but only if `DN_MIGRATE_COMMIT` (or `GIT_COMMIT` /
`GITHUB_SHA`) is set in the environment before the run. Set it explicitly:

```bash
export DN_MIGRATE_COMMIT=$(git rev-parse HEAD)
```

## Incremental re-import first, if the source has changed

If the Oracle EUL has changed since the last full run, use the delta path
([`docs/migration/incremental-delta.md`](incremental-delta.md)) rather than
re-running a full `dn-migrate run` — it records the same source-version and
commit detail into `migration_log` (`delta.ts:543`).

## Rollback

Switch `DATABASE_URL` back to the previous database and restart the backend.
Rehearsed both directions on 2026-09-17: **7-8 seconds** from restart to
`/health` reporting the database connected again. There is no data
migration to reverse — the previous database was never written to.
