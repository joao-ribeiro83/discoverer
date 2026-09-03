# PHASE 8.3 — Durability

**Model:** Sonnet · **Effort:** medium

## Purpose

Make the system recoverable.

> **`scripts/backup.sh` and `restore.sh` are real and good (INF-17) — and have evidently never
> been used for this purpose.** Meanwhile the "backup" in the tree is a **UTF-16 PowerShell
> artefact PostgreSQL cannot read** (INF-06).
>
> **Redis is RDB-only with a 1-hour worst-case window, while being the system of record for
> jobs** (INF-11).

## Scope

1. **Scheduled `pg_dump`** via the existing `scripts/backup.sh`, with retention.
2. **A proven restore** — a backup nobody has restored is not a backup.
3. **Redis AOF** rather than RDB-only, since it is the system of record for jobs (INF-11).
4. **BE-08** — `importFromOracle` writes folder + items **without a transaction, and the
   partial state is unrepairable.** Wrap it.
5. Delete the UTF-16 dumps **so nobody mistakes them for restore points** — if Phase 0.1 did
   not already.

## Prerequisites

Phase 8.1.

## Required files to read first

- `AUDIT_DETAILED_FINDINGS.md` — `INF-06`, `INF-11`, `INF-17`, `BE-08`
- `AUDIT_MIGRATION_ASSESSMENT.md` §9 — the rollback strategy
- `discoverer-neo/scripts/backup.sh`, `restore.sh`
- `discoverer-neo/docker-compose.prod.yml` — the Redis service
- `backend/src/services/oracle-introspection.ts` — `importFromOracle`
- `docs/deployment/backup.md`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode`, `context7` (current Redis persistence guidance).

## Implementation instructions

- Use the **existing** scripts. They are good; the gap is that nothing schedules or verifies
  them.
- Custom-format `pg_dump` (`-Fc`), not plain SQL — it restores selectively and compresses.
- **Actually restore one**, into a scratch database, and assert row counts. A restore that has
  never been executed is a hope, not a control.
- Redis AOF with `everysec` is the usual trade. If job loss is genuinely tolerable, say so
  explicitly in the docs rather than leaving RDB-only by accident.
- BE-08: one transaction around the folder and its items. **A partial import today is
  unrepairable** — that is the finding, and a transaction is the whole fix.

## Tests

- The backup script produces a restorable custom-format dump
- **A restore into a scratch database reproduces row counts** — automated, not manual
- Retention prunes old backups
- A failed `importFromOracle` leaves **no partial folder**
- Redis survives a restart with jobs intact

## Security checks

- **A database dump contains `data_sources` — encrypted credentials, and everything else.**
  Backups must be stored with restricted permissions and **never** inside the repository
  working tree. Confirm `.gitignore` covers the backup destination.
- Confirm the backup script does not log the database password.

## Validation

```bash
cd discoverer-neo && ./scripts/backup.sh
./scripts/restore.sh <dump> <scratch-db>
docker -c default exec discoverer-neo-postgres psql -U discoverer -d <scratch-db> \
  -c "SELECT count(*) FROM maps;"
```

Expect 923.

## Acceptance criteria

- [ ] Scheduled backups run with retention
- [ ] **A restore has actually been performed and verified by row count**
- [ ] Redis persistence is deliberate and documented (AOF, or RDB with a stated accepted loss)
- [ ] `importFromOracle` is transactional; a failure leaves no partial state
- [ ] The UTF-16 dumps are gone
- [ ] **Backups live outside the working tree, with restricted permissions**

## Documentation updates

- `docs/deployment/backup.md` — the schedule, the retention, and **the verified restore
  procedure**
- `docs/troubleshooting/` — recovery

## Git checkpoint

Backup schedule; the restore verification; Redis; BE-08. Push after each.

## Handover artefacts

- **The restore verification output** — the row count from a real restore
- The Redis persistence decision

## Explicitly out of scope

- Migration rollback and cutover. Phase 9.3.
- Off-site or cloud backup targets — a deployment decision, not a code one.

## Resume instructions

Read the checkpoint. If a verified restore is recorded, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Backup → **restore verification** → Redis → BE-08. Commit each.
2. **No specialist agents.**
3. Use `context-mode` for dump and restore output.
4. Checkpoint the restore verification — it is the deliverable.
5. Commit coherently.
6. **Clean up scratch databases** before ending the session.
7. If interrupted, record whether a restore has been verified.
