/**
 * 子表单 API 路由
 * 
 * 提供子表单的 CRUD 操作
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission, logApiOperation } from '@/middleware/auth';
import {
  createSubPermit,
  updateSubPermit,
  getSubPermit,
  getSubPermitsByParent,
  getSubPermitByCellKey,
  deleteSubPermit,
  extractSubPermitsFromParent,
} from '@/services/subPermitService';
export const dynamic = 'force-dynamic';

// GET: 获取子表单列表或单个子表单
export const GET = withAuth(async (req: Request, context, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const subPermitId = searchParams.get('id');
    const parentPermitId = searchParams.get('parentPermitId');
    const cellKey = searchParams.get('cellKey');
    
    // 获取单个子表单
    if (subPermitId) {
      const subPermit = await getSubPermit(subPermitId);
      if (!subPermit) {
        return NextResponse.json({ error: '子表单不存在' }, { status: 404 });
      }
      return NextResponse.json(subPermit);
    }
    
    // 根据父表单和单元格键获取
    if (parentPermitId && cellKey) {
      const subPermit = await getSubPermitByCellKey(parentPermitId, cellKey);
      if (!subPermit) {
        return NextResponse.json({ error: '子表单不存在' }, { status: 404 });
      }
      return NextResponse.json(subPermit);
    }
    
    // 获取父表单的所有子表单
    if (parentPermitId) {
      const subPermits = await getSubPermitsByParent(parentPermitId);
      return NextResponse.json(subPermits);
    }
    
    return NextResponse.json({ error: '缺少查询参数' }, { status: 400 });
  } catch (error) {
    console.error('Get SubPermit Error:', error);
    return NextResponse.json({ error: '获取子表单失败' }, { status: 500 });
  }
});

// POST: 创建子表单
export const POST = withPermission('work_permit', 'create', async (req: Request, context, user) => {
  try {
    const body = await req.json();
    const {
      parentPermitId,
      templateId,
      cellKey,
      fieldName,
      code,
      dataJson,
      status,
      currentStep,
      approvalLogs,
    } = body;
    
    if (!parentPermitId || !templateId || !cellKey || !dataJson) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }
    
    const subPermit = await createSubPermit({
      parentPermitId,
      templateId,
      cellKey,
      fieldName,
      code,
      dataJson,
      status,
      currentStep,
      approvalLogs,
    });
    
    // 记录审计日志
    await logApiOperation(
      user,
      'work_permit',
      'create_sub_permit',
      {
        subPermitId: subPermit.id,
        parentPermitId,
        cellKey,
        details: `创建子表单 - 单元格: ${cellKey}`,
      }
    );
    
    return NextResponse.json(subPermit);
  } catch (error) {
    console.error('Create SubPermit Error:', error);
    return NextResponse.json({ error: '创建子表单失败' }, { status: 500 });
  }
});

// PATCH: 更新子表单
export const PATCH = withPermission('work_permit', 'edit', async (req: Request, context, user) => {
  try {
    const body = await req.json();
    const { id, dataJson, status, currentStep, approvalLogs } = body;
    
    if (!id) {
      return NextResponse.json({ error: '缺少子表单 ID' }, { status: 400 });
    }
    
    const subPermit = await updateSubPermit(id, {
      dataJson,
      status,
      currentStep,
      approvalLogs,
    });
    
    // 记录审计日志
    await logApiOperation(
      user,
      'work_permit',
      'update_sub_permit',
      {
        subPermitId: id,
        details: '更新子表单',
      }
    );
    
    return NextResponse.json(subPermit);
  } catch (error) {
    console.error('Update SubPermit Error:', error);
    return NextResponse.json({ error: '更新子表单失败' }, { status: 500 });
  }
});

// DELETE: 删除子表单
export const DELETE = withPermission('work_permit', 'delete', async (req: Request, context, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '缺少子表单 ID' }, { status: 400 });
    }
    
    await deleteSubPermit(id);
    
    // 记录审计日志
    await logApiOperation(
      user,
      'work_permit',
      'delete_sub_permit',
      {
        subPermitId: id,
        details: '删除子表单',
      }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete SubPermit Error:', error);
    return NextResponse.json({ error: '删除子表单失败' }, { status: 500 });
  }
});

// PUT: 从父表单提取子表单（迁移工具）
export const PUT = withPermission('work_permit', 'edit', async (req: Request, context, user) => {
  try {
    const body = await req.json();
    const { parentPermitId } = body;
    
    if (!parentPermitId) {
      return NextResponse.json({ error: '缺少父表单 ID' }, { status: 400 });
    }
    
    const extracted = await extractSubPermitsFromParent(parentPermitId);
    
    return NextResponse.json({
      success: true,
      extractedCount: extracted.length,
      extractedIds: extracted,
    });
  } catch (error) {
    console.error('Extract SubPermits Error:', error);
    return NextResponse.json({ error: '提取子表单失败' }, { status: 500 });
  }
});

