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

A worksheet migrated from Discoverer often carries parameters — the original
titles show them as `&Dt Inicio`, `&Dt Fim`. There are 7,521 of them across the
estate.

Click **Run** and, if the worksheet has any parameter without a saved default,
a **Run parameters** prompt opens before anything is sent to the database:

1. Fill in every field marked with a red `*`. Those are required.
2. Leave an optional field blank to use its saved default.
3. Click **Run** in the prompt.

The prompt will not let you continue while a required field is empty — it marks
the field instead. Nothing runs until the prompt is satisfied, so a worksheet
that seems not to react to **Run** is usually waiting on this prompt behind the
page.

Values you type are sent to the server as bind variables. The browser never
builds SQL, so a value with a quote or a semicolon in it is data, never code.

Pick-lists for parameters that have a list of values arrive in a later release;
for now every field is free text.

## When Run is switched off

**Run** is greyed out when it cannot do anything useful, and the reason is
printed under the button. Today the one reason the page can know before it
asks the server is:

- **No output columns.** The worksheet draws nothing. Open it in the builder
  and add at least one column.

Two more conditions only the server can know, so they arrive as a message after
you click:

- **Not entitled to run.** You may open the worksheet but not run it against
  this data source.
- **Could not connect to the data source.** The connection is missing or down.

## When a worksheet is declined

Sometimes the answer is not an error and not a result — the query planner
declines to run the worksheet, because it can build the SQL but cannot promise
the number is right.

A declined worksheet shows an amber panel, not a red one. It says what was
asked, why it cannot be answered, and what to change. Discoverer refused the
same shapes.

**You are told before you press Run.** The map builder classifies the worksheet
as you compose it, so the panel appears on the canvas as soon as the columns
make an unanswerable query — not after a round trip to the database.

The reasons, and what to do, are in
[Troubleshooting: why a worksheet was declined](../troubleshooting/refusals.md).

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

### Why some totals come out blank

A total can appear **empty** rather than as a number. That is deliberate, and
it is not a bug.

It happens when one worksheet totals columns whose rows come from different
places — one from the main folder, one from its detail rows. Those two sets of
rows are counted differently, and adding them together would produce a number
that answers no question. Rather than print it, Neo leaves the cell blank and
says so in the footer.

Discoverer did exactly the same: *"Discoverer will not total the values
together. Instead, Discoverer will display a null to prevent incorrect or
unexpected results."*

To get the numbers, total each column on a worksheet of its own — or total only
the columns that come from the same folder.

**Every total on a worksheet that summarises two or more sets of detail rows is
blank, for the same reason.** A total is worked out by running the worksheet's
own join again without its grouping — and on a worksheet like this, that join is
the very one that repeats rows and would inflate the answer. The rows in the
table above the total are correct; only the total is withheld. The footer says
how many were left blank.

To get one, put the total on a worksheet that uses one folder, or export the
rows and total them there.

### Why a worksheet sometimes refuses to total at all

`AVG`, `COUNT DISTINCT`, `STDDEV` and `VARIANCE` cannot be worked out across a
one-to-many join. Neo declines rather than showing a wrong number; the amber
panel explains, and
[Troubleshooting: why a worksheet was declined](../troubleshooting/refusals.md)
lists what to use instead.

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
