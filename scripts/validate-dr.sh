#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${1:-}"
BACKUP_FILE="${2:-backups/dr-validation.sql}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "Usage: scripts/validate-dr.sh <database-url> [backup-file]" >&2
  exit 2
fi

if [[ ! "$DATABASE_URL" =~ (dr|test|validation|localhost) ]]; then
  echo "Refusing DR validation against a database URL that does not look disposable." >&2
  exit 3
fi

mkdir -p "$(dirname "$BACKUP_FILE")"
echo "Creating backup at $BACKUP_FILE"
pg_dump "$DATABASE_URL" --file "$BACKUP_FILE" --clean --if-exists

echo "Capturing integrity marker"
before="$(psql "$DATABASE_URL" -t -A -c 'select count(*) from "Client";')"

echo "Simulating database loss"
psql "$DATABASE_URL" -c "drop schema public cascade; create schema public;"

echo "Restoring backup"
psql "$DATABASE_URL" --file "$BACKUP_FILE"

echo "Verifying integrity marker"
after="$(psql "$DATABASE_URL" -t -A -c 'select count(*) from "Client";')"

if [[ "$before" != "$after" ]]; then
  echo "DR validation failed: client count changed from $before to $after." >&2
  exit 1
fi

echo "DR validation passed: client count $after restored."
