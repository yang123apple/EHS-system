FROM node:20-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
# Prisma generate 需要一个有效的 DATABASE_URL，但不会实际连接
ENV DATABASE_URL="file:./dev.db"

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY prisma ./prisma
RUN npx --no-install prisma generate

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 安装系统依赖：curl、sqlite3、restic、coreutils（包含 timeout）、util-linux（包含 flock）
RUN apt-get update && apt-get install -y \
    curl \
    sqlite3 \
    restic \
    coreutils \
    util-linux \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts

# 复制 restic 备份脚本
COPY scripts/restic ./scripts/restic
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x scripts/restic/*.sh scripts/docker-entrypoint.sh

# 创建必要的目录结构
RUN mkdir -p /app/data/db \
             /app/data/restic-repo \
             /app/data/restic-logs \
             /app/data/restic-staging/db \
             /app/data/restic-cache \
             /app/public/uploads \
             /app/ehs-private \
             /app/ehs-public

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["/app/scripts/docker-entrypoint.sh"]
