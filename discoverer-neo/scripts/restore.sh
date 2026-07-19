#!/usr/bin/env bash
#
# Discoverer Neo — restore script. Inverse of ./scripts/backup.sh.
#
# Usage:
#   ./scripts/restore.sh --postgres backups/postgres/discoverer_neo_20260719-020000.dump.gz \
#                         [--redis backups/redis/dump_20260719-020000.rdb] \
#                         [--files backups/files/generated_files_20260719-020000.tar.gz] \
#                         [--compose-file docker-compose.prod.yml]
#
# Each source is independent — pass only the ones you need to restore.
# DESTRUCTIVE: the Postgres restore drops and recreates every object in the
# target database (--clean --if-exists) before loading; the Redis restore
# stops Redis and replaces its dataset entirely. Confirmed interactively
# unless FORCE=1 is set.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

COMPOSE_FILE="docker-compose.yml"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-discoverer-neo-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-discoverer-neo-redis}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-discoverer-neo-backend}"
PG_FILE=""
REDIS_FILE=""
FILES_ARCHIVE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --postgres) PG_FILE="$2"; shift 2 ;;
    --redis) REDIS_FILE="$2"; shift 2 ;;
    --files) FILES_ARCHIVE="$2"; shift 2 ;;
    --compose-file) COMPOSE_FILE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$PG_FILE" ] && [ -z "$REDIS_FILE" ] && [ -z "$FILES_ARCHIVE" ]; then
  echo "Nothing to restore — pass at least one of --postgres / --redis / --files" >&2
  exit 1
fi

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

if [ "${FORCE:-0}" != "1" ]; then
  echo "This will OVERWRITE live data:"
  [ -n "$PG_FILE" ] && echo "  - Postgres database '$POSTGRES_DB' will be dropped and reloaded from $PG_FILE"
  [ -n "$REDIS_FILE" ] && echo "  - Redis dataset will be replaced from $REDIS_FILE (Redis restarts)"
  [ -n "$FILES_ARCHIVE" ] && echo "  - export/scheduled-results volumes will be overwritten from $FILES_ARCHIVE"
  read -r -p "Continue? [y/N] " confirm
  [ "$confirm" = "y" ] || [ "$confirm" = "Y" ] || { echo "Aborted."; exit 1; }
fi

if [ -n "$PG_FILE" ]; then
  [ -f "$PG_FILE" ] || { echo "Postgres dump not found: $PG_FILE" >&2; exit 1; }
  echo "==> Restoring Postgres from $PG_FILE"
  gunzip -c "$PG_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner
  echo "    done"
fi

if [ -n "$REDIS_FILE" ]; then
  [ -f "$REDIS_FILE" ] || { echo "Redis snapshot not found: $REDIS_FILE" >&2; exit 1; }
  echo "==> Restoring Redis from $REDIS_FILE"
  docker compose -f "$COMPOSE_FILE" stop redis
  docker compose -f "$COMPOSE_FILE" cp "$REDIS_FILE" "redis:/data/dump.rdb"
  docker compose -f "$COMPOSE_FILE" start redis
  echo "    done"
fi

if [ -n "$FILES_ARCHIVE" ]; then
  [ -f "$FILES_ARCHIVE" ] || { echo "Files archive not found: $FILES_ARCHIVE" >&2; exit 1; }
  echo "==> Restoring export/scheduled-results files from $FILES_ARCHIVE"
  docker run --rm -i --volumes-from "$BACKEND_CONTAINER" alpine \
    sh -c "rm -rf /app/exports/* /app/scheduled-results/* && tar xzf - -C /" < "$FILES_ARCHIVE"
  echo "    done"
fi

echo "==> Restore complete. Restart the backend to pick up any changed data: docker compose -f $COMPOSE_FILE restart backend"
