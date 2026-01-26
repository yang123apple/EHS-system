/**
 * 获取隐患的指定步骤信息（用于权限检查）
 * GET /api/hazards/[id]/workflow-step?stepIndex=0
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, withAuth } from '@/middleware/auth';
import { getWorkflowStep } from '@/services/hazardWorkflowStep.service';

export const GET = withErrorHandling(
  withAuth<{ params: Promise<{ id: string }> }>(async (request: NextRequest, context: any, user: any) => {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const stepIndex = searchParams.get('stepIndex');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '隐患ID不能为空' },
        { status: 400 }
      );
    }

    if (stepIndex === null || stepIndex === undefined) {
      return NextResponse.json(
        { success: false, error: '步骤索引不能为空' },
        { status: 400 }
      );
    }

    try {
      const stepIndexNum = parseInt(stepIndex, 10);
      if (isNaN(stepIndexNum)) {
        return NextResponse.json(
          { success: false, error: '无效的步骤索引' },
          { status: 400 }
        );
      }

      const step = await getWorkflowStep(id, stepIndexNum);

      if (!step) {
        return NextResponse.json({
          success: false,
          error: '未找到指定的步骤信息'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        step
      });
    } catch (error: any) {
      console.error('[GET /api/hazards/[id]/workflow-step] 获取步骤信息失败:', error);
      return NextResponse.json(
        { success: false, error: error.message || '获取步骤信息失败' },
        { status: 500 }
      );
    }
  })
);
