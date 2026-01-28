#!/bin/bash
set -euo pipefail

PROJECT="/Users/yangguang/Desktop/EHS/EHS-system"
BASE="/Users/yangguang/Desktop/EHS"
LOG_DIR="$BASE/restic-logs"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export LOG_FILE="$LOG_DIR/log-archive-$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

log_info() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $*" | tee -a "$LOG_FILE"
}

log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" | tee -a "$LOG_FILE" >&2
}

log_info "========== Log Archive Started =========="

cd "$PROJECT"

if [ ! -f "$PROJECT/node_modules/.bin/tsx" ]; then
  log_error "tsx not found. Please run: npm install"
  exit 1
fi

log_info "Running log archive service..."
if "$PROJECT/node_modules/.bin/tsx" "$PROJECT/scripts/restic/run-log-archive.ts" 2>&1 | tee -a "$LOG_FILE"; then
  log_info "Log archive completed successfully"
else
  log_error "Log archive failed"
  exit 1
fi

log_info "========== Log Archive Finished =========="
