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
-- Connect as the EUL owner (e.g. EUL5_US, or SIID_TESTES on a 4.1 EUL).
-- The prefix is EUL4_ or EUL5_; EUL5_BAS is the marker that identifies an EUL.
SELECT * FROM eul5_bas;       -- Business areas
SELECT * FROM eul5_objs;      -- Folders
SELECT * FROM eul5_expressions; -- Items and calculations
SELECT * FROM eul5_documents; -- Workbooks (the body is in DOC_DOCUMENT)
```

To check how a source stores its workbooks before migrating it — which body
column exists, whether it decodes, and how much comes out — run the
workbook probe against a registered data source:

```bash
docker compose exec backend npx tsx src/scripts/probe-eul-workbooks.ts <dataSourceId>
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

Source table names below are the **real** EUL table names, verified against
Oracle's own shipped scripts and a live 4.1 EUL — see
[EUL Schema Ground Truth](../../migrate/EUL_SCHEMA_GROUND_TRUTH.md). The prefix
is `EUL4_` or `EUL5_` depending on the source version.

### Automatically Migrated

| Discoverer | Source | Discoverer Neo |
| --- | --- | --- |
| Business areas | `BAS` | `business_areas` |
| Folders | `OBJS` (+ `BA_OBJ_LINKS`) | `folders`, `folder_business_areas` |
| Items and calculations | `EXPRESSIONS` | `items` |
| Joins | `KEY_CONS` | `joins` |
| Custom functions | `FUNCTIONS` | `custom_functions` |
| Users and roles | `EUL_USERS` | `users` |
| Privileges | `ACCESS_PRIVS` | `user_business_area_grants` |
| **Workbooks / worksheets** | **`DOCUMENTS.DOC_DOCUMENT`** | **`maps`** |
| **Worksheet columns** | same | **`map_items`** |
| **Worksheet conditions** | same | **`map_conditions`** |
| **Workbook parameters** | same | **`map_parameters`** |
| **Workbook calculations** | same | **`map_calculated_fields`** |
| **Totals and subtotals** | same | **`map_totals`** |
| **Print/page setup** | same | **`map_page_setup`** |
| **Worksheet identity, printed title, join usage** | same | **`map_layouts`** |

### How workbooks become maps

A Discoverer **workbook** is a container of worksheets; a **worksheet** is what
actually has a column layout and runs a query. Discoverer Neo has no workbook
container — a map *is* one report — so **each worksheet becomes one map**.

- A workbook with a single worksheet keeps the workbook's name
  (`GD_M.M172_V01`), which is what users have always called that report.
- A workbook with several worksheets produces one map per worksheet, named
  `Workbook — Worksheet` (`M27 — Detalhe de Pagamentos`).

Migrated maps land in an auto-created business area called **Migrated
Workbooks**: Discoverer workbooks belong to no business area, so they need a
home in Neo. Move them into real business areas after reviewing them.

The layout comes out of `DOCUMENTS.DOC_DOCUMENT` — the proprietary Discoverer
container, the same bytes a `.DIS` file holds. It is **not** XML, and none of
its content is available relationally (`EXPRESSIONS.IT_DOC_ID` and
`ELEM_XREFS` are empty on a real 4.1 EUL). The migrator decodes it directly;
the format is documented in §7 of the ground-truth reference.

Worksheet columns resolve to migrated items by the EUL's own
`EXPRESSIONS.EXP_ID`, which the workbook records alongside each item — the same
key every other migrated foreign key uses, so a column survives an item being
renamed in the EUL. The folder and item names are the fallback for the rare
column that records no id. A column whose item has since been *deleted* from
the EUL is dropped and reported.

### Worksheet layout, sorting and totals

These are not just stored — the query engine and the results grid act on them.

**Duplicate rows.** A worksheet that asked for distinct rows migrates as
`SELECT DISTINCT`. It is a property of the query, so it applies to exports and
scheduled runs too, not only to what you see on screen.

**Sorting.** Direction and position migrate. A *group* sort — Discoverer's
"group and break" — migrates as well, and the query puts every group sort ahead
of every plain sort, because a break only groups if nothing sorts outside it.
In the results grid, repeated values in a group column are left blank and a
subtotal closes each group, the way the original sheet drew them.

**Query-only columns.** A worksheet often names a column its query needs but
draws nothing for — a column a filter, a sort or a total uses. Those migrate as
hidden: they stay out of the results, and out of the `GROUP BY`, but the filter
or total that needs them still works.

**Totals and subtotals.** A grand total, and a subtotal at each change in a
column, both migrate and both run. They are computed by their own query over
the whole filtered set, so a subtotal is the true figure for its group even
when only the first page of rows has been fetched.

**Column formats.** Format mask, column width, data type and heading format
migrate and are applied when the report is drawn. A mask is read for its
*meaning* — grouped thousands, two decimals, day-month-year — and then rendered
in the reader's own language, so `999,999.00` shows as `1,234.50` in English
and `1 234,50` in Portuguese.

**The printed title.** A worksheet's name and the heading it printed above the
data are two different things, and both migrate. The name becomes the map's
name; the heading becomes its description, so it is what you read under the
title on the map page. `map_layouts` keeps the heading in all three forms
Discoverer wrote — plain text, RTF and HTML — along with the worksheet's
position in its workbook, its GUID and how many queries it linked. Every map
gets one of these rows.

**Measure vs axis.** Discoverer records whether a column is a measure or
something to group by. A column on the axis is never aggregated, even when the
EUL item it came from carries a default aggregation — otherwise a break column
would arrive summed and the grouping would be meaningless.

If any of this cannot be applied to a particular run, the report says so above
the results rather than quietly dropping it. See
[Troubleshooting](troubleshooting.md#worksheet-settings-that-could-not-be-applied).

### Migrated with caveats

⚠ **Conditions on multi-worksheet workbooks.** Discoverer stores conditions per
*workbook*, not per worksheet, and nothing in the file says which worksheet
used which. Every condition is therefore attached to every map the workbook
produced. Review multi-worksheet maps and remove the conditions that worksheet
did not use — otherwise the map filters more than the original report did.

⚠ **Conditions Neo cannot express.** `NOT IN`, and conditions that combine
several tests with `AND`/`OR`, have no Discoverer Neo equivalent. They are
reported in the migration's skipped list with their original text rather than
approximated — migrating `NOT IN` as `IN` would silently invert a filter.

⚠ **Calculated fields.** A workbook calculation is stored in Discoverer's own
token language, not SQL. It migrates with its item and parameter references
resolved to names, but the function codes are left as written and the formula
must be rewritten as SQL before the map will run.

A workbook writes every calculation into every worksheet that *offers* it, so
most migrated calculations belong to no sheet's layout — 38 436 of 47 548 in
the reference corpus. Those are marked hidden and are neither drawn nor
compiled, so only the calculations a worksheet actually displayed need
rewriting. A map is blocked by its own calculations, never by another sheet's.

⚠ **Crosstabs have no row/column split.** Discoverer records that a column is
an axis, a measure or a page item, but it has **no field at all** for which
axis columns went across the top. A migrated crosstab therefore arrives with
every axis column down the side and is shown as a table until somebody assigns
a top edge — open the column in the map builder and set *Crosstab edge* to
*Across the top*. This is missing data, not a decoding failure.

⚠ **Totals whose aggregate Neo cannot run.** Discoverer's aggregate list is
wider than SQL's. `COUNT DISTINCT` totals, and a handful using codes nobody has
decoded, migrate with their label and placement but no function — 304 of the
reference corpus's 19 639. They are listed in the report's warnings; set the
function in Neo. Writing `COUNT` instead would have counted duplicates and
shown a different number without saying so.

⚠ **Subtotals that broke on a calculation.** A subtotal breaking at each change
in a workbook *calculation* loses its boundary: Neo's break column has to be a
real map column and a calculation is not one. The total is reported and
skipped rather than being shown as a grand total, which would print an
all-rows figure where a reader expects a per-group one.

### Manual Migration Required

✗ **Hierarchies** — `HIERARCHIES` has no business-area column, and Neo requires
one, so hierarchies are currently skipped. Recreate them in Neo.
✗ **Graphs** — Discoverer's chart definitions. Neo has a `CHART` map type but
no equivalent model behind it, so `map_layouts.graph` is left null. (The graph
block is empty on all 917 corpus worksheets that have one, so nothing is being
discarded today — but a workbook with a real chart would lose it.)
✗ **Conditional formatting** — the "format this cell when…" rules. Neo has the
table for them; nothing writes it yet.
✗ **Percentages** — Discoverer keeps a percentage in the same element as a
total, and no code in the reference corpus is one, so every migrated summary
arrives as a plain total. Add percentages in Neo.
✗ **Cell alignment and word wrap** — the codes are undecoded, so they are left
unset rather than guessed; numbers right-align and text left-aligns as usual.
✗ **Sort rank** — Discoverer's explicit sort precedence is not decoded. Sorts
keep their list position, which is the same order in every case observed.
✗ **Row-level security** — Recreate as Neo security policies
✗ **LDAP/Directory Integration** — Not automatically configured; set up in Neo
✗ **Scheduled Reports** — Not migrated; recreate using Neo scheduler
✗ **Advanced Analytics** — Analytic window functions may need adjustment
✗ **Portlet Configuration** — Discoverer Portlet Provider not supported in Neo

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

### 3. Review the migrated maps

Migrated maps arrive in the **Migrated Workbooks** business area with the
columns, conditions and parameters their worksheet had. Before handing them to
users:

1. Open a map and check its column list against the original report.
2. On maps from a multi-worksheet workbook, remove the conditions that
   worksheet did not use — Discoverer stored them per workbook, so they were
   attached to every map it produced.
3. Rewrite any calculated field's formula as SQL. They arrive in Discoverer's
   token language, which Neo cannot execute.
4. Move the maps into the business areas they belong to.
5. Run each map and confirm the results match.

If the maps arrived **empty** — no columns at all — the workbook body could not
be read. See [Maps migrated without their
layout](troubleshooting.md#maps-migrated-without-their-layout).

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

### "Target Database Already Contains a Migration"

**Cause:** Re-running a migration into a Neo database that already holds one.
A database holds exactly one migration — the run is refused before it reads the
EUL, and a dry run reports the same block.  
**Solution:**
- Back up the current Neo database (`pg_dump`)
- Migrate into a fresh database, or reset this one — see
  [Troubleshooting](troubleshooting.md#target-database-already-contains-a-migration)

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
