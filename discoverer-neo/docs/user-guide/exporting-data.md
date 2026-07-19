# Exporting Data

Learn how to download map results as Excel or CSV files.

## Export Formats

| Format | Best For | Features |
|--------|----------|----------|
| **XLSX** (Excel) | Professional reports, analysis | Formatting, multiple sheets, charts |
| **CSV** (Comma-Separated Values) | Data integration, spreadsheets | Plain text, universal compatibility |

## Exporting Results

### From Map Execution

1. After executing a map, click the **Export** button
2. Choose format: **XLSX** or **CSV**
3. Click **Export**

The export job is queued and will begin processing.

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
