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

### "Target database already contains a migration"

Also seen as a raw Postgres failure from an older build:
`duplicate key value violates unique constraint "users_email_unique" …
Key (email)=(migration@migrated.local) already exists.`

**Cause:** the target database has already been migrated. A Discoverer Neo
database holds exactly one migration: the run mints a `migration@migrated.local`
service account and synthesizes an `@migrated.local` address for every Oracle
user, so a second run collides on the very first INSERT. Nothing is written —
the whole data transaction rolls back.

The runner now checks the target before it reads the EUL, so a repeat run fails
in about a second, and a **dry run reports the same block** instead of a clean
plan.

**Solution:** migrate into a fresh database, or reset this one first.

Back up before resetting — the reset deletes all Neo metadata, including
anything created by hand after the migration:

```bash
docker compose exec postgres pg_dump -U discoverer discoverer_neo > backup.sql
```

Then clear the previous migration. `business_areas` cascades to folders, items,
joins, hierarchies, maps and grants, so three statements are enough:

```sql
BEGIN;
DELETE FROM custom_functions;                          -- global; no cascade path
DELETE FROM business_areas;                            -- cascades the metadata tree
DELETE FROM users WHERE email LIKE '%@migrated.local'; -- migrated accounts + service user
COMMIT;
```

Local accounts (`admin@…` and anyone created in Neo) survive. Run the migration
again afterwards.

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

### Maps migrated without their layout

**Symptom:** every migrated map exists with the right name, but has no columns,
conditions or parameters. `map_items` is empty.

```sql
SELECT count(*) FROM maps;        -- 558
SELECT count(*) FROM map_items;   -- 0   ← the symptom
```

**Cause:** the database was migrated by a version of the tool that could not
read the workbook body. A worksheet's columns live only in
`DOCUMENTS.DOC_DOCUMENT`, a proprietary binary — nothing about the layout is
available relationally — so a migration that skipped it produced empty maps.

**Solution:** re-import just the maps. A full re-run is refused (one migration
per database) and would be wrong anyway: the users, folders and items already
in the database are correct.

```bash
# Preview first — reports what would be replaced, writes nothing.
curl -X POST http://localhost:3000/api/migration/reimport-maps \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"dataSourceId":"<uuid>","dryRun":true}'
```

Then drop `"dryRun": true` to run it. Poll
`GET /api/migration/jobs/:jobId` for progress and the result.

Or run it from the backend container, which streams the log and needs no admin
session:

```bash
docker compose exec backend npx tsx src/scripts/reimport-maps.ts <dataSourceId> --live
```

Omit `--live` for a dry run.

This deletes and rebuilds every map in the **Migrated Workbooks** business
area, so any edit made to a migrated map since the original run is lost. Maps
in other business areas are untouched. Back the database up first.

### A workbook still migrates as an empty map

**Symptom:** the re-import ran, but one or more maps still have no columns, and
the job log carries `WORKBOOK_LAYOUT_MANUAL`.

**Cause:** that workbook's body could not be decoded — it is empty in
`DOCUMENTS`, was written by a Discoverer release whose container differs, or is
corrupt.

**Check what the source actually holds:**

```bash
docker compose exec backend npx tsx src/scripts/probe-eul-workbooks.ts <dataSourceId>
```

The probe reports which body column exists and of what type, what content type
the workbooks declare, and how many of a sample decode. If it reports
`body column: NONE FOUND`, the source has no readable workbook bodies and only
names can migrate; those maps must be rebuilt by hand.

### A migrated map returns more rows than the original report

**Cause:** the map came from a workbook with several worksheets. Discoverer
stores conditions per *workbook*, not per worksheet, and the file does not
record which worksheet used which — so every condition was attached to every
map the workbook produced. A map may therefore carry filters its worksheet
never applied.

The migration warns about this per map (`CONDITIONS_WORKBOOK_WIDE`), and the
assessment report flags it before you start.

**Solution:** open the map, compare its conditions with the original worksheet,
and delete the ones that do not belong.

### A condition did not migrate

**Cause:** Discoverer supports condition forms Neo has no equivalent for —
`NOT IN`, and conditions that combine several tests with `AND`/`OR`. These are
reported rather than approximated: migrating `NOT IN` as `IN` would silently
invert a filter.

**Find them:** they are in the migration result's `skipped` list with their
original text, e.g.

```
map_conditions — condition "Estado NOT IN ('M','A')" — operator has no Neo equivalent
```

**Solution:** recreate them in the map by hand.

### A worksheet column was dropped

**Cause:** the workbook references an item by name, and that item no longer
exists in the EUL — the report outlived the folder or column it was built on.

**Find them:** the `skipped` list carries
`column "M M27.Tomador" is not a migrated item`, and the job log reports the
total.

**Solution:** either restore the item in the EUL and re-import the maps, or
add the column to the map by hand.

### Worksheet settings that could not be applied

**Cause:** the map asks for something the query could not carry. The report
still runs; the setting is listed above the results, and the API returns the
same list in `warnings`.

The ones you will actually see:

| Warning | Why | What to do |
| --- | --- | --- |
| *A total … its Discoverer aggregate did not migrate* | The total computes `COUNT DISTINCT`, or uses an aggregate code nobody has decoded. Neo runs `SUM`, `COUNT`, `AVG`, `MIN`, `MAX`. | Open the map and set the function. The original name is kept in `map_totals.source_attrs.functionName`. |
| *A subtotal was skipped: it breaks at each change in a column this map does not have* | In Discoverer it broke on a workbook *calculation*, which is not a map column in Neo. | Rewrite the calculation as SQL, add it as a column, then re-apply the break. |
| *Sort on hidden item … SELECT DISTINCT can only order by selected columns* | Oracle (ORA-01791) will not order a distinct result by a column it does not select. | Either show the column, or drop the sort. |
| *Sort on hidden item … an aggregated query cannot order by a column it neither selects nor groups by* | Ordering by it would change the report's grain. | Same: show it, or drop the sort. |

**Not an error.** These are reported because the alternative is a number in the
wrong place. A subtotal shown as a grand total, or a `COUNT DISTINCT` run as
`COUNT`, would look right and be wrong.

### A migrated crosstab is drawn as a table

**Cause:** Discoverer records that a column is an axis, a measure or a page
item — but it has **no field for which axis columns went across the top**. The
split is absent from the source file, so no migration can recover it.

**Solution:** open the map in the builder, open a column, and set *Crosstab
edge* to *Across the top*. The report pivots as soon as one column has a top
edge and one column is a measure.

### Subtotals disappear when I sort or filter the grid

**Cause:** breaks and subtotals only make sense while the rows are in the order
the query returned them. Sorting a column in the grid re-orders the rows, and a
subtotal left in place would then sit between rows it does not total.

The grid drops back to a plain list and says so in its footer.

**Solution:** clear the grid's sort and filter to get the worksheet layout
back. To change the report's own order, edit the map's sorts instead.

### A migrated map shows far more columns than the worksheet did

**Cause:** you are looking at a map that predates the calculation fix. A
Discoverer workbook writes every calculation into every worksheet that offers
it, and each is a column unless it is marked hidden.

**Solution:** re-import the maps. Current imports mark those calculations
hidden, so they are neither drawn nor compiled.

### "Calculations/formulas not working"

**Cause:** Syntax differences (Oracle PL/SQL → Neo SQL)

**Check:**
```sql
-- View the original formula in Oracle
SELECT exp_formula1 FROM eul5_expressions WHERE exp_id = <id>;
```

Workbook calculations are different: they are stored inside the workbook body
in Discoverer's own token language, not SQL. They migrate to
`map_calculated_fields` with their item and parameter references resolved to
names, but the function codes are left as written — Oracle's code table is not
public, so translating them would be guesswork. A formula like
`[2,20](Unidade Economica,:Dt Fim)` must be rewritten as SQL before the map
will run.

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
