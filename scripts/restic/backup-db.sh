#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

TAG="${1:-hourly}"
export LOG_FILE="$LOG_DIR/backup-db-$(date +%Y%m%d).log"

log_info "========== Database Backup Started =========="
log_info "Tag: $TAG"
log_info "Database: $DB_PATH"

mkdir -p "$STAGING_DB_DIR"

if [ ! -f "$DB_PATH" ]; then
  log_error "DB file not found: $DB_PATH"
  send_notification "Backup Failed" "Database file not found"
  exit 1
fi

log_info "Performing WAL checkpoint..."
/usr/bin/sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null

SNAPSHOT="$STAGING_DB_DIR/ehs.db"
log_info "Creating database snapshot..."
/usr/bin/sqlite3 "$DB_PATH" ".backup '$SNAPSHOT'"

log_info "Starting restic backup..."
if "$RESTIC_BIN" backup "$SNAPSHOT" \
  --tag ehs --tag db --tag "$TAG" \
  --host "$(scutil --get LocalHostName)" 2>&1 | tee -a "$LOG_FILE"; then

  log_success "Database backup completed successfully"
  send_notification "Backup Success" "Database backup completed ($TAG)"

  # Cleanup staging file to save space
  rm -f "$SNAPSHOT"
  log_info "Cleaned up staging file"
else
  log_error "Database backup failed"
  send_notification "Backup Failed" "Database backup failed ($TAG)"
  exit 1
fi

log_info "========== Database Backup Finished =========="
