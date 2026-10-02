# Your role in one page

You have the **USER** role. A **map** is a report. A **business area** is a group of related data.

| You can | You cannot |
|---|---|
| See your own, public and shared maps | See other people's private maps |
| Run maps, and export or schedule them when the share level allows | Export a map shared as **Can view** |
| Copy a map and edit your copy | Change maps you do not own, unless shared as **Can edit** |
| Create maps where you hold the create right | Create maps in other business areas |
| Share and delete your own maps | Share or delete other people's maps |
| Change your language and theme | Open administration pages |

Share levels: **Can view** = run only. **Can export** = run, export, schedule. **Can edit** = all of that plus change the map.

Sign in with **Email** and **Password**, then **Sign in**. A temporary password must be changed first (at least 12 characters). To leave, click your name, then **Log out**.

![The sign-in page with Email, Password, Remember me and the Sign in button.](shots/en/common/01-login.png)

---

# Dashboard

The first page after sign-in. It is read-only.

![The dashboard with summary cards and the Recent Maps list.](shots/en/user/45-dashboard.png)

1. Read **Total Maps** and **Total Executions** for a summary.
2. Read **Scheduled Maps** and **Scheduled Results** for your schedules. Click **View schedules** to open them.
3. Click a map in **Recent Maps** (your last 5) to open it in the builder.

---

# Maps

The list of your reports. Tabs: **Mine**, **Shared with me**, **All**.

![The Maps list, Mine tab, showing the action icons on the map row.](shots/en/user/03-maps-mine.png)

1. Search by name or pick a **Business Area**.
2. Click the eye icon to open the viewer.
3. Click the Copy icon to make your own copy.
4. Click the Share icon (your own maps) to give access.
5. Click **Create Map** to build a new one.

| Icon | Use |
|---|---|
| Eye | Open and run |
| Pencil | Edit (own or **Can edit**) |
| Copy | Your own copy |
| Share | Set **Can view**, **Can export**, **Can edit**, or **✕** to remove |
| Calendar | Schedule (own, **Can export**, **Can edit**) |
| Trash | Delete (own only, only an administrator can restore) |

---

# Run and export

The viewer runs a map and shows the rows.

![The map viewer after a completed run, with the results grid and export buttons.](shots/en/user/25-viewer-results.png)

1. Open the map with the eye icon.
2. Click **Run**. Fill in **Run parameters** if asked.
3. Read the results. Click a header to sort, double-click a row for **Drill to Detail**.
4. Click **Excel**, **CSV** or **PDF** to export.
5. Click **Run again** for fresh data. A result stays valid for 24 hours.

| Choice | Line |
|---|---|
| **PDF** dialog | Pick **Paper size** (A4, A3, Letter), **Orientation** and columns |
| **Not entitled to run** | You have no access to the data. Ask your administrator |
| **Forbidden** on export | The map is **Can view** only. Ask for **Can export** |

---

# Build and edit a map

Build a map from items of one business area. Only where you hold the create right.

![The map builder with the Business Areas tree, the columns canvas and the Properties panel.](shots/en/user/05-builder-overview.png)

1. Click **Create Map**.
2. Drag items from the **Business Areas** tree into **Columns**. The first item sets the business area.
3. Set filters in **Conditions**, sorting in **Sort**, prompts in **Parameters**.
4. Type a name and click **Save**. Nothing saves by itself.
5. Click **Run** to test.

| Tab | Use |
|---|---|
| **Properties** | Description and **Public** box (visible to every user) |
| **Conditions** | Filters, fixed or **Prompt at runtime** |
| **Sort** | Sort levels |
| **Parameters** | Values asked at run time |
| **Calculated Fields** | New column from a formula |

**Formatting** colours cells that meet a rule. It needs a saved map.

---

# Runs and Exports

**Runs** lists your runs. **Exports** lists your files.

![The Runs page with filters and the table of runs and their export buttons.](shots/en/user/41-runs.png)

1. Open **Runs** to see status, rows and **Expires in**.
2. Click **Open** to see a stored result, or **Run again**.
3. Click **XLSX**, **CSV** or **PDF** to download a result.
4. Open **Exports** and click **Download** for a finished file.

| Choice | Line |
|---|---|
| **Cancel** | Only for a queued run |
| **Delete** | Removes the run for good |
| Files | Kept 7 days |

![The Exports page listing export jobs with a Download button on finished ones.](shots/en/user/44-exports.png)

---

# Schedules

Runs a map by itself and stores the result on the server. Nothing is emailed.

![The New Schedule dialog with map, name, frequency, timezone and output format.](shots/en/user/32-schedule-new-dialog.png)

1. Click **New Schedule**, or the calendar icon on **Maps**.
2. Choose the **Map** (own, or shared as **Can export** or **Can edit**).
3. Type a **Name**.
4. Choose **Frequency**, **Timezone** and **Output Format**.
5. Fill in **Parameter presets**, then click **Save**.
6. Use **Run now**, **Pause**, **History** to manage it.

| Choice | Line |
|---|---|
| **Frequency** | **Daily**, **Weekly**, **Fortnightly**, **Monthly**, every 2, 3, 4 or 6 months, **Yearly**, with a **Time** and a day; or **Custom (cron)** |
| **Parameter presets** | **Fixed value**, or **Relative to the run date**: -1 **months**, **last day of that month** is the end of last month |
| **Output Format** | **Excel (.xlsx)** or **CSV** |
| Public map | Cannot be scheduled |

---

# Settings

Open **Settings** from the sidebar.

![The Settings page with the Language, Theme and Color palette cards.](shots/en/common/04-settings.png)

1. Pick a **Display language**.
2. Pick **Light**, **Dark** or **High contrast**.
3. Pick a **Palette** (not with **High contrast**).
4. Click **Save**. Without it the choice stays on this browser only.
