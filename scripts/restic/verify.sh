#!/bin/bash
# Verify restic repository integrity

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

export LOG_FILE="$LOG_DIR/verify-$(date +%Y%m%d).log"

log_info "========== Repository Verification Started =========="

# Check repository consistency
log_info "Checking repository structure..."
if "$RESTIC_BIN" check 2>&1 | tee -a "$LOG_FILE"; then
  log_success "Repository structure check passed"
else
  log_error "Repository structure check failed"
  send_notification "Backup Verification Failed" "Repository structure check failed"
  exit 1
fi

# Read a subset of data packs
log_info "Verifying data integrity (10% sample)..."
if "$RESTIC_BIN" check --read-data-subset=10% 2>&1 | tee -a "$LOG_FILE"; then
  log_success "Data integrity check passed"
else
  log_error "Data integrity check failed"
  send_notification "Backup Verification Failed" "Data integrity check failed"
  exit 1
fi

# Show repository stats
log_info "Repository statistics:"
"$RESTIC_BIN" stats --mode restore-size 2>&1 | tee -a "$LOG_FILE"

log_success "Repository verification completed successfully"
send_notification "Backup Verification" "Repository verification passed"
log_info "========== Repository Verification Finished =========="
