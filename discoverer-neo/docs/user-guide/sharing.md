# Sharing Maps

Learn how to share maps with colleagues and manage permissions.

## Why Share Maps?

Share maps to:
- Collaborate on report development
- Give colleagues access to common queries
- Delegate maintenance to other users
- Build templates for team reuse

## Sharing a Map

### Who can share

- The map's **owner**
- A **MANAGER** — any map
- An **ADMIN** — any map

A user who received a map, even with EDIT, cannot pass it on.

### Step 1: Open the share window

1. Click **Maps**
2. Click the share icon on the map's row, or on a workbook to share every
   worksheet in it

### Step 2: Pick people and levels

The window lists every user. People who already have the map come first.

1. Type in the filter box to find someone (optional)
2. Click a level next to their name: **Can view**, **Can export** or
   **Can edit**. Hover a level to see what it allows.

The dark button is the level they have now. Click another level to change it.
Click **✕** to take the map away from them.

## Permission Levels

| Permission | View | Edit | Delete | Export | Run | Share |
|-----------|------|------|--------|--------|-----|-------|
| **VIEW** | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **EDIT** | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **EXPORT** | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |

- **VIEW** — Can see map definition and run it (read-only)
- **EDIT** — Can run, export, schedule and change the map (not share it)
- **EXPORT** — Can run the map, export results and schedule it
- **Owner** — You (can always modify, share, delete)

## Public vs. Private

Toggle **Public** to make a map discoverable to all users:

- **Private** (default) — Only shared with specific users
- **Public** — All authenticated users can see and run it

## Changing or Revoking Access

In the share window, click a different level to change it, or **✕** to
remove it. The change takes effect immediately.

An ADMIN or MANAGER can also do this from **Users** → the map icon on a
user's row. That list shows every map the user can open, with its owner.
There you can change a share's level, remove it, or give the map to a new
owner.

## Copying a Map

Anyone except a VIEWER can copy a map they can see: click the copy icon on
its row in **Maps**. The copy is yours, so you can change it. Running it still
needs a grant on the map's business area.

## Shared with Me

To see maps shared with you:

1. Click **Maps** in the sidebar
2. Click **Shared with Me** tab
3. Browse shared maps

You can:
- **View** — See the map definition
- **Run** — Execute the map with YOUR permissions in the business area
- **Export** — Save results to Excel/CSV (if EXPORT permission granted)
- **Edit** — Modify (if EDIT permission granted)

## Sharing Best Practices

### Naming Conventions

Use descriptive names for shared maps:
- ✓ "Weekly Sales Report - EMEA Region"
- ✗ "Report1"

### Permission Levels

Grant the minimum necessary permission:
- **VIEW** for read-only reports
- **EDIT** only to trusted colleagues who maintain the map
- **EXPORT** to users who need data but not map changes

### Documentation

Add descriptions to shared maps:
1. Edit the map
2. Update the **Description** field
3. Explain what the map shows, what parameters mean, data refresh schedule

**Example:**
```
Sales by Region Report

Shows total sales by region for the selected time period.
Parameters:
- start_date: Report start date (default: first day of current month)
- end_date: Report end date (default: today)

Updated daily at 9 AM UTC.
Contact: sales-analytics@example.com for questions.
```

### Version Control

For critical shared maps:
- Note version number in description
- When making major changes, increment version
- Inform users of breaking changes

## Sharing Across Business Areas

Only share maps in business areas where recipients have **VIEW** access:

- **If they lack VIEW:** They can't run the map even if shared
- **If they lack EDIT:** They can't modify it even with EDIT sharing

Contact your administrator to grant business area access first.

## Collaboration Workflow

**Scenario: Building a report together**

1. **User A** creates a map draft
2. **User A** shares with **User B** using **EDIT** permission
3. **User B** runs the map, suggests changes
4. **User A** edits the map
5. **User B** verifies changes
6. **User A** makes it **Public** or grants **VIEW-only** to larger team

## Troubleshooting

### "User not found"

- User doesn't exist in system
- Contact administrator to create user account

### "Insufficient permissions to run"

- You have EDIT sharing, but lack VIEW in the business area
- Contact administrator for business area access

### "Can't share with this user"

- User's role (e.g., VIEWER) may restrict certain actions
- Contact administrator

## What's Next?

- **[Scheduling Maps](scheduling.md)** — Automate shared report distribution
- **[Building Maps](building-maps.md)** — Create maps to share
- **[Admin Guide - Users](../admin-guide/user-management.md)** — Manage user accounts

---

**See Also:** [User Guide](../user-guide/), [API Reference - Shares](../api/endpoints.md#map-shares)
