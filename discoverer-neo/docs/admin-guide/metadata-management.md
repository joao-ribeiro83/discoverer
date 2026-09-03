# Metadata Management

Learn how to organize and manage the metadata hierarchy: Business Areas, Folders, Items, Joins, and Hierarchies.

## Metadata Hierarchy

Discoverer Neo organizes data using a hierarchy:

```
Business Area (e.g., "Sales")
└── Folder (e.g., "CUSTOMERS" table)
    ├── Item (e.g., "CUSTOMER_ID" column)
    ├── Item (e.g., "CUSTOMER_NAME" column)
    └── Item (e.g., "REGION" column)
```

## Business Areas

A **Business Area** is a logical grouping of related data and queries. Examples: Sales, Finance, HR, Marketing.

### Create Business Area

1. Admin Panel → **Business Areas**
2. Click **+ Create Business Area**
3. Enter:
   - **Name** — Unique name (required)
   - **Description** — Optional overview
4. Click **Create**

The area is created but empty. Add folders and items next.

### Edit Business Area

1. Click the business area
2. Modify **Name** and **Description**
3. Click **Save**

### Grant Permissions

Users need access to business areas before they can use them. See [User Management](user-management.md).

### Delete Business Area

1. Click **Delete** (soft delete, reversible)
2. Confirm

Archived area and all its contents remain in database but marked inactive.

## Folders

A **Folder** represents a table or view from a data source. Folders contain Items (columns).

### Create Folder (Manual)

1. Open Business Area → **Folders** tab
2. Click **+ Create Folder**
3. Enter:
   - **Name** — Folder name (e.g., "CUSTOMERS")
   - **Folder Type** — TABLE, VIEW, DERIVED, COMPLEX, JOIN, or SUMMARY
   - **Data Source** — Select Oracle or Postgres source
   - **Schema** — Database schema (e.g., "SALES")
   - **Table Name** — Database table name
   - **Description** — Optional notes
4. Click **Create**

### Create Folder (Oracle Introspection)

Auto-import tables/views from Oracle:

1. Open Business Area → **Folders** tab
2. Click **Introspect** or **+ Import from Oracle**
3. Select:
   - **Data Source** — Oracle connection
   - **Schema** — Schema to search
   - **Objects** — Select tables/views (checkbox list)
4. Click **Import**

Folders and items are created automatically with appropriate types and column mappings.

### Folder Types

| Type | Use Case |
|------|----------|
| **TABLE** | Physical database table |
| **VIEW** | Database view |
| **DERIVED** | Custom SQL-based folder |
| **COMPLEX** | Multi-table folder with joins |
| **JOIN** | Pre-joined result of multiple tables |
| **SUMMARY** | Pre-aggregated summary table |

> **Migrating from Discoverer:** an EUL records only *simple* (`SOBJ`) and
> *complex* (`COBJ`) folders, which import as **TABLE** and **COMPLEX**
> respectively. The other types are Neo's own and are available when you create
> folders here.

### Sharing a Folder Across Business Areas

A folder belongs to one **owning** business area, but can be *shared* into
others — the same way Oracle Discoverer lets one folder appear in several
business areas at once. A shared date or organisation dimension is the usual
case.

1. Admin Panel → **Folders**
2. Click the **share** icon on the folder row
3. Pick a business area under **Share into** and click **Share**

The folder now appears in both areas. In any area that is not its owner it is
listed with a **Shared** badge, so nobody edits it expecting the change to be
local — edits apply everywhere it appears.

To stop sharing, open the same dialog and remove the badge for that area. The
**owning** business area cannot be removed; to move a folder somewhere else,
recreate it there.

> **Migrating from Discoverer:** every `BA_OBJ_LINKS` membership is preserved.
> A folder that belonged to three business areas keeps all three — one as owner
> and two as shares — and the migration report notes each one it shared.

### Edit Folder

1. Click folder → **Edit**
2. Modify metadata (name, description, type)
3. Click **Save**

**Note:** Changing table/schema name after creation may break existing maps. Proceed carefully.

### Delete Folder

1. Click folder → **Delete**
2. Confirm

Maps using this folder become broken. Users see errors when running them.

## Items

An **Item** is a column or attribute from a Folder. Items are what users select in the map builder.

### Create Item (Manual)

1. Open Folder → **Items** tab
2. Click **+ Add Item**
3. Enter:
   - **Name** — Item name (e.g., "CUSTOMER_ID")
   - **Data Type** — VARCHAR, NUMBER, DATE, CLOB, etc.
   - **Display Name** — User-friendly label (defaults to name)
   - **Column Name** — Actual database column
   - **Description** — Help text for users
   - **Type** — see the table below. **CO** (Database Item) is the usual
     choice: an item backed by a real column. **CI** is a *created* item —
     a calculation.
   - **Is Key** — Checkbox if this is a primary/foreign key
   - **Is Hidden** — Checkbox to exclude from map builder
   - **Is Required** — Checkbox if always must be included
4. Click **Create**

### Create Items (From Oracle)

When introspecting a table, items are created automatically for all columns.

### Item Types

Oracle Discoverer stores only two of these; the rest exist for items you author
in Neo.

| Type | Meaning | Bound to |
|------|---------|----------|
| **CO** | **Database Item** — the ordinary case, mapped to a physical column | A column |
| **CI** | **Created Item** — a calculation, date-hierarchy or complex-folder item | A formula |
| **CU** | Calculated item authored in Neo | A formula |
| **JI** | Join item | A join |
| **HI** | Hierarchy item | A hierarchy |
| **AG** | Aggregation | A formula |
| **FU** | Function item | A function |

> **If you know Discoverer:** `CO` and `CI` are easy to transpose. `CO` is the
> plain column-backed item — the overwhelming majority of an EUL — and `CI` is
> the created/calculated one. Choosing `CO` shows a **Column Name** field;
> anything else shows a **Formula** box.

### Configure Item Display

For each item, set:

- **Display Name** — How it appears in map builder and results
- **Display Order** — Sequence in list (lower numbers first)
- **Format Mask** — Number/date formatting
  - Date: `YYYY-MM-DD`, `MM/DD/YYYY`, etc.
  - Number: `9,999.00`, `$9999`, etc.

### Edit Item

1. Click item → **Edit**
2. Modify properties
3. Click **Save**

### Hide/Unhide Item

Toggle **Is Hidden** to exclude from or include in map builder. Useful for:
- Internal columns users shouldn't select
- Columns reserved for calculations
- Deprecated fields

### Delete Item

1. Click item → **Delete**
2. Confirm

Maps selecting this item become broken.

## Joins

A **Join** defines a relationship between two folders.

### Create Join

1. Open Business Area → **Joins** tab
2. Click **+ Create Join**
3. Enter:
   - **Name** — Join name (e.g., "Customers to Orders")
   - **Folder 1** — Left folder
   - **Folder 2** — Right folder
   - **Join Type** — INNER, LEFT, RIGHT, FULL
   - **Conditions** — Join predicates (see below)
4. Click **Create**

### Join Conditions

Each join has one or more conditions linking columns:

1. Click **+ Add Condition**
2. Select:
   - **Item 1** — Column in Folder 1
   - **Operator** — = (equals)
   - **Item 2** — Column in Folder 2
3. Add more conditions if needed (AND chaining)

**Example:** CUSTOMERS to ORDERS join:
```
CUSTOMERS.CUSTOMER_ID = ORDERS.CUSTOMER_ID
```

### Join Types

| Type | Result |
|------|--------|
| **INNER** | Only rows matching both folders |
| **LEFT** | All Folder 1 rows, matching Folder 2 or NULL |
| **RIGHT** | All Folder 2 rows, matching Folder 1 or NULL |
| **FULL** | All rows from both folders (with NULLs) |

### Multi-Table Queries

Users select items from multiple folders in a map. Discoverer Neo automatically applies necessary joins.

**Example:**
```
Map selects:
- CUSTOMERS.CUSTOMER_NAME (folder A)
- ORDERS.ORDER_DATE (folder B)
- ORDERS.AMOUNT (folder B)

Auto-applies: CUSTOMERS-to-ORDERS join
```

### Edit Join

1. Click join → **Edit**
2. Modify name, type, or conditions
3. Click **Save**

### Delete Join

1. Click join → **Delete**
2. Maps selecting from both folders can no longer run

## Hierarchies

A **Hierarchy** enables drill-down navigation on dimensions. Example: Year → Month → Day.

### Create Hierarchy

1. Open Business Area → **Hierarchies** tab
2. Click **+ Create Hierarchy**
3. Enter:
   - **Name** — Hierarchy name (e.g., "Time")
   - **Folder** — Folder containing hierarchy items
   - **Description** — Optional notes
4. Add levels:
   - Click **+ Add Level**
   - Select **Item** (must be from the hierarchy folder)
   - Enter **Level Name** (e.g., "Year")
   - Set **Level Number** (1 = top, 2 = second, etc.)
5. Click **Create**

### Hierarchy Levels

Levels define the drill-down order. Example hierarchy:

```
1. CALENDAR_YEAR (top level)
2. CALENDAR_QUARTER
3. CALENDAR_MONTH
4. CALENDAR_DATE (detail level)
```

Users can drill from year → quarter → month → date in reports.

### Edit Hierarchy

1. Click hierarchy → **Edit**
2. Modify name, levels, or order
3. Click **Save**

### Delete Hierarchy

1. Click hierarchy → **Delete**
2. Drill-down becomes unavailable for maps using this hierarchy

## Metadata Caching

Metadata (business areas, folders, items, joins, hierarchies) is cached in Redis for performance.

- **Cache TTL:** 5 minutes (default, configurable)
- **Invalidation:** Automatic when metadata is modified

If you modify metadata directly in the database (not recommended), restart the backend to clear cache.

## Best Practices

1. **Use Descriptive Names** — Avoid abbreviations; users should understand column purposes
2. **Provide Descriptions** — Help text aids users in building correct queries
3. **Organize Logically** — Group related items in folders, create joins for common relationships
4. **Hide Unnecessary Columns** — Keep map builder clean; hide internal/deprecated items
5. **Test After Changes** — Verify existing maps still work after metadata edits
6. **Document Hierarchies** — Describe drill-down logic in descriptions
7. **Backup Before Large Changes** — Export business area definitions before major restructuring

## What's Next?

- **[Oracle Introspection](oracle-introspection.md)** — Auto-discover tables and columns
- **[Data Sources](data-sources.md)** — Manage database connections
- **[User Management](user-management.md)** — Grant business area access
- **[Security Policies](security.md)** — Define row-level security

---

**See Also:** [Admin Guide](../admin-guide/), [API Reference](../api/endpoints.md)
