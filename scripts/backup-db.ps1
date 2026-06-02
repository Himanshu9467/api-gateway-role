$ErrorActionPreference = "Stop"

$backupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { "backups" }
$databaseUrl = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://postgres:postgres@localhost:5432/ai_platform?schema=public" }
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$file = Join-Path $backupDir "ai_platform_$stamp.dump"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
if ($env:USE_DOCKER -eq "1") {
  $containerFile = "/tmp/ai_platform_backup.dump"
  docker compose exec -T postgres pg_dump -U $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }) -d $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "ai_platform" }) --format=custom --file=$containerFile
  docker compose cp "postgres:$containerFile" $file
  docker compose exec -T postgres rm -f $containerFile
} elseif (Get-Command pg_dump -ErrorAction SilentlyContinue) {
  pg_dump $databaseUrl --format=custom --file=$file
} else {
  throw "pg_dump not found. Install PostgreSQL client tools or run `$env:USE_DOCKER='1'; .\scripts\backup-db.ps1"
}
Write-Output $file
