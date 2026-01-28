#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

TAG="${1:-hourly}"
TIMESTAMP=$(date +%Y%m%d-%H%M)
export LOG_FILE="$LOG_DIR/backup-db-$(date +%Y%m%d).log"

# Lock file to prevent concurrent execution
LOCK_FILE="/tmp/backup-db.lock"
LOCK_FD=200

# Snapshot file path
SNAPSHOT="$STAGING_DB_DIR/ehs.db"

# Cleanup function - runs on ANY exit
cleanup() {
  local exit_code=$?
  if [ -f "$SNAPSHOT" ]; then
    log_warning "Cleaning up snapshot file on exit (code: $exit_code)"
    rm -f "$SNAPSHOT"
  fi
  # Release lock
  flock -u $LOCK_FD 2>/dev/null || true
  return $exit_code
}

# Set up traps for cleanup
trap cleanup EXIT SIGINT SIGTERM SIGHUP

log_info "========== Database Backup Started =========="
log_info "Tag: $TAG, Timestamp: $TIMESTAMP"
log_info "Database: $DB_PATH"

# Check disk space first (require at least 1GB free)
check_disk_space

# Acquire exclusive lock with timeout
log_info "Acquiring lock..."
exec 200>"$LOCK_FILE"
if ! flock -n $LOCK_FD; then
  log_warning "Previous backup still running, waiting up to 30 seconds..."
  if ! flock -w 30 $LOCK_FD; then
    log_error "Could not acquire lock after 30 seconds, skipping backup"
    send_notification "Backup Skipped" "Previous backup still running"
    exit 0  # Soft failure - not an error condition
  fi
fi
log_success "Lock acquired"

mkdir -p "$STAGING_DB_DIR"

if [ ! -f "$DB_PATH" ]; then
  log_error "DB file not found: $DB_PATH"
  send_notification "Backup Failed" "Database file not found"
  exit 1
fi

log_info "Performing WAL checkpoint..."
if ! timeout 60 /usr/bin/sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null 2>&1; then
  log_warning "WAL checkpoint timeout or failed (database may not be in WAL mode)"
fi

log_info "Creating database snapshot..."
# Use timeout to prevent indefinite hangs (max 50 minutes for large databases)
if ! timeout 3000 /usr/bin/sqlite3 "$DB_PATH" ".backup '$SNAPSHOT'" 2>&1 | tee -a "$LOG_FILE"; then
  log_error "Database snapshot creation timeout or failed"
  send_notification "Backup Failed" "Database snapshot timeout"
  exit 1
fi

# Verify snapshot was created
if [ ! -f "$SNAPSHOT" ]; then
  log_error "Snapshot file was not created: $SNAPSHOT"
  send_notification "Backup Failed" "Snapshot file missing"
  exit 1
fi

SNAPSHOT_SIZE=$(stat -f%z "$SNAPSHOT" 2>/dev/null || echo "0")
log_info "Snapshot created: $(numfmt --to=iec-i --suffix=B $SNAPSHOT_SIZE 2>/dev/null || echo "${SNAPSHOT_SIZE} bytes")"

log_info "Starting restic backup..."
if "$RESTIC_BIN" backup "$SNAPSHOT" \
  --tag ehs --tag db --tag "$TAG" --tag "timestamp-$TIMESTAMP" \
  --host "$(scutil --get LocalHostName 2>/dev/null || echo 'unknown')" 2>&1 | tee -a "$LOG_FILE"; then

  log_success "Database backup completed successfully"
  send_notification "Backup Success" "Database backup completed ($TAG)"

  # Log to summary file
  echo "$(date '+%Y-%m-%d %H:%M:%S') - DB_BACKUP_SUCCESS - Tag: $TAG, Size: $SNAPSHOT_SIZE bytes" >> \
    "$LOG_DIR/backup-summary.txt"

  # Cleanup staging file to save space
  rm -f "$SNAPSHOT"
  log_info "Cleaned up staging file"
else
  log_error "Database backup failed"
  send_notification "Backup Failed" "Database backup failed ($TAG)"

  # Log to summary file
  echo "$(date '+%Y-%m-%d %H:%M:%S') - DB_BACKUP_FAILED - Tag: $TAG" >> \
    "$LOG_DIR/backup-summary.txt"

  exit 1
fi

log_info "========== Database Backup Finished =========="
