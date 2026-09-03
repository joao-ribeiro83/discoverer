<#
.SYNOPSIS
  Batch-drive DISCVR4\d4wkdmp.exe over every workbook in a live EUL, producing
  the reference corpus that diff-corpus.ts checks the parser against.

.DESCRIPTION
  Implements DISCOVERER_NEO_WORKSHEET_FIDELITY_PLAN.md section 2 literally -
  that recipe is not guessable, so nothing here should be "simplified" without
  re-reading it. Requires:
    - E:\claude\discoverer\DISCVR4 with the seven extra DLLs already in place
      (see the plan; this script does not install them).
    - A manifest at E:\claude\discoverer\d4dumps\_manifest.json, produced by
      `docker compose exec backend npx tsx src/scripts/list-eul-documents.ts
      <dataSourceId>` (stdout redirected to that file).
    - A plaintext password file, produced by
      `docker compose exec backend npx tsx
      src/scripts/export-datasource-password.ts <dataSourceId> eul-dump.pw`,
      which writes to the bind-mounted discoverer-neo\credentials\ directory.

  Idempotent / resumable: a workbook already dumped (d4dumps\<docId>.txt
  exists) is skipped unless -Force is given, so a killed run can just be
  re-invoked. Every attempt is appended to d4dumps\_dump-run-log.jsonl.

  The password is read once into memory and the on-disk file is deleted
  immediately after - "never leave it on disk" from the plan. If this script
  is interrupted, regenerate the password file before re-running.

.PARAMETER Limit
  Dump at most this many (still-undumped) workbooks. For a small validation
  run before committing to the full ~2.8h corpus.

.PARAMETER Force
  Re-dump workbooks that already have an output file.

.PARAMETER TimeoutSeconds
  Per-workbook wall clock budget. Measured throughput is ~18s; default gives
  ample margin before assuming a hang.
#>
param(
  [int]$Limit = 0,
  [switch]$Force,
  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'

$Discvr4      = 'E:\claude\discoverer\DISCVR4'
$OutDir       = 'E:\claude\discoverer\d4dumps'
$ManifestPath = Join-Path $OutDir '_manifest.json'
$PasswordPath = 'E:\claude\discoverer\discoverer-neo\credentials\eul-dump.pw'
$LogPath      = Join-Path $OutDir '_dump-run-log.jsonl'
$Exe          = Join-Path $Discvr4 'd4wkdmp.exe'
$TmpOut       = Join-Path $Discvr4 '_dump_tmp.txt'
# The manifest's `connect.sid` ('COSEC') doubles as the TNS alias - it is
# already defined in DISCVR4\tns\tnsnames.ora, verified working 2026-08-25.
$SidAlias     = $null

if (-not (Test-Path $ManifestPath)) {
  throw "manifest not found: $ManifestPath - generate it first (see script header)."
}
if (-not (Test-Path $PasswordPath)) {
  throw "password file not found: $PasswordPath - generate it first (see script header)."
}
if (-not (Test-Path $Exe)) {
  throw "d4wkdmp.exe not found at $Exe"
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$user = $manifest.connect.username
$SidAlias = $manifest.connect.sid
$owner = $manifest.owner
if (-not $user -or -not $SidAlias -or -not $owner) {
  throw 'manifest is missing connect.username / connect.sid / owner'
}

# Read once, delete immediately - see .DESCRIPTION.
$pw = (Get-Content $PasswordPath -Raw).Trim()
Remove-Item $PasswordPath -Force
Write-Host "password file consumed and deleted; $($manifest.documents.Count) workbook(s) in manifest"

# --- environment, exactly per the plan's section 2 recipe ------------------
$env:ORACLE_HOME = 'I:\orant'
$env:ORA_NLS33   = 'I:\orant\NLSRTL33\DATA'
$env:NLS_LANG    = 'PORTUGUESE_PORTUGAL.WE8ISO8859P1'
$env:TNS_ADMIN   = Join-Path $Discvr4 'tns'
$env:PATH        = "$Discvr4;I:\orant\BIN;$env:PATH"

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$connectArg = '"' + $user + '/' + $pw + '@' + $SidAlias + '"'

$todo = $manifest.documents
if (-not $Force) {
  $todo = $todo | Where-Object { -not (Test-Path (Join-Path $OutDir "$($_.docId).txt")) }
}
if ($Limit -gt 0) { $todo = $todo | Select-Object -First $Limit }

Write-Host "$($todo.Count) workbook(s) to dump (of $($manifest.documents.Count) total)"

$ok = 0
$failed = 0
$failures = @()
$i = 0
$overallStart = Get-Date

foreach ($doc in $todo) {
  $i++
  $docId = $doc.docId
  $docName = $doc.docName
  $finalOut = Join-Path $OutDir "$docId.txt"
  Remove-Item $TmpOut -Force -ErrorAction SilentlyContinue

  $nameArg = '"' + $docName + '"'
  $started = Get-Date
  $proc = $null
  $timedOut = $false
  $exitCode = $null
  $errorMessage = $null

  try {
    $proc = Start-Process -FilePath $Exe `
      -ArgumentList $nameArg, '_dump_tmp.txt', 'DB', $connectArg, $owner, '-f' `
      -WorkingDirectory $Discvr4 -NoNewWindow -PassThru
    $exited = $proc.WaitForExit($TimeoutSeconds * 1000)
    if (-not $exited) {
      $timedOut = $true
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    } else {
      $exitCode = $proc.ExitCode
    }
  } catch {
    $errorMessage = $_.Exception.Message
  }

  $elapsedMs = [int]((Get-Date) - $started).TotalMilliseconds
  $wroteOutput = Test-Path $TmpOut
  $bytes = 0
  if ($wroteOutput) { $bytes = (Get-Item $TmpOut).Length }

  # d4wkdmp can exit 0 while still writing a near-empty file on a lookup
  # failure, so "did it produce a real dump" is judged on content, not just
  # the exit code.
  $success = (-not $timedOut) -and (-not $errorMessage) -and $wroteOutput -and $bytes -gt 0

  if ($success) {
    Move-Item $TmpOut $finalOut -Force
    $ok++
  } else {
    $failed++
    $reason = if ($timedOut) { "timeout after ${TimeoutSeconds}s" }
              elseif ($errorMessage) { $errorMessage }
              elseif (-not $wroteOutput) { 'no output file produced' }
              else { "empty output (exit code $exitCode)" }
    $failures += [pscustomobject]@{ docId = $docId; docName = $docName; reason = $reason }
    Remove-Item $TmpOut -Force -ErrorAction SilentlyContinue
  }

  $logEntry = [ordered]@{
    ts = (Get-Date).ToString('o')
    docId = $docId
    docName = $docName
    success = $success
    exitCode = $exitCode
    elapsedMs = $elapsedMs
    bytes = $bytes
    timedOut = $timedOut
    error = $errorMessage
  }
  ($logEntry | ConvertTo-Json -Compress) | Add-Content -Path $LogPath

  $status = if ($success) { "OK ($([math]::Round($elapsedMs/1000,1))s, $bytes bytes)" } else { "FAILED ($reason)" }
  Write-Host "[$i/$($todo.Count)] $docId $docName -> $status"
}

$totalElapsed = (Get-Date) - $overallStart
Write-Host ''
Write-Host "done: $ok ok, $failed failed, $($totalElapsed.ToString('hh\:mm\:ss')) elapsed"
if ($failures.Count -gt 0) {
  Write-Host 'failures:'
  $failures | ForEach-Object { Write-Host "  $($_.docId) $($_.docName): $($_.reason)" }
}
