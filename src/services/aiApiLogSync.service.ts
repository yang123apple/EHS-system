// src/services/aiApiLogSync.service.ts
// AI API调用日志同步到系统操作日志的服务
import { prisma } from '@/lib/prisma';
import { SystemLogService } from './systemLog.service';

/**
 * 将AI API调用日志同步到系统操作日志
 */
export async function syncAIApiLogToSystemLog(logId: string) {
  try {
    const apiLog = await prisma.aIApiLog.findUnique({
      where: { id: logId },
      include: {
        config: {
          select: {
            name: true,
            provider: true,
          },
        },
      },
    });

    if (!apiLog) {
      console.warn(`AI API日志不存在: ${logId}`);
      return null;
    }

    // 获取用户信息（如果requestBy是用户ID）
    let userSnapshot = null;
    if (apiLog.requestBy) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: apiLog.requestBy },
          include: { department: true },
        });

        if (user) {
          userSnapshot = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            departmentId: user.departmentId || undefined,
            departmentName: user.department?.name || undefined,
            jobTitle: user.jobTitle || undefined,
          };
        }
      } catch (error) {
        console.warn('获取用户信息失败:', error);
      }
    }

    // 构建操作详情
    let details = `调用AI API: ${apiLog.config.name} (${apiLog.config.provider}) - ${apiLog.status === 'success' ? '成功' : apiLog.status === 'rate_limited' ? '限流' : '失败'}`;
    
    if (apiLog.errorMessage) {
      details += ` - ${apiLog.errorMessage}`;
    }

    // 创建系统操作日志
    const systemLog = await SystemLogService.createLog({
      userId: apiLog.requestBy || undefined,
      userName: userSnapshot?.name || undefined,
      userRole: userSnapshot?.role || undefined,
      userDepartment: userSnapshot?.departmentName || undefined,
      userDepartmentId: userSnapshot?.departmentId || undefined,
      userJobTitle: userSnapshot?.jobTitle || undefined,
      userSnapshot: userSnapshot || undefined,
      action: apiLog.status === 'success' ? 'CALL_API' : apiLog.status === 'rate_limited' ? 'RATE_LIMITED' : 'CALL_API_ERROR',
      actionLabel: apiLog.status === 'success' ? '调用AI API' : apiLog.status === 'rate_limited' ? 'AI API调用被限流' : 'AI API调用失败',
      module: 'AI_API',
      targetType: 'ai_api_call',
      targetId: logId,
      targetLabel: `${apiLog.config.name} - ${apiLog.requestSource || 'unknown'}`,
      details,
      snapshot: {
        configId: apiLog.configId,
        configName: apiLog.config.name,
        provider: apiLog.config.provider,
        requestSource: apiLog.requestSource,
        status: apiLog.status,
        tokens: apiLog.tokens,
        duration: apiLog.duration,
        errorMessage: apiLog.errorMessage,
        createdAt: apiLog.createdAt,
      },
      ip: apiLog.ip || undefined,
    });

    return systemLog;
  } catch (error) {
    console.error('同步AI API日志到系统日志失败:', error);
    return null;
  }
}

/**
 * 批量同步AI API调用日志到系统操作日志
 */
export async function batchSyncAIApiLogs(logIds: string[]) {
  const results = await Promise.allSettled(
    logIds.map(id => syncAIApiLogToSystemLog(id))
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failCount = results.filter(r => r.status === 'rejected').length;

  return {
    successCount,
    failCount,
    total: logIds.length,
  };
}

