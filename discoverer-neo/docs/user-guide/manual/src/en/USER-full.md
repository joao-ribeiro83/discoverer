# Your role at a glance

Discoverer Neo replaces Oracle Discoverer. A **map** is a report (in Oracle Discoverer this was a worksheet). A **workbook** is a group of maps. A **business area** is a group of related data. You have the **USER** role. It lets you open and run maps, export and schedule them, and build maps of your own.

| You can | You cannot |
|---|---|
| See your own maps, public maps and maps shared with you | See private maps that nobody shared with you |
| Run a map and look at its results | Run a map on data you have no access to |
| Export results to Excel, CSV or PDF, if the map's share level allows it | Export a map that is shared with you at **Can view** only |
| Schedule a map, if you own it or it is shared with you at **Can export** or **Can edit** | Schedule a public map you do not own |
| Copy any map you can see and change your copy | Change a map you do not own, unless it is shared with you at **Can edit** |
| Create a new map, but only in a business area where your administrator gave you the create right | Create maps in other business areas |
| Share and delete maps that you own | Share or delete maps that belong to someone else |
| See your own runs, exports and schedules | See other people's runs, exports or schedules |
| Choose your language, theme and colours | Open the administration pages (they are not in your menu) |

## Where your access comes from

Three things decide what you can do. Your role is only the first.

- **The map.** You see a map if you created it, if its owner made it **Public**, or if someone shared it with you. A grant on a business area does **not** show you maps.
- **The share level.** For a map you do not own, the share level tells you what you may do. See the table below.
- **Your business-area grants.** Your administrator gives you rights on business areas. To read the data of a map, you need access to the data it uses. To create a new map, you need the **create** right in that business area. Without it, the map runs fail with "Not entitled to run", or saving a new map fails.

| Situation | Open and run | Export | Schedule | Change the map |
|---|---|---|---|---|
| You own the map | Yes | Yes | Yes | Yes |
| Shared with you: **Can view** | Yes | No | No | No |
| Shared with you: **Can export** | Yes | Yes | Yes | No |
| Shared with you: **Can edit** | Yes | Yes | Yes | Yes |
| Public map you do not own | Yes | Yes | No | No |

> **Note:** Only the owner can share or delete a map. A person who has **Can edit** cannot share it further.

If a map you need is missing, ask its owner to share it with you.

## Sign in, change your password, sign out

1. Open the address your administrator gave you.
2. Type your **Email** and **Password**.
3. Leave **Remember me** ticked if you want to stay signed in after you close the browser. Untick it on a shared computer.
4. Click **Sign in**.

![The sign-in page with Email, Password, Remember me and the Sign in button.](shots/en/common/01-login.png)

If your account was created with a temporary password, the **Change your password** page opens first. You cannot use the rest of the application until you change it.

| Field | What to type |
|---|---|
| **Temporary password** (or **Current password**) | The password you use now |
| **New password** | At least 12 characters. It must be different from the current one |
| **Confirm new password** | The same new password again |

Click **Change password**. The dashboard opens.

If you forget your password, ask your administrator to reset it. There is no self-service reset.

To sign out, click your name in the top-right corner, then **Log out**. This ends your session. To use Discoverer Neo again, sign in again.

> **Note:** After 5 wrong passwords in a row your account is locked for 15 minutes. Wait, then try again.

---

# Dashboard

The **Dashboard** is the first page after sign-in. It gives you a quick summary. It is read-only. You use it to see how much you have and to jump to your last maps.

![The dashboard with summary cards and the Recent Maps list.](shots/en/user/45-dashboard.png)

| Card | What it shows |
|---|---|
| **Total Maps** | The maps you can open. The line below says how many are yours and how many are shared with you (public maps are counted there too) |
| **Total Executions** | Runs of the maps you can see, by anyone |
| **Scheduled Maps** | Maps for which you have at least one active schedule |
| **Scheduled Results** | Results stored by your schedules |
| **Recent Maps** | Your last 5 maps that you created, newest first. Click one to open it in the map builder |
| **View schedules** (link on two cards) | Opens the **Schedules** page |

If you have created no maps, **Recent Maps** says that none are yours.

---

# Maps

The **Maps** page is your list of reports. You use it to find a map, run it, copy it, share it or delete it.

![The Maps list, Mine tab, showing the action icons on the map row.](shots/en/user/03-maps-mine.png)

## Tabs, search and filters

| Control | What it does |
|---|---|
| **Mine** | Maps you created |
| **Shared with me** | Maps that others shared with you, at any level |
| **All** | Everything you can see: your own, public and shared maps |
| **Search maps by name…** | Filters the list by name as you type |
| **Business Area** filter | Shows only maps of one business area. **All business areas** removes the filter |
| **Sort by** | **Recently updated** or **Name (A–Z)** |
| **Clear** | Resets the search and the business area. It only appears when a filter is on |
| **Create Map** | Opens the map builder for a new map |

The table shows **Name**, **Workbook**, **Owner**, **Business Area**, **Type**, **Updated** and **Actions**. If you own no maps, the page opens on **All**.

## Row actions

Each row has icons. Hover over an icon to read its tip.

| Icon | What it does |
|---|---|
| Map name | Opens the map in the builder if you may change it, otherwise in the viewer |
| Eye | Opens the viewer, where you run the map and see the rows |
| Pencil | Opens the map builder. Only for your own maps and maps shared with you at **Can edit** |
| Copy | Makes your own private copy and opens it. You become its owner |
| Share | Opens the **Share map** dialog. Only for maps you own |
| Calendar | Opens **Schedules** with this map chosen. Only for maps you own or that are shared at **Can export** or **Can edit** |
| Download | Opens the viewer, where you export |
| Trash | Deletes the map. Only for your own maps |

> **Note:** The calendar and download icons for shared maps appear on the **Shared with me** tab. On the **All** tab, open the map in the viewer instead.

> **Warning:** Only an administrator can bring back a deleted map. **Delete map?** asks you to confirm with **Delete**.

## Workbooks

Above the table, a **Workbooks** section appears when some of your maps belong to a workbook.

| Control | What it does |
|---|---|
| **Search workbooks or worksheets...** | Filters by workbook or worksheet name |
| Workbook row | Click to open the list of its worksheets. Click a worksheet to open the viewer |
| Pencil on a worksheet | Edit. Only for worksheets you created |
| Copy | **Copy workbook**: makes a new workbook with a private copy of each worksheet |
| Trash | **Delete workbook**: deletes the workbook and all its worksheets. Only if you own every worksheet |

The **Share workbook** button is not for your role. Share each map you own with its own **Share** icon.

![The Copy workbook dialog with the name field for the new workbook.](shots/en/user/02-workbook-copy-dialog.png)

Example: to copy the demo map, find **GD_M.M10_V01.DIS**, click the Copy icon and confirm. Your copy opens in the builder, and you can change it freely. The original stays as it was.

## Copy a map

1. Find the map in the list.
2. Click the Copy icon.
3. The copy opens in the builder with the message "Map copied. You are now editing your copy."
4. Change what you need and click **Save**.

Running the copy still needs access to the data. Copying does not give you that.

## Share a map you own

1. Click the Share icon on your map.
2. Search a person by name or email.
3. Click a level next to their name. The dark button is the level they have now.
4. To remove access, click the **✕** next to their name.

![The Share map dialog with a matching person and Can view, Can export and Can edit buttons.](shots/en/user/29-share-dialog-search.png)

| Option | What it means / when to pick it |
|---|---|
| **Can view** | The person can open and run the map. They cannot export, schedule or change it |
| **Can export** | As above, and they can export the result and put the map on a schedule |
| **Can edit** | All of the above, and they can also change the map. They still cannot share or delete it |
| **✕** | Removes their access |

If the map is public, the dialog says "This map is public — anyone with the link can view it." and shows **Copy link**. Use it to send the address to a colleague.

---

# The map viewer

The viewer opens when you click a map name (for a map you cannot edit) or the eye icon. You use it to run a map and read its results.

![The map viewer after a completed run, with the results grid and export buttons.](shots/en/user/25-viewer-results.png)

| Button or control | What it does |
|---|---|
| **Back** | Returns to the page you came from |
| **Run** | Runs the map. If the map asks for values (parameters), a dialog opens first |
| **Run again** | Runs the map again with the same values and skips the saved result. It appears after a run has finished |
| **Cancel** | Stops a run that is still waiting in the queue. It is not offered once the run has started |
| **Schedule management** | Opens the **Schedules** page |

While a run is going, a line under the buttons shows **Queued** or **Running…**. When it is done, it shows the time and how long the result stays valid (24 hours). If you ran the same map with the same values recently, you may see "Showing a cached result". Use **Run again** to get fresh data.

If a map has no columns, the viewer tells you that there is nothing to run.

## Run parameters

Some maps ask you for values, such as a date or a region. The **Run parameters** dialog shows one input per parameter. A red * means the value is required. For some values the dialog suggests the real values from the data. Click **Run** to start, or **Cancel** to close.

![The Run parameters dialog with both required values filled in.](shots/en/user/24-viewer-params-filled.png)

## Read the results

| Item | What it means |
|---|---|
| **Results** header with row and ms badges | How many rows came back and how long it took |
| **More rows available** | The result was cut. Only part of the rows was returned |
| Column header (click) | Sorts by that column: ascending, descending, none |
| **Filter…** box under a header | Filters the rows you have loaded |
| **Group** badge, **Total for …**, **Grand total** | The map groups rows and shows subtotals. Sorting or filtering pauses them |
| Double-click a row | **Drill to Detail**: shows the raw rows behind that row |
| **Load more** | Loads the next 500 rows |
| Coloured cells | Rules the map owner set (conditional formatting) |

A crosstab map shows a pivot table when a column is placed **Across the top**.

## Export the results

Under the results, use these buttons. They appear once a run has finished.

| Button | What it does |
|---|---|
| **Excel** | Downloads an Excel file |
| **CSV** | Downloads a CSV file |
| **PDF** | Opens **Export to PDF**, where you choose the paper and the columns |

![The PDF export dialog with orientation, page size, title and font options.](shots/en/user/17-builder-pdf-dialog.png)

| Option in **Export to PDF** | What it means / when to pick it |
|---|---|
| **Paper size**: A4, A3, Letter | A4 is the default. Pick A3 for wide tables, Letter for US paper |
| **Orientation**: Portrait, Landscape | Landscape fits more columns |
| **Columns** | Tick the columns to print. **Select all** and **Clear** switch them all |

Click **Export**. The file is made in the background. Find it later on the **Exports** page.

> **Note:** The export buttons show for every map. If your access to the map is **Can view** only, the export fails with "Forbidden". Ask the owner for **Can export**.

Example: open **GD_M.M10_V01.DIS**, click **Run**, then **Excel**.

---

# Building and editing maps

You can build a new map only in a business area where your administrator gave you the **create** right. You can change an existing map if you own it or it is shared with you at **Can edit**. The builder opens from **Create Map**, from the pencil icon, or from **Recent Maps**.

![The map builder with the Business Areas tree, the columns canvas and the Properties panel.](shots/en/user/05-builder-overview.png)

The builder has a toolbar on top, a **Business Areas** tree on the left, the **Columns** area in the middle, and a settings panel with five tabs on the right. You can drag the edges to resize the panels.

> **Warning:** The builder never saves by itself. Click **Save**. If you leave the page, unsaved changes are lost.

## Toolbar

| Button or control | What it does |
|---|---|
| **Back** | Returns to the previous page |
| Map name box | The name of the map |
| Map type list | **Table**, **Crosstab**, **Page-Detail** or **Chart**. Only **Crosstab** changes how results look. The other three show a plain table |
| **● Unsaved** | Shows that you have changes that are not saved |
| **Run** | Saves the map if it is new or changed, then runs it |
| **Save** | Saves the map. Needs at least one column. If nothing changed, it shows **No changes to save** |
| **Export** | Menu with **Map definition (.xml)**, which downloads the map design, not the data. Data export is under the results |
| **Schedule** | Opens **Schedules** with this map chosen. Needs a saved map |
| **Formatting** | Opens **Conditional formatting**. Needs a saved map |
| **Share** | Opens **Share map**. Needs a saved map. Only the owner can change shares |
| **Collapse panel** / **Expand panel** | Hides or shows the right panel |

## Add columns

1. In the **Business Areas** tree on the left, open a business area, then a folder. A folder holds items (a folder is like a table).
2. Drag an item onto the **Columns** area, or click the **+** next to it. A sigma icon marks a measure (a number you add up). A tag icon marks a dimension (a label).
3. All columns of one map must come from the same business area. The first column you add sets it. You cannot pick the area yourself.
4. Use the **Filter items…** box to find an item by name.
5. Drag the grip on a column to reorder. Click **X** to remove it. Click the column chip to configure it.

If you see "No business areas.", you have no access to any business area yet. Ask your administrator.

> **Note:** The tree shows every business area you have any right on. You can build a map with only viewing rights, but **Save** for a new map fails without the create right.

## Configure a column

Click a column chip. Changes apply to the draft. Click **Save** in the dialog, then **Save** on the map.

| Field | What it does |
|---|---|
| **Display name** | Heading of the column. Empty means the item name |
| **Aggregation** | **NONE**, **SUM**, **COUNT**, **AVG**, **MIN** or **MAX** |
| **Sort direction** | **None**, **Ascending**, **Descending** |
| **Format mask** and **Presets** | A number or date format. Presets: **Number (1,234)**, **Decimal (1,234.00)**, **Currency ($1,234.00)**, **Percent (12.3%)**, **Date (DD-MON-YYYY)**, **Date (YYYY-MM-DD)** |
| **Sort order** | Position of this column when you sort by several |
| **Column width (px)** | Width of the column |
| **Placement** | **None**, **Group by (axis)**, **Measure** or **Page item** |
| **Crosstab edge** | **Down the side** or **Across the top**. Only for crosstabs |
| **Group and break** | Hides repeated values and adds a subtotal each time the value changes |
| **Query only, do not show** | The column is used for filters and totals but is not shown |

![The Configure column dialog with the Aggregation list open.](shots/en/user/08-builder-column-aggregation.png)

## Right panel tabs

| Tab | What it is for |
|---|---|
| **Properties** | **Description** (printed above results and exports), **Insert variable** (**Run date**, **Run time**, **Workbook name**, **Worksheet name**, or a parameter) and the **Public** box |
| **Conditions** | Filters. **Add Condition**, choose the item, the operator (`=`, `<>`, `<`, `>`, `<=`, `>=`, `LIKE`, `IN`, `BETWEEN`, `IS NULL`) and the value. Choose **Static value** or **Prompt at runtime**. Select two or more rows and click **Group** to join them with OR. Use **Ungroup** to undo |
| **Sort** | **Add Sort**: choose a column and a direction. Drag to change the order |
| **Parameters** | Values people are asked at run time. Each has a name, a type (**STRING**, **NUMBER**, **DATE**, **LIST**), a default and a **Required** box. If every parameter has a default, the prompt is skipped |
| **Calculated Fields** | A new column from a formula. Click **Add Calculated Field**, name it, then click the formula to open the **Formula editor** |

![The Conditions tab listing the map's conditions with operator and value or prompt controls.](shots/en/user/09-builder-conditions.png)

> **Warning:** The **Public** box makes the map visible and exportable to every user of the application, not only to one business area. Data access rules still apply to the data. Use it with care.

The **Formula editor** has function buttons (for example **ROUND**, **UPPER**, **TO_CHAR**, **NVL**, **CASE**) and your columns. **Test formula** runs it on the first 5 rows. It needs a saved map.

## Conditional formatting

Click **Formatting** to colour cells or rows that meet a rule. Rules are saved at once. They are not part of the map's **Save**. You can add or delete rules only on maps you own or can edit.

| Field | What it means |
|---|---|
| **Column** | The column to test |
| **Apply to** | **Cell** or **Row** |
| **Operator** | **Equals**, **Not equals**, **Greater than**, **Less than**, **Greater than or equal to**, **Less than or equal to**, **Like (% and _ wildcards)**, **In list**, **Between**, **Is empty** |
| **Value** | What to compare with. Use `low,high` for **Between** |
| **Background color**, **Text color** | Colours. **Clear** removes one |
| **Bold**, **Italic**, **Underline** | Text style |

![The Formatting dialog with the rules list and the Add rule controls.](shots/en/user/19-builder-formatting-dialog.png)

## Run from the builder and refused runs

**Run** opens a **Results** panel at the bottom. It works like the viewer. If you have only viewing rights on a map, do not edit it first: the automatic save would be refused.

Sometimes the planner declines a map. An amber box explains why and what to change. Typical causes are folders that are not connected, or totals from two sets of detail rows. Remove the column that causes it, or ask your administrator to define the missing join. A red banner **Not entitled to run** means you have no access to the data of one of the folders.

## Example: build a small map

1. Click **Create Map** on the **Maps** page.
2. Open a business area and drag two items into **Columns**.
3. Type a name in the map name box.
4. Click **Save**. The map now has its own address.
5. Click **Run**.
6. Click **Share** if a colleague should see it.

---

# Runs

The **Runs** page lists every map run you started, waiting, running or finished. You use it to find a result again, or to run it again.

![The Runs page with filters and the table of runs and their export buttons.](shots/en/user/41-runs.png)

| Control | What it does |
|---|---|
| **Map** filter | Shows one map. **All maps** shows all |
| **Status** filter | **All statuses**, **Queued**, **Running**, **Completed**, **Failed**, **Cancelled** |
| **Kind** filter | **All kinds**, **Live** (you ran it) or **Scheduled** |
| Map name | Opens the viewer |
| **Open** icon | Opens the stored result |
| **Run again** icon | Starts a run with the same values. It says **Result reused** if a valid result already exists |
| **XLSX**, **CSV**, **PDF** | Downloads the run's result. Only for finished, valid results, and only if your access allows export |
| **Cancel** icon | Cancels a run that is queued. Not offered for a running run |
| **Delete** icon | Deletes a finished, failed or cancelled run and its rows. It cannot be undone |

The table shows **Map**, **Kind**, **Parameters**, **Status**, **Rows**, **Duration**, **Ran at**, **Expires in** and **Actions**. **Expires in** tells you how long the stored result stays: 24 hours for a live run, longer for scheduled runs. When it says **Expired**, run the map again.

You see only your own runs. The page refreshes by itself while a run is going.

---

# Exports

The **Exports** page lists the files you asked for. You use it to download a file again.

![The Exports page listing export jobs with a Download button on finished ones.](shots/en/user/44-exports.png)

| Control | What it does |
|---|---|
| Table | **Map**, **Format** (XLSX, CSV, PDF), **Status** (**Queued**, **Running**, **Completed**, **Failed**), **Rows**, **Created**. Hover over **Failed** to read why |
| **Download** icon | Downloads a completed file |

> **Note:** Files are kept for 7 days, not for ever. If a download fails, make the export again from the viewer. Download also fails if your export access to the map was removed.

You cannot create exports here. Create them in the viewer, on **Runs** or in a schedule's history.

---

# Schedules

The **Schedules** page runs a map by itself at set times and stores the results. You use it for reports you need every day, week or month.

You can schedule a map that you own, or that is shared with you at **Can export** or **Can edit**. A public map or a **Can view** share cannot be scheduled. A schedule runs as you, with your data access.

![The Schedules page with a paused schedule and its action icons.](shots/en/user/38-schedules-list.png)

| Control | What it does |
|---|---|
| **New Schedule** | Opens the dialog to create one |
| Table | **Name**, **Map**, **Schedule**, **Next Run**, **Format**, **Status** (**Active** or **Paused**), **Planner** |
| Play icon (**Run now**) | Starts one run at once. Disabled while paused |
| **Pause** / **Enable** icon | Stops or restarts the schedule |
| **History** icon | Shows the last 50 runs |
| **Edit** icon | Opens **Edit Schedule**. The map cannot be changed |
| **Delete** icon | Deletes the schedule and its history. It cannot be undone |

The **Planner** column is filled in for schedules migrated from Oracle Discoverer. It says whether the migrated schedule could be planned. You cannot change it. **Not checked** means nothing was recorded.

## New Schedule

1. Click **New Schedule**. You can also click the calendar icon on **Maps**, and the map is already chosen.
2. Choose the **Map**. The list shows your maps and maps shared with you, marked "(shared)". A map shared with you at **Can view** is not in the list, because that level does not allow a schedule.
3. Type a **Name**.
4. Choose a **Frequency**, its **Time** and day, a **Timezone** and an **Output Format**.
5. Fill in the **Parameter presets** if the map has parameters: a **Fixed value**, or **Relative to the run date**.
6. Keep **Enabled** ticked and click **Save**.

![The New Schedule dialog filled in, with a monthly frequency and Enabled unticked.](shots/en/user/37-schedule-filled.png)

| Field | What it means / when to pick it |
|---|---|
| **Frequency** | How often it runs. See the next table |
| **Time** | The hour and minute of the run. Shown for every frequency except **Custom (cron)**. |
| **Day of the week** | Shown for **Weekly**. |
| **Day of the month** | 1 to 28, or **Last day**. Days 29 to 31 are not offered, so no short month is skipped. Shown for **Monthly**, the longer frequencies and **Yearly**. |
| **Month** | Shown for **Yearly**. |
| **Timezone** | The clock used by the schedule. Your computer's timezone is the default |
| **Valid from (optional)**, **Valid until (optional)** | The schedule does not run before or after these times |
| **Output Format**: **Excel (.xlsx)** or **CSV** | The file type of the stored result. CSV is the default |
| **Parameter presets** | The values used for every run, fixed or relative to the run date. Required ones are marked * |
| **Enabled** | If unticked, the schedule waits until you enable it |

| Option (**Frequency**) | What it means |
|---|---|
| **Daily** | Every day at the **Time** you choose. |
| **Weekly** | Once a week, on the **Day of the week** you choose. |
| **Fortnightly (1st and 16th)** | On the 1st and the 16th of each month. |
| **Monthly** | Once a month, on the **Day of the month** you choose. |
| **Every 2 months** | In January, March, May, July, September and November. |
| **Quarterly** | In January, April, July and October. |
| **Every 4 months** | In January, May and September. |
| **Every 6 months (semester)** | In January and July. |
| **Yearly** | Once a year, on the **Month** and **Day of the month** you choose. |
| **Custom (cron)** | You write a **Cron expression**: five fields, minute, hour, day of month, month, day of week. Example: `0 9 * * 1-5` is 09:00 on weekdays. |

## Parameters that follow the run date

Each parameter in **Parameter presets** has a choice: **Fixed value** or **Relative to the run date**. A fixed value is the same on every run. A relative value changes with the date the schedule runs, so a monthly report always covers the right month.

A relative value has three parts:

1. **Move the run date by** a number. Use -1 for the period before, 0 for the current one.
2. The period: **days**, **weeks**, **fortnights**, **months**, **quarters**, **semesters** or **years**.
3. **then use the**: **that date**, the first or last day of that week, fortnight, month, quarter, semester or year, **its year (number)** or **its month (number 1-12)**.

![Parameter presets with one fixed value and one value relative to the run date.](shots/en/user/35-schedule-relative-date.png)

| You want | Start date | End date |
|---|---|---|
| Last month | -1 **months**, **first day of that month** | -1 **months**, **last day of that month** |
| The year so far, up to last month | -1 **months**, **first day of that year** | -1 **months**, **last day of that month** |
| A fixed start, a moving end | **Fixed value**, for example 2026-01-01 | -1 **months**, **last day of that month** |
| Last quarter | -1 **quarters**, **first day of that quarter** | -1 **quarters**, **last day of that quarter** |
| Yesterday | -1 **days**, **that date** | -1 **days**, **that date** |

For a parameter that asks for a year or a month as a number, use **its year (number)** or **its month (number 1-12)**. A week starts on Monday. A fortnight is the 1st to the 15th, or the 16th to the end of the month.

> **Tip:** -1 **months**, **first day of that year** still gives the whole of last year when the schedule runs in January. A **Fixed value** does not move: a fixed 2026-01-01 still starts in 2026 when the schedule runs in 2027.

The **Next Run** column shows the date of the next run and, under it, the values that run will use. Check it after you save.

You can give one map more than one schedule, each with its own frequency and values. Example: one monthly schedule for last month, and one yearly schedule for last year.

## History

**History** shows **Executed**, **Status** (**SUCCESS**, **FAILED**, **TIMEOUT**), **Rows** and **Duration**. For each result, **Open** shows it, and **XLSX**, **CSV** and **PDF** create a file (if your access allows export). **Expires** says how long the result stays, 30 days by default.

Results stay on the server. Nothing is sent by email.

---

# Settings

**Settings** changes how the application looks for you. Open it from the sidebar or from your name in the top-right corner. The settings belong to your account and follow you to other computers.

![The Settings page with the Language, Theme and Color palette cards.](shots/en/common/04-settings.png)

| Control | What it does |
|---|---|
| **Display language** | **English**, **Português (Portugal)**, **Français (France)**, **Español (España)** |
| **Appearance** | **Light**, **Dark**, **High contrast** |
| **Palette** | **Classic**, **Navy**, **Forest**, **Wine**, **Ocean**, **Ochre**. Not available with **High contrast** |
| **Save** | Keeps your choices on your account |

Your choices show at once. They are only kept on every device after you click **Save**.

---

# Common questions

**I cannot see a map that a colleague sees.** Maps are visible if you own them, if they are public, or if they were shared with you. Being in the same business area is not enough. Ask the owner to share it. A manager or administrator sees every map, so your colleague may have another role.

**I opened a map and the run says "Not entitled to run".** You can see the map, but you have no access to the data of one of its folders. Ask your administrator for access to that business area.

**I clicked Excel and got "Export failed" or "Forbidden".** The map is shared with you at **Can view**. Ask the owner for **Can export**.

**I cannot save my new map.** Saving needs the create right in the map's business area. Ask your administrator.

**The Edit icon is missing.** You may change only your own maps and maps shared at **Can edit**. Copy the map, then edit your copy.

**My monthly schedule always shows the same dates.** Its date parameters have a **Fixed value**. Edit the schedule and set them to **Relative to the run date**.

**I cannot schedule a map.** You need to own it, or hold **Can export** or **Can edit**. Public maps cannot be scheduled.

**My result says Expired.** Live results stay 24 hours. Run the map again.

**I cannot find an old export.** Files are removed after 7 days. Export again.

**I forgot my password.** Ask your administrator to reset it.

**I do not see Business Areas, Users or Migration.** These pages are for other roles.

---

# Glossary

| Term | Meaning |
|---|---|
| Map | A report. In Oracle Discoverer this was a worksheet |
| Workbook | A group of maps |
| Business area | A group of related data. Your administrator gives you rights on it |
| Folder | A set of related items inside a business area, like a table |
| Item | One field. A dimension is a label, a measure is a number you add up |
| Run | One execution of a map that produces a result |
| Export | A file (Excel, CSV or PDF) made from a result |
| Schedule | A timetable that runs a map by itself and stores the result |
| Share | Giving another user access to a map you own: **Can view**, **Can export** or **Can edit** |
| Public map | A map any user can open, run and export. It cannot be scheduled by others |
| Parameter | A value the map asks for when you run it |
| Cron expression | Five fields that say when a schedule runs |
