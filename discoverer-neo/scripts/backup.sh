#!/usr/bin/env bash
#
# Discoverer Neo — backup script.
#
# Backs up:
#   1. Postgres (pg_dump, custom format, gzip'd)
#   2. Redis (BGSAVE snapshot, copied out of the container)
#   3. Generated files — the `export_files` + `scheduled_results_files`
#      volumes, via a throwaway container sharing the backend's mounts
#      (so this never has to guess the compose-generated volume name)
#
# Usage:
#   ./scripts/backup.sh                       # uses docker-compose.yml
#   COMPOSE_FILE=docker-compose.prod.yml ./scripts/backup.sh
#   BACKUP_DIR=/mnt/backups ./scripts/backup.sh
#
# Intended to run as a daily cron job:
#   0 2 * * * cd /path/to/discoverer-neo && ./scripts/backup.sh >> /var/log/discoverer-neo-backup.log 2>&1
#
# Restores are the inverse operation — see ./scripts/restore.sh.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-discoverer-neo-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-discoverer-neo-redis}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-discoverer-neo-backend}"

# .env holds POSTGRES_USER/POSTGRES_DB; not sourced wholesale (it may contain
# values with characters `set -a; source` mishandles) — read the two keys
# needed instead.
env_value() {
  local key="$1" default="$2"
  if [ -f .env ]; then
    local line
    line="$(grep -E "^${key}=" .env | tail -n1 || true)"
    if [ -n "$line" ]; then
      echo "${line#${key}=}"
      return
    fi
  fi
  echo "$default"
}

POSTGRES_USER="${POSTGRES_USER:-$(env_value POSTGRES_USER discoverer)}"
POSTGRES_DB="${POSTGRES_DB:-$(env_value POSTGRES_DB discoverer_neo)}"

mkdir -p "$BACKUP_DIR/postgres" "$BACKUP_DIR/redis" "$BACKUP_DIR/files"

echo "==> Discoverer Neo backup — $TIMESTAMP"
echo "    compose file: $COMPOSE_FILE"
echo "    backup dir:   $BACKUP_DIR"

# --- 1. Postgres --------------------------------------------------------
PG_OUT="$BACKUP_DIR/postgres/${POSTGRES_DB}_${TIMESTAMP}.dump.gz"
echo "==> Dumping Postgres ($POSTGRES_DB) -> $PG_OUT"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  | gzip > "$PG_OUT"
echo "    $(du -h "$PG_OUT" | cut -f1) written"

# --- 2. Redis ------------------------------------------------------------
REDIS_OUT="$BACKUP_DIR/redis/dump_${TIMESTAMP}.rdb"
echo "==> Snapshotting Redis -> $REDIS_OUT"
docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli SAVE > /dev/null
docker compose -f "$COMPOSE_FILE" cp "redis:/data/dump.rdb" "$REDIS_OUT"
echo "    $(du -h "$REDIS_OUT" | cut -f1) written"

# --- 3. Export + scheduled-result files ----------------------------------
FILES_OUT="$BACKUP_DIR/files/generated_files_${TIMESTAMP}.tar.gz"
echo "==> Archiving export/scheduled-result volumes -> $FILES_OUT"
docker run --rm --volumes-from "$BACKEND_CONTAINER" alpine \
  tar czf - -C / app/exports app/scheduled-results 2>/dev/null > "$FILES_OUT" \
  || echo "    (skipped — no exports/scheduled-results yet, or backend container not running)"

# --- Retention -------------------------------------------------------------
echo "==> Pruning backups older than ${RETENTION_DAYS}d"
find "$BACKUP_DIR" -type f -mtime "+${RETENTION_DAYS}" -print -delete

echo "==> Backup complete: $TIMESTAMP"
