#!/bin/bash
set -euo pipefail

# 使用绝对路径，指向上层 data 目录
BASE="/Users/yangguang/Desktop/EHS/data"
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

# Restic 仓库和配置保存到上层 data 目录
export RESTIC_REPOSITORY="$BASE/restic-repo"
export RESTIC_PASSWORD_FILE="$BASE/restic-pass"
export RESTIC_CACHE_DIR="$BASE/restic-cache"

# 数据路径配置
STAGING_DB_DIR="$BASE/restic-staging/db"
DB_PATH="$PROJECT/prisma/dev.db"
MINIO_DATA_DIR="$BASE/minio-data"
LOG_ARCHIVE_DIR="$BASE/backups/logs/archives"
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

# Smart cleanup of stale Restic locks
# This prevents "repository is locked" errors after crashes or SIGKILL
check_and_cleanup_stale_locks() {
  local locks_dir="$RESTIC_REPOSITORY/locks"
  local flock_file="/tmp/backup-db.lock"
  local max_lock_age_seconds=$((2 * 3600))  # 2 hours

  # Check if locks directory exists and has any lock files
  if [ ! -d "$locks_dir" ]; then
    return 0  # No locks directory, nothing to clean
  fi

  local lock_count=$(find "$locks_dir" -type f 2>/dev/null | wc -l | tr -d ' ')

  if [ "$lock_count" -eq 0 ]; then
    return 0  # No lock files, all good
  fi

  # Check if our flock is currently held by another process
  if flock -n 200 2>/dev/null; then
    # We got the lock immediately, so no backup is running
    # This means any restic locks are stale
    exec 200>"$flock_file"

    log_warning "Found $lock_count restic lock file(s), but no backup process is running"

    # Check age of lock files
    local has_stale_locks=false
    local oldest_lock_age=0

    for lock_file in "$locks_dir"/*; do
      if [ -f "$lock_file" ]; then
        local lock_age=$(( $(date +%s) - $(stat -f %m "$lock_file" 2>/dev/null || echo "0") ))

        if [ "$lock_age" -gt "$max_lock_age_seconds" ]; then
          has_stale_locks=true
          oldest_lock_age=$lock_age
        fi
      fi
    done

    if [ "$has_stale_locks" = true ]; then
      local lock_age_hours=$((oldest_lock_age / 3600))
      log_warning "Stale locks detected (oldest: ${lock_age_hours}h old). Attempting automatic cleanup..."

      # Attempt to unlock
      if "$RESTIC_BIN" unlock --remove-all 2>&1 | tee -a "${LOG_FILE:-$LOG_DIR/backup.log}"; then
        log_success "Successfully removed stale restic locks"
        send_notification "Backup System" "Stale locks automatically cleaned up"
      else
        log_error "Failed to remove stale locks. Manual intervention may be required."
        log_error "Run manually: restic unlock --remove-all"
        send_notification "Backup Warning" "Could not clean stale locks"
      fi
    else
      log_info "Restic locks found but are recent (< 2 hours). Assuming legitimate backup in progress."
    fi

    # Release flock
    flock -u 200 2>/dev/null || true
  else
    # Someone else has the flock, backup is legitimately running
    log_info "Backup process is running (flock held), restic locks are valid"
  fi
}

# Exclude restic repository from Time Machine backups
# This prevents redundant backups and improves Time Machine performance
exclude_from_time_machine() {
  if [ ! -d "$RESTIC_REPOSITORY" ]; then
    return 0  # Repository doesn't exist yet
  fi

  # Check if already excluded
  if tmutil isexcluded "$RESTIC_REPOSITORY" 2>/dev/null | grep -q "\[Excluded\]"; then
    log_info "Restic repository already excluded from Time Machine"
    return 0
  fi

  # Try to exclude (requires user permission)
  log_info "Excluding restic repository from Time Machine backups..."

  if tmutil addexclusion "$RESTIC_REPOSITORY" 2>/dev/null; then
    log_success "Restic repository excluded from Time Machine"
  else
    log_warning "Could not exclude from Time Machine (may require sudo)"
    log_warning "Run manually: sudo tmutil addexclusion $RESTIC_REPOSITORY"
  fi

  # Also exclude password file if not already excluded
  if [ -f "$RESTIC_PASSWORD_FILE" ]; then
    if ! tmutil isexcluded "$RESTIC_PASSWORD_FILE" 2>/dev/null | grep -q "\[Excluded\]"; then
      tmutil addexclusion "$RESTIC_PASSWORD_FILE" 2>/dev/null || true
    fi
  fi
}

# Run initial checks
check_password_file
check_repository
check_and_cleanup_stale_locks
exclude_from_time_machine
