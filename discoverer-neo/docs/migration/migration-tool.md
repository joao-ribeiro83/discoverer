# Migration Tool (dn-migrate) Reference

Complete command reference for the `dn-migrate` CLI tool.

## Installation

```bash
# Via npm (included in monorepo)
npm install --workspace=migrate

# Or use globally
npm install -g discoverer-neo-migrate
```

## Commands

### analyze

Analyze source EUL and report what would be migrated.

```bash
dn-migrate analyze \
  --connection '{"host":"oracle.example.com","user":"EUL5_US","password":"secret"}' \
  [--json]
```

**Output:**
```
Discoverer EUL Analysis
=======================
Version: 11.1.1
Business Areas: 5
Folders: 45
Items: 230
Joins: 12
Hierarchies: 8
Workbooks: 23
Calculations: 15
Issues: 0
```

**Flags:**
- `--json` — Output as JSON for scripting

**Use case:** Preview migration scope before running full migration.

### validate

Validate EUL integrity and check for migration blockers.

```bash
dn-migrate validate \
  --connection '{"host":"oracle.example.com","user":"EUL5_US","password":"secret"}'
```

**Checks:**
- Missing or corrupt table references
- Invalid join definitions
- Circular hierarchy definitions
- Orphaned items (folder deleted, item remains)

**Output:** List of issues found (if any).

### export

Export EUL metadata to JSON file (for backup or review).

```bash
dn-migrate export \
  --connection '{"host":"oracle.example.com","user":"EUL5_US","password":"secret"}' \
  --output eul-export.json \
  [--pretty]
```

**Output file structure:**
```json
{
  "businessAreas": [...],
  "folders": [...],
  "items": [...],
  "joins": [...],
  "hierarchies": [...],
  "workbooks": [...]
}
```

**Flags:**
- `--pretty` — Pretty-print JSON (easier to read, larger file)

**Use case:** Offline review, backup, or staged import.

### import

Import EUL metadata into Discoverer Neo.

```bash
dn-migrate import \
  --target 'postgres://user:pass@localhost:5432/discoverer_neo' \
  --input eul-export.json \
  --backend-url http://localhost:3000 \
  --admin-email admin@example.com \
  --admin-password secret
```

**Flags:**
- `--target` — Postgres connection URL (required)
- `--input` — JSON export file (required)
- `--backend-url` — Neo backend URL (required)
- `--admin-email` — Admin email for API auth (required)
- `--admin-password` — Admin password (required)
- `--skip-existing` — Skip if business area already exists
- `--dry-run` — Simulate import without writing

**Use case:** Perform actual migration to Neo.

## Connection Configuration

### Inline JSON

```bash
dn-migrate analyze \
  --connection '{"host":"oracle","user":"eul5_us","password":"secret","serviceName":"PROD"}'
```

### JSON File

```bash
# oracle-config.json
{
  "host": "oracle.example.com",
  "port": 1521,
  "user": "EUL5_US",
  "password": "secret",
  "serviceName": "PROD"
}

# Command
dn-migrate analyze --connection oracle-config.json
```

### Connection String

```bash
dn-migrate analyze --connectString "oracle.example.com:1521/PROD" --user EUL5_US --password secret
```

### Individual Flags (Override)

```bash
# Base config from file
dn-migrate analyze --connection oracle-config.json \
  --password newpassword  # Override password
```

## Thin vs. Thick Mode

### Thin Mode (Default)

No Oracle Instant Client required:

```bash
dn-migrate analyze \
  --connection '{"host":"oracle","user":"EUL5_US","password":"secret","serviceName":"PROD"}'
```

**Limitation:** Requires Oracle Database 12.1+

### Thick Mode

Requires Oracle Instant Client:

```bash
ORACLE_THICK_MODE=true \
ORACLE_CLIENT_PATH=/opt/oracle/instantclient \
dn-migrate analyze \
  --connection '{"host":"oracle","user":"EUL5_US","password":"secret","serviceName":"PROD"}'
```

**Supports:** Oracle 11.2 and later

## Output & Logging

### Log Levels

```bash
LOG_LEVEL=debug dn-migrate analyze --connection ...
```

Levels: `fatal`, `error`, `warn`, `info`, `debug`, `trace`

### Save Logs

```bash
dn-migrate analyze --connection ... 2>&1 | tee migration.log
```

### JSON Output

```bash
dn-migrate analyze --connection ... --json | jq '.issues[]'
```

## Dry Run (Safe Testing)

Test import without writing to database:

```bash
dn-migrate import \
  --target 'postgres://...' \
  --input eul-export.json \
  --backend-url http://localhost:3000 \
  --admin-email admin@example.com \
  --admin-password secret \
  --dry-run
```

**Output:** Shows what would be created without modifying database.

## Examples

### Full Migration Workflow

```bash
# 1. Analyze
dn-migrate analyze \
  --connection oracle-config.json \
  --json > analysis.json

# 2. Validate
dn-migrate validate \
  --connection oracle-config.json

# 3. Export
dn-migrate export \
  --connection oracle-config.json \
  --output eul-export.json

# 4. Backup Neo (optional)
docker compose exec postgres pg_dump -U discoverer discoverer_neo > backup.sql

# 5. Dry run test
dn-migrate import \
  --target 'postgres://...' \
  --input eul-export.json \
  --backend-url http://localhost:3000 \
  --admin-email admin@example.com \
  --admin-password secret \
  --dry-run

# 6. Actual import
dn-migrate import \
  --target 'postgres://...' \
  --input eul-export.json \
  --backend-url http://localhost:3000 \
  --admin-email admin@example.com \
  --admin-password secret
```

### Automated Migration Script

```bash
#!/bin/bash
set -e

ORACLE_HOST="oracle.example.com"
ORACLE_USER="EUL5_US"
ORACLE_PASS="secret"

NEO_DB="postgres://user:pass@neo:5432/discoverer_neo"
NEO_URL="http://neo:3000"
NEO_ADMIN="admin@example.com"
NEO_PASS="secret"

echo "Starting migration..."

dn-migrate validate \
  --connection "{\"host\":\"$ORACLE_HOST\",\"user\":\"$ORACLE_USER\",\"password\":\"$ORACLE_PASS\"}"

dn-migrate export \
  --connection "{\"host\":\"$ORACLE_HOST\",\"user\":\"$ORACLE_USER\",\"password\":\"$ORACLE_PASS\"}" \
  --output eul-export.json

dn-migrate import \
  --target "$NEO_DB" \
  --input eul-export.json \
  --backend-url "$NEO_URL" \
  --admin-email "$NEO_ADMIN" \
  --admin-password "$NEO_PASS"

echo "Migration complete!"
```

### Bulk Migrate Multiple EULs

```bash
# Migrate multiple Discoverer sources to same Neo instance
for source in prod dev staging; do
  echo "Migrating $source..."
  
  dn-migrate export \
    --connection "{\"host\":\"$source.oracle.example.com\",\"user\":\"EUL5_US\",\"password\":\"secret\"}" \
    --output "$source-export.json"
  
  dn-migrate import \
    --target 'postgres://...' \
    --input "$source-export.json" \
    --backend-url http://localhost:3000 \
    --admin-email admin@example.com \
    --admin-password secret
done
```

## Troubleshooting

### "Connection refused"

```bash
# Test Oracle connectivity
sqlplus EUL5_US/secret@PROD

# Or check with nc
nc -zv oracle.example.com 1521
```

### "Invalid EUL version"

```bash
# Check EUL version in database
SELECT * FROM eul5_release;
```

Supported: 4.1, 9.0.4, 10.1.2, 10.1.2.1, 11.1.1

### "Missing Instant Client"

```bash
# Install (Linux)
apt-get install oracle-instantclient

# Or download from Oracle and set path
ORACLE_CLIENT_PATH=/opt/oracle/instantclient dn-migrate ...
```

### "Validation errors found"

Run with `LOG_LEVEL=debug` to see details:

```bash
LOG_LEVEL=debug dn-migrate validate --connection ...
```

See [Troubleshooting Guide](troubleshooting.md) for more.

## What's Next?

- **[From Discoverer 4](from-discoverer4.md)** — Migration process overview
- **[Troubleshooting](troubleshooting.md)** — Common issues and solutions

---

**See Also:** [Migration Guide](../migration/), [Admin Guide](../admin-guide/)
