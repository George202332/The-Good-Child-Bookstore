# Applies the waiting database updates (Prisma migrations) to the PRODUCTION database ONLY.
# Run it BEFORE merging staging into main, from the "staging" branch (that branch contains the new migration files).
#
# What it guarantees:
#  - runs only on the branch "staging" (or "main"), and shows which branch you are on
#  - does NOT read or download any Vercel / Preview settings
#  - asks you to paste the PRODUCTION connection string from Neon; what you paste is hidden, used for this one run only,
#    never saved to a file, never printed, never logged
#  - shows only the Neon endpoint NAME and database name, never the password
#  - REFUSES if the pasted address is the staging database
#  - lists the waiting migrations (read-only) and STOPS if any of them contains data-destroying statements
#  - needs you to type YES (capital letters) before anything changes
#  - uses "prisma migrate deploy" only (never reset, never dev, never db push)
#  - clears the pasted value at the end
#
# Run from the folder that contains package.json (the "bookstore" folder):
#   powershell -ExecutionPolicy Bypass -File scripts\migrate-production.ps1

$ErrorActionPreference = "Continue"
$StagingEndpoint = "ep-royal-unit-ax5doypv"
$dbUrl = $null
$failed = $false

function Stop-Here($message) {
  Write-Host ""
  Write-Host "STOPPED: $message" -ForegroundColor Red
  Write-Host "Nothing was changed." -ForegroundColor Yellow
  $script:failed = $true
}

try {
  # ---- 1. folder and branch ----
  if (-not (Test-Path "package.json") -or -not (Test-Path "prisma\schema.prisma") -or -not (Test-Path "prisma\migrations")) {
    Stop-Here "This is not the project folder. Open the terminal in the folder that contains package.json and the prisma folder (the 'bookstore' folder), then run again."
    return
  }
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  Write-Host "You are on the branch: $branch"
  if ($branch -ne "staging" -and $branch -ne "main") {
    Stop-Here "This must be run from the branch 'staging' (before the merge) or 'main' (after the merge). Run: git checkout staging   and then run this again."
    return
  }
  if ($branch -eq "main") {
    Write-Host "Note: on 'main' before the merge, the new migration files are not there yet, so there is nothing new to apply. For the launch you want 'staging'." -ForegroundColor Yellow
  }
  $dirty = git status --porcelain prisma
  if ($dirty) {
    Write-Host "Warning: there are unsaved changes inside the prisma folder. Commit or undo them first." -ForegroundColor Yellow
  }

  # ---- 2. the production address, hidden ----
  Write-Host ""
  Write-Host "In Neon, open your PRODUCTION branch (not 'backup-before-launch', not the staging branch) and click Connect."
  Write-Host "Copy the connection string and paste it below. You will not see it appear. It is used for this one run and never saved."
  $secure = Read-Host "Paste the PRODUCTION connection string, then press Enter" -AsSecureString
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $typed = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  $secure = $null
  $found = [regex]::Match($typed, "postgres(ql)?://[^\s'""]+")
  $typed = $null
  if (-not $found.Success) {
    Stop-Here "That does not look like a database address (it should contain postgresql://). Copy the whole string from Neon's Connect screen."
    return
  }
  $dbUrl = $found.Value
  # Database updates must use the direct address, not the pooled one (the pooled one can stall).
  $dbUrl = $dbUrl -replace "-pooler\.", "."

  try { $uri = [System.Uri]$dbUrl } catch { Stop-Here "That address could not be read. Copy the whole string again."; return }
  $endpoint = ($uri.Host.Split(".")[0])
  $dbName = $uri.AbsolutePath.TrimStart("/")

  Write-Host ""
  Write-Host "================ The database this will change ================"
  Write-Host "   Neon endpoint name : $endpoint"
  Write-Host "   Database name      : $dbName"
  Write-Host "==============================================================="
  Write-Host ""

  # ---- 3. refuse the wrong databases ----
  if ($endpoint -eq $StagingEndpoint) {
    Stop-Here "That is the STAGING database ($StagingEndpoint), not production. Copy the string from the PRODUCTION branch in Neon."
    return
  }
  if ($endpoint -match "stag" -or $endpoint -match "backup" -or $dbName -match "stag" -or $dbName -match "backup") {
    Stop-Here "The name looks like a staging or backup database. Use the PRODUCTION branch."
    return
  }
  Write-Host "Important: a backup branch ('backup-before-launch') is a copy of production and its address looks just like production's." -ForegroundColor Yellow
  Write-Host "I cannot tell them apart from the address alone, so please check in Neon: the branch you copied from must be named PRODUCTION (usually 'production' or 'main'), and its endpoint name must be exactly: $endpoint"
  $retype = Read-Host "Type that endpoint name here to confirm you checked it"
  if ($retype.Trim() -cne $endpoint) {
    Stop-Here "What you typed does not match the endpoint name shown above."
    return
  }

  $env:DATABASE_URL = $dbUrl
  Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue

  # ---- 4. read-only look at what is waiting ----
  Write-Host ""
  Write-Host "Step 1 of 3: which database updates are waiting (this only reads)..."
  $statusText = (npx prisma migrate status 2>&1 | Out-String)
  Write-Host $statusText

  if ($statusText -match "failed to apply" -or $statusText -match "have failed" -or $statusText -match "P3009") {
    Stop-Here "A previous database update failed part-way on production. Do NOT continue. Send me the screenshot above."
    return
  }
  if ($statusText -match "absent from the local migrations directory" -or $statusText -match "not found locally" -or $statusText -match "applied to the database but") {
    Stop-Here "Production has database updates that this branch does not have. You are probably on the wrong or an old branch. Run: git checkout staging ; git pull origin staging   and try again."
    return
  }
  if ($statusText -match "Database schema is up to date") {
    Write-Host "Production already has every update. Nothing to do." -ForegroundColor Green
    return
  }

  $waiting = @()
  $collect = $false
  foreach ($line in ($statusText -split "`r?`n")) {
    if ($line -match "have not yet been applied" -or $line -match "has not yet been applied") { $collect = $true; continue }
    if ($collect) {
      $t = $line.Trim()
      if ($t -match "^\d{14}_") { $waiting += $t } elseif ($t -ne "") { $collect = $false }
    }
  }
  if ($waiting.Count -eq 0) {
    Stop-Here "I could not read the list of waiting updates from the output above. Send me the screenshot."
    return
  }

  Write-Host "Waiting for production ($($waiting.Count)):" -ForegroundColor Cyan
  foreach ($w in $waiting) { Write-Host "   $w" }

  # ---- 5. destructive check ----
  $bad = @()
  $pattern = "(?i)\b(DROP\s+(TABLE|COLUMN|SCHEMA|DATABASE|TYPE)|TRUNCATE|DELETE\s+FROM)\b|ALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE"
  foreach ($w in $waiting) {
    $file = Join-Path "prisma\migrations" (Join-Path $w "migration.sql")
    if (-not (Test-Path $file)) { $bad += "$w : the migration file is missing in this folder"; continue }
    $n = 0
    foreach ($sql in (Get-Content $file)) {
      $n++
      $code = ($sql -replace "--.*$", "")
      if ($code -match $pattern) { $bad += "$w line ${n}: " + $code.Trim() }
    }
  }
  if ($bad.Count -gt 0) {
    Write-Host ""
    Write-Host "These waiting updates contain statements that can DELETE data:" -ForegroundColor Red
    foreach ($b in $bad) { Write-Host "   $b" -ForegroundColor Red }
    Stop-Here "A waiting update could destroy data. Do not continue. Send me this screenshot and I will check it with you."
    return
  }
  Write-Host "Safety check: none of the waiting updates drops tables or columns, truncates, or deletes rows." -ForegroundColor Green

  # ---- 6. last confirmation, then apply ----
  Write-Host ""
  Write-Host "Reminder: your Neon backup branch 'backup-before-launch' must exist. This changes the PRODUCTION database ($endpoint)." -ForegroundColor Yellow
  $answer = Read-Host "Type YES (capital letters) to apply these updates to PRODUCTION"
  if ($answer -cne "YES") {
    Stop-Here "You did not type YES."
    return
  }

  Write-Host ""
  Write-Host "Step 2 of 3: applying (prisma migrate deploy)..."
  npx prisma migrate deploy
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    $script:failed = $true
    Write-Host ""
    Write-Host "THE UPDATE DID NOT FINISH. Do NOT run it again blindly." -ForegroundColor Red
    Write-Host "1. Take a photo of the red text above and send it to me."
    Write-Host "2. Your data is safe in the backup. If we decide to go back: in Neon open Branches, click your production branch,"
    Write-Host "   choose Restore, pick 'backup-before-launch' as the source, and confirm. Do not do this until we have talked."
    return
  }

  Write-Host ""
  Write-Host "Step 3 of 3: checking the result..."
  npx prisma migrate status
  Write-Host ""
  Write-Host "SUCCESS if you see 'Database schema is up to date!' above. Production now has every update." -ForegroundColor Green
  Write-Host "Next: merge staging into main, then watch the production deployment in Vercel."
}
finally {
  $dbUrl = $null
  $found = $null
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue
  [System.GC]::Collect()
  Write-Host ""
  Write-Host "(The pasted address was cleared from memory. No file was created.)"
}
