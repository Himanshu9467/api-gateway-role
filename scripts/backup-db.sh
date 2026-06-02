#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-backups}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ai_platform?schema=public}"
STAMP="$(date +%Y%m%d%H%M%S)"
FILE="${BACKUP_DIR}/ai_platform_${STAMP}.dump"

mkdir -p "$BACKUP_DIR"
if [ "${USE_DOCKER:-}" = "1" ]; then
  docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-ai_platform}" --format=custom > "$FILE"
elif command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" --format=custom --file="$FILE"
else
  echo "pg_dump not found. Install PostgreSQL client tools or run USE_DOCKER=1 scripts/backup-db.sh." >&2
  exit 1
fi
printf '%s\n' "$FILE"
