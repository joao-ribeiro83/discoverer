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
Workbooks: 23 (41 worksheets)
Calculations: 15
Issues: 0
```

The worksheet count matters more than the workbook count: each worksheet
becomes one Discoverer Neo map. The report also warns about workbooks whose
body could not be decoded (they migrate as empty maps) and about
multi-worksheet workbooks whose conditions cannot be attributed to a single
worksheet.

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

### run

Migrate the EUL into a Discoverer Neo Postgres database.

```bash
dn-migrate run   --connection '{"host":"oracle.example.com","user":"EUL5_US","password":"secret"}'   --target 'postgres://user:pass@localhost:5432/discoverer_neo'
```

**Flags:**
- `--target` — target Postgres: connection URL, JSON config file, or inline JSON (required)
- `--dry-run` — run the whole pipeline and report, writing nothing
- `--version` — override EUL auto-detection: `auto` (default), `eul4`, `eul5`
- `--schema-owner` — schema owning the EUL tables

**Use case:** Perform the actual migration into Neo.

> **One migration per database.** The run mints a `migration@migrated.local`
> service account and gives every migrated Oracle user a synthesized
> `@migrated.local` address, so a second run into the same database would
> collide on `users_email_unique` — and, if it could not, would duplicate every
> business area, folder and item. The runner checks the target before it reads
> anything and refuses with *"target database already contains a migration"*; a
> dry run makes the same check and reports it instead of a clean plan. To
> migrate again, reset the target first — see
> [Troubleshooting](troubleshooting.md#target-database-already-contains-a-migration).

### Re-importing just the maps

There is one exception to *one migration per database*: the **maps**. If a
database was migrated by a version of this tool that could not read the
workbook body, its maps have no columns, conditions or parameters — and a full
re-run cannot fix that, because it is refused.

The re-import rebuilds only the maps. It reads the EUL's workbooks, deletes the
maps in the migration's host business area (**Migrated Workbooks**), and writes
them again — resolving every column against the items already in the database.
Users, business areas, folders, items and grants are not touched.

It runs through the API rather than the CLI, because it needs the same
registered data source and decrypted credentials a migration uses:

```bash
# Preview: reports what would be replaced and rebuilt, writes nothing.
curl -X POST http://localhost:3000/api/migration/reimport-maps \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"dataSourceId":"<uuid>","dryRun":true}'

# Then, for real:
curl -X POST http://localhost:3000/api/migration/reimport-maps \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"dataSourceId":"<uuid>"}'
```

Both return a job; poll `GET /api/migration/jobs/:jobId` for progress, logs and
the result.

Or run it from the backend container, which streams the log as it goes and
needs no admin session — the practical choice for a large EUL:

```bash
docker compose exec backend npx tsx src/scripts/reimport-maps.ts <dataSourceId>
```

It defaults to a dry run; add `--live` to perform the replacement.

> **Destructive for migrated maps.** Every map in *Migrated Workbooks* is
> deleted and rebuilt, along with its columns, conditions, parameters,
> calculated fields, shares, schedules and export jobs. Any edit made to a
> migrated map since the original run is lost. Maps in other business areas —
> including any you built yourself — are never touched. Run with
> `"dryRun": true` first, and back the database up.

The whole operation runs in one transaction: if any part fails, the old maps
are still there.

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

## Migrated user accounts

The migration provisions a temporary password for every imported person, forces
a change at first login, and writes the passwords to a file on the server host
for you to distribute.

See **[Migrated Users & Passwords](user-credentials.md)** — it covers the file's
location, how it is protected, and what you must do with it.

## What's Next?

- **[Verifying a migration](verify.md)** — `dn-migrate verify`: the four checks
  that say whether what you migrated actually works. Run it after every
  migration; a run that finished is not a run that worked
- **[From Discoverer 4](from-discoverer4.md)** — Migration process overview
- **[Troubleshooting](troubleshooting.md)** — Common issues and solutions

---

**See Also:** [Migration Guide](../migration/), [Admin Guide](../admin-guide/)
