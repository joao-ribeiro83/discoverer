# Scheduling Maps

Learn how to automatically run maps on a schedule and receive results.

## What is Scheduling?

**Scheduling** runs a map automatically at specified times, stores results, and optionally sends notifications.

## Creating a Schedule

### Step 1: Open Map

1. Open the map you want to schedule
2. Click **Schedule** or **+ New Schedule**

### Step 2: Configure Schedule

Enter:

- **Schedule Name** — Descriptive name (e.g., "Daily Sales Report")
- **Description** — Optional notes
- **Cron Expression** — When to run (see examples below)
- **Parameters** — Fixed values (if map has parameters)
- **Status** — Active/Inactive toggle
- **Notification Email** — (Optional) Email when complete

### Cron Expressions

Cron expressions define the schedule using standard Unix format:

```
0 9 * * MON-FRI   →   Every weekday at 9:00 AM
0 0 * * *         →   Every day at midnight
0 */6 * * *       →   Every 6 hours
0 0 1 * *         →   First day of month at midnight
```

**Format:** `[minute] [hour] [day-of-month] [month] [day-of-week]`

| Field | Values | Example |
|-------|--------|---------|
| Minute | 0–59 | 0, 15, 30, 45 |
| Hour | 0–23 | 0 (midnight), 9 (9 AM), 18 (6 PM) |
| Day of Month | 1–31 | 1 (1st), 15 (15th) |
| Month | 1–12 or JAN-DEC | 1 (Jan), 6 (Jun) |
| Day of Week | 0–6 or SUN-SAT | 0 (Sun), 5 (Fri) |

**Common Expressions:**

| Schedule | Expression |
|----------|-----------|
| Every day at 9 AM | `0 9 * * *` |
| Weekdays at 8 AM | `0 8 * * MON-FRI` |
| Every Monday at 9 AM | `0 9 * * MON` |
| Every 4 hours | `0 */4 * * *` |
| First day of month | `0 0 1 * *` |
| Every 30 minutes | `*/30 * * * *` |

### Step 3: Set Parameters

If your map has parameters, enter fixed values:

- **Fixed Parameters** — Same value every run
- (Optional parameters without values use defaults)

**Example:** Daily sales report for Americas region:
- Parameter `region` = "AMERICAS"

### Step 4: Save Schedule

Click **Save Schedule**. The schedule becomes **Active** immediately (if enabled).

## Managing Schedules

### View Schedules

1. Click **Schedules** in the sidebar
2. See list of all your schedules with:
   - Schedule name and map
   - Next run time
   - Last run status
   - Active/Inactive toggle

### Edit Schedule

1. Click the schedule
2. Modify cron expression, parameters, or email
3. Click **Save**

Changes take effect immediately.

### Disable/Enable

Toggle the **Active** switch:
- **Off** — Schedule won't run
- **On** — Schedule runs on next interval

### Delete Schedule

1. Click schedule → **Delete**
2. Confirm deletion

The schedule is removed; past results remain available.

## Viewing Results

### From Schedules Page

1. Click a schedule
2. See **Execution History** showing:
   - Scheduled run date/time
   - Actual execution time (may differ slightly from cron)
   - Status (SUCCESS, FAILED, TIMEOUT)
   - Number of rows returned
   - Execution duration

### Download Results

Click a past execution to:
- View results (same table view as manual execution)
- Export to Excel or CSV

## Notifications

If you configured a **Notification Email**, you'll receive:

**On Success:**
```
Subject: [Discoverer Neo] Schedule Complete: Daily Sales Report
To: your-email@example.com

Your scheduled report "Daily Sales Report" completed successfully.
- Rows: 1,524
- Duration: 12 seconds
- View: [link to results]
```

**On Failure:**
```
Subject: [Discoverer Neo] Schedule Failed: Daily Sales Report
To: your-email@example.com

Your scheduled report "Daily Sales Report" failed.
- Error: Connection timeout
- Time: 2026-07-19 09:15:32 UTC
```

## Timezone Considerations

Cron expressions are evaluated in the **server's timezone** (UTC by default). If your server is in a different timezone, adjust expressions accordingly.

**Example:** To run at 9 AM EST (UTC-5):
- Use `0 14 * * *` (2 PM UTC = 9 AM EST in winter, 10 AM EDT in summer)

## Scheduled Export

Schedules create result files, not email attachments. To automate Excel export:

1. Create a schedule that captures results
2. Set notification email to alert when complete
3. Visit the schedule to download results as XLSX/CSV

## Limits and Considerations

- **Concurrent Runs** — Only one execution per schedule at a time
- **Long-Running Queries** — If a map takes > timeout, execution fails
- **Failed Schedules** — Failed runs don't retry automatically
- **Resource Usage** — Many concurrent schedules may impact system performance

## Troubleshooting

### Schedule Didn't Run

- Check if Active toggle is **On**
- Verify cron expression (use online cron validator)
- Check server logs for errors

### Wrong Execution Time

- Verify server timezone
- Confirm cron expression (minutes/hours might be reversed)

### Out of Memory Error

- Map is too large for scheduling
- Add more filters or parameters to reduce rows
- Contact administrator

## What's Next?

- **[Sharing Maps](sharing.md)** — Share scheduled reports with colleagues
- **[Exporting Data](exporting-data.md)** — Download scheduled results
- **[Building Maps](building-maps.md)** — Optimize maps for scheduling

---

**See Also:** [User Guide](../user-guide/), [API Reference - Schedules](../api/endpoints.md#schedules)
