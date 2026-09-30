# Your role in one page

You are an **administrator**. You can use every page. A **map** is a report (in Oracle Discoverer, a worksheet). A **business area** is a group of related data.

| You can | You cannot |
|---|---|
| Open, change, share, copy and delete every map | Delete or deactivate your own account |
| Build maps anywhere, without a grant | Download another user's export |
| See SQL and plan of a map | See other users' schedules in the list |
| See every user's runs | |
| Set up business areas, folders, items, joins, hierarchies, functions, data sources | |
| Manage users, grants, security policies | |
| Read the audit log and run migrations | |

**Sign in:** type **Email** and **Password**, click **Sign in**. Sign out from your name menu with **Log out**. **Settings** (language, theme, palette) needs **Save** to stick.

![The sign-in page with Email, Password, Remember me and the Sign in button.](shots/en/common/01-login.png)

---

# Dashboard and Maps

The **Dashboard** counts maps, runs and your schedules. **Maps** lists every map in the system.

![The Maps list, All tab, with every row icon and the Workbooks section above.](shots/en/admin/02-maps-all.png)

1. Open **Maps**. Use the tabs **Mine**, **Shared with me**, **All**.
2. Find a map with the search box or the **Business Area** filter.
3. Click the Eye icon to run it, the pencil to change it.
4. Click the Share icon to give access.
5. Click the Trash icon to delete (only an administrator can restore).

| Choice | Meaning |
|---|---|
| **Can view** | Open and run only. |
| **Can export** | Also export and schedule. |
| **Can edit** | Also change the map. Cannot re-share. |
| Copy icon | Your own private copy. |

---

# Map builder and viewer

The builder makes a map. The viewer runs it.

![Run results with the SQL and Plan buttons beside the Excel, CSV and PDF buttons.](shots/en/admin/03-viewer-results.png)

1. Click **Create Map**.
2. Drag items from the **Business Areas** tree onto the canvas. The first item fixes the business area.
3. Click a column to set **Aggregation**, sort or format.
4. Add **Conditions**, **Parameters** or **Calculated Fields** in the right tabs if needed.
5. Click **Save**, then **Run**.
6. Export with **Excel**, **CSV** or **PDF**. You also see **SQL** and **Plan**.

| Choice | Meaning |
|---|---|
| **Public** (Properties) | Every signed-in user can open and export it. |
| **Aggregation** | NONE, SUM, COUNT, AVG, MIN, MAX. |
| **Run again** (viewer) | New run, skips the stored result. |
| **PDF** | Choose paper (A4, A3, Letter) and orientation. |

---

# Runs, Exports and Schedules

A **run** is one execution of a map (kept 24 hours). An **export** is a file made from a run (kept 7 days). A **schedule** runs a map by itself.

![The Runs page with every user's runs shown.](shots/en/admin/04-runs-every-user.png)

1. In **Runs**, tick **Show every user's runs** to see everyone's.
2. Click **Open** to see a result, or **XLSX**, **CSV**, **PDF** to export it.
3. In **Exports**, click the Download icon. You see only your own files.
4. In **Schedules**, click **New Schedule**. Pick the map, **Frequency**, **Timezone** and **Output Format**. Click **Save**.
5. Use **History** to open or export past results.

| Choice | Meaning |
|---|---|
| **Frequency** | **Daily (midnight)**, **Weekly (Sunday, midnight)**, **Monthly (1st, midnight)**, **Custom** (cron). |
| **Output Format** | **Excel (.xlsx)** or **CSV**. |
| **Run now** | Runs a schedule at once. |

---

# Business Areas and Grants

A business area groups folders. A **grant** gives a person access to its data. A grant never shows a map.

![The Manage grants dialog with the Permission list open.](shots/en/admin/09-business-areas-grants-permission.png)

1. Open **Business Areas**. Click **New Business Area**, type a **Name**, click **Save**.
2. Click the **Manage grants** icon.
3. Tick the people. Choose **Permission**. Click **Add**.
4. Click **Revoke** to take a grant away.

| Level | Meaning |
|---|---|
| VIEW | Read data, run shared maps. |
| EXPORT, SCHEDULE | Same as VIEW. Rights come from the map's share. |
| CREATE | Also create maps, folders, items, joins, hierarchies. |
| EDIT | Also change the area and its objects. |
| DELETE | Also delete those objects. |

A Manager never changes the model. For a Manager, CREATE and above only let them create maps.

---

# Folders, Items, Joins, Hierarchies

A **folder** is a table or view. An **item** is a column. A **join** connects two folders. A **hierarchy** is a drill-down list.

![The New Folder dialog after Discover Tables, listing the tables found.](shots/en/admin/14-folders-discovered.png)

1. Choose a business area in **Folders**. Click **New Folder**.
2. Choose the **Data Source**, click **Discover Tables**, click a table.
3. Tick the columns to create as items. Click **Save**.
4. In **Joins**, click **New Join**. Choose two folders, click **Suggest Joins**, choose a **Join Type**. Click **Save**.
5. In **Hierarchies**, click **New Hierarchy**, add levels top to bottom. Click **Save**.
6. Use **Refresh all** to re-read tables after the database changed.

| Choice | Meaning |
|---|---|
| **Folder Type** | TABLE, VIEW, DERIVED, COMPLEX, JOIN, SUMMARY. |
| **Join Type** | INNER, LEFT, RIGHT. |
| **Item Type** | Database (CO), Created (CI), Calculated (CU), Join (JI), Hierarchy (HI), Aggregation (AG), Function (FU). |

---

# Custom Functions and Data Sources

A **data source** is a saved database connection. A **custom function** is an Oracle function that calculated items can call.

![The Data Sources page with a table of connections and five row icons.](shots/en/admin/30-data-sources.png)

1. In **Data Sources**, click **New Data Source**. Fill **Name**, **Connection Type**, **Host**, **Port**, **Username**, **Password**. Click **Save**.
2. Click **Test connection**.
3. Click **Import tables** to make many folders at once.
4. In **Custom Functions**, click **New Function**. Choose the data source, search Oracle, click a result. Click **Save**.

| Choice | Meaning |
|---|---|
| **Connection Type** | **Oracle** or **PostgreSQL**. |
| **Function Type** | SQL, PLSQL, PACKAGE. |
| **Refresh all** | Re-reads functions from Oracle. |

---

# Users

Add people, set roles, switch accounts off, hand maps to others.

![The Users page with the Credentials file and New User buttons and row icons.](shots/en/admin/35-users.png)

1. Click **New User**. Type **Name**, **Email**, **Password** (8 or more), choose **Role**. Click **Save**.
2. Click **Credentials file** to give temporary passwords to migrated accounts. Hand each person only their line.
3. Click the **Maps this user can open** icon to see what they see. Change a share level or give a map to a **New owner**.
4. To stop access, click **Deactivate**. Click **Activate** to undo.

| Choice | Meaning |
|---|---|
| ADMIN | Everything. |
| MANAGER | Sees, runs, exports, schedules and shares every map. Never changes the data model. |
| USER | Own, public and shared maps. |
| VIEWER | Like USER, but cannot copy maps. |
| **Deactivate** | Keeps the account. Reversible. |
| **Delete** | Removes the account for good. Cannot be undone. |

---

# Security Policies and Audit Log

A **policy** filters which rows people see. The **Audit Log** shows who did what.

![The New Policy dialog with a name, description and one rule.](shots/en/admin/44-security-new-dialog.png)

1. In **Security**, click **New Policy**. Type a **Name**.
2. Choose **Applies to** (**Business Area** or **Folder**) and the target.
3. Type the **SQL predicate**, for example `{alias}.REGION = 'NORTH'`. Click **Validate**. Click **Save**.
4. Click the **Assignments** icon. Choose **User** or **Role**. Click **Assign**.
5. In **Audit Log**, filter by **User**, **Action** or **From**/**To**. Click a **View details** icon for the full entry.

> **Warning:** A folder with no policy follows an installation setting. In **closed** mode (the default) nobody sees its rows, you included. In **open** mode everyone with a grant sees all rows.

---

# Migration

**Migration** imports an Oracle Discoverer EUL (its stored business areas, folders, workbooks and users). It writes a lot into this database.

![The Migration page with the Source card, its buttons and help text.](shots/en/admin/50-migration.png)

1. Register the Oracle connection in **Data Sources**.
2. In **Migration**, choose the **Oracle data source**. Click **Detect version**, then **Analyze**.
3. Leave **Dry run** ticked. Click **Run dry run**. Read the report and log.
4. Untick **Dry run** and click **Run migration**.
5. In **Users**, click **Credentials file** so migrated people can sign in.
6. Move maps from "Migrated Workbooks" to the right business area.

| Choice | Meaning |
|---|---|
| **Re-import maps** | Rebuilds maps only. Replaces every map in "Migrated Workbooks". Edits, schedules and shares of those maps are lost. |
| **Re-import everything** | Rewrites what differs. Deletes nothing. Keeps ids, schedules, shares. |
| **Compile calculated fields** | Use if a map says a field "has not compiled". |

> **Warning:** Always do a dry run first.
