# Recovering from data loss

Full procedure: [deployment/backup.md](../deployment/backup.md). This page is
symptom → which restore, not the mechanics.

## Postgres is corrupted or a bad migration wrecked data

Restore just the database — Redis's queue state is unaffected:

```bash
./scripts/restore.sh --postgres backups/postgres/discoverer_neo_<ts>.dump.gz \
                      --compose-file docker-compose.prod.yml
```

Pick the newest dump from **before** the corrupting event, not the newest
dump overall.

## Jobs vanished after a Redis crash or container recreate

If Redis was running the prod config (`--appendonly yes`), an unplanned
restart should not have lost anything — check `docker compose -f
docker-compose.prod.yml logs redis` for `AOF` messages first; a full restore
is a last resort:

```bash
./scripts/restore.sh --redis backups/redis/data_<ts>.tar.gz \
                      --compose-file docker-compose.prod.yml
```

This replaces `/data` (RDB + AOF) entirely and restarts Redis — anything
written after the backup's timestamp is gone. If the dev/base compose file
(`docker-compose.yml` without the prod overlay) is what's running, this loss
is expected: that file does not enable AOF.

## `importFromOracle` failed partway through

Nothing to restore. Since BE-08, the folder and its items are written in one
transaction — a failed import leaves no partial folder behind. Re-run the
import; the earlier failed attempt left no trace to clean up.

## Verifying a restore before trusting it

Never assume a dump is good — prove it:

```bash
./scripts/verify-restore.sh backups/postgres/discoverer_neo_<ts>.dump.gz
```

Restores into a throwaway `<db>_restoretest` database, diffs row counts
against the live database table by table, drops the scratch database, and
exits non-zero on any mismatch.

## A cutover step failed

Full procedure: [`docs/deployment/cutover-runbook.md`](../deployment/cutover-runbook.md).
Each step there has its own failure signal and rollback; the two general
traps found while rehearsing it:

- **A crashed container can still show `docker ps` as "running."** Under
  `tsx watch` (dev-style boot), an uncaught exception at startup — e.g. the
  production secrets guard refusing a default `JWT_SECRET` — is caught by
  the watcher, logged, and the process stays up watching for a file change
  that will never come. Check `docker logs` or `/health`, never container
  status alone, to decide whether a boot actually succeeded.
- **`docker run -e SOME_PATH=/opt/...` on Windows/Git Bash** gets its value
  silently rewritten into a Windows path by MSYS's path conversion, breaking
  anything that expects a Unix path (e.g. `ORACLE_CLIENT_PATH`). Prefix the
  command with `MSYS_NO_PATHCONV=1`.

If the verifier (`docs/migration/verify.md`) reports `COMPLETED_WITH_BLOCKERS`
at cutover time, check each blocker against the known list in the runbook's
Step 3 before treating it as new — a blocker Phase 3.4/4.x already tracked is
not a reason to stop; an unlisted one is.
