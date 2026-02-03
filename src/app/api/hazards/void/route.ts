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

    // 4. 在事务中执行：标记为已作废 + 释放编号（确保原子性）
    const currentLogs = safeJsonParseArray(hazard.logs || '[]');
    const voidLog = {
      operatorId: user.id,
      operatorName: user.name,
      action: '作废隐患',
      time: new Date().toISOString(),
      changes: `作废原因：${reason}；原编号：${hazard.code}`
    };

    const updatedHazard = await prisma.$transaction(async (tx) => {
      // 4.1 标记隐患为已作废
      const updated = await tx.hazardRecord.update({
        where: { id: hazardId },
        data: {
          isVoided: true,
          voidReason: reason,
          voidedAt: new Date(),
          voidedBy: voidedByInfo,
          code: null, // ♻️ 清除编号，使其可以被重用
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

      // 4.2 释放编号到编号池（在同一事务中，确保原子性）
      if (hazard.code) {
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 30); // 30天后过期

        // 提取日期前缀和序号
        const match = hazard.code.match(/^Hazard(\d{8})(\d{3})$/);
        if (match) {
          const datePrefix = match[1];
          const sequence = parseInt(match[2], 10);

          await tx.hazardCodePool.upsert({
            where: { code: hazard.code },
            update: {
              status: 'available',
              releasedBy: user.id,
              releasedAt: now,
              expiresAt,
              usedAt: null,
              usedBy: null
            },
            create: {
              code: hazard.code,
              datePrefix,
              sequence,
              status: 'available',
              releasedBy: user.id,
              releasedAt: now,
              expiresAt
            }
          });

          console.log(`♻️ [编号回收] 编号 ${hazard.code} 已释放到编号池 (序号: ${sequence}), 过期时间: ${expiresAt.toISOString()}`);
        } else {
          console.warn(`⚠️ [编号回收] 无效编号格式: ${hazard.code}`);
        }
      }

      return updated;
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
      message: '隐患已作废，编号已释放可重用',
      data: {
        id: updatedHazard.id,
        originalCode: hazard.code, // 返回原编号
        code: updatedHazard.code,  // 现在是null
        isVoided: updatedHazard.isVoided,
        voidReason: updatedHazard.voidReason,
        voidedAt: updatedHazard.voidedAt
      }
    });
  })
);
