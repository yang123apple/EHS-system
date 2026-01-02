// src/lib/logger.ts
import { prisma } from '@/lib/prisma';

export async function createLog(
  userId: string | undefined, 
  userName: string | undefined, 
  action: string, 
  targetId?: string, 
  details?: string,
  targetType?: string
) {
  try {
    await prisma.systemLog.create({
      data: {
        userId: userId || 'system',
        userName: userName || 'System',
        action,
        targetId,
        targetType: targetType || null,
        details
      }
    });
  } catch (e) {
    console.error("日志写入失败", e); // 日志系统挂了不应影响主业务
  }
}