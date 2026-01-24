/**
 * 获取隐患的工作流步骤信息
 * GET /api/hazards/[id]/workflow-steps
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, withAuth } from '@/middleware/auth';
import { getWorkflowSteps } from '@/services/hazardWorkflowStep.service';

export const GET = withErrorHandling(
  withAuth<{ params: Promise<{ id: string }> }>(async (request: NextRequest, context: any, user: any) => {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '隐患ID不能为空' },
        { status: 400 }
      );
    }

    try {
      const steps = await getWorkflowSteps(id);

      return NextResponse.json({
        success: true,
        steps
      });
    } catch (error: any) {
      console.error('[GET /api/hazards/[id]/workflow-steps] 获取步骤信息失败:', error);
      return NextResponse.json(
        { success: false, error: error.message || '获取步骤信息失败' },
        { status: 500 }
      );
    }
  })
);
