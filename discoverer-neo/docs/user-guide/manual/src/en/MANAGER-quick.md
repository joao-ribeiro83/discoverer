# Your role in one page

You are a **Manager**. You see, run, export, schedule and share every map. You do not change the data model. That is an administrator's job.

| You can | You cannot |
|---|---|
| See, run, export and schedule every map | Change or delete a map you do not own (unless shared with you at **Can edit**) |
| Share any map and change any share | See SQL or the database plan |
| Copy any map to make your own | Create users, data sources or business areas, or give grants |
| Give a map to a new owner | See other people's runs, exports or schedules |
| Manage custom functions | Use Security, Audit Log or Migration |
| Read, test and introspect data sources | Import tables from a data source |
| Build maps on the business areas you hold a grant on | Change business areas, folders, items, joins or hierarchies |

> **Note:** **Business Areas**, **Folders**, **Items**, **Joins**, **Hierarchies**, **Security**, **Audit Log** and **Migration** are for administrators only. They are not in your sidebar.

Seeing a map does not give you its data. A run needs a business-area grant on every folder the map uses. Without one you get **Not entitled to run**.

Sign in with your **Email** and **Password**, then click **Sign in**. Sign out from your name menu with **Log out**.

---

# Maps

The **Maps** page lists every map. A map is a report (a worksheet in Oracle Discoverer).

![The Maps list, All tab, with Copy, Share, Schedule and Export icons on each row.](shots/en/manager/02-maps-all.png)

1. Choose a tab: **Mine**, **Shared with me** or **All**.
2. Narrow the list with **Search maps by name…** or the **Business Area** filter.
3. Click the Eye icon to open a map and run it.
4. Click the Copy icon to make your own copy. It is private to you.
5. Click the Share icon to give someone access.

| Icon | What it does |
|---|---|
| Pencil | Change the map. Only your own maps or **Can edit** shares. |
| Trash | Delete. Only your own maps. An administrator must restore it. |
| Calendar | Schedule this map. |

---

# Sharing a map

Sharing decides what another person may do with one map.

![The Share map dialog with a search box and Can view, Can export and Can edit buttons.](shots/en/manager/03-share-dialog.png)

1. Click the Share icon on the map.
2. Search for a person by name or email.
3. Click a level next to their name. The dark button is their current level.
4. Click the X next to a name to remove access.

| Level | What it means |
|---|---|
| **Can view** | Open and run only. |
| **Can export** | Also export and schedule. |
| **Can edit** | Also change the map. |

---

# Viewing, running and exporting

The viewer runs a map and shows its rows. It never changes the map.

![A completed run with Excel, CSV and PDF buttons over the results grid.](shots/en/viewer/06-viewer-results.png)

1. Open the map with the Eye icon.
2. Click **Run**. Answer the **Run parameters** questions if they appear.
3. Read the rows. Click a header to sort. Double-click a row to see its raw rows.
4. Click **Excel**, **CSV** or **PDF** to export.
5. Find the file later on **Exports**. Files are kept for 7 days.

A result stays valid for 24 hours. **Run again** forces a fresh run.

---

# Map builder

Use the builder to make or change a map. You can save a new map only with a CREATE grant on its business area. You can save an existing map only if you own it or hold **Can edit**. To change someone else's map, copy it first.

![The map builder with the Business Areas tree, the columns canvas and the Properties panel.](shots/en/user/05-builder-overview.png)

1. Click **Create Map**, or the Pencil icon on your own map.
2. Drag items from the **Business Areas** tree onto **Columns**. All columns must come from one business area.
3. Click a column to set its **Aggregation**, **Sort direction** or **Format mask**.
4. Use the tabs **Conditions**, **Sort**, **Parameters** and **Calculated Fields** if needed.
5. Click **Save**, then **Run**. Nothing saves by itself.

---

# Schedules

A schedule runs a map on a timetable and stores the result. You see only your own schedules.

![The Schedules page with a paused schedule and its action icons.](shots/en/user/38-schedules-list.png)

1. On **Maps**, click the Calendar icon of the map. To schedule someone else's map, use this icon.
2. Type a **Name**.
3. Choose **Frequency**, **Timezone** and **Output Format**.
4. Click **Save**.
5. Click **Run now** to test. Open **History** to see results.

| Choice | Meaning |
|---|---|
| **Daily (midnight)**, **Weekly (Sunday, midnight)**, **Monthly (1st, midnight)** | Ready-made timetables. |
| **Custom** | Your own five-field cron expression. |
| **Excel (.xlsx)**, **CSV** | Format of the stored result. |

The schedule runs as you, so your grants decide what data it reads.

---

# Runs and Exports

**Runs** lists your own runs. **Exports** lists your own export files. You do not see other people's.

![The Runs page with map, status and kind filters and the list of runs.](shots/en/manager/10-runs.png)

1. Click **Runs** to see waiting, running and finished runs.
2. Click the **Open** icon to see a stored result. Use **Run again** to repeat it.
3. Click **Cancel** on a queued run to stop it.
4. Click **Exports**, then the **Download** icon on a **Completed** row.

---

# Users

The **Users** page is read-only for you. You can list accounts and fix map access.

![The Maps dialog for a user, with share-level selects and owner and remove icons.](shots/en/manager/11-users-maps-dialog.png)

1. Click the row icon **Maps this user can open**.
2. To change a shared map, use the level list next to it.
3. To take a shared map away, click the X.
4. To hand a map over, click the owner icon and choose the **New owner**.

> **Warning:** The new owner can change, share and delete the map.

Creating, editing and deleting users is for administrators.

---

# Custom Functions and Data Sources

**Custom Functions** are database functions that calculated items can call. You have full rights. **Data Sources** are saved database connections. You can only look and test.

![The Custom Functions page with the list, Refresh all and New Function.](shots/en/manager/08-custom-functions.png)

1. On **Custom Functions**, click **New Function**.
2. Choose a **Data source**, type part of a name in **Find a function**, click **Search**.
3. Click a result to fill the dialog, then click **Save**.
4. Use **Refresh all** to re-read every function from Oracle.
5. On **Data Sources**, click **Test connection** to check a connection.

**New Data Source**, **Edit**, **Delete** and **Import** on a data source are for administrators. The system refuses them.

---

# Settings

Open **Settings** from the sidebar or your name menu.

![The Settings page with the Language, Theme and Color palette cards.](shots/en/common/04-settings.png)

1. Choose your **Display language**, **Appearance** and **Palette**.
2. Click **Save**. Without it the choice does not follow you to other computers.

To change your password, open `/change-password`. It needs at least 12 characters. There is no reset link. Ask an administrator if you forget it.
