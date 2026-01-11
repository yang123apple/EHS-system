/**
 * 隐患延期 API
 * POST /api/hazards/extension - 申请延期
 * PATCH /api/hazards/extension - 审批延期
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, withAuth } from '@/middleware/auth';
import { requestExtension, approveExtension, getHazardExtensions } from '@/services/hazardExtension.service';

/**
 * POST - 申请延期
 */
export const POST = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    try {
      const body = await request.json();
      const { hazardId, newDeadline, reason } = body;

      if (!hazardId || !newDeadline || !reason) {
        return NextResponse.json(
          { success: false, error: '缺少必要参数：hazardId, newDeadline, reason' },
          { status: 400 }
        );
      }

      const extension = await requestExtension({
        hazardId,
        newDeadline,
        reason,
        applicantId: user.id,
        applicantName: user.name
      });

      return NextResponse.json({
        success: true,
        data: extension
      });
    } catch (error: any) {
      console.error('[API] 申请延期失败:', error);
      return NextResponse.json(
        { success: false, error: error.message || '申请延期失败' },
        { status: 400 }
      );
    }
  })
);

/**
 * PATCH - 审批延期
 */
export const PATCH = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    try {
      const body = await request.json();
      const { extensionId, approved } = body;

      if (!extensionId || typeof approved !== 'boolean') {
        return NextResponse.json(
          { success: false, error: '缺少必要参数：extensionId, approved' },
          { status: 400 }
        );
      }

      const result = await approveExtension({
        extensionId,
        approverId: user.id,
        approverName: user.name,
        approved
      });

      return NextResponse.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('[API] 审批延期失败:', error);
      return NextResponse.json(
        { success: false, error: error.message || '审批延期失败' },
        { status: 400 }
      );
    }
  })
);

/**
 * GET - 获取隐患的延期记录
 */
export const GET = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    try {
      const { searchParams } = new URL(request.url);
      const hazardId = searchParams.get('hazardId');

      if (!hazardId) {
        return NextResponse.json(
          { success: false, error: '缺少参数：hazardId' },
          { status: 400 }
        );
      }

      const extensions = await getHazardExtensions(hazardId);

      return NextResponse.json({
        success: true,
        data: extensions
      });
    } catch (error: any) {
      console.error('[API] 获取延期记录失败:', error);
      return NextResponse.json(
        { success: false, error: error.message || '获取延期记录失败' },
        { status: 400 }
      );
    }
  })
);

