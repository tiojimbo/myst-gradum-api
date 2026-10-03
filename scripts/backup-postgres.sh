#!/usr/bin/env bash

set -Eeuo pipefail

: "${BACKUP_PATH:?BACKUP_PATH is required}"
: "${BACKUP_RETENTION_DAYS:?BACKUP_RETENTION_DAYS is required}"
: "${POSTGRES_CONTAINER:?POSTGRES_CONTAINER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"

if ! [[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]] || ((BACKUP_RETENTION_DAYS < 1)); then
  echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 1
fi

mkdir -p -- "$BACKUP_PATH"
backup_directory=$(cd -- "$BACKUP_PATH" && pwd -P)

if [[ "$backup_directory" == "/" ]]; then
  echo "BACKUP_PATH cannot resolve to the filesystem root" >&2
  exit 1
fi

umask 077
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_directory/gradum-$timestamp.dump"
temporary_file="$backup_file.tmp"

cleanup() {
  rm -f -- "$temporary_file"
}

trap cleanup EXIT

docker exec "$POSTGRES_CONTAINER" pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --compress 9 >"$temporary_file"

if [[ ! -s "$temporary_file" ]]; then
  echo "Backup file is empty" >&2
  exit 1
fi

docker exec -i "$POSTGRES_CONTAINER" pg_restore --list <"$temporary_file" >/dev/null
mv -- "$temporary_file" "$backup_file"

find "$backup_directory" \
  -maxdepth 1 \
  -type f \
  -name 'gradum-*.dump' \
  -mtime "+$BACKUP_RETENTION_DAYS" \
  -delete

printf '%s\n' "$backup_file"
