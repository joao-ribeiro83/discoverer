# Your role at a glance

You are a **Manager**. You see every map in Discoverer Neo, run it, export it, schedule it and share it. You look after who can open what. You do not change the data model. That is an administrator's job.

A **map** is a report (in Oracle Discoverer this was a worksheet). A **workbook** is a group of maps. A **business area** is a group of related data. A **folder** is one table or view inside a business area, and an **item** is one column of a folder.

## You can / You cannot

| You can | You cannot |
|---|---|
| See every map, including private ones | Change a map you do not own, unless it is shared with you at **Can edit** |
| Run, export and schedule every map (the data rules below still apply) | Delete a map you do not own |
| Share any map, and change or remove any share | See the SQL text or the database plan of a run |
| Copy any map to make your own version | Create, delete or change grants on business areas |
| Hand a map over to another owner | Create, edit or delete users |
| Open the Users page and see which maps each person can open | Create, edit or delete data sources, or import tables from one |
| Create, edit and delete custom functions | See other people's runs, exports or schedules |
| Test and read data sources | Use Security, Audit Log or Migration (administrators only) |
| Build maps on the business areas you hold a grant on | Change business areas, folders, items, joins or hierarchies, whatever grant you hold |

> **Note:** **Business Areas**, **Folders**, **Items**, **Joins**, **Hierarchies**, **Security**, **Audit Log** and **Migration** are for administrators only. They are not in your sidebar.

## Where your access comes from

Three things decide what you can do.

- **Your role.** As a Manager you can see, run, export, schedule and share every map. This does not depend on shares.
- **Shares.** You can change a map only if you own it or someone shared it with you at **Can edit**. Being a Manager does not add that right.
- **Business-area grants.** An administrator gives you a grant on a business area. A grant has a level. Each level includes the ones before it.

| Grant level | What it lets you do in that business area |
|---|---|
| VIEW | Read its data. Use its folders and items in the map builder. |
| EXPORT | Same as VIEW. Export and schedule rights on a map come from how the map is shared. |
| SCHEDULE | Same as VIEW. Export and schedule rights on a map come from how the map is shared. |
| CREATE | Everything in VIEW, plus create new maps. |
| EDIT | Same as CREATE for you. The extra model rights of this level are for administrators only. |
| DELETE | Same as CREATE for you. The extra model rights of this level are for administrators only. |

Unlike an administrator, you get no bypass. Two rules follow.

- You can see and run every map, but the data comes second. A run or export needs a grant on every folder the map uses. Without it the run fails with **Not entitled to run**. Ask an administrator for the grant.
- A grant does not make maps appear. You already see all maps because you are a Manager.

## How to sign in, change your password, and sign out

1. Open the Discoverer Neo address in your browser.
2. Type your **Email** and **Password**.
3. Leave **Remember me** ticked to stay signed in after you close the browser. Untick it on a shared computer. Then you are signed out when you close the browser.
4. Click **Sign in**. You land on the **Dashboard**.

![The sign-in page with Email, Password, Remember me and the Sign in button.](shots/en/common/01-login.png)

If you type a wrong password five times, the account is locked for 15 minutes. Wait, then try again. There is no "forgot password" link. Ask an administrator to reset it.

If your account has a temporary password, Discoverer Neo sends you to **Change your password** and nothing else works until you finish it.

To change your password at any time, open the address `/change-password` in the same browser window. Enter your current password, then the new one twice. The new one must have at least 12 characters and be different from the old one.

To sign out, click your name at the top right and choose **Log out**. This ends your session. To use Discoverer Neo again, sign in again.

![The account menu open, with Settings and Log out.](shots/en/common/03-user-menu.png)

---

# Dashboard

The **Dashboard** is the first page you see. It gives you numbers only. Nothing on it changes data.

![The Manager dashboard with the sidebar and summary cards.](shots/en/manager/01-dashboard-sidebar.png)

| Card | What it shows for you |
|---|---|
| **Total Maps** | Every active map in the system. The line below splits it into "yours" and "shared with you". For you, "shared with you" means everyone else's maps, including private ones. |
| **Total Executions** | All logged runs, by anyone, of the maps you can see. |
| **Scheduled Maps** | Maps that have at least one active schedule made by you. |
| **Scheduled Results** | Stored results made by your own schedules. |
| **Recent Maps** | The last five maps you created. Click one to open it in the builder. |

The **View schedules** link on two cards opens the **Schedules** page.

---

# Custom Functions

A custom function is a function stored in the Oracle database that calculated items can call. You have full rights here. No business-area grant is needed.

![The Custom Functions page with the list, Refresh all and New Function.](shots/en/manager/08-custom-functions.png)

| Button or control | What it does |
|---|---|
| **Filter by name or database function…** | Narrows the list as you type. |
| **Refresh all** | Reads every function again from Oracle. Changed signatures are saved and calculated fields are recompiled. Functions gone from Oracle are kept and listed. |
| **New Function** | Opens the function dialog. |
| Row icon **Refresh from database** | Refreshes one function. |
| Row icon **Edit** | Changes the function. |
| Row icon **Delete** | Deactivates the function after you confirm. |
| **Close** under **Refresh results** | Hides the result list. |

| Field | What it means |
|---|---|
| **Data source** | The database where the function lives. |
| **Owner**, **Find a function**, **Search** | Searches Oracle for functions and packages. Oracle data sources only. |
| **Owner**, **Package**, **Function name**, **Database link** | The parts of the full name. Letters, digits, _, $ or # only, starting with a letter. |
| **Name** and **Description** | The display name and a note. |
| **Function Type** | See below. |
| **Return Type** | For example NUMBER. |
| **Parameters (JSON)** | The list of inputs. Each needs a name and a type. |

| Option (**Function Type**) | What it means |
|---|---|
| SQL | A plain SQL function. |
| PLSQL | A stored PL/SQL function. The default. |
| PACKAGE | A function inside an Oracle package. |

## Example: register a package function

1. Click **Custom Functions**, then **New Function**.
2. Choose the **Data source**.
3. Type part of the name in **Find a function**, then click **Search**.
4. Click the right result. The type, owner, package, return type and parameters are filled. Results Oracle cannot call from SQL are greyed out.
5. Check the **Name**, then click **Save**.

---

# Data Sources

A data source is a saved connection to a database. You can look at them and test them. You cannot change them.

![The Data Sources page with the list of connections and row icons.](shots/en/manager/07-data-sources.png)

| Button or control | What it does |
|---|---|
| Row icon **Test connection** | Tries the stored login. A message says **Connection succeeded** or **Connection failed**. |
| Row icon **Introspect schema** | Reads the Oracle schema to find its tables. Shows how many tables were found. Oracle only. |
| **New Data Source** | Reserved for administrators. |
| Row icon **Edit** | Reserved for administrators. |
| Row icon **Delete** | Reserved for administrators. |
| Row icon **Import tables** | You can open the dialog and **Discover Tables**. **Import** is reserved for administrators. |

> **Note:** The screen offers **New Data Source**, **Edit**, **Delete** and the import step. The system refuses them for you. To create folders from tables, use **Folders** and **Discover Tables** instead.

---

# Users

The **Users** page is read-only for you. Use it to see accounts, to find out which maps a person can open, and to fix who owns or shares a map.

![The read-only Users list, without New User or Credentials file buttons.](shots/en/manager/06-users.png)

The list shows **Name**, **Email**, **Role** and **Status** (**Active** or **Inactive**). You cannot create, edit, deactivate, activate or delete users. You cannot issue a credentials file. Ask an administrator.

## Maps for a person

Click the row icon **Maps this user can open**. The dialog **Maps for {name}** lists every map that person sees.

![The Maps dialog for a user, with share-level selects and owner and remove icons.](shots/en/manager/11-users-maps-dialog.png)

| Button or control | What it does |
|---|---|
| Map name | Opens the map in the viewer. |
| **Owner: {name}** | Shows who owns the map. |
| Badge | Says why the person sees the map. |
| Share level select | Changes what the person may do with a shared map. |
| Owner icon | Opens the **New owner** list. |
| **New owner** | Choose a person to give the map to. |
| Remove icon (X) | Removes the map from that person. No confirmation. |

| Option (badge) | What it means |
|---|---|
| Administrator | The person is an administrator and sees all maps. |
| Owner | The person owns the map. |
| Shared | Someone shared the map with the person. You can change or remove this. |
| Public | The map is public. |
| Manager role | The person is a manager and sees all maps. |

| Option (share level) | What it means / when to pick it |
|---|---|
| Can view | Can open and run the map. Cannot export, schedule or change it. |
| Can export | Can open and run the map, export its result, and put it on a schedule. |
| Can edit | Can do all of the above, and also change the map. |

## Example: give a map to a colleague who takes over

1. Click **Users**, then the row icon **Maps this user can open** for the current owner.
2. Find the map. Click the owner icon.
3. In **New owner**, choose the colleague.
4. Wait for the message **Owner changed**.

> **Warning:** The new owner can change, share and delete the map. Their own earlier share of it is dropped. You do not become an editor of the map by handing it over.

---

# Maps

The **Maps** page lists every map in the system. You see everything, including private maps. Seeing a map does not mean you can read its data. The data rules from the first chapter still apply.

![The Maps list, All tab, with Copy, Share, Schedule and Export icons on each row.](shots/en/manager/02-maps-all.png)

## Finding a map

| Control | What it does |
|---|---|
| **Mine** tab | Maps you created. |
| **Shared with me** tab | Maps someone shared with you at any level. |
| **All** tab | Every map in the system. |
| **Search maps by name…** | Filters by name. |
| **Business Area** filter | Shows one business area. Choose **All business areas** to reset. |
| **Sort by** | **Recently updated** or **Name (A–Z)**. |
| **Clear** | Resets the search and filter. |

The **Workbooks** section at the top groups maps by workbook. Click a workbook to see its maps. Click a map to open it.

## What each icon does

| Icon | What it does |
|---|---|
| Eye | Opens the viewer so you can run the map. |
| Pencil | Opens the builder. Shown only for maps you own, or that are shared with you at **Can edit**. |
| Copy | Makes your own copy, which you can then change. Works for any map. |
| Share | Opens **Share map**. Works for any map. |
| Calendar | Opens **Schedules** with this map chosen. |
| Download | Opens the viewer, where you export. |
| Trash | Deletes the map. Shown only for your own maps. |

The workbook row has its own icons. Copy makes a private copy of every map in the workbook. Share gives someone every map of the workbook. Trash deletes a workbook only if you own every map in it.

> **Warning:** A deleted map can only be brought back by an administrator.

## Copy a map to build your own

1. Find the map and click the Copy icon.
2. For a workbook, type a name in **Name of the new workbook** and click **Copy**.
3. The copy opens in the builder. It is private to you.

Example: copy **GD_M.M10_V01.DIS**, then add a column to your copy. The original does not change.

## Share a map

1. Click the Share icon on the map.
2. Search for a person by name or email.
3. Click a level next to their name: **Can view**, **Can export** or **Can edit**. The dark button is what they hold now.
4. To take access away, click the X next to their name.

![The Share map dialog with a search box and Can view, Can export and Can edit buttons.](shots/en/manager/03-share-dialog.png)

The dialog also shows a notice when the map is public, with **Copy link**. Anyone with the link can view it. This dialog does not switch a map between public and private. That switch is on the map's **Properties** tab, and only someone who can edit the map may save it.

For a workbook, the same dialog fans one share out to every map you can see in it. It tells you which maps could not be shared.

---

# Map builder

Use the builder to make a map or change one. You reach it with **Create Map**, the Pencil icon, or by copying a map.

![The map builder with the Business Areas tree, the columns canvas and the Properties panel.](shots/en/user/05-builder-overview.png)

## What you may save

| Situation | Can you save? |
|---|---|
| A new map | Yes, if you hold a CREATE grant or higher on the business area. |
| A map you own | Yes. |
| A map shared with you at **Can edit** | Yes. |
| Any other map | No. Save fails with "Forbidden". Copy the map first, then edit your copy. |

The builder opens for every map, even one you cannot save. You only find out when you click **Save**.

## The toolbar

| Button or control | What it does |
|---|---|
| **Back** | Returns to the page you came from. Unsaved changes are lost without a warning. |
| Map name box | Sets the map name. |
| Map type list | **Table**, **Crosstab**, **Page-Detail** or **Chart**. Only **Crosstab** changes how the result looks. The others show as a plain table. |
| **● Unsaved** | Reminds you there are changes you have not saved. |
| **Run** | Saves the map if it is new or changed, then runs it. |
| **Save** | Saves your changes. Nothing saves by itself. |
| **Export** > **Map definition (.xml)** | Downloads the map definition. It holds no data rows. Needs a saved map. |
| **Schedule** | Opens **Schedules** with this map chosen. Needs a saved map. |
| **Formatting** | Opens conditional formatting. Needs a saved map. |
| **Share** | Opens **Share map**. Needs a saved map. |

## Build a map

1. In the **Business Areas** tree on the left, open a business area and a folder. Only areas where you hold a grant are listed.
2. Drag items onto the **Columns** canvas, or click the plus button next to an item. Measures have a sigma icon, dimensions a tag icon.
3. Every column of a map must come from one business area. The first column you add decides which one.
4. Click a column to open **Configure column**. Change what you need, then click **Save** in that dialog.
5. Add conditions, sorting and parameters on the right-hand tabs.
6. Click **Save** on the toolbar. Then click **Run**.

Use **Filter items…** above the tree to find an item by name.

## Configure column

| Field | What it does |
|---|---|
| **Display name** | Column heading. Blank uses the item name. |
| **Aggregation** | Total for this column. |
| **Sort direction** | **None**, **Ascending** or **Descending**. |
| **Format mask** | How numbers and dates look. **Presets** fills it for you. |
| **Sort order** | Position of this column when you sort by several. |
| **Column width (px)** | Width in pixels. |
| **Placement** | See below. |
| **Crosstab edge** | Where an axis column goes in a crosstab. |
| **Group and break** | Hides repeated values and starts a subtotal when the value changes. |
| **Query only, do not show** | The query uses the column, but the result hides it. |

| Option (**Placement**) | What it means |
|---|---|
| None | No special role. |
| Group by (axis) | The column groups the rows. |
| Measure | The column holds a value that is totalled. |
| Page item | The column becomes a page filter. |

| Option (**Crosstab edge**) | What it means |
|---|---|
| None | Not used in a crosstab. |
| Down the side | Values run down the left side. |
| Across the top | Values run across the top. |

| Option (**Presets**) | What it fills in |
|---|---|
| Number (1,234) | 999,999,999 |
| Decimal (1,234.00) | 999,999,999.00 |
| Currency ($1,234.00) | $999,999,999.00 |
| Percent (12.3%) | 990.0% |
| Date (DD-MON-YYYY) | DD-MON-YYYY |
| Date (YYYY-MM-DD) | YYYY-MM-DD |

## The five settings tabs

| Tab | What it is for |
|---|---|
| **Properties** | The **Description** printed above the results and on every export, the **Public (visible to everyone in the business area)** tick box, and counts. **Insert variable** adds values such as the run date. |
| **Conditions** | Filters. |
| **Sort** | Sort levels. |
| **Parameters** | Questions asked when the map runs. |
| **Calculated Fields** | New columns from a formula. |

> **Warning:** **Public** makes the map viewable and exportable by every signed-in person, not only people in the business area. Their data rights still apply.

**Conditions.** Click **Add Condition**. Choose the **Item**, an **Operator** and a value. Choose **Static value** for a fixed value, or **Prompt at runtime** to ask each time. For a prompt, give the parameter a name that you have defined on the **Parameters** tab. Select two or more conditions and click **Group** to join them with OR. Use **Ungroup** to undo it.

| Option (**Operator**) | What it means |
|---|---|
| = | Equal to. |
| <> | Not equal to. |
| < and > | Less than, greater than. |
| <= and >= | Less than or equal, greater than or equal. |
| LIKE | Matches a pattern with % and _. |
| IN | Matches any of a list, separated by commas. |
| BETWEEN | Between two values, low then high. |
| IS NULL | The value is empty. |

**Sort.** Choose a column, click **Add Sort**, then pick **Ascending** or **Descending**. Drag a level to change its priority.

**Parameters.** Click **Add Parameter**. Give it a unique name, a type and, if you like, a default. Tick **Required** to refuse a blank answer. If every parameter has a default, **Run** skips the question.

| Option (parameter type) | What it means |
|---|---|
| STRING | Text. |
| NUMBER | A number. |
| DATE | A date. |
| LIST | Several values separated by commas. |

**Calculated Fields.** Click **Add Calculated Field**, name it, then click the formula button. In the **Formula editor**, type a formula or click function and column buttons to insert them. **Test formula** runs it on the first five rows of a saved map. It needs a grant on the data.

## Conditional formatting

Click **Formatting** to colour cells or whole rows by a rule, for example red when a value is below zero. Rules are saved at once and are not part of **Save**. You need to own the map or hold **Can edit** on it to add or delete rules. Otherwise the system refuses with "Forbidden".

| Field | What it means |
|---|---|
| **Column** | The column to test. |
| **Apply to** | **Cell** or **Row**. |
| **Operator** | **Equals**, **Not equals**, **Greater than**, **Less than**, **Greater than or equal to**, **Less than or equal to**, **Like (% and _ wildcards)**, **In list**, **Between** or **Is empty**. |
| **Value** | What to compare with. Hidden for **Is empty**. |
| **Background color**, **Text color** | Colours. **Clear** removes one. |
| **Bold**, **Italic**, **Underline** | Text style. |

## Refused maps

Some map shapes are declined before they run, for example folders with no join, or totals that would be counted twice. An amber box explains why and what to change. Add a join, remove columns, or split the map in two.

---

# Map viewer

The viewer runs a map and shows its rows. It never changes the map. You reach it with the Eye icon, or from **Runs** and **Exports**.

![A completed run with Excel, CSV and PDF buttons over the results grid.](shots/en/viewer/06-viewer-results.png)

| Button or control | What it does |
|---|---|
| **Run** | Runs the map. If a parameter has no default, **Run parameters** opens first. |
| **Run again** | After a finished run, asks for a fresh run with the same values. |
| **Cancel** | Cancels a run that is still waiting in the queue. A run already in progress cannot be cancelled here. |
| **Schedule management** | Opens **Schedules**. |
| **Excel**, **CSV**, **PDF** | Export the finished result. |
| **Load more** | Loads the next 500 rows. |
| Header click | Sorts by that column. |
| **Filter…** under a header | Filters the rows already loaded. |
| Double-click a row | Opens **Drill to Detail**, the raw rows behind that row. |

The status line under **Run** says whether the result is fresh or was reused. A result stays valid for 24 hours. If you run the same map with the same values again in that time, you get the stored result. Use **Run again** to force a new one.

**Run** and **Export** need a grant on every folder of the map. Without it a red **Not entitled to run** box appears. Ask an administrator for the grant.

You do not see the **SQL** and **Plan** buttons. They are for administrators.

The **Run parameters** dialog asks one question per parameter. A red star marks a required one. Where the parameter feeds a filter on an item, a picker suggests the real values. It needs a grant on that area.

## Export to PDF

Click **PDF** to open **Export to PDF**.

| Field | What it means |
|---|---|
| **Paper size** | **A4**, **A3** or **Letter**. |
| **Orientation** | **Portrait** or **Landscape**. |
| **Columns** | Tick the columns to print. **Select all** and **Clear** toggle them all. |

Click **Export**. The map description prints at the top of the first page.

## Example: run and export GD_M.M10_V01.DIS

1. Open **Maps**, find **GD_M.M10_V01.DIS** and click the Eye icon.
2. Click **Run**. Answer the questions if any appear.
3. When the rows appear, click **Excel**.
4. Open **Exports** to download the file.

---

# Schedules

A schedule runs a map by itself on a timetable and stores the result. You see only your own schedules, even though you can schedule any map.

![The Schedules page with a paused schedule and its action icons.](shots/en/user/38-schedules-list.png)

To schedule a map you do not own, use the Calendar icon on the **Maps** page. The map list in the **New Schedule** dialog holds only your own maps and maps shared with you.

A schedule runs as you. Your business-area grants decide whether it can read the data.

| Button or control | What it does |
|---|---|
| **New Schedule** | Opens the dialog. |
| Row icon **Run now** | Runs it at once. Not available while paused. |
| Row icon **Pause** or **Enable** | Switches the schedule off or on. |
| Row icon **History** | Opens **Execution History**. |
| Row icon **Edit** | Changes the schedule. You cannot change its map. |
| Row icon **Delete** | Deletes the schedule and its history after you confirm. It cannot be undone. |

The **Status** column shows **Active** or **Paused**. The **Planner** column is filled by the migration. You cannot change it.

| Field in the dialog | What it means |
|---|---|
| **Map** | The map to run. |
| **Name** | The schedule name. |
| **Frequency** | See below. |
| **Timezone** | The clock the times use. Default UTC. |
| **Cron expression** | Shown for **Custom**. Five fields: minute, hour, day of month, month, day of week. |
| **Valid from** and **Valid until** | Optional dates. The schedule runs only in between. |
| **Output Format** | See below. |
| **Parameter presets** | The value used each time for every map parameter. |
| **Enabled** | Off means it never runs by itself. |

| Option (**Frequency**) | What it means |
|---|---|
| Daily (midnight) | Every day at 00:00. |
| Weekly (Sunday, midnight) | Every Sunday at 00:00. |
| Monthly (1st, midnight) | The first of each month at 00:00. |
| Custom | You write the cron expression. Example: `0 9 * * 1-5` is 09:00 on weekdays. |

| Option (**Output Format**) | What it means |
|---|---|
| Excel (.xlsx) | A spreadsheet. |
| CSV | A plain text table. The default. |

**Execution History** lists the last 50 results with **Executed**, **Status**, **Rows** and **Duration**. Each has **XLSX**, **CSV** and **PDF** buttons and an **Open** icon. Results are kept for 30 days. Then the export buttons disappear.

## Example: schedule a weekly run

1. On **Maps**, click the Calendar icon of the map.
2. Type a **Name**. Set **Frequency** to **Weekly (Sunday, midnight)**.
3. Choose your **Timezone** and **Output Format**.
4. Click **Save**.
5. Click the **Run now** icon to check it works. Then open **History**.

---

# Runs

**Runs** lists every run you requested, whether it is waiting, running or finished. It shows only your own runs, not other people's.

![The Runs page with map, status and kind filters and the list of runs.](shots/en/manager/10-runs.png)

| Button or control | What it does |
|---|---|
| **Map**, **Status**, **Kind** filters | Narrow the list. **Kind** is **Live** or **Scheduled**. |
| Map name | Opens the viewer. |
| **Open** icon | Opens the stored result of that run. |
| **Run again** icon | Requests the same run again. |
| **XLSX**, **CSV**, **PDF** | Export a finished run that has not expired. |
| **Cancel** icon | Cancels a run that is still queued. |
| **Delete** icon | Deletes a finished run and its stored rows. It cannot be undone. |

The **Expires in** column shows how long the result is kept. The **Show every user's runs** box is for administrators only, so you do not see it. A run of a map you can no longer open disappears from your list.

---

# Exports

**Exports** lists the files you asked for. You see your own only.

![The Exports page listing export jobs with a Download button on finished ones.](shots/en/user/44-exports.png)

| Button or control | What it does |
|---|---|
| **Download** icon | Downloads a finished file. |

The **Status** shows **Queued**, **Running**, **Completed** or **Failed**. Point at a failed status to read the reason. Files are kept for 7 days. After that the download fails. Export again from a fresh run.

---

# Settings

Open **Settings** from the sidebar or from your name menu. The choices are kept for your account on every computer, but only after you click **Save**.

![The Settings page with the Language, Theme and Color palette cards.](shots/en/common/04-settings.png)

| Control | What it does |
|---|---|
| **Display language** | **English**, **Português (Portugal)**, **Français (France)** or **Español (España)**. |
| **Appearance** | **Light**, **Dark** or **High contrast**. |
| **Palette** | **Classic**, **Navy**, **Forest**, **Wine**, **Ocean** or **Ochre**. Off while **High contrast** is on. |
| **Save** | Keeps your choices. |

If you leave without saving, this browser shows the new choice, but your account still holds the old one.

---

# Common questions

**Why do I see a map but the run says "Not entitled to run"?**
You see every map as a Manager. Its data needs a business-area grant on each folder it uses. Ask an administrator.

**Why is there no Pencil icon on a map?**
You may edit only your own maps and maps shared with you at **Can edit**. Click the Copy icon, then change your copy. Or ask the owner to share it with you at **Can edit**.

**Where are Business Areas, Folders, Items, Joins and Hierarchies?**
Changing the data model is for administrators only, so these pages are not in your sidebar. If a folder or item is wrong or missing, ask an administrator.

**I clicked something and got "Forbidden" or "Save failed".**
The screen offered it, but your role or grant does not allow it. The most common case is saving a map you do not own.

**I cannot see another person's runs, exports or schedules.**
Runs, exports and schedules belong to the person who made them. Nobody but that person sees them in the list, and the same is true for you.

**A colleague left. How do I keep their maps?**
Open **Users**, click **Maps this user can open**, then use the owner icon on each map to give it to someone else.

**A schedule I made does not run.**
Check that its **Status** is **Active**, that the dates in **Valid from** and **Valid until** cover today, and that you still hold a grant on the data. A schedule runs as you.

**My export download says it failed.**
Files are kept for 7 days. Run the map again and export the new result.

**I cannot change my password when I forget it.**
There is no reset link. Ask an administrator.

---

# Glossary

| Term | Meaning |
|---|---|
| Map | A report. In Oracle Discoverer this was a worksheet. |
| Workbook | A group of maps. |
| Business area | A group of related data. |
| Folder | One table, view or query inside a business area. |
| Item | One column of a folder. A dimension groups rows. A measure holds values that are totalled. |
| Join | The rule that connects two folders. |
| Hierarchy | An ordered list of items for drill-down. |
| Grant | Access to a business area given by an administrator, at a level. |
| Share | Access to one map given to one person, at a level: **Can view**, **Can export** or **Can edit**. |
| Public map | A map anyone signed in can view and export. Their data rights still apply. |
| Run | One execution of a map. Its rows are stored for 24 hours. |
| Export | A file (Excel, CSV or PDF) made from a finished run. |
| Schedule | A timetable that runs a map by itself and stores the result. |
| Data source | A saved connection to a database. |
| Custom function | A database function that calculated items can call. |
