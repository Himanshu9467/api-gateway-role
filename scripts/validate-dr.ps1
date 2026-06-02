param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,

  [string]$BackupFile = "backups/dr-validation.sql"
)

$ErrorActionPreference = "Stop"

if ($DatabaseUrl -notmatch "dr|test|validation|localhost") {
  throw "Refusing DR validation against a database URL that does not look disposable."
}

$env:DATABASE_URL = $DatabaseUrl

Write-Host "Creating backup at $BackupFile"
New-Item -ItemType Directory -Force -Path (Split-Path $BackupFile) | Out-Null
pg_dump $DatabaseUrl --file $BackupFile --clean --if-exists

Write-Host "Capturing integrity marker"
$before = psql $DatabaseUrl -t -A -c "select count(*) from `"Client`";"

Write-Host "Simulating database loss"
psql $DatabaseUrl -c "drop schema public cascade; create schema public;"

Write-Host "Restoring backup"
psql $DatabaseUrl --file $BackupFile

Write-Host "Verifying integrity marker"
$after = psql $DatabaseUrl -t -A -c "select count(*) from `"Client`";"

if ($before.Trim() -ne $after.Trim()) {
  throw "DR validation failed: client count changed from $($before.Trim()) to $($after.Trim())."
}

Write-Host "DR validation passed: client count $($after.Trim()) restored."
