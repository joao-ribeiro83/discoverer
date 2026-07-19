# Migrating from Oracle Discoverer 4–11

Migrate your existing Oracle Discoverer metadata to Discoverer Neo.

## Migration Overview

The migration process extracts EUL (End User Layer) metadata from Oracle Discoverer and imports it into Discoverer Neo:

```
Oracle Discoverer EUL          Discoverer Neo
(Legacy 4.1, 9, 10, 11)    →   (Postgres Database)
    ↓
EUL5_* tables
    ↓
dn-migrate CLI
    ↓
Business Areas, Folders, Items, Joins, Hierarchies, Maps
```

## Supported Versions

The migration tool supports:
- **Oracle Discoverer 4.1**
- **9.0.4**
- **10.1.2, 10.1.2.1**
- **11.1.1**

(Versions 4i/5i use different EUL schema; contact support)

## Prerequisites

1. **Oracle Database** — Source Discoverer EUL (version 4.1–11)
2. **Oracle Instant Client** — Thin or thick mode connection
3. **Discoverer Neo** — Target system deployed and running
4. **PostgreSQL** — Target Discoverer Neo database
5. **Network** — Connectivity from migration tool to both Oracle and Neo

## Pre-Migration Checklist

- [ ] Backup source Oracle database
- [ ] Backup Discoverer Neo PostgreSQL database
- [ ] Test in non-production environment first
- [ ] Verify Oracle user has SELECT on EUL tables
- [ ] Verify PostgreSQL user can INSERT into Neo tables
- [ ] Document custom calculations/hierarchies not automatically migrated

## Migration Process

### 1. Prepare Source Connection

Identify your Oracle Discoverer EUL:

```sql
-- Connect as EUL owner (e.g., EUL5_US)
SELECT * FROM eul5_ba;      -- Business areas
SELECT * FROM eul5_objs;    -- Folders
SELECT * FROM eul5_obj_cols; -- Items
```

Connection details needed:
- **Host** — Oracle server hostname/IP
- **Port** — Listener port (default 1521)
- **Service Name/SID** — Database identifier
- **User** — EUL owner (e.g., EUL5_US)
- **Password** — EUL owner password

### 2. Prepare Target Connection

Verify Discoverer Neo is running:

```bash
curl http://localhost:3000/api/health
# Should return 200 with { "status": "ok" }
```

Note:
- **Backend URL** — http://localhost:3000
- **Admin Email/Password** — For API authentication

### 3. Run Migration Tool

Use the `dn-migrate` CLI:

```bash
# Analyze EUL (preview what will migrate)
npx dn-migrate analyze \
  --connection '{"host":"oracle.example.com","user":"EUL5_US","password":"secret","serviceName":"PROD"}' \
  --json > analysis.json

# Validate EUL integrity
npx dn-migrate validate \
  --connection '{"host":"oracle.example.com","user":"EUL5_US","password":"secret","serviceName":"PROD"}'

# Export EUL metadata
npx dn-migrate export \
  --connection '{"host":"oracle.example.com","user":"EUL5_US","password":"secret","serviceName":"PROD"}' \
  --output eul-export.json

# Import into Neo (via API)
npx dn-migrate import \
  --target 'postgres://postgres:password@localhost:5432/discoverer_neo' \
  --input eul-export.json \
  --backend-url http://localhost:3000 \
  --admin-email admin@example.com \
  --admin-password secret
```

See [Migration Tool Reference](migration-tool.md) for all commands and options.

## What Gets Migrated

### Automatically Migrated

✓ **Business Areas** — EUL_BA → business_areas  
✓ **Folders** — EUL_OBJS → folders  
✓ **Items** — EUL_OBJ_COLS → items  
✓ **Joins** — EUL_JOINS → joins  
✓ **Hierarchies** — EUL_EXPRESSIONS (level type) → hierarchies  
✓ **Calculations** — EUL_EXPRESSIONS (calculation) → custom_functions  
✓ **Workbooks** — EUL_WORKBOOKS → maps  
✓ **Worksheets** → map definitions  
✓ **Conditions** → map conditions  
✓ **Business Area Privileges** → grants  

### Manual Migration Required

✗ **LDAP/Directory Integration** — Not automatically configured; set up in Neo  
✗ **Scheduled Reports** — Not migrated; recreate using Neo scheduler  
✗ **Advanced Analytics** — Analytic window functions may need adjustment  
✗ **Portlet Configuration** — Discoverer Portlet Provider not supported in Neo  
✗ **Drill-Down Reports** → Manual setup (create hierarchies in Neo)  

## Post-Migration Steps

### 1. Verify Import

```bash
# Check business areas created
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/business-areas

# Check item counts
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/business-areas/:id/folders
```

### 2. Create Data Sources

The migration imports metadata references, not actual data sources. Create them manually:

1. Admin Panel → **Data Sources**
2. Add Oracle connection pointing to your EUL source
3. Or add PostgreSQL data source if you're using that

### 3. Test Maps

Run a few key maps to verify:

1. Open a map from Neo
2. Click **Run** or **Execute**
3. Verify results return correctly
4. Check any calculated fields work

### 4. Update Scheduled Reports

If you had scheduled reports in Discoverer:

1. Recreate schedules in Neo
2. Maps are imported, but schedule definitions are not
3. See [User Guide - Scheduling](../user-guide/scheduling.md)

### 5. Reconfigure Security

Row-level security predicates don't automatically migrate. Recreate:

1. Admin Panel → **Business Area** → **Security**
2. Add policies matching your original security conditions

### 6. User Onboarding

Create Neo user accounts:

1. Admin Panel → **Users**
2. Create one per Discoverer user
3. Grant business area permissions
4. Send login instructions

## Common Issues

### "EUL Version Mismatch"

**Cause:** Using migration tool from different version  
**Solution:** Download matching tool version for your EUL

### "Missing Oracle Instant Client"

**Cause:** Thick mode required but client not installed  
**Solution:** Either:
- Use thin mode (if Oracle 12.1+)
- Install Instant Client and set `ORACLE_CLIENT_PATH`

### "Business Area Already Exists"

**Cause:** Re-running migration, target already populated  
**Solution:**
- Backup current Neo database
- Delete and restart, or
- Use `--skip-existing` flag (if available)

### "No Data in Results"

**Cause:** Folder doesn't reference a data source  
**Solution:**
1. Admin Panel → select folder
2. Update **Data Source** field
3. Verify schema/table names match

## Performance Considerations

**Large EUL (10,000+ items):**
- Migration may take 30 min – 2 hours
- Don't interrupt; let it complete
- Monitor memory usage (~1–2 GB)

**Network Latency:**
- High-latency connections slow migration
- Consider running tool on same network as databases

## Data Integrity Checks

After migration, verify:

```sql
-- Check item count matches
SELECT COUNT(*) FROM items;  -- Should match EUL_OBJ_COLS

-- Check join count
SELECT COUNT(*) FROM joins;  -- Should match EUL_JOINS

-- Check user permissions
SELECT COUNT(*) FROM business_area_grants;
```

## Rollback Plan

If migration fails or data looks incorrect:

1. **Stop** any user access to Neo
2. **Restore** PostgreSQL backup (taken before migration)
3. **Verify** restore succeeded
4. **Investigate** failure (check logs)
5. **Retry** after fixing issue

## Supported Data Types

Oracle Discoverer → Neo:

| Oracle | Neo |
|--------|-----|
| NUMBER | NUMBER |
| VARCHAR2 | VARCHAR |
| DATE | DATE |
| TIMESTAMP | DATE |
| CLOB | VARCHAR |
| BLOB | VARCHAR |
| RAW | VARCHAR |

Character sets must be UTF-8 compatible.

## What's Next?

- **[Migration Tool Reference](migration-tool.md)** — All CLI commands
- **[Troubleshooting](troubleshooting.md)** — Common problems and solutions
- **[Admin Guide](../admin-guide/)** — Manage imported metadata

---

**See Also:** [Migration Guide](../migration/), [Architecture](../developer-guide/architecture.md)
