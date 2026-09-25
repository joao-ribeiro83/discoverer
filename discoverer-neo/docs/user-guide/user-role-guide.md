# Discoverer Neo — Guide for the USER Role

This guide is for people whose account has the **USER** role. It tells you
what you can do, where to find it, and what to ask your administrator for.

Discoverer Neo replaces Oracle Discoverer. The reports you knew as
**worksheets** are called **maps** here. A **workbook** is still a group of
worksheets.

---

## 1. What the USER role can do

| You can | You cannot |
|---------|-----------|
| Run maps you have access to | Create or change business areas, folders, items, joins or data sources |
| Export results to Excel, CSV and PDF | Manage users, security or the audit log |
| Schedule maps to run automatically | Run the migration from Oracle Discoverer |
| Create and edit your own maps (if your administrator lets you) | See other users' runs |
| Share **your own** maps with colleagues | Share a map that someone else owns |
| Choose your language and theme | |

The menu shows only what your role can use. If you do not see a page that a
colleague sees, they have a different role.

### Where your access comes from

Your role is only half of the picture. Your administrator also gives you
**access to business areas** (groups of related data). You can open a map in
one of these ways:

- **You created it.** You can always run, edit, export, schedule, share and
  delete your own maps.
- **Someone shared it with you.** What you can do depends on the share level
  (see [section 8](#8-sharing-maps)).
- **It is public.** Every user can open, run and export a public map.
- **Your administrator gave you create or edit rights in its business area.**
  You can then work with the maps in that area.

If a map you need is not in your list, ask your administrator or the map's
owner.

---

## 2. Signing in

1. Open the Discoverer Neo address your administrator gave you.
2. Enter your **Email** and **Password**.
3. Click **Sign In**.

### First sign-in with a temporary password

If your account came from Oracle Discoverer, your administrator gives you a
**temporary password**. It has 16 characters, for example `ufNnRksjgR7U%M6X`.

1. Sign in with your email and the temporary password.
2. The **Change your password** screen opens. You cannot skip it.
3. Enter the temporary password again, then your new password two times.
4. The dashboard opens. The temporary password stops working.

Your new password must have **at least 12 characters**. It must be different
from the temporary password.

> **Tip:** the temporary password has no capital `O`, no zero, no small `l`
> and no one. These characters are easy to mix up, so they are not used.

If you lose the temporary password, ask your administrator to reset it.

To sign out, click your email in the top-right corner, then **Log out**.

---

## 3. The screen

The left menu has these items:

| Menu item | What it is for |
|-----------|---------------|
| **Dashboard** | Your numbers at a glance and your recent maps |
| **Maps** | Find, open, run and build maps |
| **Schedules** | Maps that run automatically |
| **Runs** | Every run you started, and its result |
| **Exports** | Files you exported |
| **Settings** (bottom) | Language and theme |

### Dashboard

- **Total Maps** — the maps you can see.
- **Total Executions** — how many times you ran a map.
- **Scheduled Maps** — how many of your schedules are active.
- **Scheduled Results** — how many results your schedules made.
- **Recent Maps** — the last 5 maps you changed.

---

## 4. Finding a map

1. Click **Maps**.
2. Choose a tab:
   - **Mine** — maps you created.
   - **Shared with me** — maps other people shared with you.
   - **All** — every map you are allowed to see. This includes maps that came
     from Oracle Discoverer.
3. Search by name, filter by business area, or sort by name or by date.

### Browse by workbook

The **Workbooks** panel groups maps the way Discoverer saved them. Click a
workbook to see its worksheets in their original order. Click a worksheet to
open it. You only see the worksheets you are allowed to see.

---

## 5. Running a map

1. Open the map.
2. Click **Run**.

### Parameters

Many maps ask for values before they run, for example a start date and an end
date. A **Run parameters** window opens.

1. Fill in every field with a red `*`. These fields are required.
2. Leave an optional field empty to use its saved default.
3. Click **Run**.

If you click **Run** and nothing seems to happen, look for this window. The map
waits until you fill it in.

**Pick-lists.** Most fields show a list of the values that are in the database
now. Click the field or start to type. You can still type any value. If a
column has too many values, the field says
*"Too many values to list — type to search"*. Type two or three characters to
see matches.

**Dates.** Type dates in the format that the field shows.

### What happens after you click Run

A run goes through these steps:

- **Queued** — the run waits its turn. Your runs go one at a time, in order.
- **Running** — the database is working on it.
- **Completed** — the rows show in the table.

If you run the same map with the same values again, and a valid result exists,
Neo shows that result at once. It is marked **Result reused**. Click
**Run again** to get fresh data.

A result stays available for **up to one day**. After that, you must run the
map again.

### When Run is grey

The reason shows under the button. **No output columns** means the map has no
columns to show. Open the map in the builder and add a column.

Two other messages can show after you click **Run**:

- **Not entitled to run** — you can open the map, but you cannot run it on this
  data. Ask your administrator.
- **Could not connect to the data source** — the database is not available.
  Try again later. If it continues, tell your administrator.

### When a map is declined (amber panel)

Sometimes Neo can build the query but cannot promise that the numbers are
correct. It then shows an **amber panel**, not a red error. The panel tells you
what you asked for, why Neo cannot answer, and what to change. Oracle
Discoverer declined the same kinds of query.

This is not a fault. Change the map as the panel tells you, or ask the map's
owner to change it.

---

## 6. Reading the results

### Group breaks and totals

- **Group breaks** — a grouped column shows its value once, on the first row of
  each group. Its header has a **Group** badge.
- **Subtotals** — a line at the end of each group, for example
  `Total for EMEA`.
- **Grand totals** — a bold line at the bottom.

Totals use **all the rows that match the filters**, not only the rows on the
screen.

**When you sort or filter the table, the groups and subtotals stop.** The table
becomes a plain list. Clear the sort to get the groups back. A note at the
bottom tells you when this happens.

### Why a total is empty

Sometimes a total cell is empty on purpose. This happens when the columns come
from different sets of rows, and adding them together gives a wrong number.
Oracle Discoverer did the same. The rows in the table are correct. Only the
total is not shown. The note at the bottom says how many totals are empty.

### Sort, search and columns

- Click a column header to sort: first click A → Z, second click Z → A, third
  click removes the sort.
- Use the search box to filter the rows on the screen. This does not run the
  query again.
- Drag the edge of a column header to change its width.

### Drill to detail

Double-click a row to see the detail rows behind it. For example, double-click
a total to see the rows that make it.

### Yellow note above the results

A yellow note lists settings that this run could not use, for example a sort on
a column that the report does not show. The rows are still correct.

### Crosstabs

Maps from Oracle Discoverer arrive as **tables**, also when the original was a
crosstab (a pivot table). Discoverer did not save which columns went across the
top. If you can edit the map, open a column in the builder and set
**Crosstab edge** to **Across the top**.

---

## 7. Exporting results

1. Run the map and wait until it shows **Completed**.
2. Click **Excel**, **CSV** or **PDF**.
3. **Excel** and **CSV** download the file to your computer at once.
   **PDF** first opens a window: choose the paper and the columns, then click
   **Export**.
4. The file also goes on the **Exports** page. You can download it again from
   there.

| Format | Use it for |
|--------|-----------|
| **Excel** (.xlsx) | Reports and analysis |
| **CSV** | Loading the data into other tools |
| **PDF** | Printing and sending a fixed layout |

All formats keep the group breaks, subtotals and totals that you see on the
screen.

You need the **Can export** share (or higher) to export a map that someone
else owns.

### Why the export buttons are missing

Export uses the rows that a run already saved. It does not run the query again.
The buttons show only when the run is **Completed** and its result has not
expired. Click **Run again** to get a new result that you can export.

### The Exports page

Click **Exports** to see all your exports and their status: **Queued**,
**Running**, **Completed** or **Failed**. Files are kept for **7 days**. Then
they are deleted. Download the files you want to keep.

You can leave the page while a large export runs. Come back to **Exports**
later.

---

## 8. Sharing maps

### Share your own map

You can share only the maps that **you created**.

1. Open your map.
2. Click **Share**.
3. Choose a colleague.
4. Choose the level:

| Level | What your colleague can do |
|-------|---------------------------|
| **Can view** | Open and run the map |
| **Can export** | Open, run, export and schedule the map |
| **Can edit** | All of the above, and change the map |

5. Click **Share**.

To change a level, choose a new one in the list. To stop sharing, click
**Remove**. The change applies at once.

Give the lowest level that your colleague needs.

**Public maps.** If you make a map **Public**, every user can open, run and
export it.

### Maps shared with you

Open **Maps → Shared with me**. What you can do depends on the level you got.
A **Can edit** share lets you change the map, but you **cannot share it** with
other people. Only the owner can do that.

Your own data rights still apply. A share gives you the map, not new data
rights. If you see **Not entitled to run**, ask your administrator for
access to the data.

---

## 9. Building and changing maps

You can build a map only in a business area where your administrator gave you
the right to create maps. If **Create Map** gives an error, ask for this right.

### Create a map

1. Click **Maps**, then **Create Map**.
2. Choose a business area.
3. Enter a **Name**. You can add a **Description**.
4. Choose a **Map Type**: **TABLE** (the usual one), **CROSSTAB** (pivot
   table), **PAGE_DETAIL** or **CHART**.
5. Add columns: choose items from the list on the left. Drag them to change the
   order.
6. Add filters (conditions), parameters and calculated fields if you need them.
7. Click **Save**.

### Useful column settings

- **Sort order** — 1, 2, 3 … for a sort on more than one column.
- **Aggregation** — SUM, COUNT, AVG, MIN or MAX. The other columns become the
  groups.
- **Group and break** — show a value once per group and add a subtotal.
- **Query only, do not show** — the query uses the column, but the table does
  not show it.
- **Format mask** — for example `999,999.00` or `DD-MON-YYYY`. Each reader sees
  the format in their own language.

### Parameters

A parameter asks for a value when the map runs. The name can have only letters,
digits and underscores, and must start with a letter, for example
`start_date`.

### Conditional formatting

After you save the map, click **Formatting** to colour cells or rows that match
a rule. The rules also apply to exports.

### Copy a map

Click **Duplicate** to make your own copy of a map. For a map that someone else
owns, you need the right to create maps in its business area.

### No mouse needed

Every drag action has a keyboard key. Use **Tab** to go to an item, then its
**Add** button. To move a column, go to its grip handle, press **Space**, use
the arrow keys, then press **Space** again.

---

## 10. Scheduling maps

A schedule runs a map for you at set times and keeps the results.

You can schedule your own maps, and maps shared with you at **Can export** or
higher.

### Create a schedule

1. Click **Schedules**, then **New Schedule**.
2. Choose the **Map**.
3. Enter a **Name**.
4. Choose a **Frequency**: **Daily (midnight)**, **Weekly (Sunday, midnight)**,
   **Monthly (1st, midnight)**, or **Custom**.
5. Choose the **Timezone**.
6. Optional: set **Valid from** and **Valid until**.
7. Choose the **Output Format**: Excel or CSV.
8. If the map has parameters, fill in the **Parameter presets**. Every run uses
   these values.
9. Tick **Enabled**, then save.

### Custom frequency (cron)

**Custom** uses a cron expression with five parts:
`minute hour day-of-month month day-of-week`.

| When | Expression |
|------|-----------|
| Every day at 09:00 | `0 9 * * *` |
| Monday to Friday at 08:00 | `0 8 * * MON-FRI` |
| Every Monday at 09:00 | `0 9 * * MON` |
| Every 4 hours | `0 */4 * * *` |
| The first day of each month at midnight | `0 0 1 * *` |

### Manage schedules

In the **Schedules** list, each schedule has these actions: **Run now**,
**Pause** or **Enable**, **History**, **Edit** and **Delete**.

Click **History** to see each run, its status, rows and duration. Click
**Open** to see the rows, or **XLSX**, **CSV** or **PDF** to download them.

### Schedules from Oracle Discoverer

Schedules that came from Oracle Discoverer arrive **disabled**. They do not run
until someone enables them. Before you enable one, look at the **Planner**
column:

| Planner | Meaning |
|---------|---------|
| **Not checked** | No check yet. You can enable it and see the result. |
| `FLAT(...)` or `REWRITE(...)` | The map can run correctly. |
| `REFUSE(...)` | The map cannot give a correct answer. Each run fails. Fix the map first. |
| `UNPLANNABLE` | The map has a data problem from the migration. Ask your administrator. |

A failed scheduled run does not try again automatically.

---

## 11. The Runs page

Click **Runs** to see every run that you started, live or scheduled. You see its
status, rows, duration and when its result expires.

- **Open** — show the rows of that run.
- **Run again** — run with the same values.
- **Cancel** — stop a run that is still queued.
- **Delete** — remove a finished run.
- **XLSX / CSV / PDF** — download the saved rows.

Use the **Map** filter to see the runs of one map only.

---

## 12. Settings

1. Click **Settings** at the bottom of the menu.
2. Choose a **Language**: English, Português (Portugal), Français (France) or
   Español (España).
3. Choose a **Theme**: **Light**, **Dark** or **High-Contrast**.
4. Click **Save**.

The screen changes at once so you can try each choice. **If you do not click
Save, the change is lost** when you reload the page.

Your settings follow you to every computer and browser.

---

## 13. Problems and what to do

| Problem | What to do |
|---------|-----------|
| I cannot find a map | Look in **All**. If it is not there, ask the owner to share it, or ask your administrator for access. |
| **Run** does nothing | Look for the **Run parameters** window and fill in the red `*` fields. |
| **Not entitled to run** | Ask your administrator for access to the data. |
| **Could not connect to the data source** | Wait and try again. If it continues, tell your administrator. |
| Amber panel | The map cannot give a correct number. Change it as the panel says, or ask the owner. |
| No rows | Check the filters and the parameter values. |
| The query takes too long | Use smaller date ranges or more filters. |
| No export buttons | The result expired or is not complete. Click **Run again**. |
| Export **Failed** | Export fewer rows (add filters), or try another format. |
| **Create Map** or **Duplicate** gives an error | Ask your administrator for the right to create maps in that business area. |
| I cannot share a map | You can share only maps you created. Ask the owner. |
| My language or theme went back | You did not click **Save** in **Settings**. |
| The schedule did not run | Check that it is **Enabled** and look at its **Planner** value. |

### What to tell your administrator

When you ask for help, give:

- the map name,
- what you clicked,
- the exact message on the screen,
- the date and time.
