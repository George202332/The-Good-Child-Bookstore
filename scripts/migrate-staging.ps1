# Applies pending database updates (Prisma migrations) to the STAGING database ONLY.
# Safe by design:
#  - it only runs on the "staging" git branch
#  - it pulls the Preview (staging) variables from Vercel into a local file that git ignores, and deletes that file at the end
#  - it NEVER prints the connection string or password; it shows only the Neon endpoint NAME and database name for you to compare
#  - it asks you to type YES twice before anything changes
#  - it uses "prisma migrate deploy" only (never reset)
# Run from the folder that contains package.json:
#   powershell -ExecutionPolicy Bypass -File scripts\migrate-staging.ps1
$ErrorActionPreference = "Stop"
$envFile = ".env.preview.local"

function Clean-Up {
  if (Test-Path $envFile) { Remove-Item -Force $envFile }
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue
}

try {
  if (-not (Test-Path "package.json") -or -not (Test-Path "prisma\schema.prisma")) {
    throw "This is not the project folder. Open the terminal in the folder that contains package.json and the prisma folder (the 'bookstore' folder), then run again."
  }
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -ne "staging") { throw "You are on the branch '$branch'. Run: git checkout staging   and then run this again." }
  Write-Host "Branch: staging (good)."

  Write-Host "Step 1: asking Vercel for the Preview (staging) settings..."
  npx vercel env pull $envFile --environment=preview --git-branch=staging --yes
  if (-not (Test-Path $envFile)) { throw "Vercel did not create the settings file. Run: npx vercel link   (then try again)." }

  $values = @{}
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*(DATABASE_URL|DIRECT_URL|PRODUCTION_DATABASE_ENDPOINT)\s*=\s*(.*)$') {
      $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
  }
  $dbUrl = $values["DATABASE_URL"]
  if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    Write-Host ""
    Write-Host "Vercel did not hand over the staging database address (normal when the variable is marked Sensitive)."
    Write-Host "In Neon, open the branch 'The Good Child Bookstore Staging' -> Connect, copy the connection string, and paste it below."
    Write-Host "What you paste is hidden and is used for this one command only; it is never saved."
    $secure = Read-Host "Paste the staging connection string, then press Enter" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $dbUrl = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $dbUrl = $dbUrl.Trim().Trim('"').Trim("'")
    if ($dbUrl -notmatch '^postgres(ql)?://') { throw "That does not look like a database address (it should start with postgresql://). Nothing was changed." }
  }
  # Database updates must use the direct address, not the pooled one (the pooled one can stall migrations).
  $dbUrl = $dbUrl -replace '-pooler\.', '.'
  $values["DATABASE_URL"] = $dbUrl

  $uri = [System.Uri]$values["DATABASE_URL"]
  $endpoint = ($uri.Host.Split(".")[0]) -replace "-pooler$", ""
  $dbName = $uri.AbsolutePath.TrimStart("/")
  Write-Host ""
  Write-Host "The database this will change:"
  Write-Host "   Neon endpoint name : $endpoint"
  Write-Host "   Database name      : $dbName"
  Write-Host ""
  if ($values.ContainsKey("PRODUCTION_DATABASE_ENDPOINT") -and $values["PRODUCTION_DATABASE_ENDPOINT"] -eq $endpoint) {
    throw "STOP: this is the PRODUCTION database. Nothing was changed. Fix the Preview DATABASE_URL in Vercel."
  }
  Write-Host "Check in Neon: open the branch 'The Good Child Bookstore Staging' -> Connection details. The host starts with the same endpoint name as above."
  $a = Read-Host "Is that the STAGING branch's endpoint name? Type YES to continue"
  if ($a -ne "YES") { throw "Cancelled. Nothing was changed." }

  $env:DATABASE_URL = $values["DATABASE_URL"]
  if ($values.ContainsKey("DIRECT_URL") -and $values["DIRECT_URL"]) { $env:DIRECT_URL = $values["DIRECT_URL"] }

  Write-Host ""
  Write-Host "Step 2: which database updates are still waiting (this only reads)..."
  npx prisma migrate status
  Write-Host ""
  $b = Read-Host "Apply the waiting updates to STAGING now? Type YES to continue"
  if ($b -ne "YES") { throw "Cancelled. Nothing was changed." }

  Write-Host "Step 3: applying..."
  npx prisma migrate deploy
  Write-Host ""
  Write-Host "Done. If you saw 'All migrations have been successfully applied', staging is up to date."
}
finally {
  Clean-Up
  Write-Host "(The temporary settings file was deleted.)"
}
