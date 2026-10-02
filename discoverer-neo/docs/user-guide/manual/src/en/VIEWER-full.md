# Your role at a glance

Discoverer Neo replaces Oracle Discoverer. A **map** is a report (in Oracle Discoverer this was a worksheet). A **workbook** is a group of maps. A **business area** is a group of related data. You have the **VIEWER** role. Your main job is to open maps, run them and read the results.

| You can | You cannot |
|---|---|
| See your own maps, public maps and maps shared with you | See private maps that nobody shared with you |
| Run a map and read its results, sort, filter and drill down | Copy a map or a workbook |
| Export results, if the map is public or shared with you at **Can export** or **Can edit** | Export a map shared with you at **Can view** only |
| See your own runs and exports | See other people's runs or exports |
| Choose your language, theme and colours | Open the administration pages (they are not in your menu) |

The VIEWER role has one fixed limit: you cannot copy maps or workbooks. Everything else depends on what has been given to you for each map and each business area. See the next section.

## Where your access comes from

The role does not decide what you can run, export or schedule. These three things do.

- **The map.** You see a map if you created it, if its owner made it **Public**, or if someone shared it with you. A grant on a business area does **not** show you maps.
- **The share level.** Most maps reach you as a share. The level tells you what you may do.
- **Your business-area grants.** To read the data of a map, your administrator must have given you access to the business areas it uses. Without that, the run fails with "Not entitled to run".

| Situation | Open and run | Export | Schedule | Change the map |
|---|---|---|---|---|
| Shared with you: **Can view** | Yes | No | No | No |
| Shared with you: **Can export** | Yes | Yes | Yes | No |
| Shared with you: **Can edit** | Yes | Yes | Yes | Yes |
| Public map you do not own | Yes | Yes | No | No |

This guide covers what you do most: finding a map, running it and reading it. Exporting, scheduling and editing work only when the map is shared with you at the needed level. Those parts are short at the end of each chapter.

If a map you need is missing, ask its owner to share it with you.

## Sign in, change your password, sign out

1. Open the address your administrator gave you.
2. Type your **Email** and **Password**.
3. Leave **Remember me** ticked to stay signed in after you close the browser. Untick it on a shared computer.
4. Click **Sign in**.

![The sign-in page with Email, Password, Remember me and the Sign in button.](shots/en/common/01-login.png)

If your account was created with a temporary password, the **Change your password** page opens first. Fill in **Temporary password**, **New password** (at least 12 characters, different from the old one) and **Confirm new password**, then click **Change password**.

If you forget your password, ask your administrator to reset it. To sign out, click your name in the top-right corner, then **Log out**. This ends your session. To use Discoverer Neo again, sign in again.

---

# Dashboard

The **Dashboard** is the first page after sign-in. It is a summary. It is read-only.

![The Viewer dashboard with its short sidebar and summary cards.](shots/en/viewer/01-dashboard.png)

| Card | What it shows |
|---|---|
| **Total Maps** | The maps you can open, with how many are yours and how many are shared with you (public maps are counted there too) |
| **Total Executions** | Runs of the maps you can see, by anyone |
| **Scheduled Maps** and **Scheduled Results** | Your own schedules. These are usually zero for you |
| **Recent Maps** | Maps you created. Usually empty for you |

---

# Maps

The **Maps** page is your list of reports. Use it to find a map and open it.

![The Maps list, All tab, where each map has only the Open icon.](shots/en/viewer/03-maps-all.png)

| Control | What it does |
|---|---|
| **Mine**, **Shared with me**, **All** | Your own maps, maps shared with you, or everything you can see. If you own nothing, the page opens on **All** |
| **Search maps by name…** | Filters by name as you type |
| **Business Area** filter | Shows one business area. **All business areas** removes the filter |
| **Sort by** | **Recently updated** or **Name (A–Z)** |
| **Clear** | Removes the search and the filter |
| Map name or eye icon | Opens the map in the viewer |

The table shows **Name**, **Workbook**, **Owner**, **Business Area**, **Type**, **Updated** and **Actions**.

You do not see a Copy icon, and there is no **Copy workbook** button. That is by design for your role.

Above the table, **Workbooks** lists the workbooks that contain your maps. Type in **Search workbooks or worksheets...**, click a workbook to open it, then click a worksheet to open the viewer.

![The Maps list, Shared with me tab, with the Workbooks card and only the Open icon.](shots/en/viewer/02-maps-shared.png)

> **Note:** Some icons on a row (for example the pencil, the calendar or the trash) only work if you own the map or it was shared with you at a high enough level. If you click one and the server refuses, you see "Forbidden". Nothing is changed.

Example: to find the demo map, type **GD_M.M10_V01.DIS** in the search box and click its name.

---

# The map viewer

The viewer runs a map and shows its rows. You spend most of your time here.

![A completed run with Excel, CSV and PDF buttons over the results grid.](shots/en/viewer/06-viewer-results.png)

| Button or control | What it does |
|---|---|
| **Back** | Returns to the previous page |
| **Run** | Runs the map. If the map asks for values, a dialog opens first |
| **Run again** | Runs again with the same values and skips the saved result. It appears after a run has finished |
| **Cancel** | Stops a run that is still waiting in the queue |

Under the buttons, a status line shows **Queued**, **Running…** or the time of the result and how long it stays valid (24 hours). "Showing a cached result" means you ran this map with the same values recently. Click **Run again** to get fresh data.

## Run parameters

Some maps ask for values, such as a date. In **Run parameters**, fill in each input (a red * means required) and click **Run**. **Cancel** closes the dialog.

![The Run parameters dialog with both required values filled in.](shots/en/viewer/05-viewer-params-filled.png)

## Read the results

| Item | What it means |
|---|---|
| **Results**, row and ms badges | How many rows came back and how long it took |
| **More rows available** | The result was cut. Only part of the rows was returned |
| Column header (click) | Sorts by that column: ascending, descending, none |
| **Filter…** box under a header | Filters the rows you have loaded |
| **Group** badge, **Total for …**, **Grand total** | Rows are grouped and subtotalled. Sorting or filtering pauses them |
| Double-click a row | **Drill to Detail**: shows the raw rows behind that row |
| **Load more** | Loads the next 500 rows |
| Coloured cells | Rules the owner set to highlight values |

A crosstab map shows a pivot table.

## When a run does not work

| What you see | What it means |
|---|---|
| **Not entitled to run** (red) | You may see the map but you have no access to its data. Ask your administrator |
| **Request declined** or **Worksheet not run** (amber) | The map is built in a way that cannot be run safely. The box says why. Tell the map's owner |
| **Query timed out** | The query took too long. Try again later or tell the owner |
| **Map not found** | The map was deleted or is not shared with you any more |

## Export (only if your access allows)

The **Excel**, **CSV** and **PDF** buttons appear under the results after a run. They work for public maps and for maps shared with you at **Can export** or **Can edit**.

| Button | What it does |
|---|---|
| **Excel** | Downloads an Excel file |
| **CSV** | Downloads a CSV file |
| **PDF** | Opens **Export to PDF**: choose **Paper size** (A4, A3, Letter), **Orientation** (Portrait, Landscape) and the columns, then **Export** |

![The PDF export dialog with orientation, page size, title and font options.](shots/en/user/17-builder-pdf-dialog.png)

> **Note:** If the map is shared with you at **Can view** only, the buttons are still on the screen, but the export fails with "Forbidden". Ask the owner for **Can export**.

---

# Runs

The **Runs** page lists every map run you started. Use it to find a result again without running the map a second time.

![The Runs page listing the Viewer's own runs.](shots/en/viewer/07-runs.png)

| Control | What it does |
|---|---|
| **Map**, **Status** and **Kind** filters | Narrow the list. Kind is **Live** (you ran it) or **Scheduled** |
| **Open** icon | Opens the stored result |
| **Run again** icon | Starts a run with the same values |
| **XLSX**, **CSV**, **PDF** | Downloads a result, if your access allows export |
| **Cancel** icon | Cancels a run that is still queued |
| **Delete** icon | Deletes a finished run for good |

The table shows **Map**, **Kind**, **Parameters**, **Status**, **Rows**, **Duration**, **Ran at**, **Expires in** and **Actions**. A live result stays 24 hours. When **Expires in** says **Expired**, run the map again. You see only your own runs.

---

# Exports

The **Exports** page lists the files you asked for.

![The Exports page listing export jobs with a Download button on finished ones.](shots/en/user/44-exports.png)

The table shows **Map**, **Format**, **Status** (**Queued**, **Running**, **Completed**, **Failed**), **Rows** and **Created**. Click the **Download** icon on a completed row. Files are kept for 7 days. If the download fails, export again from the viewer. If you never export, this page stays empty.

---

# Schedules

The **Schedules** page lists timetables that run a map by itself. It is yours only if you own a map or have **Can export** or **Can edit** on it. With **Can view** or a public map you cannot schedule. Those maps are not in the **Map** list of **New Schedule**.

![The Schedules page with the message No schedules yet.](shots/en/viewer/09-schedules.png)

If you do have the right level:

1. Click **New Schedule**, or the calendar icon on **Maps**.
2. Choose the **Map** and type a **Name**.
3. Choose **Frequency** (**Daily**, **Weekly**, **Fortnightly**, **Monthly**, every 2, 3, 4 or 6 months, **Yearly**, or **Custom (cron)**), its **Time** and day, **Timezone** and **Output Format** (**Excel (.xlsx)** or **CSV**). A parameter can have a **Fixed value**, or be **Relative to the run date**, for example -1 **months**, **last day of that month**.
4. Click **Save**.

Use the icons on each row to **Run now**, **Pause** or **Enable**, see **History**, **Edit** or **Delete**. Results stay on the server. Nothing is sent by email.

---

# Settings

**Settings** changes how the application looks for you. Open it from the sidebar or from your name.

![The Settings page with the Language, Theme and Color palette cards.](shots/en/common/04-settings.png)

| Control | What it does |
|---|---|
| **Display language** | **English**, **Português (Portugal)**, **Français (France)**, **Español (España)** |
| **Appearance** | **Light**, **Dark**, **High contrast** |
| **Palette** | **Classic**, **Navy**, **Forest**, **Wine**, **Ocean**, **Ochre**. Not available with **High contrast** |
| **Save** | Keeps your choices on your account |

Your choices show at once. Click **Save** to keep them on every device.

---

# Common questions

**I cannot see a map that a colleague sees.** You see only your own, public and shared maps. Ask the owner to share it. Managers and administrators see every map.

**Why is there no Copy icon?** The VIEWER role cannot copy maps or workbooks. Ask the owner or your administrator.

**I get "Not entitled to run".** You have no access to the data of that map. Ask your administrator.

**Excel, CSV or PDF says "Forbidden".** The map is shared with you at **Can view** only. Ask the owner for **Can export**.

**The Edit or Schedule icon does nothing.** Those need **Can edit** or **Can export** on the map, or ownership.

**My result says Expired.** Live results stay 24 hours. Click **Run again**.

**I cannot find an old export.** Files are removed after 7 days.

**I forgot my password.** Ask your administrator to reset it.

---

# Glossary

| Term | Meaning |
|---|---|
| Map | A report. In Oracle Discoverer this was a worksheet |
| Workbook | A group of maps |
| Business area | A group of related data |
| Run | One execution of a map that produces a result |
| Export | A file (Excel, CSV or PDF) made from a result |
| Schedule | A timetable that runs a map by itself |
| Share | Access to a map given by its owner: **Can view**, **Can export** or **Can edit** |
| Public map | A map every user can open, run and export |
| Parameter | A value the map asks for when you run it |
