// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// 防止开发环境下热更新导致连接数耗尽的单例模式
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['query'], // 开启日志，方便调试
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ====================================================================
// WAL 模式初始化 - 关键备份策略配置
// ====================================================================
// 启用 SQLite Write-Ahead Logging (WAL) 模式，这对我们的备份策略至关重要：
//
// 1. **文件级备份安全性**：
//    - WAL 模式下，所有写操作先写入 .wal 文件，而不是直接修改主数据库文件
//    - 备份时可以直接复制 .db 文件，无需担心写入冲突或数据库锁定
//    - 配合 checkpoint 操作，确保备份文件包含完整的一致性数据
//
// 2. **并发性能提升**：
//    - 读操作不会阻塞写操作，写操作也不会阻塞读操作
//    - 允许备份进程在不中断系统服务的情况下运行
//
// 3. **数据一致性保证**：
//    - WAL 提供原子性提交，即使备份过程中系统崩溃也能保证数据完整性
//    - 恢复时可以通过 .wal 文件重放未提交的事务
//
// 注意：auto-backup.js 脚本会在备份前执行 PRAGMA wal_checkpoint(TRUNCATE)
//       将 WAL 文件的内容合并回主数据库文件，确保备份的完整性
// ====================================================================

// 立即执行 WAL 模式配置（仅在首次实例化时执行）
if (!globalForPrisma.prisma) {
  prisma.$queryRaw`PRAGMA journal_mode = WAL`
    .then((result: any) => {
      const mode = result[0]?.journal_mode;
      console.log(`✅ SQLite WAL 模式已启用 - 当前模式: ${mode} - 备份策略就绪`);
    })
    .catch((error) => {
      console.error('❌ 启用 WAL 模式失败:', error);
      // WAL 模式启用失败不应阻止应用启动，但应记录警告
      console.warn('⚠️  系统将以默认 journal 模式运行，备份时可能存在锁定风险');
    });
}