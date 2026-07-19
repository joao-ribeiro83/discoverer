# Migration Troubleshooting

Common migration issues and solutions.

## Connection Issues

### "Connection refused"

**Symptoms:**
```
Error: connect ECONNREFUSED 192.168.1.100:1521
```

**Causes:**
- Oracle listener not running
- Firewall blocking port 1521
- Wrong hostname/IP
- Network unreachable

**Solutions:**
```bash
# Test connectivity
nc -zv oracle.example.com 1521

# Verify listener
sqlplus -V

# Check Oracle listener
lsnrctl status

# Verify host/port
nslookup oracle.example.com
```

### "ORA-01017: invalid username/password"

**Cause:** Wrong EUL owner credentials

**Solution:**
```bash
# Verify EUL owner
SELECT OWNER FROM dba_tables WHERE TABLE_NAME = 'EUL5_BA';

# Test connection
sqlplus EUL5_US/password@PROD
```

### "ORA-12514: TNS:listener does not currently know of service"

**Cause:** Wrong service name or SID

**Solution:**
```bash
# List available services
lsnrctl services

# Try different service names:
# - PROD (database name)
# - ORCLPDB (PDB name)
# - Check tnsnames.ora
```

## EUL Version Issues

### "Unsupported EUL version"

**Supported versions:** 4.1, 9.0.4, 10.1.2, 10.1.2.1, 11.1.1

**Check version:**
```sql
SELECT * FROM eul5_release;
-- Or
SELECT version FROM eul5_system_base;
```

**Solution:**
- If version not listed, upgrade source Discoverer or contact support
- Migration tool matches source version automatically

### "EUL tables not found"

**Cause:** Not connected as EUL owner, or EUL not installed

**Check:**
```sql
SELECT COUNT(*) FROM eul5_ba;
SELECT COUNT(*) FROM eul5_objs;
```

**Solution:**
- Verify EUL owner name (typically EUL5_US or similar)
- Check if EUL is installed on this database
- Look for other EUL schemas (different owner)

## Validation Errors

### "Invalid join definition"

**Cause:** Join references non-existent item

**Check:**
```sql
SELECT * FROM eul5_joins WHERE id = 'problematic_join_id';
```

**Solution:**
- Manually fix in source Discoverer
- Or use `--skip-invalid` flag if available

### "Circular hierarchy detected"

**Cause:** Hierarchy references itself (A → B → A)

**Check:**
```sql
-- Query EUL_EXPRESSIONS for cyclic references
SELECT * FROM eul5_expressions WHERE exp_type = 'L';
```

**Solution:**
- Fix hierarchy in source Discoverer
- Or manually recreate in Neo

### "Orphaned items"

**Cause:** Item references deleted folder

**Check:**
```sql
SELECT * FROM eul5_obj_cols col
WHERE NOT EXISTS (
  SELECT 1 FROM eul5_objs obj WHERE obj.id = col.obj_id
);
```

**Solution:**
- Delete orphaned items in Discoverer
- Rerun validation

## Import Errors

### "Duplicate business area name"

**Cause:** Business area already exists in target

**Solutions:**

Option 1: Backup and restart
```bash
# Backup current Neo DB
docker compose exec postgres pg_dump -U discoverer discoverer_neo > backup.sql

# Remove volume
docker volume rm discoverer-neo_postgres_data

# Restart and import
docker compose up -d
```

Option 2: Use skip flag
```bash
dn-migrate import \
  --target 'postgres://...' \
  --input eul-export.json \
  --skip-existing
```

### "Foreign key constraint violation"

**Cause:** Referenced entity doesn't exist

**Check:**
```bash
# Run with --dry-run first
dn-migrate import \
  --target 'postgres://...' \
  --input eul-export.json \
  --dry-run
```

**Solution:**
- Import business areas first
- Then folders
- Then joins
- Run in dependency order

### "Connection to target database failed"

**Cause:** PostgreSQL unreachable or wrong credentials

**Check:**
```bash
# Test connection
psql postgresql://user:pass@localhost:5432/discoverer_neo

# Check service
docker compose exec postgres psql -U discoverer -d discoverer_neo -c "SELECT 1;"
```

**Solution:**
- Verify DATABASE_URL format
- Check PostgreSQL is running
- Verify username/password
- Check firewall/network

## Large EUL Migrations

### "Migration timeout or hangs"

**Causes:**
- Large EUL (10K+ items)
- Slow network
- Low memory

**Solutions:**

Increase timeout:
```bash
NODE_OPTIONS="--max-old-space-size=4096" dn-migrate import ...
```

Reduce concurrency:
```bash
MIGRATION_CONCURRENCY=2 dn-migrate import ...
```

Run on same network as databases (latency).

### "Out of memory (JavaScript heap out of memory)"

**Cause:** Exporting very large EUL

**Solution:**
```bash
# Increase Node memory
node --max-old-space-size=8192 node_modules/.bin/dn-migrate export ...

# Or in shell
export NODE_OPTIONS="--max-old-space-size=8192"
dn-migrate export ...
```

### "Postgres table too large"

**Cause:** Inserting millions of rows

**Solution:**
```bash
# Disable indexes during migration, rebuild after
ALTER TABLE maps ALTER CONSTRAINT maps_pkey DISABLE;

# Or increase maintenance work_mem
ALTER SYSTEM SET maintenance_work_mem = '1GB';
```

## Data Inconsistencies

### "Item counts don't match"

**Verify:**
```bash
# After migration
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/business-areas/:id/folders

# Count items
sqlite3 :memory: ".mode list" \
  "SELECT COUNT(*) FROM $(echo $NEO_JSON | jq -r '.items | length')"
```

**Causes:**
- Hidden items not migrated
- User-defined items filtered out
- Join items treated differently

**Solution:**
- Check `--include-hidden` flag if available
- Review analysis report for excluded items

### "Calculations/formulas not working"

**Cause:** Syntax differences (Oracle PL/SQL → Neo SQL)

**Check:**
```sql
-- View original formula in Oracle
SELECT exp_expr FROM eul5_expressions WHERE exp_id = 'calc_id';
```

**Solution:**
- Manually review and fix formulas in Neo
- Test complex expressions in both systems
- Document syntax mappings

### "Hierarchies not displaying correctly"

**Cause:** Level ordering or circular references

**Solution:**
1. Admin Panel → **Business Areas** → **Hierarchies**
2. Review level ordering
3. Verify no circular references
4. Manually adjust if needed

## Rollback

If migration fails and you need to rollback:

```bash
# 1. Stop all access to Neo
docker compose exec backend curl -X POST http://localhost:3000/api/auth/logout

# 2. Restore backup
docker compose down
docker volume rm discoverer-neo_postgres_data
psql -h localhost -U discoverer discoverer_neo < backup.sql

# 3. Verify
curl http://localhost:3000/api/health
```

## Getting Help

If you're still stuck:

1. **Check logs:**
   ```bash
   docker compose logs backend | grep -i error
   ```

2. **Run validation:**
   ```bash
   dn-migrate validate --connection oracle-config.json
   ```

3. **Export for inspection:**
   ```bash
   dn-migrate export --connection oracle-config.json --output eul-export.json
   # Review eul-export.json in text editor
   ```

4. **Collect diagnostics:**
   ```bash
   # Database versions
   sqlplus -v
   postgres --version
   
   # Connection info
   sqlplus EUL5_US/pass@PROD -c "SELECT * FROM eul5_release;"
   
   # Error logs
   docker compose logs > logs.txt
   ```

5. **Contact support** with:
   - EUL version and size
   - Error messages
   - Collected logs
   - Analysis/validation output

## What's Next?

- **[Migration Tool](migration-tool.md)** — CLI commands
- **[From Discoverer 4](from-discoverer4.md)** — Migration process
- **[Admin Guide](../admin-guide/)** — Managing imported data

---

**See Also:** [Migration Guide](../migration/), [Developer Guide](../developer-guide/)
