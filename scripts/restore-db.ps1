param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"
$databaseUrl = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://postgres:postgres@localhost:5432/ai_platform?schema=public" }

if ($env:USE_DOCKER -eq "1") {
  $containerFile = "/tmp/ai_platform_restore.dump"
  docker compose cp $BackupFile "postgres:$containerFile"
  docker compose exec -T postgres pg_restore -U $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }) -d $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "ai_platform" }) --clean --if-exists --no-owner $containerFile
  docker compose exec -T postgres rm -f $containerFile
} elseif (Get-Command pg_restore -ErrorAction SilentlyContinue) {
  pg_restore $databaseUrl --clean --if-exists --no-owner $BackupFile
} else {
  throw "pg_restore not found. Install PostgreSQL client tools or run `$env:USE_DOCKER='1'; .\scripts\restore-db.ps1 -BackupFile <file>"
}
