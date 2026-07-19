# Sharing Maps

Learn how to share maps with colleagues and manage permissions.

## Why Share Maps?

Share maps to:
- Collaborate on report development
- Give colleagues access to common queries
- Delegate maintenance to other users
- Build templates for team reuse

## Sharing a Map

### Step 1: Open Map

1. Click **Maps** → select your map
2. Click **Share** or **Manage Sharing**

### Step 2: Add User

In the sharing panel:

1. Click **+ Add User** or **+ Grant Access**
2. Select a user from the list
3. Choose permission level (see below)
4. Click **Grant**

The user can now access the map with the selected permission level.

## Permission Levels

| Permission | View | Edit | Delete | Export | Run | Share |
|-----------|------|------|--------|--------|-----|-------|
| **VIEW** | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **EDIT** | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **EXPORT** | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |

- **VIEW** — Can see map definition and run it (read-only)
- **EDIT** — Can modify map and share it with others
- **EXPORT** — Can run map and export results
- **Owner** — You (can always modify, share, delete)

## Public vs. Private

Toggle **Public** to make a map discoverable to all users:

- **Private** (default) — Only shared with specific users
- **Public** — All authenticated users can see and run it

## Changing Permissions

To change a user's access level:

1. Find the user in the sharing list
2. Click the permission dropdown
3. Select new level
4. Changes take effect immediately

## Revoking Access

To remove a user's access:

1. Find the user in the sharing list
2. Click **Remove** or the trash icon
3. Confirm removal

The user loses access immediately.

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
