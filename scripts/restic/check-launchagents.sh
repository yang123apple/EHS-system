#!/bin/bash
# LaunchAgent health check script

set -euo pipefail

BASE="/Users/yangguang/Desktop/EHS"
LOG_DIR="$BASE/restic-logs"
LOG_FILE="$LOG_DIR/launchagent-health-$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

AGENTS=(
  "com.ehs.backup.database.hourly"
  "com.ehs.backup.full.daily"
  "com.ehs.backup.prune.weekly"
  "com.ehs.backup.verify.weekly"
)

echo "=========================================" | tee -a "$LOG_FILE"
echo "  LaunchAgent Health Check" | tee -a "$LOG_FILE"
echo "=========================================" | tee -a "$LOG_FILE"
log ""

FAILED_AGENTS=()
WARNINGS=()

for agent in "${AGENTS[@]}"; do
  log "Checking: $agent"

  # Check if agent is loaded
  if ! launchctl list "$agent" > /dev/null 2>&1; then
    echo -e "${RED}✗ NOT LOADED${NC}" | tee -a "$LOG_FILE"
    FAILED_AGENTS+=("$agent - NOT LOADED")
    continue
  fi

  # Get agent status
  status=$(launchctl list "$agent" 2>/dev/null)

  # Extract PID and exit status
  pid=$(echo "$status" | awk '{print $1}' | head -1)
  exit_code=$(echo "$status" | awk '{print $2}' | head -1)

  if [ "$pid" == "-" ]; then
    # Agent is not currently running (which is normal between scheduled runs)
    if [ "$exit_code" == "0" ]; then
      echo -e "${GREEN}✓ OK (last run successful)${NC}" | tee -a "$LOG_FILE"
    else
      echo -e "${RED}✗ FAILED (exit code: $exit_code)${NC}" | tee -a "$LOG_FILE"
      FAILED_AGENTS+=("$agent - EXIT CODE $exit_code")

      # Find recent error logs
      error_log_pattern=$(echo "$agent" | sed 's/com.ehs.backup./launchd-/' | sed 's/\..*/-err.log/')
      if [ -f "$LOG_DIR/$error_log_pattern" ]; then
        log "  Recent errors:"
        tail -5 "$LOG_DIR/$error_log_pattern" | while read line; do
          log "    $line"
        done
      fi
    fi
  else
    # Agent is currently running
    echo -e "${BLUE}⟳ RUNNING (PID: $pid)${NC}" | tee -a "$LOG_FILE"
    WARNINGS+=("$agent is currently running")
  fi

  log ""
done

# Check last backup times
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Last Backup Times:"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "$LOG_DIR/backup-summary.txt" ]; then
  # Database backup
  LAST_DB=$(grep "DB_BACKUP_SUCCESS" "$LOG_DIR/backup-summary.txt" 2>/dev/null | tail -1 || echo "Never")
  log "Database:   $LAST_DB"

  # Full backup
  LAST_FULL=$(grep "NOTIFICATION.*Full backup completed" "$LOG_DIR/backup-summary.txt" 2>/dev/null | tail -1 || echo "Never")
  log "Full:       $LAST_FULL"

  # Check if backups are stale (> 2 hours for DB, > 25 hours for full)
  NOW=$(date +%s)

  if [ "$LAST_DB" != "Never" ]; then
    LAST_DB_TIME=$(echo "$LAST_DB" | awk '{print $1" "$2}')
    LAST_DB_EPOCH=$(date -j -f "%Y-%m-%d %H:%M:%S" "$LAST_DB_TIME" +%s 2>/dev/null || echo "0")
    DB_AGE=$(( (NOW - LAST_DB_EPOCH) / 3600 ))

    if [ "$DB_AGE" -gt 2 ]; then
      WARNINGS+=("Database backup is ${DB_AGE} hours old (expected < 2 hours)")
    fi
  fi
else
  log "No backup summary found"
  WARNINGS+=("backup-summary.txt not found")
fi

# Summary
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Health Check Summary"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#FAILED_AGENTS[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ ALL SYSTEMS OPERATIONAL${NC}" | tee -a "$LOG_FILE"
  exit 0
fi

if [ ${#FAILED_AGENTS[@]} -gt 0 ]; then
  echo -e "${RED}✗ CRITICAL: ${#FAILED_AGENTS[@]} agent(s) failed${NC}" | tee -a "$LOG_FILE"
  for failure in "${FAILED_AGENTS[@]}"; do
    log "  - $failure"
  done
  log ""
  log "Action required: Check logs in $LOG_DIR"
  log "Reinstall agents: cd $BASE/tools && ./manage-launchagents.sh reinstall"

  # Send notification
  osascript -e 'display notification "Backup agents failed! Check logs." with title "EHS Backup Alert"' 2>/dev/null || true
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo -e "${YELLOW}⚠ WARNINGS: ${#WARNINGS[@]} issue(s) detected${NC}" | tee -a "$LOG_FILE"
  for warning in "${WARNINGS[@]}"; do
    log "  - $warning"
  done
fi

log ""
log "Full report saved to: $LOG_FILE"

# Exit with error if there are failures
[ ${#FAILED_AGENTS[@]} -eq 0 ] && exit 0 || exit 1
