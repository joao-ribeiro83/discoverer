# Backup and Restore

Backup and restore strategy for Discoverer Neo.

## What to Backup

1. **PostgreSQL Database** — Metadata (business areas, maps, users, audit logs)
2. **Export Files** — Generated Excel/CSV files (temporary, retention = 7 days)
3. **Scheduled Results** — Output from cron-driven map runs

## PostgreSQL Backup

### Full Database Dump

```bash
# Using docker
docker compose exec -T postgres pg_dump -U discoverer discoverer_neo > backup.sql

# Using psql (direct connection)
pg_dump -h localhost -U discoverer discoverer_neo > backup.sql
```

**Options:**
```bash
# Custom format (compressed)
docker compose exec -T postgres pg_dump -U discoverer discoverer_neo -Fc > backup.dump

# Include data only (for migration)
docker compose exec -T postgres pg_dump -U discoverer discoverer_neo -a > data-only.sql
```

### Automated Backups

Create backup script (`backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/discoverer_neo_$TIMESTAMP.sql"

docker compose exec -T postgres pg_dump \
  -U discoverer \
  discoverer_neo \
  > "$BACKUP_FILE"

# Keep only 7 days of backups
find "$BACKUP_DIR" -name "discoverer_neo_*.sql" -mtime +7 -delete

echo "Backup saved: $BACKUP_FILE"
```

Schedule with cron:

```bash
# Daily at 2 AM
0 2 * * * /path/to/backup.sh
```

### Restore Database

```bash
# From SQL dump
docker compose exec -T postgres psql -U discoverer discoverer_neo < backup.sql

# From compressed dump
docker compose exec -T postgres pg_restore -U discoverer -d discoverer_neo backup.dump
```

## Volume Snapshots

### Docker Named Volumes

Backup PostgreSQL volume:

```bash
# Create backup container
docker run --rm -v discoverer-neo_postgres_data:/data \
  -v /backups:/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz -C /data .

# Restore from backup
docker run --rm -v discoverer-neo_postgres_data:/data \
  -v /backups:/backup \
  alpine tar xzf /backup/postgres_data_YYYYMMDD.tar.gz -C /data
```

### Cloud Storage (AWS S3)

```bash
# Backup to S3
aws s3 cp backup.sql s3://my-backups/discoverer_neo_backup.sql

# Restore from S3
aws s3 cp s3://my-backups/discoverer_neo_backup.sql backup.sql
```

## Export Files & Scheduled Results

These are temporary outputs. Retention strategy:

- **Exports:** 7 days (configurable: `EXPORT_RETENTION_DAYS`)
- **Scheduled Results:** User-specified TTL

**Cleanup (automatic):**
- Backend periodically purges expired files
- Interval: `EXPORT_CLEANUP_INTERVAL_MINUTES` (default 60 min)

**Manual cleanup:**
```bash
# Remove files > 7 days old
docker compose exec -T backend find /app/exports -type f -mtime +7 -delete
```

**Archive important exports:**
```bash
# Before 7-day retention expires
docker compose exec -T backend cp /app/exports/* /archive/
```

## Backup Strategy

### Development
- Daily backups for 7 days
- Sufficient for recovering from accidental deletes

### Staging
- Daily full backups for 30 days
- Weekly compressed archives (S3)
- Pre-release snapshots (tag with version)

### Production
- **Daily:** Full backup at 2 AM (UTC)
- **Weekly:** Compressed archive (S3)
- **Monthly:** Off-site archive
- **Real-time:** Write Ahead Logging (PostgreSQL default, WAL)

## Point-in-Time Recovery (PITR)

PostgreSQL Write Ahead Log (WAL) enables recovery to any point in time:

```bash
# Configure WAL archiving in postgresql.conf
archive_mode = on
archive_command = 'cp %p /archive/%f'
```

Then recover:

```bash
# Restore from base backup
pg_restore ... backup.dump

# PostgreSQL replays WAL up to specified time
recovery_target_time = '2026-07-19 14:30:00'
```

## Testing Backups

Regularly test restore:

```bash
# Weekly test restore
1. Create test database
2. Restore backup
3. Verify data integrity
4. Delete test database

# Example
docker compose exec -T postgres createdb test_discoverer_neo
docker compose exec -T postgres psql -U discoverer test_discoverer_neo < backup.sql
docker compose exec -T postgres psql -U discoverer test_discoverer_neo -c "SELECT COUNT(*) FROM maps;"
docker compose exec -T postgres dropdb test_discoverer_neo
```

## Documentation

For each backup, record:
- **Date/Time:** When backup was taken
- **Size:** Backup file size
- **Type:** Full, incremental, snapshot
- **Location:** Where backup is stored
- **Tested:** Whether restore was tested
- **Owner:** Who is responsible

Example log:

```
2026-07-19 02:00 | Full | discoverer_neo_20260719.sql | 1.2GB | s3://backups | Tested 2026-07-20 | admin@example.com
2026-07-20 02:00 | Full | discoverer_neo_20260720.sql | 1.2GB | s3://backups | Pending | admin@example.com
```

## Disaster Recovery Plan

### Database Corruption

1. Restore latest clean backup
2. Run integrity check: `REINDEX`
3. Verify user data
4. Document incident

### Data Loss

1. Restore from backup
2. Use PITR if available to minimize data loss
3. Notify users of recovery time
4. Document incident

### Complete Data Center Failure

1. Provision new infrastructure
2. Restore from off-site backup
3. Verify all services
4. Update DNS/routing
5. Notify users

## Compliance & Retention

**Typical requirements:**
- Financial/audit data: 7 years
- User data: 1–3 years
- Backups: At least 30 days

**GDPR compliance:**
- Right to deletion: Must be able to remove user data
- Data portability: Must export in standard format

## What's Next?

- **[Monitoring](monitoring.md)** — Health and metrics
- **[Docker Deployment](docker.md)** — Container setup
- **[Configuration](configuration.md)** — Environment variables

---

**See Also:** [Deployment Guide](../deployment/), [Docker Deployment](docker.md)
