# Building Maps

Learn how to create maps (saved queries) using the interactive map builder.

## What is a Map?

A **Map** is a saved query definition that specifies:
- Which data columns (Items) to display
- What rows to filter (Conditions)
- How to sort and aggregate results
- Parameters to make the query interactive
- Calculated fields for business logic

## Map Types

Discoverer Neo supports four map types:

| Type | Use Case |
|------|----------|
| **TABLE** | Tabular result display, default for most queries |
| **CROSSTAB** | Pivot table view (rows × columns) |
| **PAGE_DETAIL** | Master-detail layout (drill-down) |
| **CHART** | Visual representations (bar, line, pie, etc.) |

## Creating a Map

### Step 1: Start the Map Builder

1. Click **Maps** in the sidebar, then **Create Map**
2. Choose a business area for the new map
3. Enter:
   - **Name** — Map title (required)
   - **Description** — Optional description
   - **Map Type** — Choose TABLE, CROSSTAB, PAGE_DETAIL, or CHART
4. Click **Next** or **Create**

### Step 2: Select Items (Columns)

Items are the columns/fields you want to display.

1. In the **Items** panel, click **+ Add Item**
2. Select from the available items in the folder
3. Reorder by dragging items
4. For each item, you can configure:
   - **Display Name** — Column header (defaults to item name)
   - **Sort Direction** — ASC (ascending) or DESC (descending)
   - **Sort Order** — 1, 2, 3... for multi-column sort
   - **Aggregation Function** — SUM, COUNT, AVG, MIN, MAX (for numeric items)
   - **Display Width** — Column width in pixels (optional)
   - **Format Mask** — Date/number formatting (optional)

**Example:** For a Sales report:
- CUSTOMER_NAME (display name: "Customer", sort order 1)
- AMOUNT (aggregation: SUM)
- SALE_DATE (format mask: "YYYY-MM-DD")

### Step 3: Add Conditions (Filters)

Conditions filter which rows appear in results.

1. Click **+ Add Condition**
2. Select an **Item** to filter on
3. Choose an **Operator**:
   - `=` — Equals
   - `<>` — Not equals
   - `>` — Greater than
   - `<` — Less than
   - `>=` — Greater than or equal
   - `<=` — Less than or equal
   - `LIKE` — Pattern match (%)
   - `IN` — Multiple values
   - `BETWEEN` — Range
   - `IS_NULL` — No value
4. Enter a **Value** or choose **Parameter**
5. Set **Logic Operator** (AND/OR) if multiple conditions

**Example:** Show only sales from 2026:
- Item: SALE_DATE
- Operator: >=
- Value: 2026-01-01

**Parameterized Condition:** Make a condition interactive by binding to a **Parameter** (see Step 4).

### Step 4: Add Parameters

Parameters make maps interactive by prompting users for input when executing.

1. Click **+ Add Parameter**
2. Enter:
   - **Name** — Unique identifier (letters, digits, underscores only, e.g., `start_date`)
   - **Type** — STRING, NUMBER, DATE, LIST
   - **Default Value** — Optional default (used if parameter not provided)
   - **Required** — If checked, user must provide a value

3. Use the parameter in a condition by selecting it instead of a static value

**Example:** Create a DATE parameter `end_date`, use it in condition:
- Item: SALE_DATE
- Operator: <=
- Value: <parameter: end_date>

When running the map, users will be prompted to enter an end date.

### Step 5: Add Calculated Fields (Optional)

Calculated fields compute new columns using SQL expressions.

1. Click **+ Add Calculated Field**
2. Enter:
   - **Name** — Field name (e.g., `REVENUE_PERCENT`)
   - **Formula** — SQL expression (e.g., `AMOUNT * QUANTITY`)

**Example:**
- Name: `MARGIN_PCT`
- Formula: `(AMOUNT - COST) / AMOUNT * 100`

Formulas can reference:
- Item names (e.g., `AMOUNT`, `QUANTITY`)
- SQL functions (e.g., `UPPER(CUSTOMER_NAME)`, `TRUNC(SALE_DATE)`)
- Window functions (e.g., `SUM(AMOUNT) OVER (PARTITION BY CUSTOMER_ID)`)

### Step 6: Save the Map

1. Click **Save Map**
2. Review the summary
3. Click **Confirm**

The map is now saved and available in your **My Maps** list.

## Editing a Map

1. Click **Maps** → find your map → click **Edit**
2. Modify items, conditions, parameters, or calculated fields
3. Click **Save**

## Map Builder Tips

### Multi-Folder Queries

To query data from multiple folders, you first need to define **Joins** between them. Contact your administrator.

### Sorting

- Set **Sort Order** (1, 2, 3...) for multi-column sorting
- Only items with a sort order appear in the sort
- Higher sort orders are applied after lower orders

### Aggregation

When you add an aggregation function (SUM, COUNT, etc.) to an item:
- Results automatically group by non-aggregated items
- Aggregated items are calculated per group

**Example:** To get total sales by customer:
- Add CUSTOMER_NAME (no aggregation, sort order 1)
- Add AMOUNT (aggregation: SUM)
- Result: One row per customer with total sales

### Parameter Naming

Parameter names must:
- Start with a letter (A-Z, a-z)
- Contain only letters, digits, and underscores
- Example good names: `start_date`, `region_code`, `customer_id`

### Group and Break

Tick **Group and break** on a column to hide its repeated values and start a
new subtotal each time it changes. Group columns are always sorted before every
other column — a break only groups if nothing sorts outside it.

### Placement and Crosstab Edge

**Placement** says what a column is for:

- **Group by (axis)** — a column the report groups on. It is never aggregated,
  even if the underlying item has a default aggregation.
- **Measure** — a value to aggregate.
- **Page item** — filters the whole sheet; not drawn in the grid.

**Crosstab edge** applies to a `CROSSTAB` map: set one column to *Across the
top* to pivot the report. Maps migrated from Discoverer have no edge recorded —
Discoverer had no such field — so a migrated crosstab shows as a table until
you set one.

### Query-Only Columns

Tick **Query only, do not show** to keep a column out of the results while the
query still asks for it. Use it when a filter, a sort or a total needs a column
the reader should not see.

### Column Formats

**Format mask** uses Oracle's notation (`999,999.00`, `$9,999.00`,
`DD-MON-YYYY`). It is read for its meaning — grouped thousands, two decimals,
day-month-year — and then rendered in each reader's own language, so the same
map reads correctly for everyone.

## What's Next?

- **[Executing Maps](executing-maps.md)** — Run your map and view results
- **[Exporting Data](exporting-data.md)** — Save results as Excel or CSV
- **[Sharing Maps](sharing.md)** — Share with other users

---

**See Also:** [User Guide](../user-guide/), [Admin Guide - Metadata](../admin-guide/metadata-management.md)
