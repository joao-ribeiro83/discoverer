# Phase 9.3 checkpoint — cutover runbook

The runbook is [`docs/deployment/cutover-runbook.md`](../../deployment/cutover-runbook.md).
Migration-side summary: [`docs/migration/cutover-and-rollback.md`](../../migration/cutover-and-rollback.md).

## Status

| Item | State |
|---|---|
| Runbook written, exact commands, exact decision points | Done |
| Rehearsed end to end in a scratch environment (2026-09-17) | Done — see timing table in the runbook |
| Every step has a failure signal and a rollback | Done |
| Rollback rehearsed, not assumed | Done — both directions, 7-8s each |
| Parallel-run exit criterion defined and measurable | Done — 14 days, zero unexplained mismatches on the top-20 worksheets by usage |
| Credential re-provisioning rehearsed for a real migrated user, out of band | Done — full login → gated → change-password → full-access sequence, against a real restored user row |
| Three MANUAL decisions surfaced and answered | Done — see below |
| `migration_log` records source version + commit SHA | Already built (`sourceStateDetail()`, Phase 9.2) — confirmed by code read, not a fresh live run; requires `DN_MIGRATE_COMMIT` set before the real run |
| UTF-16 dumps (INF-06) gone | Confirmed — none present; the one `.dump` in the tree is a genuine gitignored `pg_dump` output |
| Production config guard fires | Rehearsed live — refuses to boot on a default secret in production, boots clean on a real one |
| Verifier runs after the rehearsed cutover | Ran, both workspaces — reports `COMPLETED_WITH_BLOCKERS`, matching Phase 3.4/4.x's already-known blockers. **Not a clean pass** — the estate itself isn't migration-complete, which this phase doesn't change |

## The three MANUAL decisions

1. **`EUL4_B*Q*R1` historical result table retention** (Phase 7.2) — asked the
   user directly (no answer existed in the plan). **Decided: migrate the rows
   into `scheduled_results` before the legacy source is decommissioned.**
   Not yet implemented — that's new scope for whoever executes the real
   cutover, tracked here so it isn't lost.
2. **Date-hierarchy regeneration** (D-074) — already resolved at Phase 5.1,
   no action needed at cutover.
3. **Accepted result-set differences** (Phase 9.1) — already recorded in
   `docs/decisions/accepted-result-differences.md`; Phase 9.1 states
   equivalence is not yet proven for DISTINCT/multi-folder/master-detail
   worksheets. The parallel-run period is the safety net for that gap, not
   this runbook.

## What was rehearsed live vs. what wasn't

Rehearsed for real, against a real restored copy of the estate, in an
isolated scratch Docker stack (torn down at the end of the session):
backup, restore into a fresh database, connection-string promote and
rollback (both directions), the migration verifier (both workspaces),
credential re-provisioning end to end for a real migrated user row, and the
production secrets boot guard (both the refusal and the clean boot).

**Not rehearsed live: the Oracle-to-Postgres transform itself** (`dn-migrate
run` against the real EUL). Decrypting the live EUL's stored Oracle password
to run it was refused by this session's own safety controls
("credential materialization") — correctly, since that's a live production
credential. The workaround (restore a real backup into the scratch target
instead of re-running the transform) rehearses everything downstream of "a
target database has real migrated data in it," which is what the cutover
mechanics actually need to prove. The transform command itself is documented
in the runbook with the exact flags; a human with real Oracle credentials
needs to run it once, outside an agent session, the first time this runbook
is executed for real.

## Traps found while rehearsing

- `docker-compose.yml` hardcodes `container_name` for every service, so a
  second stack can't be brought up as a second Compose project without a
  name collision — a second, isolated set of `docker run` containers on
  their own network was used instead. Worth an override file if this runbook
  gets rehearsed often.
- A crashed container can still report `docker ps` as "running" under
  `tsx watch` dev-mode boot — the watcher catches the exception and keeps
  running. `docker logs` / `/health`, not container status, is the real
  signal. Documented in `docs/troubleshooting/recovery.md`.
- `MSYS_NO_PATHCONV=1` is needed for any `docker run -e SOME_PATH=/unix/path`
  on Windows/Git Bash, or the path gets silently rewritten to a Windows path.
- `must_change_password = true` over-counts people still needing a *new*
  credential — some rows already have a real bcrypt hash and are just mid-
  flow. The runbook and `docs/admin-guide/user-management.md` now give the
  two separate queries.

## Resume here

The runbook and its rehearsal record are the deliverable and are done. What's
still open for whoever executes a real cutover:

1. Implement the `EUL4_B*Q*R1` → `scheduled_results` migration (decision 1
   above) — not built yet.
2. Run Step 2 (the real Oracle transform) for real, once, with real
   credentials, outside an agent session — the one step this phase could not
   rehearse itself.
3. Everything else in the runbook has already been proven to work.
