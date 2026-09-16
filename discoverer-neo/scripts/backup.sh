#!/usr/bin/env bash
#
# Discoverer Neo — backup script.
#
# Backs up:
#   1. Postgres (pg_dump, custom format, gzip'd)
#   2. Redis — the whole `/data` dir (RDB snapshot + AOF), tarball'd. Redis is
#      BullMQ's system of record for job state, not just a cache (INF-11), so
#      a dump.rdb-only backup would silently drop the AOF half on restore.
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

# A failed step stops the run with a non-zero exit and removes the partial
# archive that step was writing, so a truncated file never passes for a backup.
OUT=""
trap 'rc=$?; echo "!! Backup FAILED (exit $rc)${OUT:+ — removed partial $OUT}" >&2; [ -z "$OUT" ] || rm -f "$OUT"; exit $rc' ERR

# A step that "succeeds" with an empty archive has still failed.
written() {
  [ -s "$OUT" ] || { echo "!! $OUT is empty" >&2; return 1; }
  echo "    $(du -h "$OUT" | cut -f1) written"
}

cd "$(dirname "${BASH_SOURCE[0]}")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
# Outside the working tree by default (INF-06): a dump under the repo is one
# `git add -A` away from committing data-source credentials and audit-log
# passwords in the clear. Override with BACKUP_DIR for a real deployment's
# mount point (a separate disk/volume, ideally off-host too).
BACKUP_DIR="${BACKUP_DIR:-$HOME/discoverer-neo-backups}"
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
# Restricted permissions: dumps contain data_sources (encrypted Oracle
# credentials) and audit_log (cleartext, per INF-04/BE-XX) — owner-only.
chmod 700 "$BACKUP_DIR" "$BACKUP_DIR/postgres" "$BACKUP_DIR/redis" "$BACKUP_DIR/files"

echo "==> Discoverer Neo backup — $TIMESTAMP"
echo "    compose file: $COMPOSE_FILE"
echo "    backup dir:   $BACKUP_DIR"

# --- 1. Postgres --------------------------------------------------------
OUT="$BACKUP_DIR/postgres/${POSTGRES_DB}_${TIMESTAMP}.dump.gz"
echo "==> Dumping Postgres ($POSTGRES_DB) -> $OUT"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  | gzip > "$OUT"
written

# MSYS_NO_PATHCONV=1 on the docker calls below: Git Bash on Windows rewrites a
# container-side argument such as `/data` or `/` to `C:/Program Files/Git/...`
# before docker sees it. The variable is inert on Linux. It is scoped per call,
# not exported, because COMPOSE_FILE is a host path that may need converting.

# --- 2. Redis ------------------------------------------------------------
OUT="$BACKUP_DIR/redis/data_${TIMESTAMP}.tar.gz"
echo "==> Snapshotting Redis -> $OUT"
docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli SAVE > /dev/null
MSYS_NO_PATHCONV=1 docker compose -f "$COMPOSE_FILE" exec -T redis tar czf - -C /data . > "$OUT"
written

# --- 3. Export + scheduled-result files ----------------------------------
# The mount points exist even when the volumes are empty, and --volumes-from
# works on a stopped container, so a failure here is real — not "nothing yet".
OUT="$BACKUP_DIR/files/generated_files_${TIMESTAMP}.tar.gz"
echo "==> Archiving export/scheduled-result volumes -> $OUT"
MSYS_NO_PATHCONV=1 docker run --rm --volumes-from "$BACKEND_CONTAINER" alpine \
  tar czf - -C / app/exports app/scheduled-results > "$OUT"
written
OUT=""

# --- Retention -------------------------------------------------------------
echo "==> Pruning backups older than ${RETENTION_DAYS}d"
find "$BACKUP_DIR" -type f -mtime "+${RETENTION_DAYS}" -print -delete

echo "==> Backup complete: $TIMESTAMP"
