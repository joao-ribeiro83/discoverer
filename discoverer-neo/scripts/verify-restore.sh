#!/usr/bin/env bash
#
# Discoverer Neo — restore verification.
#
# A backup nobody has restored is not a backup. This takes a Postgres dump
# produced by ./scripts/backup.sh, restores it into a throwaway scratch
# database, compares row counts against the live database table-by-table,
# and drops the scratch database. Exits non-zero on any mismatch.
#
# Usage:
#   ./scripts/verify-restore.sh backups/postgres/discoverer_neo_20260915-100000.dump.gz
#   COMPOSE_FILE=docker-compose.prod.yml ./scripts/verify-restore.sh <dump.gz>
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

DUMP_FILE="${1:?Usage: $0 <postgres-dump.gz>}"
[ -f "$DUMP_FILE" ] || { echo "Dump not found: $DUMP_FILE" >&2; exit 1; }

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

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
# Suffix, not a caller-supplied name — same guard as setup-test-db.mjs, so a
# stray env var can never point this at a real database.
SCRATCH_DB="${POSTGRES_DB}_restoretest"

pg() { docker compose -f "$COMPOSE_FILE" exec -T postgres "$@"; }

echo "==> Creating scratch database $SCRATCH_DB"
pg psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};" > /dev/null
pg psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${SCRATCH_DB};" > /dev/null

cleanup() {
  echo "==> Dropping scratch database $SCRATCH_DB"
  pg psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};" > /dev/null
}
trap cleanup EXIT

echo "==> Restoring $DUMP_FILE into $SCRATCH_DB"
gunzip -c "$DUMP_FILE" | pg pg_restore -U "$POSTGRES_USER" -d "$SCRATCH_DB" --no-owner

# Every table that exists in both the live DB and the restored one — new
# tables from a dump taken after a migration bump would need the fixture
# below extended, not the comparison logic.
TABLES="business_areas data_sources folders items joins maps map_items users audit_log"

echo "==> Comparing row counts: live $POSTGRES_DB vs restored $SCRATCH_DB"
FAILED=0
for t in $TABLES; do
  live=$(pg psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM ${t};")
  restored=$(pg psql -U "$POSTGRES_USER" -d "$SCRATCH_DB" -tAc "SELECT count(*) FROM ${t};")
  if [ "$live" = "$restored" ]; then
    echo "    $t: $restored (match)"
  else
    echo "    $t: live=$live restored=$restored — MISMATCH" >&2
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "==> Restore verification FAILED — row counts do not match" >&2
  exit 1
fi

echo "==> Restore verification PASSED — all row counts match"
