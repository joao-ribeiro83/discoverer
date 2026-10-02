# Your role at a glance

You are an **administrator**. You can use every page in Discoverer Neo. You set up the data that maps are built on, decide who can see what, look after user accounts, and bring in old Oracle Discoverer work.

A **map** is a report (in Oracle Discoverer this was a worksheet). A **workbook** is a group of maps. A **business area** is a group of related data. A **folder** is one table or view inside a business area. An **item** is one column of a folder.

## You can / You cannot

| You can | You cannot |
|---|---|
| Open, run, change, share, copy and delete every map | Delete or deactivate your own account |
| Build maps in any business area, without a grant | Download another user's export (exports are always private to their owner) |
| See the generated SQL and the database plan of a map | See another user's schedules in the **Schedules** list (you see your own) |
| See every user's runs (**Show every user's runs**) | |
| Create, edit and deactivate business areas, folders, items, joins, hierarchies, custom functions and data sources | |
| Give and remove business-area grants | |
| Create, edit, deactivate, delete and re-activate users | |
| Issue a credentials file with temporary passwords | |
| Move a map to a new owner | |
| Write row-level security policies | |
| Read the audit log | |
| Migrate an Oracle Discoverer EUL | |

## Where your access comes from

Your access comes from your role. It does not depend on shares or grants.

- **Maps.** You see every active map, whoever owns it. You can change, share and delete any map.
- **Data.** You can read the data of every folder without a business-area grant. Each time you do, the system writes a note in the audit log.
- **Row-level security.** Row-level security policies still apply to you (see the chapter **Security Policies**).
- **Other people.** Ordinary users see only their own maps, public maps and maps shared with them. A business-area grant gives access to data. It never shows a map.

## How to sign in, change your password, and sign out

1. Open the Discoverer Neo address in your browser.
2. Type your **Email** and **Password**.
3. Leave **Remember me** ticked to stay signed in after you close the browser. Untick it on a shared computer. The session then ends when you close the browser.
4. Click **Sign in**.

![The sign-in page with Email, Password, Remember me and the Sign in button.](shots/en/common/01-login.png)

After five wrong passwords the account is locked for 15 minutes. The message is **Too many login attempts. Try again later.** If your password is lost, another administrator must set a new one for you. There is no "forgot password" link.

The **Change your password** page opens on its own when your account has a temporary password. Type the current password, then the new password twice. The new password must have at least 12 characters and must differ from the old one. (The password an administrator sets for someone in **Users** needs only 8 characters.)

To sign out, click your name at the top right and choose **Log out**. This ends your session. To use Discoverer Neo again, sign in again.

![The account menu open, with Settings and Log out.](shots/en/common/03-user-menu.png)

## The sidebar

| Section | Pages |
|---|---|
| **Overview** | **Dashboard** |
| **Data Modeling** | **Business Areas**, **Folders**, **Items**, **Joins**, **Hierarchies**, **Custom Functions**, **Data Sources**, **Users**, **Security**, **Audit Log** |
| **Maps** | **Maps** |
| **Other** | **Schedules**, **Runs**, **Exports**, **Migration** |

**Settings** is at the bottom of the sidebar. On a narrow screen the sidebar hides behind the menu button at the top left (**Toggle menu**).

![The full Administrator sidebar, including Data Modeling and Migration.](shots/en/admin/01-dashboard-sidebar.png)

---

# Settings

**Settings** holds your own choices. They follow your account to any browser. Open it from the sidebar or from your name menu.

![The Settings page with the Language, Theme and Color palette cards.](shots/en/common/04-settings.png)

| Button or control | What it does |
|---|---|
| **Display language** | Changes the language of the screens straight away in this browser. |
| **Appearance** | Changes the theme straight away in this browser. |
| **Palette** | Changes the accent colours straight away in this browser. |
| **Save** | Keeps your choices on your account, so they apply on every device. |

**Display language**

| Option | What it means / when to pick it |
|---|---|
| English | English screens. |
| Português (Portugal) | Portuguese screens. This is the default before you sign in. |
| Français (France) | French screens. |
| Español (España) | Spanish screens. |

**Appearance**

| Option | What it means / when to pick it |
|---|---|
| **Light** | Light background. |
| **Dark** | Dark background. Easier in a dim room. |
| **High contrast** | Fixed, strong colours for easier reading. The **Palette** choices are switched off while this is selected. |

**Palette**

| Option | What it means / when to pick it |
|---|---|
| **Classic**, **Navy**, **Forest**, **Wine**, **Ocean**, **Ochre** | Six sets of accent colours. Pick the one you like. |

> **Warning:** A choice changes the screen at once, but it is kept on your account only when you click **Save**. If you leave without saving, the next sign-in brings back the old values.

---

# Dashboard

The **Dashboard** is the page you see after you sign in. It gives you a quick count of the work in the system. You cannot change anything here.

![The Administrator dashboard with summary cards and the Recent Maps list.](shots/en/admin/01-dashboard-sidebar.png)

| Card | What it shows |
|---|---|
| **Total Maps** | All active maps in the system. Under it: how many are yours and how many belong to other people ("N yours, M shared with you"). For you, "shared with you" means every other person's map, private ones included. |
| **Total Executions** | All runs of all maps, by anyone. |
| **Scheduled Maps** | How many maps have at least one active schedule that you created. |
| **Scheduled Results** | How many stored results your schedules have produced. |
| **Recent Maps** | The last 5 maps that you created and changed. Click one to open it in the builder. |

The link **View schedules** on two cards opens the **Schedules** page.

---

# Maps

**Maps** is the list of every map in the system. Use it to find a map, run it, change it, share it, copy it, hand it to someone else or delete it.

![The Maps list, All tab, with every row icon and the Workbooks section above.](shots/en/admin/02-maps-all.png)

## The list

| Button or control | What it does |
|---|---|
| **Create Map** | Opens the map builder with an empty map. |
| **Mine**, **Shared with me**, **All** tabs | **Mine** shows maps you created. **Shared with me** shows maps other people shared with you. **All** shows every map in the system. The page opens on **All** if you own no map. |
| **Search maps by name…** | Filters the list by name. |
| **Business Area** filter | Shows only maps of one business area. |
| **Sort by** | **Recently updated** or **Name (A–Z)**. |
| **Clear** | Removes the search and the business-area filter. It shows only while a filter is on. |
| Map name | Opens the map in the builder. |
| Eye icon | Opens the map in the viewer, where you run it and read the rows. |
| Pencil icon | Opens the map in the builder to change columns, conditions and layout. |
| Copy icon | Makes your own copy of the map and opens it for editing. |
| Share icon | Opens the **Share map** dialog. |
| Calendar icon | Opens **Schedules** with this map already chosen. |
| Download icon | Opens the viewer, where you export to Excel, CSV or PDF. |
| Trash icon | Deletes the map after you confirm. |

The columns are **Name**, **Workbook**, **Owner**, **Business Area**, **Type** and **Updated**.

Deleting a map takes it out of every list. Only an administrator can bring it back. Its runs and schedules stay linked to it.

> **Warning:** As an administrator you can delete any map. Check the **Owner** column first.

## Workbooks

The **Workbooks** section shows at the top when at least one map belongs to a workbook. Click a workbook to see its maps. Use **Search workbooks or worksheets...** to find one.

| Button or control | What it does |
|---|---|
| Pencil icon on a map row | Opens that map in the builder. |
| Copy icon | Opens **Copy** dialog. It makes a new workbook with a private copy of every map. The original does not change. Type the **Name of the new workbook** and click **Copy**. |
| Share icon | Opens the workbook share dialog. It gives a person access to every map in the workbook at once. |
| Trash icon | Deletes the workbook and all its maps after you confirm. Only an administrator can bring them back. |

## Share a map

Sharing decides who else may open a map and what they may do with it.

![The Share map dialog with a search box and Can view, Can export and Can edit buttons.](shots/en/manager/03-share-dialog.png)

1. Click the Share icon on the map row.
2. Type in **Search by name or email…** to find the person.
3. Click a level next to the person. The dark level is what the person has now.
4. To remove access, click the **✕** next to the person.

| Option | What it means / when to pick it |
|---|---|
| **Can view** | The person can open and run the map. They cannot export, schedule or change it. |
| **Can export** | The person can open and run the map, export the result, and put it on a schedule. |
| **Can edit** | The person can do all of the above and also change the map. They cannot share it again. |

If the map is public, the dialog shows **This map is public — anyone with the link can view it.** and a **Copy link** button. A public map can be opened and exported by every signed-in user. You turn a map public in the builder (see the chapter **Map builder**).

A person also needs a business-area grant on the data of the map. Without it, the person can open the map but the run stops with **Not entitled to run**.

## Share a whole workbook

In the workbook share dialog, the levels are the same: **Can view**, **Can export**, **Can edit**. One click shares every map in the workbook. The list shows "n of m worksheets" for each person. Click **✕** to remove access.

## Copy a map

Click the Copy icon. You get a private copy that you own. You can then change it. The original stays as it is.

## Example: give a colleague read access

Example: share **GD_M.M10_V01.DIS** with a colleague who must only read it.

1. In **Maps**, find **GD_M.M10_V01.DIS**.
2. Click the Share icon.
3. Search for your colleague's name.
4. Click **Can view**.
5. Check that the colleague has a grant on the business area of the map (see **Business Areas**). Without it the run is refused.

---

# Map builder

The builder is where you make and change a map. Open it with **Create Map**, or with the pencil icon or the map name in the list. As administrator you can change every map.

![The map builder with the Business Areas tree, the columns canvas and the Properties panel.](shots/en/user/05-builder-overview.png)

## The screen

- **Left:** the **Business Areas** tree. Open a business area, then a folder, then drag an item out.
- **Middle:** the **Columns** canvas. It holds the columns of the map. The results appear below it after a run.
- **Right:** five tabs: **Properties**, **Conditions**, **Sort**, **Parameters**, **Calculated Fields**.

You can drag the bars between the zones to change their width. **Collapse panel** hides the right side.

## The toolbar

| Button or control | What it does |
|---|---|
| **Back** | Returns to the page you came from. The builder does not warn you about unsaved changes. |
| Map name box | The name of the map. |
| Map type list | **Table**, **Crosstab**, **Page-Detail** or **Chart**. Only **Crosstab** changes how the result looks (see below). |
| **● Unsaved** | Shows that the map has changes you have not saved. |
| **Run** | Saves the map if it is new or changed, then runs it. |
| **Save** | Saves the map. There is no automatic save. If nothing changed, it shows **No changes to save**. |
| **Export** > **Map definition (.xml)** | Downloads the definition of the map as an XML file. This holds no data rows. It works only after the map is saved. |
| **Schedule** | Opens **Schedules** with this map chosen. Works after the map is saved. |
| **Formatting** | Opens the conditional formatting dialog. Works after the map is saved. |
| **Share** | Opens the **Share map** dialog. Works after the map is saved. |

| Option (map type) | What it means / when to pick it |
|---|---|
| **Table** | A plain grid of rows. The default. |
| **Crosstab** | A grid with values across the top and down the side. It needs at least one column set to **Across the top**. If none is set, the result shows as a table with a note. |
| **Page-Detail** | Stored with the map, but the result shows as a plain grid. |
| **Chart** | Stored with the map, but the result shows as a plain grid. |

## Build a map

1. Click **Create Map**.
2. In the **Business Areas** tree, open a business area and a folder.
3. Drag an item onto the canvas, or click the **+** next to it. Repeat for more columns.
4. Click **Save**.

The first column you add fixes the business area of the map. Every other column must come from the same business area. The system refuses a column from another area with **Different business area**. A column can be on the canvas only once. There is no business-area picker.

Example: build a small map in the business area **DC**. Drag a dimension (a tag icon) and a measure (a sigma icon) onto the canvas. Set the measure to **SUM**. Click **Run**.

Use **Filter items…** above the tree to find an item. Drag the grip on a column to change the order. Click **X** on a column to remove it.

While you build, the system checks the shape of the map. If it will be refused, an amber banner explains why before you click **Run** (see **Refusals**).

## Configure a column

Click a column on the canvas. The dialog **Configure column** opens. Nothing is kept until you click **Save** on the map.

| Button or control | What it does |
|---|---|
| **Display name** | The heading of the column. Blank uses the item name. |
| **Aggregation** | How the column is totalled. |
| **Sort direction** | Sorts the result by this column. |
| **Format mask** | How numbers and dates print. |
| **Presets** | Fills the **Format mask** from a list. |
| **Sort order** | The place of the column when you sort by several columns. |
| **Column width (px)** | The width of the column. It must be above zero. |
| **Placement** | The job of the column in the layout. |
| **Crosstab edge** | Where a column goes in a crosstab. |
| **Group and break** | Hides repeated values and starts a subtotal each time the column changes. |
| **Query only, do not show** | The query asks for the column, so a condition, a sort or a total can use it, but the result does not show it. |

| Option (**Aggregation**) | What it means / when to pick it |
|---|---|
| NONE | No total. Use for names and codes. |
| SUM | Adds the values. |
| COUNT | Counts the rows. |
| AVG | Average. |
| MIN | Smallest value. |
| MAX | Largest value. |

| Option (**Sort direction**) | What it means / when to pick it |
|---|---|
| **None** | Do not sort by this column. |
| **Ascending** | Smallest first, A to Z. |
| **Descending** | Largest first, Z to A. |

| Option (**Presets**) | What it means / when to pick it |
|---|---|
| **Number (1,234)** | Whole number with thousand marks. |
| **Decimal (1,234.00)** | Two decimals. |
| **Currency ($1,234.00)** | Money with the dollar sign. |
| **Percent (12.3%)** | Percentage. |
| **Date (DD-MON-YYYY)** | Date such as 31-DEC-2026. |
| **Date (YYYY-MM-DD)** | Date such as 2026-12-31. |

| Option (**Placement**) | What it means / when to pick it |
|---|---|
| **None** | No special job. |
| **Group by (axis)** | The column groups the rows. |
| **Measure** | The column holds the numbers. |
| **Page item** | The column splits the result into pages. |

| Option (**Crosstab edge**) | What it means / when to pick it |
|---|---|
| **None** | Not used in a crosstab. |
| **Down the side** | The values run down the left side. |
| **Across the top** | The values run across the top. |

![The Configure column dialog with the Aggregation list open.](shots/en/user/08-builder-column-aggregation.png)

## The Properties tab

| Button or control | What it does |
|---|---|
| **Description** | The heading printed above the results and at the top of every export. Text after `&` is a variable. |
| **Insert variable** | Puts a variable at the cursor. |
| **Public (visible to everyone in the business area)** | Makes the map public when you save. In fact every signed-in user can then open and export it. The data still needs a grant. |
| Counts | Read-only totals of columns, conditions, parameters and calculated fields. |

| Option (**Insert variable**) | What it means / when to pick it |
|---|---|
| Run date (`&Date`) | The date of the run. |
| Run time (`&Time`) | The time of the run. |
| Workbook name (`&Workbook`) | The workbook the map belongs to. |
| Worksheet name (`&Worksheet`) | The name of the map. |
| Parameters entered at run time | Each parameter of the map as `&Name`. |

## The Conditions tab

A condition keeps only the rows that match a test.

| Button or control | What it does |
|---|---|
| **Add Condition** | Adds a row. It needs at least one column on the canvas. |
| Row checkbox | Selects the row for grouping. |
| **Group n selected conditions** | Groups two or more selected rows into one OR block. |
| **Ungroup** | Removes the block. |
| **Logic operator** | Joins the row to the row before: **AND** or **OR**. |
| **Condition item** | The column to test. |
| **Operator** | The comparison. |
| **Static value** | A fixed value in the box. |
| **Prompt at runtime** | The value is asked when the map runs. You name a parameter. |
| Value box | The value. Use `value1, value2, …` for IN and `low, high` for BETWEEN. |
| **Parameter name** | The parameter that supplies the value. It must exist. |
| Trash | Removes the condition. |

| Option (**Operator**) | What it means / when to pick it |
|---|---|
| `=` | Equal to. |
| `<>` | Not equal to. |
| `<`, `>`, `<=`, `>=` | Less than, greater than, and with equal. |
| LIKE | Matches a pattern with `%` and `_`. |
| IN | Matches one of a list. |
| BETWEEN | Between a low and a high value. |
| IS NULL | The value is empty. No value box. |

## The Sort tab

| Button or control | What it does |
|---|---|
| **Choose a column** | Picks the column to add. |
| **Add Sort** | Adds the sort level. |
| Grip | Drag to change the priority. |
| Direction list | **Ascending** or **Descending**. |
| X | Removes the level. |

## The Parameters tab

A parameter is a question asked when the map runs.

| Button or control | What it does |
|---|---|
| **Add Parameter** | Adds a parameter named Parameter1, Parameter2 and so on. |
| Name box | The name. It must be unique. |
| Type list | The kind of value. |
| Default value | Used when nobody types a value. If every parameter has a default, the map runs without asking. |
| **Required** | The run refuses a blank value. |
| Trash | Removes the parameter. |
| **Run-time prompt preview** | Shows the prompt as people will see it. |

| Option (**Type**) | What it means / when to pick it |
|---|---|
| STRING | Text. |
| NUMBER | A number. |
| DATE | A date. |
| LIST | Several values, separated by commas. |

## The Calculated Fields tab

A calculated field is a new column made from a formula.

| Button or control | What it does |
|---|---|
| **Add Calculated Field** | Adds Calc1, Calc2 and so on. |
| Grip | Reorders the fields. |
| Name box | The name. Other formulas call it as `[Name]`. |
| Display order | The place of the column. |
| Formula button | Opens the **Formula editor**. |
| Trash | Removes the field. |

In the **Formula editor**, type the formula or click a function to insert it. Click a column name to insert `[Column]`. The editor warns about empty formulas, unbalanced quotes or brackets, and unknown functions or columns. **Test formula** runs the formula on the first 5 rows of live data. It works after the map is saved.

| Group of functions | What is in it |
|---|---|
| Arithmetic | ROUND, TRUNC, FLOOR, CEIL, ABS, MOD, POWER, SQRT, SIGN, GREATEST, LEAST |
| String | UPPER, LOWER, INITCAP, LENGTH, SUBSTR, TRIM, LTRIM, RTRIM, INSTR, REPLACE, CONCAT, LPAD, RPAD |
| Date | TO_CHAR, TO_DATE, ADD_MONTHS, MONTHS_BETWEEN, LAST_DAY |
| Conditional / null handling | NVL, NVL2, COALESCE, DECODE, TO_NUMBER, CASE |

## Conditional formatting

**Formatting** paints a cell or a whole row when a value meets a test. Rules are stored at once. They do not wait for **Save**.

| Button or control | What it does |
|---|---|
| **Add rule** | Opens the rule form. |
| **Column** | The column to test. |
| **Apply to** | **Cell** paints one cell. **Row** paints the whole row. |
| **Operator** | The test. |
| **Value** | The value to compare with. |
| **Background color**, **Text color** | The colours. **Clear** removes one. |
| **Bold**, **Italic**, **Underline** | Text style. |
| **Save** | Keeps the rule. |
| X on a rule | Deletes the rule. |

| Option (**Operator**) | What it means / when to pick it |
|---|---|
| **Equals**, **Not equals** | Same or different value. |
| **Greater than**, **Less than** | Above or below. |
| **Greater than or equal to**, **Less than or equal to** | Above or below, with equal. |
| **Like (% and _ wildcards)** | Pattern match. |
| **In list** | One of `value1,value2,…`. |
| **Between** | From `low,high`. |
| **Is empty** | No value. |

## Run a map and read the result

Click **Run**. If a parameter has no default, the **Run parameters** dialog opens first. Fill the values and click **Run**. Required blanks show **This parameter is required.**

The results panel shows the number of rows and the time. **More rows available** means the result was cut short. Click **Load more** to fetch the next 500 rows.

| Button or control | What it does |
|---|---|
| **SQL** | Shows or hides the SQL text that was sent to the database. Only you and other administrators see it. |
| **Plan** | Shows the database execution plan. Administrators only. |
| **Excel**, **CSV** | Exports the result. |
| **PDF** | Opens **Export to PDF**. |
| Column heading | Click to sort the loaded rows. |
| **Filter…** box | Filters the loaded rows. |
| Double-click a row | Opens **Drill to Detail**: the raw rows behind that row. |

**Export to PDF**

| Option | What it means / when to pick it |
|---|---|
| **Paper size**: **A4**, **A3**, **Letter** | The page size. A4 is the default. Use A3 for wide results. |
| **Orientation**: **Portrait**, **Landscape** | Tall or wide page. Use **Landscape** for many columns. |
| **Columns** list, **Select all** / **Clear** | The columns to print. All are ticked at first. **Export** needs at least one. |

![Run results with the SQL and Plan buttons beside the Excel, CSV and PDF buttons.](shots/en/admin/03-viewer-results.png)

Run results are kept for 24 hours. Running the same map again with the same values shows the stored result ("Showing a cached result"). Click **Run again** in the viewer for a fresh run.

## Refusals and errors

The system refuses some maps that would give wrong totals. It says why and what to change.

| Message | What to do |
|---|---|
| These folders are not connected | Remove columns of the unconnected folder, or define a join (see **Joins**). |
| A join has no join condition | Set the columns the join matches on. |
| A join is set both ways at once | Turn off one outer-join setting. |
| These totals are measured against different things | Total from one set of detail rows. |
| These folders are joined in a circle | Use one of the two detail folders. |
| Individual values from two sets of detail rows | Total instead, or list from one set. |
| Fans out from more than one folder | Split into two maps. |
| This kind of total cannot be worked out across a join | Use SUM, COUNT, MIN or MAX. |

A red **Not entitled to run** banner means a business-area grant is missing, or (in closed mode) a row-level security policy is missing. You bypass grants, but not row-level security.

---

# The map viewer

The viewer runs a map and shows the rows. It never changes the map. Open it with the Eye icon, or with a map name in **Runs**.

![The map viewer after a completed run, with the results grid and export buttons.](shots/en/user/25-viewer-results.png)

| Button or control | What it does |
|---|---|
| **Run** | Runs the map. It asks for parameters if any has no default. |
| **Run again** | Runs it again with the same values and ignores the stored result. Shows only after a completed run. |
| **Cancel** | Cancels a run that is still waiting in the queue. Shows only while the run is queued. |
| **Schedule management** | Opens **Schedules**. |
| **Excel**, **CSV**, **PDF** | Exports the result. |
| **SQL**, **Plan** | Administrators only. |

The line under **Run** tells you the state: queued, running, or "Result from … valid until …". A migrated map may show a warning that some Discoverer filters could not be migrated. The result can then hold more rows than the original.

---

# Runs

**Runs** lists every run you asked for, waiting, running or done. Use it to open a stored result, run again, export or clear old runs. Results are kept for 24 hours (live runs) or for the schedule's retention time (scheduled runs). The page updates itself.

![The Runs page with every user's runs shown.](shots/en/admin/04-runs-every-user.png)

| Button or control | What it does |
|---|---|
| **Map** filter | Shows one map only. |
| **Status** filter | Shows one status. |
| **Kind** filter | Shows **Live** or **Scheduled** runs. |
| **Show every user's runs** | Lists runs of all users, not only yours. There is no owner column, so other users' rows carry no name. |
| Map name | Opens the map in the viewer. |
| **Open** icon | Opens the stored result. |
| **Run again** icon | Starts a new run of the same map with the same values. It is your run, even when you copied it from another user's row. |
| **XLSX**, **CSV**, **PDF** buttons | Exports a completed run that has not expired. |
| **Cancel** icon | Cancels a run that is waiting. |
| **Delete** icon | Deletes a finished run and its stored rows. This cannot be undone. |

| Option (**Status**) | What it means / when to pick it |
|---|---|
| **Queued** | Waiting its turn. Each person runs one map at a time. |
| **Running** | Working now. |
| **Completed** | Done. The result can be opened and exported. |
| **Failed** | Stopped by an error. |
| **Cancelled** | Stopped by a person. |

The **Expires in** column shows the time left in minutes, hours or days, or **Expired**.

---

# Exports

**Exports** lists the files you exported. It shows only your own exports. Even an administrator cannot see or download another person's export.

![The Exports page listing export jobs with their status and download buttons.](shots/en/admin/05-exports.png)

| Button or control | What it does |
|---|---|
| Download icon | Saves the file. It shows on **Completed** exports. |
| Status badge | **Queued**, **Running**, **Completed** or **Failed**. Point at a failed one to read the reason. |

The columns are **Map**, **Format**, **Status**, **Rows** and **Created**.

| Option (**Format**) | What it means / when to pick it |
|---|---|
| XLSX | Excel spreadsheet. |
| CSV | Plain text with commas. Use it to load the data into another program. |
| PDF | A page-based document, made with the paper size and columns you chose. |

You create an export from a finished run: from the viewer, the builder, **Runs** or a schedule's history. Files are deleted after 7 days. After that, the row stays but the download fails.

---

# Schedules

A **schedule** runs a map by itself at set times and stores the result. Use it for reports you need every day, week or month. It shows only the schedules you created. It does not send e-mails. The result stays on the server.

![The Schedules page with a paused schedule and its action icons.](shots/en/user/38-schedules-list.png)

| Button or control | What it does |
|---|---|
| **New Schedule** | Opens the schedule form. |
| Play icon (**Run now**) | Runs the schedule at once. It is off while the schedule is paused. |
| **Pause** / **Enable** icon | Stops or restarts the timetable. |
| **History** icon | Opens **Execution History**. |
| **Edit** icon | Changes the schedule. You cannot change its map. |
| **Delete** icon | Deletes the schedule and its history after you confirm. |

The columns are **Name**, **Map**, **Schedule**, **Next Run**, **Format**, **Status** (**Active** or **Paused**) and **Planner**. **Planner** shows the note the migration left for a schedule that came from Discoverer. **Not checked** is normal for new schedules. Schedules migrated from Discoverer arrive paused.

A schedule runs as its creator. The creator's business-area grants and row-level policies apply.

## New Schedule and Edit Schedule

| Button or control | What it does |
|---|---|
| **Map** | The map to run. The list holds your own maps and maps shared with you, marked "(shared)". To schedule another user's map, use the Calendar icon in **Maps**. |
| **Name** | The name of the schedule. |
| **Frequency** | How often it runs. |
| **Timezone** | The clock the timetable follows. |
| **Time** | The hour and minute of the run. Shown for every frequency except **Custom (cron)**. |
| **Day of the week** | Shown for **Weekly**. |
| **Day of the month** | 1 to 28, or **Last day**. Days 29 to 31 are not offered, so no short month is skipped. Shown for **Monthly**, the longer frequencies and **Yearly**. |
| **Month** | Shown for **Yearly**. |
| **Cron expression** | The timetable in five fields. Shown only for **Custom (cron)**. |
| **Valid from (optional)** | The timetable starts on this date and time. |
| **Valid until (optional)** | The timetable stops after this date and time. |
| **Output Format** | The file kind for the stored result. |
| **Parameter presets** | The value of each map parameter: fixed, or relative to the run date (see below). Shown only if the map has parameters. |
| **Enabled** | Whether the timetable is on. |

| Option (**Frequency**) | What it means / when to pick it |
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

| Option (**Output Format**) | What it means / when to pick it |
|---|---|
| **Excel (.xlsx)** | A spreadsheet. |
| **CSV** | Plain text with commas. The default. |

**Timezone** offers your computer's own timezone first, then UTC, Europe/Lisbon, Atlantic/Madeira, Atlantic/Azores, Europe/Madrid and other common zones. Your computer's timezone is the default.

Results are kept for 30 days.

![The New Schedule dialog with a custom frequency and the cron expression field.](shots/en/user/34-schedule-custom-cron.png)

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

## Execution History

**History** shows the last 50 runs of the schedule: **Executed**, **Status** (SUCCESS, FAILED or TIMEOUT), **Rows** and **Duration**. Point at a failed row to read the error.

| Button or control | What it does |
|---|---|
| **XLSX**, **CSV**, **PDF** | Exports the stored result of a successful run. |
| **Open** icon | Opens the stored result in the viewer. |
| **Download** icon | Saves an older result file directly. |
| "Expires …" | The time left before the result is removed. |

## Example: a weekly result

Example: run **GD_M.M10_V01.DIS** every Monday at 07:00.

1. In **Maps**, click the Calendar icon on the map.
2. In **New Schedule**, type a **Name**.
3. Set **Frequency** to **Weekly**, **Day of the week** to Monday and **Time** to 07:00.
4. Choose your **Timezone**.
5. Leave **Enabled** ticked, then click **Save**.
6. Later, click the **History** icon to open or export the result.

---

# Business Areas

A **business area** is a group of related folders, for example "Sales". It is the unit for giving people access to data.

![The Business Areas page listing areas, with the New Business Area button and row icons.](shots/en/admin/06-business-areas.png)

The columns are **Name**, **Description**, **Status** (**Active** or **Inactive**) and **Created**.

| Button or control | What it does |
|---|---|
| **New Business Area** | Opens the create form. |
| **Manage grants** icon | Opens the **Grants** dialog. |
| **Edit** icon | Changes the name and description. |
| **Delete** icon | Deactivates the business area after you confirm. |

Delete only deactivates. An administrator can bring the area back.

![The New Business Area dialog with Name and Description fields.](shots/en/admin/07-business-areas-new.png)

## Create a business area

1. Click **New Business Area**.
2. Type a **Name** (required, up to 255 characters). Type a **Description** if you like.
3. Click **Save**. The toast **Business area created** appears.

## Grants

A **grant** gives one person a level of access to the data of one business area. Only an administrator can add or remove grants. Grants apply to a person, not to a role. A grant never makes a map visible.

![The Manage grants dialog with the Permission list open.](shots/en/admin/09-business-areas-grants-permission.png)

| Button or control | What it does |
|---|---|
| **Filter users by name or email** | Filters the list of people. |
| User checkboxes | Tick one or many people. |
| **Permission** | The level to give to every ticked person. The text under it explains the level. |
| **Add** | Gives the level to every ticked person. It is off until you tick someone. |
| Level badge on a grant | Shows the level a person holds. |
| **Revoke** (X) | Removes that person's grant. |
| **Close** | Closes the dialog. |

The six levels are a ladder. Each level includes the ones before it. If a person holds several grants on an area, the highest wins.

| Option (**Permission**) | What it means / when to pick it |
|---|---|
| VIEW | Read the data in the area's folders. Run maps that are shared with the person. See the area's folders, items, joins and hierarchies. Pick it for people who only run reports. |
| EXPORT | Same as VIEW. Export rights on a map come from how the map is shared. |
| SCHEDULE | Same as VIEW. Schedule rights on a map come from how the map is shared. |
| CREATE | Everything in VIEW, plus create new maps, folders, items, joins and hierarchies in the area. Pick it for people who build maps. |
| EDIT | Everything in CREATE, plus change the area and its folders, items, joins and hierarchies. |
| DELETE | Everything in EDIT, plus delete folders, items, joins and hierarchies in the area. |

> **Note:** EXPORT and SCHEDULE add nothing on their own. Whether someone can export or schedule a map depends on how the map is shared. A person needs at least CREATE to save a new map.

> **Note:** A Manager never changes folders, items, joins, hierarchies or the area, whatever grant they hold. For a Manager, CREATE, EDIT and DELETE only let them create maps.

Example: give a colleague the right to build maps in the business area **DC**.

1. Click the **Manage grants** icon on the area.
2. Tick your colleague.
3. Set **Permission** to CREATE.
4. Click **Add**. The toast **Access granted to 1 user** appears.

To give several people the same level, tick them all before you click **Add**. If some fail, the toasts report them separately.

---

# Folders

A **folder** is one table, view or query inside a business area. Its columns become **items**. Choose a business area first. **Refresh all** and **New Folder** stay off until you do.

![The Folders page with a business area chosen, showing the folder table and row icons.](shots/en/admin/11-folders.png)

The columns are **Name** (with a **Shared** badge for a folder that belongs to another area), **Type**, **Table Name** and **Data Source**.

| Button or control | What it does |
|---|---|
| **Business Area** | Chooses the area whose folders you see. |
| **Refresh all** | Re-reads every table and view of the area from its data source. New columns become items. Changed types are updated. Vanished columns are only listed. |
| **New Folder** | Opens the folder wizard. |
| **Refresh from data source** icon | The same refresh for one folder. It shows for table and view folders that have a data source and are not shared in. |
| **Manage business areas** icon | Opens the sharing dialog. |
| **Edit** icon | Opens the wizard on this folder. |
| **Delete** icon | Deactivates the folder after you confirm. |
| **Refresh results** panel, **Close** | Lists what each refresh found. |

Refresh never deletes an item. A column that is gone from the source is listed as "Column gone from the source (item kept — delete it if no map uses it)".

Shared-in folders are skipped by **Refresh all**. Refresh them from the area that owns them.

## The folder wizard

| Button or control | What it does |
|---|---|
| **Name** | The name of the folder. Filled from the table if empty. |
| **Description** | Text. Filled from the Oracle table comment if empty. |
| **Folder Type** | The kind of folder. |
| **Custom SQL** | The SQL that defines the folder. Shows for **DERIVED** and **COMPLEX**. |
| **Data Source** | The database connection. Shows for every type except **DERIVED** and **COMPLEX**. |
| **Discover Tables** | Reads the tables of the data source so you can pick one. |
| Filter box | Filters the discovered list by name or comment. |
| Discovered list | Click a table to fill **Table Name**, **Table Owner**, **Name** and **Description**. |
| **Table Name**, **Table Owner** | The table to use. You can type them. The system checks that the table exists and can be read. |
| **Items to create (n)** | The columns of the table. Each ticked column becomes an item. You can change each description. **Select all** / **Clear** ticks or unticks all. |
| **Save** | Creates the folder, then creates the items. |

| Option (**Folder Type**) | What it means / when to pick it |
|---|---|
| TABLE | A database table. The usual choice. |
| VIEW | A database view. |
| DERIVED | A folder defined by your own text in **Custom SQL**. |
| COMPLEX | A folder defined by your own SQL. The SQL must not be empty and must pass the check. Row-level security policies do not work with it: a COMPLEX folder covered by a policy is refused. |
| JOIN | A folder that stands for a join. |
| SUMMARY | A summary folder. |

![The New Folder dialog with a table picked and the Items to create checklist.](shots/en/admin/15-folders-picked.png)

Example: create a folder for a table.

1. Choose the business area, then click **New Folder**.
2. Leave **Folder Type** on TABLE. Choose the **Data Source**.
3. Click **Discover Tables**. Type part of the name in the filter box.
4. Click the table. The columns appear under **Items to create**.
5. Untick columns you do not need. Click **Save**.

## Share a folder into another business area

A folder is owned by one business area. It can also appear in others, as in Oracle Discoverer. A grant on any of its areas gives access to the folder.

1. Click the **Manage business areas** icon.
2. Under **Share into**, choose an area.
3. Click **Share**.
4. To stop sharing, click the X on the badge. You cannot remove the owning area.

![The folder sharing dialog with the owner badge and the Share into list.](shots/en/admin/16-folders-sharing.png)

---

# Items

An **item** is one column of a folder. Maps are built from items. Choose a **Business Area** and then a **Folder**. The folder list includes shared-in folders.

![The Items page for a chosen folder, with Type, Column, Data Type and Aggregation columns.](shots/en/admin/17-items.png)

The columns are **Name**, **Type**, **Column**, **Data Type** and **Aggregation**.

| Button or control | What it does |
|---|---|
| **Business Area**, **Folder** | Choose whose items you see. |
| **New Item** | Opens the create form. It is off until a folder is chosen. |
| **Edit** icon | Changes the item. You cannot move it to another folder. |
| **Delete** icon | Deactivates the item after you confirm. |

Items are normally created by the folder wizard. This page has no import button.

| Button or control | What it does |
|---|---|
| **Name** | The item name. Required. |
| **Description** | Optional text. |
| **Item Type** | The kind of item. |
| **Column Name** | The physical column. Shows only for **Database Item (CO)**. |
| **Formula** | The calculation. Shows for every type except CO. An invalid formula is refused. |
| **Data Type** | For example NUMBER. |
| **Format Mask** | For example `999,999.00`. |
| **Aggregation** | The default total of the item. |

| Option (**Item Type**) | What it means / when to pick it |
|---|---|
| **Database Item (CO)** | A column of the table. The usual choice. |
| **Created Item (CI)** | An item that you created, using a formula. |
| **Calculated Item (CU)** | A calculated item, using a formula. |
| **Join Item (JI)** | An item that comes through a join. |
| **Hierarchy Item (HI)** | An item that is a level of a hierarchy. |
| **Aggregation (AG)** | An item that totals other items. |
| **Function (FU)** | An item that calls a custom function. |

| Option (**Aggregation**) | What it means / when to pick it |
|---|---|
| NONE | No default total. Stores nothing. |
| SUM, COUNT, AVG, MIN, MAX | The default total for this item when it is used in a map. Pick SUM for amounts. |

![The New Item dialog with the Item Type list open showing the item types.](shots/en/admin/19-items-type-open.png)

---

# Joins

A **join** tells the system how two folders connect, so a map can use columns from both. Choose a business area first.

![The Joins page, including joins made of several column pairs.](shots/en/admin/20-joins.png)

The columns are **Name**, **Left Folder**, **Right Folder**, **Columns** (pairs shown as `left op right`, joined with AND) and **Type**.

| Button or control | What it does |
|---|---|
| **Business Area** | Chooses the area. |
| **New Join** | Opens the join form. |
| **Edit** icon | Changes the join. |
| **Delete** icon | Deactivates the join after you confirm. |

| Button or control | What it does |
|---|---|
| **Name** | The join name. Required. Filled by a suggestion if empty. |
| **Left Folder**, **Right Folder** | The two folders. Both must belong to the area. |
| **Suggest Joins** | Looks for matching column names between folders and lists them. It works from the left folder. Click a suggestion to fill the form. |
| **Left Item**, **Operator**, **Right Item** | One pair of columns and how they compare. |
| X on a pair | Removes the pair. The last pair cannot be removed. |
| **Add column pair** | Adds another pair. Every pair must match (AND). This gives a join on several columns. |
| **Join Type** | The kind of join. |

| Option (**Operator**) | What it means / when to pick it |
|---|---|
| `=` | The columns are equal. Almost always the right choice. |
| `<>`, `<`, `<=`, `>`, `>=` | Other comparisons. Rare. |

| Option (**Join Type**) | What it means / when to pick it |
|---|---|
| INNER | Only rows that match on both sides. The default. |
| LEFT | All rows of the left folder, with or without a match. |
| RIGHT | All rows of the right folder, with or without a match. |

There is no full join, on purpose.

![The New Join dialog with a select list open.](shots/en/admin/23-joins-select-open.png)

Example: connect two folders.

1. Choose the area and click **New Join**.
2. Choose the **Left Folder** and **Right Folder**.
3. Click **Suggest Joins** and click the suggestion that fits.
4. Check the **Join Type** and click **Save**.

---

# Hierarchies

A **hierarchy** is an ordered list of items, from the widest to the narrowest, for example Year, Quarter, Month. It defines how to drill down. Choose a business area first.

![The Hierarchies page with the table showing the number of levels.](shots/en/admin/24-hierarchies.png)

The columns are **Name** and **Levels**.

| Button or control | What it does |
|---|---|
| **Business Area** | Chooses the area. |
| **New Hierarchy** | Opens the form. |
| **Edit** icon | Opens the hierarchy with its levels. |
| **Delete** icon | Deactivates the hierarchy after you confirm. |

| Button or control | What it does |
|---|---|
| **Name**, **Description** | Text fields. |
| **Add Level** | Adds a level at the bottom. |
| Drag handle | Drag to reorder. The order is the drill order (top to bottom). |
| **Level name** | The name of the level. |
| **Folder**, **Item** | The item that is this level. Choosing a new folder clears the item. |
| X on a level | Removes the level. |
| **Save** | Off until the hierarchy has a name, at least one level, and every level has a name and an item. |

> **Warning:** The **Folder** list also shows folders shared in from other areas, but a hierarchy accepts only items of folders that its own area owns. An item of a shared-in folder is refused when you save.

![The New Hierarchy dialog after adding a level, with folder and item selects.](shots/en/admin/26-hierarchies-level-added.png)

---

# Custom Functions

A **custom function** registers a function that lives in the Oracle database, so calculated items can call it. It has no business area.

![The Custom Functions page with filter box, Refresh all, New Function and the function table.](shots/en/admin/27-custom-functions.png)

The columns are **Name**, **Type**, **Database Function** (`OWNER.PACKAGE.NAME`, with `@LINK` if any), **Data Source**, **Parameters** and **Return Type**.

| Button or control | What it does |
|---|---|
| **Refresh all** | Re-reads every function that has a data source from Oracle and writes changed signatures back. It recompiles calculated fields if something changed. Functions gone from Oracle are only listed and are kept. |
| **New Function** | Opens the form. |
| **Filter by name or database function…** | Filters the table. |
| **Refresh from database** icon | Refreshes one function. |
| **Edit** icon | Changes the function. |
| **Delete** icon | Deactivates the function after you confirm. |
| **Refresh results** panel, **Close** | Lists what changed, what is gone and what failed. |

## The function form

| Button or control | What it does |
|---|---|
| **Data source** | Where the function lives. Chosen for you if there is only one. |
| **Owner**, **Find a function**, **Search** | Searches the Oracle database for functions and packages. It works only for an Oracle data source. Click a result to fill the form. Results that cannot be called from SQL are greyed out with the reason. |
| **Owner**, **Package**, **Function name**, **Database link** | The parts of the function's address. Use letters, digits, `_`, `$` or `#`, starting with a letter. |
| **Name**, **Description** | The name people see, and text. |
| **Function Type** | The kind of function. |
| **Return Type** | For example NUMBER. |
| **Parameters (JSON)** | A list of parameters. Each needs a name and a type, for example `[{ "name": "p_id", "type": "NUMBER", "required": true }]`. |

| Option (**Function Type**) | What it means / when to pick it |
|---|---|
| SQL | A function written in SQL. |
| PLSQL | A stand-alone PL/SQL function. The default. |
| PACKAGE | A function inside a package. The search picks this when it finds a package. |

![The New Custom Function dialog listing database functions that match the search.](shots/en/admin/29-custom-functions-search-results.png)

---

# Data Sources

A **data source** is a saved database connection. Business areas, folders and migrations use it. Passwords are stored on the server and are never shown again.

![The Data Sources page with a table of connections and five row icons.](shots/en/admin/30-data-sources.png)

The columns are **Name**, **Type**, **Host**, **Status** and **Created**.

| Button or control | What it does |
|---|---|
| **New Data Source** | Opens the connection form. |
| **Test connection** icon | Tries to connect with the saved details. The result shows in a toast and in a box above the table. |
| **Introspect schema** icon | Reads the Oracle schema again. The toast tells how many tables were found. It works only for Oracle. |
| **Import tables** icon | Opens **Import Tables**. |
| **Edit** icon | Changes the connection. |
| **Delete** icon | Deactivates the data source after you confirm. |

| Button or control | What it does |
|---|---|
| **Name** | Must be unique. |
| **Connection Type** | The kind of database. |
| **Host**, **Port** | Where the server is. |
| **Service Name**, **SID** | Shown for Oracle only. |
| **Username** | The database account. |
| **Password** | The account password. On edit, leave it blank to keep the saved one. |

| Option (**Connection Type**) | What it means / when to pick it |
|---|---|
| **Oracle** | An Oracle database. Needed for introspection, function search and migration. |
| **PostgreSQL** | A PostgreSQL database. |

## Import tables

**Import Tables** turns many tables into folders at once.

1. Click the **Import tables** icon.
2. Type the **Table Owner / Schema** (the data source username is the default).
3. Click **Discover Tables**.
4. Choose the **Business Area** that will own the new folders.
5. Tick the tables you want.
6. Click **Import n table(s)**. The toast says how many folders were created and how many were skipped because they exist.

![The Import Tables dialog with the Discover Tables button, before any table is found.](shots/en/admin/34-data-sources-import-dialog.png)

---

# Users

**Users** lists every account. Use it to add people, change roles, switch accounts off and hand maps to other people.

![The Users page with the Credentials file and New User buttons and row icons.](shots/en/admin/35-users.png)

The columns are **Name**, **Email**, **Role** and **Status** (**Active** or **Inactive**).

| Button or control | What it does |
|---|---|
| **Credentials file** | Gives a new temporary password to every active account that still has one, and downloads the list as a CSV file. |
| **New User** | Opens the create form. |
| **Maps this user can open** icon | Opens the list of maps this person can open, and why. |
| **Edit** icon | Changes name, email, password or role. |
| **Deactivate** icon | Switches the account off. Shows on active accounts. |
| **Activate** icon | Switches the account on again, with no question. Shows on inactive accounts. |
| **Delete** icon | Deletes the account for good. |

You cannot deactivate or delete your own account. Those icons are greyed out on your row.

## Create or change a user

| Button or control | What it does |
|---|---|
| **Name** | Required, up to 255 characters. |
| **Email** | The sign-in address. It must be unique. |
| **Password** | At least 8 characters. On edit, leave it blank to keep the old one. A password you set does not force the person to change it. |
| **Role** | The kind of account. The list under it explains each role. |

| Option (**Role**) | What it means / when to pick it |
|---|---|
| ADMIN | Does everything: users, business areas, data sources, security and audit. Opens, changes, shares and deletes every map. Give it to very few people. |
| MANAGER | Opens, runs, exports, schedules and shares every map, and changes who owns a map. Changes only their own maps and maps shared with **Can edit**. Sees, edits, activates and deactivates MANAGER, USER and VIEWER accounts, but never sees administrators and cannot create or delete users or give the ADMIN role. Cannot change business areas, folders, items, joins or hierarchies, whatever grant they hold. Cannot use **Custom Functions**, **Data Sources**, **Security**, **Audit Log** or **Migration**. |
| USER | Sees their own maps, public maps and maps shared with them. Runs, exports and schedules as each share allows. Copies maps, and creates new maps where they hold a CREATE grant. The default. |
| VIEWER | Like USER, but cannot copy maps or workbooks. For a person who must only read, share maps with **Can view** and give no CREATE grant. |

> **Note:** The short text under the **Role** list on screen is a summary. The table above is what each role really can do.

A role change applies on the person's next click. They do not need to sign in again.

![The New User dialog with the Role list open and each role described.](shots/en/admin/37-users-role-open.png)

## Deactivate, activate or delete

- **Deactivate** keeps the account and its history. The person is signed out on their next request and cannot sign in until you activate the account. Use it when someone leaves or is away.
- **Activate** switches the account on again at once.
- **Delete** removes the account for good and cannot be undone. The confirmation says so, and lists what goes with the account: its schedules, runs and exports. If you are unsure, use **Deactivate**.

![The confirmation dialog shown before deactivating a user.](shots/en/admin/39-users-deactivate-dialog.png)

> **Warning:** **Delete** is permanent. **Deactivate** is not.

## The credentials file

Migrated accounts start with a temporary password and must change it before they can do anything. **Credentials file** creates a new temporary password for each active account that still has one, and downloads a CSV. Each click makes new passwords, so keep the file safe and give each person only their own line. Accounts that are inactive or that stand for database roles are skipped.

## Maps this user can open

The icon opens **Maps for <name>**. It lists exactly what the person sees on their own **Maps** page, with the owner and the reason.

![The Maps dialog for a user, with source badges and share-level selects.](shots/en/admin/41-users-maps-dialog.png)

| Badge | What it means |
|---|---|
| Administrator | The person is an administrator and sees every map. |
| Owner | The person owns the map. |
| Shared | The map was shared with the person. |
| Public | The map is public. |
| Manager role | The person is a manager and sees every map. |

| Button or control | What it does |
|---|---|
| Map name | Opens the map in the viewer. |
| Share-level list | For a shared map, changes the level: **Can view**, **Can export**, **Can edit**. |
| Give-map icon | Shows the **New owner** list. |
| **New owner** | Choose an active user. The map moves to that person. They can change, share and delete it. |
| X icon | Removes this map from the person at once, with no question. |

Example: a colleague leaves. Open **Maps this user can open** for that colleague. For each map they own, click the give-map icon and choose the new owner. Then click **Deactivate** on the account.

---

# Security Policies

**Security Policies** control **row-level security**: which rows of a folder each person may see. A **policy** holds one or more **rules**. Each rule points at a business area or a folder and holds a filter written as a SQL test. The filter is added to every query that a person covered by the policy runs.

![The Security Policies page with the Test and New Policy buttons.](shots/en/admin/43-security.png)

> **Warning:** What happens to a folder that no policy covers depends on one installation setting (`ROW_LEVEL_FAIL_MODE`). **Closed**, the default: nobody sees its rows, administrators included, and runs stop with **Refusing to run unfiltered**. **Open**: everyone with a grant sees all its rows. Ask the person who installed the system which mode yours uses. In closed mode, write and assign policies before people run maps.

The columns are **Name**, **Description**, **Status**, **Rules** and **Assignments**.

| Button or control | What it does |
|---|---|
| **Test** | Opens **Test a policy**. |
| **New Policy** | Opens the policy form. |
| **Assignments** icon | Opens the **Assignments** dialog. |
| **Edit** icon | Changes the policy. |
| **Delete** icon | Deletes the policy after you confirm. |

## Write a policy

| Button or control | What it does |
|---|---|
| **Name** | Required. |
| **Description** | Optional text. |
| **Active** | An inactive policy is not applied. |
| **Add rule** | Adds another rule. A policy needs at least one. |
| **Applies to** | What the rule points at. |
| **Business Area**, **Folder** | The target. **Folder** lists the folders of the chosen area. |
| **SQL predicate (WHERE-clause fragment)** | The filter. It must not be empty. |
| **Validate** | Checks the filter. **Valid predicate** means it is good. |
| **Remove rule** | Removes the rule. |

| Option (**Applies to**) | What it means / when to pick it |
|---|---|
| **Business Area** | The rule covers every folder of the area. |
| **Folder** | The rule covers one folder. |

In the filter you can use `:current_user_id`, `:current_user_email` and `:current_user_role`. Use `{alias}` for the folder's name inside the query. Example: `{alias}.REGION = 'NORTH'`. All the filters that match are joined with AND.

> **Note:** A COMPLEX folder covered by a policy is refused. Use another folder type if the folder needs a policy.

![The New Policy dialog after pressing Validate on a predicate.](shots/en/admin/46-security-validate.png)

## Assign a policy

A policy applies to each assigned person, and to everyone who holds an assigned role.

| Option (**Assign to**) | What it means / when to pick it |
|---|---|
| **User** | One named person. Choose them in **User**. |
| **Role** | Everyone with that role: ADMIN, MANAGER, USER or VIEWER. Choose it in **Role**. |

1. Click the **Assignments** icon.
2. Choose **User** or **Role**, then choose the person or role.
3. Click **Assign**. The toast **Policy assigned** appears.
4. To remove, click the **Remove assignment** icon.

A policy with no assignment gives rows to nobody ("Not assigned — this policy gives rows to nobody").

## Test a policy

**Test** shows where the filters land in a sample query. It does not run the query. Choose the **Policy**, edit the **Sample query** (the default is `SELECT * FROM SALES`), and click **Run test**. The result appears under **Query with security predicates**.

---

# Audit Log

The **Audit Log** records every change and sign-in event in the system. Use it to find out who did what and when. It is read-only.

![The Audit Log page with export button, statistic cards, daily chart and filters.](shots/en/admin/47-audit.png)

The top of the page shows **Total Actions**, **Top Actions** and **Actions per Day**.

| Button or control | What it does |
|---|---|
| **Export CSV (this page)** | Saves the rows on screen (up to 25) as a CSV. It is not the whole log. |
| **User** filter | Shows one person's actions. **All users** removes it. |
| **Entity type** | Shows one kind of object. Type the exact text, for example `maps`. |
| **Action** | Shows one action. Type the exact text, for example `POST /api/maps`. |
| **From**, **To** | The date range. |
| **Clear** | Removes all filters. |
| **View details** icon | Opens **Audit entry details** with the whole entry. |
| **Previous**, **Next** | Move between pages of 25 rows. |

The columns are **Timestamp**, **User**, **Action**, **Entity** and **IP Address**. A blank user shows **System / unauthenticated**.

What is recorded: every request that changes something (create, change, delete, sign-in, sign-out, export, migration), and the reading of business areas, folders, items, joins, hierarchies, custom functions and data sources. Passwords and tokens are never stored. The text filters match the whole text and are case-sensitive.

When you read the data of a folder without a grant, the log records it as an administrator bypass.

---

# Migration

**Migration** brings an Oracle Discoverer End User Layer (EUL: the place where Discoverer kept its business areas, folders, items, users and workbooks) into Discoverer Neo. It is powerful. It writes many objects into this database.

> **Warning:** Always run a **dry run** first and read the report. A live migration writes into the Discoverer Neo database. **Re-import maps** replaces every map in the "Migrated Workbooks" business area, so edits made since the first migration are lost, and so are the schedules, shares, runs and exports of those maps. Prefer **Re-import everything**, which keeps them.

![The Migration page with the Source card, its buttons and help text.](shots/en/admin/50-migration.png)

The source is an Oracle **data source** that you registered first (see **Data Sources**). Its saved password is used on the server. No password is typed on this page.

## Choose the source

| Button or control | What it does |
|---|---|
| **Oracle data source** | The Oracle connection that holds the EUL. |
| **EUL schema owner (optional)** | The schema that owns the EUL, for example `EUL5_US`. |
| **EUL version** | The version of the EUL. |
| **Detect version** | Finds the version and shows the **Detected source** card. |
| **Analyze** | Checks readiness and complexity. It fills the **Assessment** card. |
| **Dry run (validate without writing)** | On by default. Runs are only a test and write nothing. |
| **Run dry run** / **Run migration** | Starts the job. The name follows the **Dry run** box. |
| **Re-import maps** | Rebuilds the maps of a database that is already migrated. |
| **Re-import everything** | Replays the whole migration with the current version. |
| **Compile calculated fields** | Checks every calculated field and writes the SQL that maps run. |

| Option (**EUL version**) | What it means / when to pick it |
|---|---|
| **Auto-detect** | The system finds the version. Pick it first. |
| **Force EUL4** | Treat the source as Discoverer 4. |
| **Force EUL5** | Treat the source as Discoverer 9i, 10g or 11g. |

## What each action does

| Action | What it does |
|---|---|
| **Run migration** | A first migration of an empty target. It cannot run on a target that already holds a migration (**Target database already migrated**). Use a re-import instead. |
| **Re-import maps** | Rebuilds only the maps, from the workbooks in the EUL. It replaces every map in the "Migrated Workbooks" business area, and deletes their schedules and shares with them. It leaves users, folders, items and grants alone. |
| **Re-import everything** | Rewrites, object by object, whatever now differs: business areas, folders, items, joins, hierarchies, functions, users, grants and maps. Nothing is deleted. Map ids survive, so schedules and shares are kept. Objects removed from the EUL are only reported. A live run ends by compiling calculated fields. |
| **Compile calculated fields** | Use it if a map says a field "has not compiled". A migration and a re-import already do this at the end. It does not read the EUL. |

Buttons are off while a job is running, or when no data source is chosen. **Compile calculated fields** works even with no data source.

## Do a migration safely

1. Register the Oracle data source in **Data Sources** and test it.
2. Choose it here. Click **Detect version**, then **Analyze**. Read the **Assessment**: readiness, blockers and warnings.
3. Leave **Dry run** ticked. Click **Run dry run**.
4. Read the report: **Rows that would be inserted**, the summary, the reconciliation and the **Migration log**.
5. When the dry run is clean, untick **Dry run**. The warning "A live migration writes into this Discoverer Neo database" appears. Click **Run migration**.
6. Open **Users**. Migrated accounts cannot sign in until they have a password. Click **Credentials file** and hand out the passwords.
7. Review the maps in the "Migrated Workbooks" business area and move each one to the area it belongs to.

The **Assessment** card shows a readiness score out of 100, complexity, estimated effort, counts of what was found, worksheet layout coverage, blockers and warnings.

---

# Common questions

**I cannot see a map a colleague sees. Or a colleague cannot see my map.**
You see every map, so the problem is the colleague's. Open **Users**, click **Maps this user can open**, and check the badge. If the map is missing, share it (**Can view** at least) or make it public.

**A user opens a map but the run stops with "Not entitled to run".**
The map is visible but the person has no grant on the business area of its folders. Add a grant in **Business Areas**. In closed mode, a missing row-level security policy gives the same banner.

**Everybody gets "Refusing to run unfiltered".**
The installation runs row-level security in closed mode, and no policy covers the folder. Write a policy in **Security Policies** and assign it.

**A person can view a map but cannot export or schedule it.**
Their share is **Can view**. Change it to **Can export**. Public maps can be exported but not scheduled.

**A migrated user cannot sign in.**
The account has no password yet. Use **Credentials file** in **Users**. If the person is deactivated, click **Activate**.

**I cannot delete or deactivate my own account.**
That is by design. Ask another administrator.

**The Runs page shows only my runs.**
Tick **Show every user's runs**.

**I cannot download an export made by someone else.**
Exports are private, even from administrators. Ask the person to export again.

**A schedule I made for another person's map is not in the list.**
The **Schedules** page lists only the schedules you created. The **Map** list in the form shows your own maps and maps shared with you. To schedule someone else's map, use the Calendar icon in **Maps**.

**My monthly schedule always shows the same dates.**
Its date parameters have a **Fixed value**. Edit the schedule and set them to **Relative to the run date**, for example -1 **months**, **first day of that month** and **last day of that month**.

**I pressed Save and saw "No changes to save".**
Nothing changed since the last save, so nothing was sent. The map is already saved.

**A calculated field says it "has not compiled".**
Click **Compile calculated fields** in **Migration**.

## Glossary

| Term | Meaning |
|---|---|
| Map | A report. In Oracle Discoverer this was a worksheet. |
| Workbook | A group of maps. |
| Business area | A group of related data. The unit for grants. |
| Folder | One table, view or query in a business area. |
| Item | One column of a folder. |
| Join | A rule that connects two folders. |
| Hierarchy | An ordered list of items used to drill down. |
| Grant | A level of access to a business area, given to one person. |
| Run | One execution of a map. Its result is stored for a while. |
| Export | A file (XLSX, CSV or PDF) made from a finished run. |
| Schedule | A timetable that runs a map by itself and stores the result. |
| Share | Access to one map, given to one person: **Can view**, **Can export** or **Can edit**. |
| Public map | A map that every signed-in user can open and export. |
| Data source | A saved database connection. |
| Row-level security | Rules that decide which rows of a folder a person sees. |
| EUL | End User Layer. Where Oracle Discoverer kept its metadata. |
| Dry run | A migration test that writes nothing. |
