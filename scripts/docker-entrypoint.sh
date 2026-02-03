#!/bin/bash
# ============================================
# Docker 容器启动脚本
# 同时启动 Next.js 应用和 Restic 备份调度
# ============================================

set -e

echo "=========================================="
echo "🚀 Starting EHS System in Docker"
echo "=========================================="

# ============================================
# 1. 初始化 Restic 仓库（如果不存在）
# ============================================
if [ ! -d "/app/data/restic-repo/config" ]; then
  echo "📦 Initializing Restic repository..."

  # 确保密码文件存在
  if [ ! -f "/app/data/restic-pass" ]; then
    echo "⚠️  Creating default restic password file..."
    echo "${RESTIC_PASSWORD:-change-me-restic-password}" > /app/data/restic-pass
    chmod 600 /app/data/restic-pass
  fi

  export RESTIC_REPOSITORY="/app/data/restic-repo"
  export RESTIC_PASSWORD_FILE="/app/data/restic-pass"

  restic init --repo "$RESTIC_REPOSITORY" || {
    echo "⚠️  Restic repository already exists or initialization failed"
  }

  echo "✅ Restic repository initialized"
else
  echo "✅ Restic repository already exists"
fi

# ============================================
# 2. 启动 Restic 备份调度（后台运行）
# ============================================
if [ "${ENABLE_RESTIC_BACKUP:-true}" = "true" ]; then
  echo "📋 Starting Restic backup scheduler in background..."

  # 创建一个简单的调度脚本
  cat > /tmp/restic-scheduler.sh <<'EOF'
#!/bin/bash
set -e

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Restic backup scheduler..."

# 等待应用完全启动（60秒）
sleep 60

# 初次运行完整备份
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running initial full backup..."
bash /app/scripts/restic/backup-db.sh daily 2>&1 | tee -a /app/data/restic-logs/docker-scheduler.log

# 每小时运行数据库备份
while true; do
  sleep 3600  # 1小时
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running hourly database backup..."
  bash /app/scripts/restic/backup-db.sh hourly 2>&1 | tee -a /app/data/restic-logs/docker-scheduler.log
done
EOF

  chmod +x /tmp/restic-scheduler.sh
  nohup bash /tmp/restic-scheduler.sh > /app/data/restic-logs/scheduler-output.log 2>&1 &

  echo "✅ Restic backup scheduler started (PID: $!)"
else
  echo "⚠️  Restic backup disabled (ENABLE_RESTIC_BACKUP=false)"
fi

# ============================================
# 3. 运行数据库迁移
# ============================================
echo "📊 Running database migrations..."
npx --no-install prisma migrate deploy

# ============================================
# 4. 启动 Next.js 应用
# ============================================
echo "🌐 Starting Next.js application..."
echo "=========================================="
exec npm start
