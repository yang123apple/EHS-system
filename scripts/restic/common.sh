#!/bin/bash
set -euo pipefail

BASE="/Users/yangguang/Desktop/EHS"
PROJECT="/Users/yangguang/Desktop/EHS/EHS-system"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export RESTIC_REPOSITORY="$BASE/restic-repo"
export RESTIC_PASSWORD_FILE="$BASE/restic-pass"
export RESTIC_CACHE_DIR="$BASE/restic-cache"

STAGING_DB_DIR="$BASE/restic-staging/db"
DB_PATH="$PROJECT/prisma/dev.db"
MINIO_DATA_DIR="$BASE/minio-data"
LOG_ARCHIVE_DIR="$PROJECT/data/backups/logs/archives"
LOG_DIR="$BASE/restic-logs"

RESTIC_BIN="$(command -v restic || true)"
if [ -z "$RESTIC_BIN" ]; then
  echo "[RESTIC] restic not found. Run: brew install restic"
  exit 1
fi

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Logging functions
log_to_file() {
  local log_file="$1"
  shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$log_file"
}

log_info() {
  log_to_file "${LOG_FILE:-$LOG_DIR/backup.log}" "[INFO] $*"
}

log_success() {
  log_to_file "${LOG_FILE:-$LOG_DIR/backup.log}" "[SUCCESS] $*"
}

log_error() {
  log_to_file "${LOG_FILE:-$LOG_DIR/backup.log}" "[ERROR] $*" >&2
}

log_warning() {
  log_to_file "${LOG_FILE:-$LOG_DIR/backup.log}" "[WARNING] $*"
}

# Send notification (macOS only)
send_notification() {
  local title="$1"
  local message="$2"
  osascript -e "display notification \"$message\" with title \"$title\"" 2>/dev/null || true
}
