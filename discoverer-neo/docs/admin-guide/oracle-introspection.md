# Oracle Introspection

Automatically discover tables and views from Oracle databases and import them as Discoverer Neo folders.

## What is Introspection?

**Introspection** connects to an Oracle database and reads table/view definitions (schema, columns, data types) to automatically create Discoverer Neo folders and items.

Without introspection, you'd manually create each folder and item, which is tedious and error-prone for large schemas.

## Introspection Process

1. Connect to Oracle database (via data source)
2. Query dictionary views (USER_TABLES, USER_VIEWS, USER_TAB_COLUMNS)
3. Create folder for each table/view
4. Create item for each column
5. Set data types, key constraints, and display names

## Running Introspection

### Step 1: Add Data Source

First, create an Oracle data source (see [Data Sources](data-sources.md)):

1. Admin Panel → **Data Sources**
2. Add Oracle connection
3. Test connectivity
4. Save

### Step 2: Introspect Tables

1. Admin Panel → **Business Areas** → select area
2. Click **Folders** tab
3. Click **+ Introspect** or **Import from Oracle**
4. Select:
   - **Data Source** — Oracle connection
   - **Schema** — Database schema (e.g., "SALES")
5. Click **List Tables**

System queries all tables and views in the schema.

### Step 3: Select Tables/Views

A list appears showing all discoverable objects:

1. Check boxes next to tables/views you want to import
2. Uncheck any you want to skip (e.g., temporary tables, internal objects)
3. Click **Import**

Discoverer Neo creates folders for each selected object.

### Step 4: Verify Import

After import completes:

1. Refresh the **Folders** list
2. Verify all expected tables/views appear
3. Click a folder to review items (columns)
4. Check data types and display names

## Imported Folder Properties

When importing, each folder gets:

| Property | Auto-Detected |
|----------|---------------|
| **Name** | Table/view name |
| **Type** | TABLE or VIEW |
| **Schema** | Source schema |
| **Table Name** | Physical table name |
| **Description** | Null (user should add) |

## Imported Item Properties

For each column, items receive:

| Property | Auto-Detected |
|----------|---------------|
| **Name** | Column name |
| **Data Type** | Oracle data type (VARCHAR2 → VARCHAR, NUMBER, DATE, etc.) |
| **Display Name** | Column name (user should improve) |
| **Column Name** | Physical column name |
| **Is Key** | Yes, if column is part of primary key |
| **Description** | Null (user should add) |

## Post-Import Cleanup

After introspection, improve metadata:

### Add Descriptions

1. Click folder → **Edit**
2. Add **Description** explaining the table
3. Repeat for key items
4. Save

**Example:**
- Folder: "Customers master table with contact and address info"
- Item CUSTOMER_ID: "Unique customer identifier, primary key"
- Item CUSTOMER_NAME: "Customer business name"

### Improve Display Names

1. Click item → **Edit**
2. Change **Display Name** to user-friendly version
3. Examples:
   - CUST_ID → Customer ID
   - SALES_AMOUNT_USD → Sales Amount (USD)
   - CREATE_DT → Creation Date

### Hide Unnecessary Items

For internal columns users shouldn't use:

1. Click item → **Edit**
2. Check **Is Hidden**
3. Save

Hidden items don't appear in map builder but still exist for queries.

### Set Sort Order

Organize items for map builder:

1. Click folder → **Edit**
2. Reorder items by **Display Order**
3. Save

## Handling Data Type Mapping

Oracle data types are mapped to generic types:

| Oracle | Mapped To | Notes |
|--------|-----------|-------|
| VARCHAR2(n) | VARCHAR | Text, up to 4000 chars |
| CLOB | VARCHAR | Large text (>4000 chars) |
| NUMBER(p,s) | NUMBER | Numeric with precision |
| DATE | DATE | Date only |
| TIMESTAMP | DATE | Date and time |
| BLOB | VARCHAR | Binary (treated as text in Discoverer Neo) |

## Incremental Introspection

Introspect a schema multiple times to:

- Add newly created tables
- Re-import changed tables
- Skip previously imported tables (system checks for duplicates)

**Note:** Re-importing an existing table doesn't update item definitions. Delete old folder first, then introspect.

## Handling Complex Objects

### Views with Joins

Views that join multiple tables introspect normally. The resulting folder doesn't expose the join structure; it's just a folder with items from the view's result set.

### Synonym Handling

Database synonyms are typically not introspected (system skips them). If needed:
- Create a view instead of a synonym
- Manually create folder pointing to synonym name

### Materialized Views

Oracle materialized views introspect as tables (they're materialized, so behave like tables).

## Introspection Troubleshooting

### "No tables found"

**Causes:**
- Wrong schema name or doesn't exist
- User lacks SELECT_CATALOG_ROLE privilege
- No tables in schema

**Solution:**
1. Verify schema name from Oracle DBA
2. Check user privileges:
   ```sql
   SELECT * FROM SESSION_PRIVS WHERE PRIVILEGE LIKE '%CATALOG%';
   ```
3. List available tables:
   ```sql
   SELECT OWNER, TABLE_NAME FROM DBA_TABLES ORDER BY OWNER;
   ```

### "Cannot connect to Oracle"

See [Data Sources - Troubleshooting](data-sources.md#troubleshooting).

### "Import timeout"

**Cause:** Large schema with many objects

**Solution:**
- Introspect smaller schemas separately
- Contact admin to increase timeout in backend config

## Automation

To automate large-scale introspection (e.g., after deploying a new ERP):

1. Use migration tool CLI or API to bulk-create folders
2. Write script to introspect via API:
   ```bash
   curl -X POST http://localhost:3000/api/business-areas/:baId/folders/:folderId/introspect \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"dataSourceId":"...","schema":"SALES"}'
   ```

## Next Steps

- **[Metadata Management](metadata-management.md)** — Create joins between introspected tables
- **[Data Sources](data-sources.md)** — Manage database connections
- **[Building Maps](../user-guide/building-maps.md)** — Use imported tables in queries

---

**See Also:** [Admin Guide](../admin-guide/), [API Reference](../api/endpoints.md)
