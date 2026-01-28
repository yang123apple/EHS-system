#!/bin/bash
set -euo pipefail

BASE="/Users/yangguang/Desktop/EHS"
PROJECT="/Users/yangguang/Desktop/EHS/EHS-system"

# Auto-detect Homebrew paths (Apple Silicon vs Intel)
if [ -x /opt/homebrew/bin/restic ]; then
  RESTIC_BIN="/opt/homebrew/bin/restic"
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
elif [ -x /usr/local/bin/restic ]; then
  RESTIC_BIN="/usr/local/bin/restic"
  export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
else
  echo "[RESTIC ERROR] restic not found. Install with: brew install restic"
  exit 1
fi

export RESTIC_REPOSITORY="$BASE/restic-repo"
export RESTIC_PASSWORD_FILE="$BASE/restic-pass"
export RESTIC_CACHE_DIR="$BASE/restic-cache"

STAGING_DB_DIR="$BASE/restic-staging/db"
DB_PATH="$PROJECT/prisma/dev.db"
MINIO_DATA_DIR="$BASE/minio-data"
LOG_ARCHIVE_DIR="$PROJECT/data/backups/logs/archives"
LOG_DIR="$BASE/restic-logs"

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

# Improved notification system
send_notification() {
  local title="$1"
  local message="$2"
  local log_file="${LOG_FILE:-$LOG_DIR/backup.log}"

  # Log to file (more reliable than notifications)
  log_to_file "$log_file" "[NOTIFY] [$title] $message"

  # Try macOS notification
  if command -v osascript &>/dev/null; then
    osascript -e "display notification \"$message\" with title \"$title\"" 2>/dev/null || true
  fi

  # Write to system log
  if command -v log &>/dev/null; then
    log -t "restic-backup" "[$title] $message" 2>/dev/null || true
  fi

  # Write to summary file for easy querying
  echo "$(date '+%Y-%m-%d %H:%M:%S') - NOTIFICATION - $title: $message" >> \
    "$LOG_DIR/backup-summary.txt"
}

# Check disk space
check_disk_space() {
  local required_kb=$((1024 * 1024))  # 1GB minimum
  local target_dir="${1:-$RESTIC_REPOSITORY}"

  # Get available space in KB
  local available_kb=$(df -k "$target_dir" 2>/dev/null | awk 'NR==2 {print $4}')

  if [ -z "$available_kb" ]; then
    log_error "Could not determine disk space for: $target_dir"
    return 1
  fi

  if [ "$available_kb" -lt "$required_kb" ]; then
    local available_mb=$((available_kb / 1024))
    local required_mb=$((required_kb / 1024))
    log_error "Insufficient disk space: ${available_mb}MB available, ${required_mb}MB required"
    send_notification "Backup Failed" "Insufficient disk space (${available_mb}MB available)"
    exit 1
  fi

  local available_gb=$((available_kb / 1024 / 1024))
  log_info "Disk space check passed: ${available_gb}GB available"
}

# Check if password file exists and is secure
check_password_file() {
  if [ ! -f "$RESTIC_PASSWORD_FILE" ]; then
    log_error "Password file not found: $RESTIC_PASSWORD_FILE"
    exit 1
  fi

  # Check permissions (should be 600 or 400)
  local perms=$(stat -f "%Lp" "$RESTIC_PASSWORD_FILE" 2>/dev/null || echo "000")
  if [ "$perms" != "600" ] && [ "$perms" != "400" ]; then
    log_warning "Password file has incorrect permissions: $perms (should be 600)"
  fi
}

# Verify restic repository
check_repository() {
  if [ ! -d "$RESTIC_REPOSITORY" ]; then
    log_error "Restic repository not found: $RESTIC_REPOSITORY"
    exit 1
  fi

  if [ ! -f "$RESTIC_REPOSITORY/config" ]; then
    log_error "Restic repository is not initialized: $RESTIC_REPOSITORY"
    exit 1
  fi
}

# Run initial checks
check_password_file
check_repository
