# Getting Started with Discoverer Neo

Learn how to log in and navigate the Discoverer Neo interface.

## Accessing Discoverer Neo

1. Open your browser and navigate to the Discoverer Neo URL (e.g., `http://localhost:5173` for development)
2. You should see the login screen

## Logging In

**Login Screen:**
- **Email:** Your email address
- **Password:** Your password (provided by your administrator)

Enter your credentials and click **Sign In**.

**First Time?** Contact your administrator to create an account.

## First login with a temporary password

If your account was moved over from Oracle Discoverer, your administrator will
give you a **temporary password**. It is a random 16-character string, for
example `ufNnRksjgR7U%M6X`.

1. Sign in with your email address and the temporary password.
2. You are taken straight to **Change your password** — you cannot skip this.
   Until you choose a password, the rest of the application is unavailable.
3. Enter the temporary password once more, then your new password twice.
4. You land on the dashboard, and your temporary password stops working
   immediately.

Your new password must be **at least 12 characters** and different from the
temporary one.

> **Tip:** the temporary password deliberately avoids characters that are easy
> to confuse — no capital `O` or zero, no lower-case `l` or one. If a character
> looks ambiguous, it is not one of those.

If you mistype the temporary password the screen says so and nothing changes;
ask your administrator to reset it if you have lost it.

## Main Interface

After logging in, you'll see the main dashboard with the following sections:

### Navigation

**Left Sidebar:**
- **Dashboard** — Overview and quick actions
- **Business Areas** — Organized collections of data
- **Maps** — Every map you can reach: yours, shared with you, or (per your
  permissions) the whole estate
- **Settings** — Customize language and theme preferences
- **Admin** (if you have admin privileges) — System management

### Dashboard

The dashboard displays:
- **Total Maps** — Every map you can see (yours, and shared with you)
- **Total Executions** — How many times you've run a query, across every map you can see
- **Scheduled Maps** — How many of your schedules are active
- **Scheduled Results** — How many results your schedules have produced
- **Recent Maps** — Your last 5 updated maps, if you own any

## Exploring Business Areas

A **Business Area** is a logical grouping of related data and queries.

1. Click **Business Areas** in the sidebar
2. You'll see a list of areas you have access to
3. Click on a business area to explore its contents:
   - **Folders** — Tables/views available in this area
   - **Items** — Columns/fields within folders
   - **Joins** — Relationships between folders
   - **Existing Maps** — Queries already built for this area

## Your Maps

### View Your Maps

1. Click **Maps** in the sidebar
2. Three tabs let you switch scope:
   - **Mine** — Maps you created
   - **Shared with me** — Maps others explicitly shared with you
   - **All** — Every map you're permitted to see, including ones migrated
     from Discoverer that nobody has shared or reassigned yet
3. Search by name, filter by business area, and sort by name or by when a map
   was last updated
4. Click **Create Map** to start a new one

### Create a New Map

See [Building Maps](building-maps.md).

### View Map Details

Click on any map to see:
- Map definition (selected items, filters, parameters)
- Execution history
- Sharing permissions

## Navigating Help

- **Hover over icons** for tooltips
- **Check for "?" icons** for field-specific help
- **See inline error messages** for validation feedback

## What's Next?

- **[Settings](settings.md)** — Customize language and theme
- **[Building Maps](building-maps.md)** — Create your first query
- **[Executing Maps](executing-maps.md)** — Run maps and view results
- **[Exporting Data](exporting-data.md)** — Download results as Excel or CSV
- **[Scheduling Maps](scheduling.md)** — Automate report generation

---

**See Also:** [User Guide](../user-guide/), [API Reference](../api/endpoints.md)
