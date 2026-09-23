# Exporting Data

Learn how to download map results as Excel, CSV, or PDF files.

## Export Formats

| Format | Best For | Features |
|--------|----------|----------|
| **XLSX** (Excel) | Professional reports, analysis | Formatting, multiple sheets, charts |
| **CSV** (Comma-Separated Values) | Data integration, spreadsheets | Plain text, universal compatibility |
| **PDF** | Printing, sharing a fixed layout | Page setup (orientation, margins, header/footer) when the map defines one |

All three match what the screen shows: group breaks, subtotals and grand
totals are exported in the same order and with the same labels the results
grid draws.

## Exporting Results

### From Map Execution

1. Run a map and wait for it to reach **Completed**
2. Click **Excel**, **CSV**, or **PDF**
3. The export job is queued and will begin processing

### Why the Export Buttons Are Sometimes Missing

The export buttons export the **rows a run already saved** — they never
query the data source again. They only appear once a run exists for the
current parameters, that run is **Completed**, and its result has not yet
expired (see [Result Validity](executing-maps.md#result-validity)). A run
still **Queued** or **Running** has no rows yet, and an expired run's rows
are gone, so both hide the buttons. Click **Run again** to get a fresh,
exportable result.

A quick preview built in the map builder (before you save and run it
properly) is not saved either, so it has no export buttons for the same
reason.

### Download Status

You'll see a status panel showing:
- **Status** — PENDING, PROCESSING, COMPLETED, FAILED
- **File Size** — Once completed
- **Expires** — When the file will be deleted (default: 7 days)

Click **Download** when status is **COMPLETED**.

### Export Options

When exporting, you can choose:
- **All Rows** — Export all matching rows (same filters as map)
- **Current Page** — Export only visible rows
- **Include Formatting** — (XLSX only) Apply display formatting, colors

## File Storage

Exported files are stored temporarily:
- **Retention Period** — 7 days (configurable by administrator)
- **Location** — Server export directory
- **After Expiration** — Files are automatically deleted

## Large Exports

For very large result sets:

1. Exports run asynchronously in background
2. You can navigate away and return later
3. Check **Exports** section to see all pending/completed exports

**Tips for large exports:**
- Exports hold a database connection for their entire duration
- Multiple concurrent exports may be throttled to preserve performance
- Very large exports (millions of rows) may fail or time out
- Contact administrator to increase export limits if needed

## Handling Download Issues

### Browser Download Manager

Downloaded files appear in your browser's default download location:
- **Chrome/Firefox:** Check the Downloads folder
- **Safari:** Check the Downloads folder or notification
- **IE/Edge:** May open save dialog

### Export Failed

If status shows **FAILED**:
- Check error message (if displayed)
- Try exporting fewer rows (filter more)
- Contact administrator if persistent

### File Corruption

If downloaded file is corrupted:
- Try exporting again
- Use a different format (XLSX ↔ CSV)
- Check disk space on your computer

## Viewing Exported Files

### XLSX (Excel)

Open with:
- Microsoft Excel
- Google Sheets
- LibreOffice Calc
- Any spreadsheet application

**Features in XLSX:**
- Column headers from map display names
- Data types preserved (numbers, dates)
- Formatting applied (if "Include Formatting" selected)
- Large row counts supported (up to ~1 million per sheet)

### CSV

Open with:
- Spreadsheet applications (Excel, Sheets, Calc)
- Text editors (Notepad, VS Code)
- Data tools (Python, R, SQL)

**CSV Format:**
- Comma-delimited by default
- UTF-8 encoded
- Quoted values contain special characters
- Suitable for import into databases or scripts

### PDF

Open with any PDF reader, or print directly.

**PDF layout:**
- Bordered table matching the results grid, with the column headers repeated
  on every page
- Orientation, margins, and header/footer text come from the map's page
  setup when it defines one, and fall back to portrait A4 with plain margins
  otherwise — page setup has no authoring screen yet, so today this only
  applies to a map an administrator has set one for directly
- Paginates automatically once the rows no longer fit one page

## Sharing Exported Files

Once downloaded, exported files are no longer tied to Discoverer Neo:
- Email them to colleagues
- Upload to cloud storage
- Import into other systems
- Share via your organization's file system

## Performance Tips

1. **Filter First** — Apply conditions in map to reduce rows
2. **Limit Date Range** — Use date parameters to narrow results
3. **Exclude Large Text** — Remove wide text columns if not needed
4. **Schedule for Off-Peak** — Large exports run faster during slow periods

## What's Next?

- **[Scheduling Maps](scheduling.md)** — Automate export generation
- **[Sharing Maps](sharing.md)** — Share queries with colleagues
- **[Building Maps](building-maps.md)** — Optimize your map for export

---

**See Also:** [Executing Maps](executing-maps.md), [User Guide](../user-guide/)
