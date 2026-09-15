# Backup and Restore

The real tooling is `scripts/backup.sh` and `scripts/restore.sh` — read those
first; this page is the schedule, the retention policy, and the restore
procedure, not a re-explanation of what the scripts already document in their
own headers.

## What gets backed up

`scripts/backup.sh` takes three things in one run:

1. **Postgres** — `pg_dump --format=custom`, gzip'd. Custom format restores
   selectively (`pg_restore` can pull one table) and is smaller than plain SQL.
2. **Redis** — the whole `/data` directory (RDB snapshot + AOF), tarball'd.
   Redis holds BullMQ job state (export queue, scheduler queue), not just a
   cache — an RDB-only backup would silently drop the AOF half on restore.
3. **Generated files** — the `export_files` and `scheduled_results_files`
   volumes.

## Where backups live

`BACKUP_DIR` defaults to `~/discoverer-neo-backups` — **outside the repo
working tree** on purpose. A dump under the repo is one `git add -A` away
from committing `data_sources` (encrypted Oracle credentials) and
`audit_log` (cleartext passwords) — this happened once already (see
`AUDIT_DETAILED_FINDINGS.md` INF-06); the two dumps it produced are gone
and `.gitignore` now has `discoverer-neo/*.sql` so it can't happen the same
way again.

Every backup subdirectory is `chmod 700` by the script. Point `BACKUP_DIR`
at a separate disk or volume for a real deployment — ideally one that is
itself replicated off-host; this repo does not manage off-site replication
(a deployment decision, not a code one).

## Scheduling

`backup.sh` is a plain script, not a container — schedule it with the host's
own cron:

```cron
0 2 * * * cd /path/to/discoverer-neo && COMPOSE_FILE=docker-compose.prod.yml ./scripts/backup.sh >> /var/log/discoverer-neo-backup.log 2>&1
```

Retention defaults to 30 days (`BACKUP_RETENTION_DAYS`), pruned by the script
itself on every run — nothing else needs to clean up old backups.

## Restoring

```bash
./scripts/restore.sh --postgres backups/postgres/discoverer_neo_<ts>.dump.gz \
                      --redis backups/redis/data_<ts>.tar.gz \
                      --files backups/files/generated_files_<ts>.tar.gz \
                      --compose-file docker-compose.prod.yml
```

Each source is independent — pass only what you need. This is **destructive**:
the Postgres restore drops and recreates every object in the target database
first; the Redis restore replaces `/data` entirely and restarts Redis.
Confirmed interactively unless `FORCE=1`.

## Restore verification

A backup nobody has restored is not a backup. `scripts/verify-restore.sh`
restores a Postgres dump into a throwaway scratch database
(`<db>_restoretest`) and diffs row counts against the live database,
table by table, then drops the scratch database:

```bash
./scripts/verify-restore.sh backups/postgres/discoverer_neo_<ts>.dump.gz
```

This has been run for real, not just written. Against the
`discoverer_neo_20260915-092448.dump.gz` dump taken from the live
migrated-EUL database on 2026-09-15:

```
business_areas: 7 (match)
data_sources: 1 (match)
folders: 212 (match)
items: 9626 (match)
joins: 10 (match)
maps: 926 (match)
map_items: 25968 (match)
users: 19 (match)
audit_log: 16759 (match)
==> Restore verification PASSED — all row counts match
```

Run `verify-restore.sh` after every schema migration that adds a table worth
checking — the table list is a fixed set in the script (`TABLES=...`), not
auto-discovered, so a new table needs adding there to be covered.

## Redis persistence

`docker-compose.prod.yml` runs Redis with `--appendonly yes --appendfsync
everysec`. This was an explicit change (INF-11): Redis is BullMQ's system of
record for job state, not just a cache, and the previous RDB-only
configuration (`save 3600 1 300 100 60 10000`) had a worst-case one-hour
window in which a crash could discard in-flight and delayed jobs. `everysec`
accepts at most ~1 second of job loss against the alternative
(`appendfsync always`) fsync-per-write throughput cost — the standard trade.

Verified: a Redis container running this config, hard-killed mid-write and
restarted, recovered a key written immediately before the kill.

## Disaster recovery

1. Provision Postgres + Redis (fresh `docker compose up -d postgres redis`).
2. `./scripts/restore.sh --postgres <latest dump> --redis <latest dump>
   --compose-file docker-compose.prod.yml`
3. Bring up `backend` and `frontend`; `/health` should report `database` and
   `redis` both `connected` (see
   [troubleshooting/health-check.md](../troubleshooting/health-check.md)).
4. Spot-check a known map executes correctly.

For Postgres-only corruption, restore just `--postgres`; Redis's queue state
recovers on its own once BullMQ workers reconnect to a healthy Redis (jobs
already completed are gone from the queue either way — this restores the
metadata database, not export history).

## What's next?

- [Monitoring](monitoring.md) — health and metrics
- [Docker Deployment](docker.md) — container setup
- [Configuration](configuration.md) — environment variables
