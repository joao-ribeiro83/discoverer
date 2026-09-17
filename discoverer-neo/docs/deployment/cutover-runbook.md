# Production cutover runbook

How to move from the legacy Discoverer estate to Discoverer Neo in production,
and how to undo it if something is wrong. Every step below was rehearsed end
to end in a scratch environment on 2026-09-17; the timings are real, not
estimates. See [Rehearsal record](#rehearsal-record-2026-09-17) at the bottom.

**Executing the real cutover is not covered here** — this is the rehearsed
procedure, ready for someone to run when the business schedules it. See the
three [blocking decisions](#blocking-decisions) before that date is picked.

## Principle

Migrate into a **fresh database**, promoted by a connection-string switch.
Never migrate in place (D-078). Rollback is the same switch, backwards.

## Before you start

- [ ] Phase 9.1 equivalence report reviewed — [`docs/migration/result-equivalence.md`](../migration/result-equivalence.md)
- [ ] Phase 9.2 incremental delta available if the source changed since the last full run — [`docs/migration/incremental-delta.md`](../migration/incremental-delta.md)
- [ ] The three [blocking decisions](#blocking-decisions) below are answered
- [ ] `scripts/backup.sh` and `scripts/restore.sh` both exist and are executable
- [ ] You have the live EUL's Oracle credentials and `ORACLE_THICK_MODE`/`ORACLE_CLIENT_PATH` are set if the source needs thick mode (12c password verifier — see `docs/migration/troubleshooting.md`)

## Blocking decisions

Answer these before cutover. They are not defaults — each is a judgement call
the team must record.

1. **Retention of the nine `EUL4_B*Q*R1` historical batch-result tables**
   (Phase 7.2). **Decided 2026-09-17: migrate the rows into `scheduled_results`
   before the legacy source is decommissioned** — do not discard them, and do
   not leave them stranded in a source about to be read-only-then-gone.
2. **Date-hierarchy regeneration** (D-074). **Already resolved, no action
   needed at cutover**: all 508 hierarchies in this estate are Discoverer's own
   date-template machinery (6 `DBH` templates + 502 stamped instances), not
   hand-authored, and Neo regenerates them natively. Verified by the Phase
   5.1 reconciliation seam.
3. **Accepted result-set differences** (Phase 9.1). Already recorded in
   [`docs/decisions/accepted-result-differences.md`](../decisions/accepted-result-differences.md)
   — read it. Phase 9.1 states plainly that result-set equivalence is **not
   yet proven** for DISTINCT, multi-folder, and master-detail worksheets. That
   gap does not block *rehearsing* this runbook, but it does block treating a
   real cutover as done — the parallel-run period (below) is what catches it.

## Step 1 — Pre-run backup

```bash
./scripts/backup.sh
```

Dumps Postgres (`pg_dump --format=custom`), Redis, and the export/scheduled-
result volumes to `$BACKUP_DIR` (default `~/discoverer-neo-backups`).
**Rehearsed: 4 seconds for an 11 MB database.**

- **How to tell it failed:** non-zero exit, or `0 bytes written` in the
  output — the script checks for an empty archive itself and refuses to leave
  a corrupt file in place.
- **Rollback:** nothing was changed yet — nothing to undo.

## Step 2 — Migrate into a fresh database

Create a new, empty target database, then run the real transform against it —
**never** the database backing the current live Neo deployment.

```bash
# Record the source version and this build's commit alongside the run —
# already wired into migration_log (D-078), but only if this is exported first.
export DN_MIGRATE_COMMIT=$(git rev-parse HEAD)

npx dn-migrate run \
  --connection oracle-config.json \
  --target "postgres://discoverer:<password>@<new-db-host>:5432/discoverer_neo_cutover"
```

`ensureSchema()` runs automatically — you do not need to run migrations
against the new database first. `sourceStateDetail()` (migrate/src/services/
migration-runner.ts:382) writes the source `EUL4_VERSIONS` row and
`DN_MIGRATE_COMMIT` into `migration_log.detail` as an `INFO` row for the run,
automatically, on every non-dry-run — **but only if `DN_MIGRATE_COMMIT` (or
`GIT_COMMIT` / `GITHUB_SHA`) is set in the environment first.** Unset, it logs
`commitSha: "unknown"`.

- **How to tell it failed:** the CLI exits non-zero, or `migration_log` has no
  `ERROR`-free row for the new `run_id`.
- **Rollback:** drop the new database. The current live database was never
  touched.
- **Not rehearsed live against the real Oracle source** — decrypting the
  live EUL's stored password to run this command was refused by this
  session's own safety controls (credential materialization). The mechanism
  below (backup → restore → promote → rollback) **was** rehearsed live,
  end to end, against a real restored copy of the current estate; only the
  Oracle-to-Postgres transform step itself needs a human to run once, with
  real credentials, outside an agent session.

## Step 3 — Verify before promoting

```bash
npx dn-migrate verify --target "postgres://.../discoverer_neo_cutover"
npm run verify --workspace backend   # adds sql-generation and planner-live
```

**Rehearsed against a real restored copy of the estate: 4s (migrate-only) /
18s (full, both workspaces).** Read the six checks in
[`docs/migration/verify.md`](../migration/verify.md) before reading the
bottom line — `COMPLETED_WITH_BLOCKERS` is not automatically a stop, but
every blocker must be a **known, already-triaged** one, not a new one.

**What the rehearsal actually found** on the current estate: `sql-generation`
and `referential-closure` and `planner-live` all reported known, pre-existing
blockers (unfitted formula codes, one map with no columns, the REWRITE-path-
unreachable gap tracked against Phase 4). None of these were introduced by
the rehearsal; they match Phase 3.4/4.x's own findings. **A clean pass is not
what this step proves — a correct, honest report is.** If the verifier at
real cutover time reports a blocker that isn't in the known list, stop and
triage before Step 4.

- **How to tell it failed:** `Status: COMPLETED_WITH_BLOCKERS` listing a
  blocker category not already tracked in the master plan, or the process
  crashing outright.
- **Rollback:** none needed — nothing has been promoted yet.

## Step 4 — Promote: switch the connection string

```bash
# Wherever DATABASE_URL is set for the running backend (.env, compose env,
# orchestrator secret) — point it at the new database, then restart:
docker compose -f docker-compose.yml restart backend
```

**Rehearsed: 7-8 seconds** from container restart to `/health` reporting
`"database":"connected"` again, both directions (promote and roll back are
the identical mechanic).

- **How to tell it failed:** `/health` doesn't return `200` with
  `"database":"connected"` within the container's health-check window
  (30s interval, 3 retries, 15s start-period — see `backend/Dockerfile`).
  **`docker ps` status alone is not a reliable failure signal** — a crash at
  boot can leave the container "running" if it's started under `tsx watch`
  (dev mode catches the exception and keeps watching); use `docker logs` or
  the health check, not container state.
- **Rollback:** switch `DATABASE_URL` back to the previous database and
  restart again. That's it — nothing else changed.

## Step 5 — Parallel-run period

Keep the legacy Discoverer estate **read-only-live** — do not let it accept
new writes while Neo and it are compared, or the two diverge and the
comparison becomes meaningless.

**Exit criterion:** run for **N = 14 consecutive days** with **zero
unexplained result-set mismatches on the top 20 worksheets by usage**
(a mismatch already listed in
[`docs/decisions/accepted-result-differences.md`](../decisions/accepted-result-differences.md)
is explained; anything else is not). Extend the window if a mismatch is
found and fixed — the clock restarts from the fix, not from day 1.

- **How to tell it failed:** any unexplained mismatch on the top-20 list.
- **Rollback:** Step 4's rollback, at any point during the window.

## Step 6 — Re-provision credentials

**Rehearsed live, end to end, against a real migrated user in the restored
scratch database — not a fabricated one.** See
[`docs/migration/user-credentials.md`](../migration/user-credentials.md) for
the mechanism and [`docs/admin-guide/user-management.md`](../admin-guide/user-management.md#password-management)
for the admin-facing flow. Do not query a literal headcount — **query it live
at cutover time**:

```sql
-- Real people still needing a NEW credential (never re-provisioned):
SELECT count(*) FROM users WHERE password_hash = '!migrated-no-login' AND is_role = false;

-- Real people who already HAVE a credential but haven't completed first login yet:
SELECT count(*) FROM users WHERE must_change_password = true AND password_hash != '!migrated-no-login';
```

These are **two different populations** and the runbook's own rehearsal found
they can differ sharply: on 2026-09-17, `must_change_password = true` alone
counted 14, but only the **role and service accounts** (which never get a
real password by design — see `docs/migration/user-credentials.md`) still
carried the sentinel. Zero real people needed a brand-new credential; the 14
already had one and simply hadn't logged in yet. Do not quote either number
as fixed — Phase 0.4's baseline (14, at the time it was measured) has already
drifted once and will drift again.

Delivery is out of band, single-use, and expires:
- Temporary-password CSV: `CREDENTIALS_DIR`, exclusive-create (a re-run
  cannot overwrite one still being distributed), mode `0600`/`0700`, never
  served over the API, never logged. `CREDENTIAL_FILE_TTL_HOURS` (default 24)
  sweeps it — `sweepCredentialFiles()` runs once at boot and hourly
  thereafter (`backend/src/app.ts:154,166`), and has its own unit-tested
  suite (`credential-file-sweep.test.ts`).
- The `!migrated-no-login` sentinel fails closed until re-provisioned:
  confirmed both by code (`bcrypt.compare` can never match a non-bcrypt
  string — `backend/src/lib/password.ts`) and by this rehearsal's own login
  attempt against it.
- **Rehearsed sequence** (wrong password → 401; temp password → 200 with
  `mustChangePassword: true`; any route but `/me`/`/change-password`/`/logout`
  → 403 `PASSWORD_CHANGE_REQUIRED`; `/change-password` → 200; re-login with
  the new password → 200 with `mustChangePassword: false`, full access
  restored). Every step matched the documented behaviour exactly.

- **How to tell it failed:** a re-provisioned account can reach a route
  other than `/me`, `/change-password`, `/logout` before changing its
  password — that's the fail-open case, and it should be impossible per
  `backend/src/plugins/auth.ts`. If you see it, stop and do not cut over.
- **Rollback:** re-provisioning has no effect on the legacy estate. Nothing
  to undo there. If a specific account was re-provisioned in error, reset it
  again from Admin Panel → Users.

## Step 7 — Production config guard

**Rehearsed live**: booting the backend image with `NODE_ENV=production` and
either `JWT_SECRET` or `ENCRYPTION_KEY` still at its published development
default refuses to start —

```
Error: Refusing to start in production: JWT_SECRET and ENCRYPTION_KEY are
still set to the development default published in this repository.
```

(`backend/src/config.ts:247-267`, `assertProductionSecrets`). Booting the
same image with two freshly generated secrets (`openssl rand -hex 32`)
started cleanly and `/health` reported `"database":"connected"`,
`"redis":"connected"`, `"oracleClient":"thick_ready"`.

- **How to tell it failed:** the guard does *not* refuse — i.e. the backend
  boots in production with a default secret. That's a stop-cutover finding,
  not a warning.
- **Rollback:** n/a — this is a boot-time check, nothing to undo.

## Step 8 — Delete the UTF-16 dumps (INF-06)

```bash
find . -iname "*.dump" -exec file {} \; | grep -vi "PostgreSQL custom database dump"
```

**Checked during this rehearsal: none found.** The one `.dump` file present
(`backups/maps_backup_20260828_181905.dump`) is a genuine
`pg_dump --format=custom` output, already gitignored and untracked — not the
UTF-16 PowerShell artefact INF-06 describes. If a real one turns up before
your cutover, delete it; a PowerShell-authored UTF-16 file is not a valid
restore point and its presence invites someone to trust it as one.

## Rehearsal record — 2026-09-17

Rehearsed in a scratch Docker stack (`neo-scratch-postgres`,
`neo-scratch-redis`, `neo-scratch-backend`, on their own Docker network),
built from the same backend image as the live deployment, torn down at the
end of the session. Used a restored copy of the real estate (via
`scripts/backup.sh` + `pg_restore`) rather than a fresh Oracle transform, for
the reason given in Step 2.

| Step | Timing |
| --- | --- |
| Scratch Postgres boot to ready | 2s |
| `scripts/backup.sh` (11 MB DB) | 4s |
| `pg_restore` into a fresh scratch database | 3s |
| Connection-string switch + restart, either direction | 7-8s |
| `dn-migrate verify` (migrate workspace only) | 4s |
| `npm run verify --workspace backend` (all 6 checks) | 18s |
| Credential re-provisioning walkthrough (6 HTTP calls) | <1s |

**Gotcha for whoever runs this on Windows/Git Bash:** `docker run -e
SOME_PATH=/opt/oracle/instantclient` gets silently mangled into a Windows
path (`C:/Program Files/Git/opt/...`) by MSYS's path conversion. Prefix the
command with `MSYS_NO_PATHCONV=1` whenever an env var or argument looks like
an absolute Unix path.

**Not rehearsed live:** the Oracle-to-Postgres transform itself (Step 2) —
decrypting the live EUL's stored credential to run it was correctly refused
by this session's own safety controls, and that refusal was not bypassed.
Everything downstream of "a target database has real migrated data in it" —
backup, restore, promote, rollback, verify, re-provision, boot guard — was
rehearsed for real, against a real (restored) copy of the estate.
