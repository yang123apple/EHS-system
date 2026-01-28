#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

export LOG_FILE="$LOG_DIR/prune-$(date +%Y%m%d).log"

log_info "========== Prune & Cleanup Started =========="

log_info "Running forget and prune..."
if "$RESTIC_BIN" forget \
  --keep-hourly 168 \
  --keep-daily 30 \
  --keep-weekly 12 \
  --keep-monthly 12 \
  --prune 2>&1 | tee -a "$LOG_FILE"; then

  log_success "Prune completed successfully"
  send_notification "Backup Maintenance" "Old snapshots pruned successfully"
else
  log_error "Prune failed"
  send_notification "Backup Maintenance Failed" "Prune operation failed"
  exit 1
fi

log_info "========== Prune & Cleanup Finished =========="
