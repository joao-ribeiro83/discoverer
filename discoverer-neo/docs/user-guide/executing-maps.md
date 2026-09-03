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

## Group Breaks and Totals

A map migrated from Discoverer draws the way the original worksheet did.

**Group breaks.** A column marked *group and break* is shown once per group:
the value appears on the first row and is left blank on the rows that repeat
it. The column header carries a **Group** badge.

**Subtotals.** Where the map defines them, a subtotal line closes each group,
labelled the way the original author wrote it — `Total for EMEA`.

**Grand totals.** A bold line at the foot of the results.

Totals are computed over **every row the filters match**, not over the rows
currently loaded. Loading more rows does not change them.

**Sorting or filtering the grid pauses this.** Breaks and subtotals only make
sense in the order the query returned. Click a column header to sort and the
results become a plain list; clear the sort to get the layout back. The footer
tells you when the layout is paused.

## Crosstabs

A crosstab map puts one set of values down the side, another across the top,
and the measures in between.

Maps migrated from Discoverer arrive **as tables**, even when the original was
a crosstab. Discoverer never recorded which columns went across the top, so
nothing can recover it. Open the map in the builder, open a column and set
*Crosstab edge* to *Across the top* to get the pivot back. See
[Building Maps](building-maps.md).

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

### Worksheet Settings That Could Not Be Applied

A yellow note above the results lists anything the map asked for that this run
could not carry — a total whose Discoverer function has no SQL equivalent, or a
sort on a column the report does not show.

The rows themselves are correct. Fix the setting in the map builder, or see
[Migration Troubleshooting](../migration/troubleshooting.md#worksheet-settings-that-could-not-be-applied).

## What's Next?

- **[Exporting Data](exporting-data.md)** — Download results as Excel or CSV
- **[Scheduling Maps](scheduling.md)** — Run maps automatically on a schedule
- **[Sharing Maps](sharing.md)** — Share queries with colleagues

---

**See Also:** [Building Maps](building-maps.md), [User Guide](../user-guide/)
