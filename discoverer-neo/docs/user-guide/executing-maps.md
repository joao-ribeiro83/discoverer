# Executing Maps

Learn how to run maps and view results.

## Running a Map

### From Your Maps

1. Click **Maps** in the sidebar
2. Select a map from **My Maps** or **Shared with Me**
3. Click **Run** or **Execute**

### From Business Area

1. Click **Business Areas** → select an area
2. Find a map in the **Maps** section
3. Click **Run**

## Providing Parameters

If your map has parameters, you'll see an input panel:

1. Enter values for each **Required** parameter
2. Optional parameters can be left blank (default value used)
3. Click **Execute** to run

**Example:**
```
Start Date: [2026-01-01]
End Date: [2026-12-31]
Region: [EMEA]
```

## Viewing Results

After execution completes, you see:

### Result Table

- **Columns** — Based on items selected in map
- **Rows** — Filtered and sorted per map definition
- **Pagination** — If results exceed page size

### Result Information

- **Total Rows** — Total number of rows matching filters
- **Execution Time** — How long the query took
- **Executed By** — Your username
- **Executed At** — Timestamp

## Pagination

For large result sets:

- **Next Page** — Load more rows
- **Load More** — Append additional rows to current view
- Results load in pages (default: 100 rows per page)

## Sorting Results

Click column headers to sort:
- **First click** — Sort ascending (A → Z)
- **Second click** — Sort descending (Z → A)
- **Third click** — Clear sort

**Note:** Multiple column sorts are defined in the map builder, not here.

## Searching Results

Use the search box above the results to filter visible rows by keyword:
- Searches across all columns
- Case-insensitive
- Real-time filtering (doesn't re-execute query)

## Column Actions

Hover over column headers for options:
- **Hide Column** — Temporarily hide from view
- **Adjust Width** — Drag column edge to resize
- **Copy Value** — Copy cell value to clipboard

## Download Results

See [Exporting Data](exporting-data.md).

## Async Execution (Long Queries)

For queries that take > 30 seconds:

1. Click **Run in Background**
2. You're returned to the dashboard
3. Check **Scheduled Jobs** or **Execution History** for status

Status values:
- **PENDING** — Queued, waiting to run
- **PROCESSING** — Currently executing
- **COMPLETED** — Done, results available
- **FAILED** — Query failed (see error)

Click a completed job to view results.

## Execution History

View recent executions of a map:

1. Open a map → click **History**
2. See list of recent runs with:
   - Execution date/time
   - User who ran it
   - Number of rows returned
   - Execution time

Click any row to view those results again.

## Troubleshooting

### Query Timeout

If a query takes too long:
- Check if parameters are too broad (e.g., no date filter)
- Contact your administrator to optimize the underlying data

### No Results

If a query returns zero rows:
- Check conditions are correct
- Verify parameter values
- Try running without optional filters

### Connection Error

If you see "Connection failed":
- The data source is temporarily unavailable
- Try again in a few moments
- Contact your administrator if persistent

## What's Next?

- **[Exporting Data](exporting-data.md)** — Download results as Excel or CSV
- **[Scheduling Maps](scheduling.md)** — Run maps automatically on a schedule
- **[Sharing Maps](sharing.md)** — Share queries with colleagues

---

**See Also:** [Building Maps](building-maps.md), [User Guide](../user-guide/)
