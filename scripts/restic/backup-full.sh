#!/bin/bash
# Master backup script - runs log archive before MinIO backup

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

TAG="${1:-daily}"
export LOG_FILE="$LOG_DIR/backup-full-$(date +%Y%m%d).log"

log_info "========== Full Backup Started =========="
log_info "Tag: $TAG"

# Step 1: Run log archive
log_info "Step 1: Running log archive..."
if "$SCRIPT_DIR/run-log-archive.sh"; then
  log_success "Log archive completed"
else
  log_error "Log archive failed, but continuing with backup..."
fi

# Step 2: Backup MinIO data (includes log archives)
log_info "Step 2: Backing up MinIO and log archives..."
if "$SCRIPT_DIR/backup-minio.sh" "$TAG"; then
  log_success "MinIO backup completed"
else
  log_error "MinIO backup failed"
  send_notification "Backup Failed" "Full backup failed at MinIO step"
  exit 1
fi

log_success "Full backup completed successfully"
send_notification "Backup Success" "Full backup completed ($TAG)"
log_info "========== Full Backup Finished =========="
