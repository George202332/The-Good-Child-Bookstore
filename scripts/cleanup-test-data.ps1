# ONE-TIME CLEANUP of the test data in the PRODUCTION database. It DELETES rows, so read the screen at each step.
# Same safety as migrate-production.ps1: hidden paste of the production address (never saved or printed), endpoint-name box,
# refuses the staging endpoint, asks for proof that the backup branch exists, then the script itself lists the exact counts and
# needs you to type DELETE TEST DATA. Everything is deleted in ONE transaction: if anything fails, nothing is changed.
# Run from the folder that contains package.json (the "bookstore" folder):
#   powershell -ExecutionPolicy Bypass -File scripts\cleanup-test-data.ps1

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
  if (-not (Test-Path "scripts\cleanup-test-data.ts")) {
    Stop-Here "scripts\cleanup-test-data.ts is missing. Unzip the latest update over the project first."
    return
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
  Write-Host "================ The database this will CLEAN (test data is deleted) ================"
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
  Remove-Item Env:DATABASE_LABEL -ErrorAction SilentlyContinue
  Write-Host ""
  Write-Host ""
  Write-Host "BEFORE ANYTHING IS DELETED: in Neon, open your PRODUCTION branch, create a child branch from it and name it exactly:  backup-before-cleanup" -ForegroundColor Yellow
  Write-Host "(Branches > production > Create branch > name it backup-before-cleanup > create from the current data.)"
  $b = Read-Host "Type BACKUP EXISTS (capital letters) once that branch is created"
  if ($b -cne "BACKUP EXISTS") {
    Stop-Here "You did not confirm the backup branch."
    return
  }
  Write-Host ""
  Write-Host "Step 1: the cleanup script will now list exactly what it will delete and what it keeps. Read it, then it asks you to type DELETE TEST DATA."
  Write-Host ""
  npx tsx scripts/cleanup-test-data.ts
  if ($LASTEXITCODE -ne 0) {
    $script:failed = $true
    Write-Host ""
    Write-Host "THE CLEANUP STOPPED. Nothing was changed (the delete is one all-or-nothing statement)." -ForegroundColor Red
    Write-Host "Take a photo of the red text above and send it to me."
    return
  }
  Write-Host ""
  Write-Host "Step 2: running the report again to show the result (read only)..."
  Write-Host ""
  npx tsx scripts/report-cleanup.ts
  Write-Host ""
  Write-Host "Finished. To undo everything: in Neon, Branches, open the production branch, choose Restore, pick backup-before-cleanup as the source, confirm." -ForegroundColor Green
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
