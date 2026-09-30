# Fills the table of contents in the role manuals (Word fields) and, with
# -Pdf <dir>, also exports each file to PDF for a visual check.
# Needs Microsoft Word on this machine.
#   pwsh scripts/update-docx-fields.ps1 [-Filter 'ADMIN*'] [-Pdf C:\tmp\pdf]
param([string]$Filter = '*', [string]$Pdf = '')

$dir = Join-Path $PSScriptRoot '..\docs\user-guide\manual' | Resolve-Path
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  Get-ChildItem $dir -Filter "Discoverer-Neo-$Filter.docx" | ForEach-Object {
    $doc = $word.Documents.Open($_.FullName)
    foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
    $doc.Fields.Update() | Out-Null
    $doc.Save()
    if ($Pdf) { $doc.SaveAs2((Join-Path $Pdf ($_.BaseName + '.pdf')), 17) }
    $doc.Close()
    "updated $($_.Name)"
  }
} finally { $word.Quit() }
