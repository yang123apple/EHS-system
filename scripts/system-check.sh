#!/bin/bash
# EHS System Startup Health Check
# This script verifies all critical services before starting the application
# Exit code 0 = healthy, 1 = critical failure

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="/Users/yangguang/Desktop/EHS"
PROJECT="/Users/yangguang/Desktop/EHS/EHS-system"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Track failures
CRITICAL_FAILURES=0
WARNINGS=0

echo -e "${CYAN}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EHS System Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"
echo ""

log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $*"
}

log_warning() {
  echo -e "${YELLOW}[⚠]${NC} $*"
  WARNINGS=$((WARNINGS + 1))
}

log_error() {
  echo -e "${RED}[✗]${NC} $*"
  CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
}

log_fatal() {
  echo ""
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  CRITICAL FAILURE - CANNOT START SYSTEM${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}$*${NC}"
  echo ""
  exit 1
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Check MinIO
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${CYAN}[1/5] Checking MinIO Status...${NC}"

if pgrep -f "minio server" > /dev/null 2>&1; then
  log_success "MinIO is running"
else
  log_warning "MinIO is not running. Attempting to start..."

  # Try to start MinIO using the existing script
  if [ -f "$SCRIPT_DIR/start-minio-cross-platform.js" ]; then
    if node "$SCRIPT_DIR/start-minio-cross-platform.js" 2>/dev/null; then
      sleep 2  # Give it time to start
      if pgrep -f "minio server" > /dev/null 2>&1; then
        log_success "MinIO started successfully"
      else
        log_error "MinIO failed to start"
        log_fatal "MinIO is required but could not be started.\nCheck logs or start manually: cd $BASE && ./start-minio.sh"
      fi
    else
      log_error "Could not execute MinIO startup script"
      log_fatal "MinIO startup failed. Please start manually."
    fi
  else
    log_error "MinIO startup script not found"
    log_fatal "Cannot start MinIO automatically. Please start manually."
  fi
fi

# Verify MinIO is accessible
if command -v curl &>/dev/null; then
  if curl -s --max-time 3 http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    log_success "MinIO health check passed"
  else
    log_warning "MinIO is running but health check failed"
  fi
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Check MinIO Client (mc)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${CYAN}[2/5] Checking MinIO Client...${NC}"

if command -v mc &>/dev/null; then
  log_success "MinIO client (mc) is installed"
elif command -v /opt/homebrew/bin/mc &>/dev/null; then
  log_success "MinIO client found at /opt/homebrew/bin/mc"
elif command -v /usr/local/bin/mc &>/dev/null; then
  log_success "MinIO client found at /usr/local/bin/mc"
else
  log_error "MinIO client (mc) not found"
  log_fatal "MinIO client is required but not installed.\nInstall with: brew install minio/stable/mc"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Check Restic
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${CYAN}[3/5] Checking Restic Backup System...${NC}"

RESTIC_BIN=""
if [ -x /opt/homebrew/bin/restic ]; then
  RESTIC_BIN="/opt/homebrew/bin/restic"
elif [ -x /usr/local/bin/restic ]; then
  RESTIC_BIN="/usr/local/bin/restic"
else
  log_error "Restic not found"
  log_fatal "Restic is required but not installed.\nInstall with: brew install restic"
fi

log_success "Restic found at: $RESTIC_BIN"

# Check restic repository
RESTIC_REPOSITORY="$BASE/restic-repo"
RESTIC_PASSWORD_FILE="$BASE/restic-pass"

if [ ! -d "$RESTIC_REPOSITORY" ]; then
  log_error "Restic repository not found: $RESTIC_REPOSITORY"
  log_fatal "Restic repository is missing. Please reinitialize or restore from backup."
fi

if [ ! -f "$RESTIC_REPOSITORY/config" ]; then
  log_error "Restic repository is not initialized"
  log_fatal "Repository config missing. Please reinitialize: restic init"
fi

log_success "Restic repository exists"

# Check password file
if [ ! -f "$RESTIC_PASSWORD_FILE" ]; then
  log_error "Restic password file not found: $RESTIC_PASSWORD_FILE"
  log_fatal "Password file is missing. System cannot access backups."
fi

log_success "Restic password file exists"

# Check repository integrity
log_info "Verifying repository integrity (this may take a moment)..."
export RESTIC_REPOSITORY
export RESTIC_PASSWORD_FILE

if "$RESTIC_BIN" check --read-data-subset=5% 2>&1 | grep -q "no errors"; then
  log_success "Repository integrity check passed"
else
  log_warning "Repository integrity check found issues"
  log_info "Attempting to repair repository..."

  if "$RESTIC_BIN" repair index 2>/dev/null && "$RESTIC_BIN" repair snapshots 2>/dev/null; then
    log_success "Repository repaired successfully"
  else
    log_error "Could not repair repository"
    log_warning "Backups may be affected. Consider running: restic check --read-data"
  fi
fi

# Check for stale locks (non-fatal, just informational)
LOCKS_DIR="$RESTIC_REPOSITORY/locks"
if [ -d "$LOCKS_DIR" ]; then
  LOCK_COUNT=$(find "$LOCKS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$LOCK_COUNT" -gt 0 ]; then
    log_warning "Found $LOCK_COUNT lock file(s). These will be auto-cleaned if stale."
  fi
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Check LaunchAgents (non-blocking)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${CYAN}[4/5] Checking Backup Automation...${NC}"

AGENTS=(
  "com.ehs.backup.database.hourly"
  "com.ehs.backup.full.daily"
  "com.ehs.backup.prune.weekly"
  "com.ehs.backup.verify.weekly"
)

FAILED_AGENTS=0

for agent in "${AGENTS[@]}"; do
  if launchctl list | grep -q "$agent"; then
    # Check if last run failed
    status=$(launchctl list "$agent" 2>/dev/null || echo "")
    exit_code=$(echo "$status" | awk '{print $2}' | head -1)

    if [ "$exit_code" != "0" ] && [ "$exit_code" != "-" ]; then
      log_warning "$agent failed on last run (exit code: $exit_code)"
      FAILED_AGENTS=$((FAILED_AGENTS + 1))
    fi
  else
    log_warning "$agent is not loaded"
    FAILED_AGENTS=$((FAILED_AGENTS + 1))
  fi
done

if [ "$FAILED_AGENTS" -eq 0 ]; then
  log_success "All backup agents are operational"
elif [ "$FAILED_AGENTS" -le 2 ]; then
  log_warning "$FAILED_AGENTS backup agent(s) have issues"
  log_info "Run 'npm run restic:check-agents' for details"
else
  log_warning "Multiple backup agents have issues ($FAILED_AGENTS failures)"
  log_info "Consider reinstalling: cd $BASE/tools && ./manage-launchagents.sh reinstall"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. Check Database
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${CYAN}[5/5] Checking Database...${NC}"

DB_PATH="$PROJECT/prisma/dev.db"

if [ ! -f "$DB_PATH" ]; then
  log_warning "Database file not found: $DB_PATH"
  log_info "This is normal for a fresh installation. Database will be created on first run."
else
  log_success "Database file exists"

  # Check if database is locked
  if lsof "$DB_PATH" 2>/dev/null | grep -q "$DB_PATH"; then
    log_warning "Database is currently in use by another process"
    log_info "Processes:"
    lsof "$DB_PATH" 2>/dev/null | tail -n +2 | awk '{print "  - " $1 " (PID: " $2 ")"}'
  fi

  # Quick integrity check
  if command -v sqlite3 &>/dev/null; then
    if sqlite3 "$DB_PATH" "PRAGMA quick_check;" 2>&1 | grep -q "ok"; then
      log_success "Database integrity check passed"
    else
      log_error "Database integrity check failed"
      log_warning "Database may be corrupted. Consider restoring from backup."
    fi
  fi
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Final Summary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Health Check Complete${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$CRITICAL_FAILURES" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "${GREEN}✓ All systems operational${NC}"
  echo ""
  exit 0
elif [ "$CRITICAL_FAILURES" -eq 0 ]; then
  echo -e "${YELLOW}⚠ $WARNINGS warning(s) detected${NC}"
  echo "System can start, but some issues should be addressed."
  echo ""
  exit 0
else
  echo -e "${RED}✗ $CRITICAL_FAILURES critical failure(s)${NC}"
  if [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s)${NC}"
  fi
  echo ""
  echo "System cannot start safely. Please resolve the errors above."
  echo ""
  exit 1
fi
