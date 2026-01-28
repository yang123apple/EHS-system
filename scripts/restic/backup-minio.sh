#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

TAG="${1:-daily}"
export LOG_FILE="$LOG_DIR/backup-minio-$(date +%Y%m%d).log"

log_info "========== MinIO Backup Started =========="
log_info "Tag: $TAG"

if [ ! -d "$MINIO_DATA_DIR" ]; then
  log_error "MinIO data dir not found: $MINIO_DATA_DIR"
  send_notification "Backup Failed" "MinIO directory not found"
  exit 1
fi

ARGS=("$MINIO_DATA_DIR")
if [ -d "$LOG_ARCHIVE_DIR" ]; then
  ARGS+=("$LOG_ARCHIVE_DIR")
  log_info "Including log archives"
fi

log_info "Starting restic backup..."
log_info "Backing up: ${ARGS[*]}"

if "$RESTIC_BIN" backup "${ARGS[@]}" \
  --tag ehs --tag minio --tag "$TAG" \
  --host "$(scutil --get LocalHostName)" 2>&1 | tee -a "$LOG_FILE"; then

  log_success "MinIO backup completed successfully"
  send_notification "Backup Success" "MinIO backup completed ($TAG)"
else
  log_error "MinIO backup failed"
  send_notification "Backup Failed" "MinIO backup failed ($TAG)"
  exit 1
fi

log_info "========== MinIO Backup Finished =========="
