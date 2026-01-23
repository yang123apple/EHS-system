// src/app/api/hazards/void/route.ts
/**
 * 隐患软删除（作废）API
 * 
 * 功能：将隐患标记为"已作废"，不物理删除数据
 * 场景：录入错误、认定错误等需要保留审计轨迹的情况
 * 权限：普通用户和管理员均可触发
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, withAuth, logApiOperation } from '@/middleware/auth';
import { safeJsonParseArray } from '@/utils/jsonUtils';

export const POST = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    const body = await request.json();
    const { hazardId, reason } = body;

    if (!hazardId || !reason) {
      return NextResponse.json(
        { error: '缺少必要参数：hazardId 和 reason' },
        { status: 400 }
      );
    }

    // 1. 检查隐患是否存在
    const hazard = await prisma.hazardRecord.findUnique({
      where: { id: hazardId },
      select: {
        id: true,
        code: true,
        isVoided: true,
        status: true,
        type: true,
        location: true,
        logs: true
      }
    });

    if (!hazard) {
      return NextResponse.json(
        { error: '隐患记录不存在' },
        { status: 404 }
      );
    }

    // 2. 检查是否已经作废
    if (hazard.isVoided) {
      return NextResponse.json(
        { error: '该隐患已被作废，无需重复操作' },
        { status: 400 }
      );
    }

    // 3. 构造作废操作人信息（JSON 格式）
    const voidedByInfo = JSON.stringify({
      id: user.id,
      name: user.name,
      role: user.role,
      timestamp: new Date().toISOString()
    });

    // 4. 更新隐患记录 - 标记为已作废
    const currentLogs = safeJsonParseArray(hazard.logs || '[]');
    const voidLog = {
      operatorId: user.id,
      operatorName: user.name,
      action: '作废隐患',
      time: new Date().toISOString(),
      changes: `作废原因：${reason}`
    };

    const updatedHazard = await prisma.hazardRecord.update({
      where: { id: hazardId },
      data: {
        isVoided: true,
        voidReason: reason,
        voidedAt: new Date(),
        voidedBy: voidedByInfo,
        logs: JSON.stringify([voidLog, ...currentLogs])
      },
      select: {
        id: true,
        code: true,
        isVoided: true,
        voidReason: true,
        voidedAt: true,
        voidedBy: true
      }
    });

    // 5. 记录系统日志
    await logApiOperation(user, 'hidden_danger', 'void', {
      hazardId: hazard.code || hazardId,
      reason,
      type: hazard.type,
      location: hazard.location
    });

    console.log(`✅ [隐患作废] 隐患 ${hazard.code} 已作废，操作人：${user.name}，原因：${reason}`);

    return NextResponse.json({
      success: true,
      message: '隐患已作废',
      data: {
        id: updatedHazard.id,
        code: updatedHazard.code,
        isVoided: updatedHazard.isVoided,
        voidReason: updatedHazard.voidReason,
        voidedAt: updatedHazard.voidedAt
      }
    });
  })
);
