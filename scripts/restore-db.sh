#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/restore-db.sh <backup-file>" >&2
  exit 1
fi

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ai_platform?schema=public}"
if [ "${USE_DOCKER:-}" = "1" ]; then
  docker compose exec -T postgres pg_restore -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-ai_platform}" --clean --if-exists --no-owner < "$1"
elif command -v pg_restore >/dev/null 2>&1; then
  pg_restore "$DATABASE_URL" --clean --if-exists --no-owner "$1"
else
  echo "pg_restore not found. Install PostgreSQL client tools or run USE_DOCKER=1 scripts/restore-db.sh <backup-file>." >&2
  exit 1
fi
