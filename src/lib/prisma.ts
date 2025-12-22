// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// 防止开发环境下热更新导致连接数耗尽的单例模式
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['query'], // 开启日志，方便调试
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;