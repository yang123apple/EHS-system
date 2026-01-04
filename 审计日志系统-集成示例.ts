/**
 * 审计日志系统集成示例
 * 
 * 演示如何在现有业务代码中集成新的审计日志系统
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import AuditService from '@/services/audit.service';
import { LogModule, LogAction, BusinessRole } from '@/types/audit';

// ============================================================
// 示例 1：隐患管理 API - 创建隐患
// ============================================================

export async function POST_CreateHazard(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await getCurrentUser(request); // 假设有这个函数获取当前用户

    // 1. 执行业务逻辑：创建隐患
    const hazard = await prisma.hazardRecord.create({
      data: {
        code: generateHazardCode(), // 如：HZ-2024-001
        type: body.type,
        location: body.location,
        desc: body.desc,
        riskLevel: body.riskLevel,
        photos: JSON.stringify(body.photos || []),
        reporterId: user.id,
        reporterName: user.name,
        status: 'reported',
        reportTime: new Date(),
      },
      include: {
        reporter: true,
      },
    });

    // 2. 🟢 记录审计日志
    await AuditService.logCreate({
      module: LogModule.HAZARD,
      businessId: hazard.code || undefined,  // ⚠️ 使用业务编号（null 转 undefined）
      targetType: 'hazard',
      targetLabel: hazard.desc?.substring(0, 50),
      targetLink: `/hazard/${hazard.id}`,
      newData: hazard,
      operator: {
        id: user.id,
        name: user.name,
        role: user.role,
        departmentName: user.department?.name,
      },
      businessRole: BusinessRole.REPORTER,
      request,
    });

    return NextResponse.json({ success: true, data: hazard });
  } catch (error) {
    console.error('创建隐患失败:', error);
    return NextResponse.json(
      { success: false, error: '创建隐患失败' },
      { status: 500 }
    );
  }
}

// ============================================================
// 示例 2：隐患管理 API - 分配整改责任人
// ============================================================

export async function PATCH_AssignHazard(request: NextRequest) {
  try {
    const body = await request.json();
    const { hazardId, responsibleId } = body;
    const user = await getCurrentUser(request);

    // 1. 查询旧数据（用于 Diff）
    const oldHazard = await prisma.hazardRecord.findUnique({
      where: { id: hazardId },
    });

    if (!oldHazard) {
      return NextResponse.json(
        { success: false, error: '隐患不存在' },
        { status: 404 }
      );
    }

    // 2. 查询责任人信息
    const responsible = await prisma.user.findUnique({
      where: { id: responsibleId },
      include: { department: true },
    });

    if (!responsible) {
      return NextResponse.json(
        { success: false, error: '责任人不存在' },
        { status: 404 }
      );
    }

    // 3. 执行业务逻辑：分配责任人
    const updatedHazard = await prisma.hazardRecord.update({
      where: { id: hazardId },
      data: {
        responsibleId,
        responsibleName: responsible.name,
        responsibleDept: responsible.department?.name,
        status: 'assigned',
      },
    });

    // 4. 🟢 记录审计日志（自动计算 Diff）
    await AuditService.logAssign({
      module: LogModule.HAZARD,
      businessId: oldHazard.code || undefined,
      targetType: 'hazard',
      targetLabel: oldHazard.desc?.substring(0, 50),
      targetLink: `/hazard/${hazardId}`,
      oldData: oldHazard,
      newData: updatedHazard,
      operator: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      description: `${user.name} 将隐患 [${oldHazard.code}] 分配给 ${responsible.name}`,
      request,
    });

    return NextResponse.json({ success: true, data: updatedHazard });
  } catch (error) {
    console.error('分配隐患失败:', error);
    return NextResponse.json(
      { success: false, error: '分配隐患失败' },
      { status: 500 }
    );
  }
}

// ============================================================
// 示例 3：隐患管理 API - 提交整改
// ============================================================

export async function PATCH_SubmitRectification(request: NextRequest) {
  try {
    const body = await request.json();
    const { hazardId, rectifyDesc, rectifyPhotos } = body;
    const user = await getCurrentUser(request);

    // 1. 查询旧数据
    const oldHazard = await prisma.hazardRecord.findUnique({
      where: { id: hazardId },
    });

    if (!oldHazard) {
      return NextResponse.json(
        { success: false, error: '隐患不存在' },
        { status: 404 }
      );
    }

    // 2. 验证权限：只有责任人可以提交整改
    if (oldHazard.responsibleId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '无权限：您不是该隐患的整改人' },
        { status: 403 }
      );
    }

    // 3. 执行业务逻辑：提交整改
    const updatedHazard = await prisma.hazardRecord.update({
      where: { id: hazardId },
      data: {
        rectifyDesc,
        rectifyPhotos: JSON.stringify(rectifyPhotos || []),
        rectifyTime: new Date(),
        status: 'rectified',
      },
    });

    // 4. 🟢 记录审计日志
    await AuditService.recordLog({
      module: LogModule.HAZARD,
      action: LogAction.SUBMIT,
      businessId: oldHazard.code || undefined,
      targetType: 'hazard',
      targetLabel: oldHazard.desc?.substring(0, 50),
      targetLink: `/hazard/${hazardId}`,
      oldData: oldHazard,
      newData: updatedHazard,
      operator: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      businessRole: BusinessRole.RECTIFIER,
      description: `${user.name} 提交了隐患 [${oldHazard.code}] 的整改`,
      request,
    });

    return NextResponse.json({ success: true, data: updatedHazard });
  } catch (error) {
    console.error('提交整改失败:', error);
    return NextResponse.json(
      { success: false, error: '提交整改失败' },
      { status: 500 }
    );
  }
}

// ============================================================
// 示例 4：隐患管理 API - 验收通过/驳回
// ============================================================

export async function PATCH_VerifyHazard(request: NextRequest) {
  try {
    const body = await request.json();
    const { hazardId, action, comments } = body; // action: 'pass' | 'reject'
    const user = await getCurrentUser(request);

    // 1. 查询旧数据
    const oldHazard = await prisma.hazardRecord.findUnique({
      where: { id: hazardId },
    });

    if (!oldHazard) {
      return NextResponse.json(
        { success: false, error: '隐患不存在' },
        { status: 404 }
      );
    }

    // 2. 执行业务逻辑
    const newStatus = action === 'pass' ? 'verified' : 'assigned';
    const updatedHazard = await prisma.hazardRecord.update({
      where: { id: hazardId },
      data: {
        status: newStatus,
        verifierId: user.id,
        verifierName: user.name,
        verifyTime: new Date(),
      },
    });

    // 3. 🟢 记录审计日志
    if (action === 'pass') {
      await AuditService.recordLog({
        module: LogModule.HAZARD,
        action: LogAction.APPROVE,
        businessId: oldHazard.code || undefined,
        targetType: 'hazard',
        targetLabel: oldHazard.desc?.substring(0, 50),
        targetLink: `/hazard/${hazardId}`,
        oldData: oldHazard,
        newData: updatedHazard,
        operator: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        businessRole: BusinessRole.VERIFIER,
        description: `${user.name} 验收通过了隐患 [${oldHazard.code}]`,
        request,
      });
    } else {
      await AuditService.logReject({
        module: LogModule.HAZARD,
        businessId: oldHazard.code || undefined,
        targetType: 'hazard',
        targetLabel: oldHazard.desc?.substring(0, 50),
        targetLink: `/hazard/${hazardId}`,
        oldData: oldHazard,
        newData: updatedHazard,
        operator: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        businessRole: BusinessRole.VERIFIER,
        description: `${user.name} 驳回了隐患 [${oldHazard.code}] 的整改，原因：${comments}`,
        request,
      });
    }

    return NextResponse.json({ success: true, data: updatedHazard });
  } catch (error) {
    console.error('验收操作失败:', error);
    return NextResponse.json(
      { success: false, error: '验收操作失败' },
      { status: 500 }
    );
  }
}

// ============================================================
// 示例 5：用户管理 - 修改密码（不记录密码内容）
// ============================================================

export async function PATCH_ChangePassword(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;
    const user = await getCurrentUser(request);

    // 1. 查询用户
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 2. 验证当前密码
    const isValid = await verifyPassword(currentPassword, existingUser.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '当前密码错误' },
        { status: 400 }
      );
    }

    // 3. 更新密码
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // 4. 🟢 记录审计日志（不传递密码数据）
    await AuditService.recordLog({
      module: LogModule.USER,
      action: LogAction.UPDATE,
      businessId: existingUser.username,
      targetType: 'user',
      targetLabel: existingUser.name,
      operator: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      description: `${user.name} 修改了密码`,
      request,
      // ⚠️ 不传递 oldData 和 newData，避免记录密码
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('修改密码失败:', error);
    return NextResponse.json(
      { success: false, error: '修改密码失败' },
      { status: 500 }
    );
  }
}

// ============================================================
// 示例 6：系统设置 - 更新工作流配置
// ============================================================

export async function PATCH_UpdateWorkflowConfig(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowConfig } = body;
    const user = await getCurrentUser(request);

    // 1. 查询旧配置
    const oldConfig = await prisma.hazardConfig.findUnique({
      where: { key: 'workflow' },
    });

    // 2. 更新配置
    const newConfig = await prisma.hazardConfig.upsert({
      where: { key: 'workflow' },
      create: {
        key: 'workflow',
        value: JSON.stringify(workflowConfig),
        description: '隐患工作流配置',
      },
      update: {
        value: JSON.stringify(workflowConfig),
      },
    });

    // 3. 🟢 记录审计日志
    await AuditService.recordLog({
      module: LogModule.SYSTEM,
      action: LogAction.CONFIG,
      targetType: 'workflow',
      targetLabel: '隐患工作流配置',
      oldData: oldConfig ? JSON.parse(oldConfig.value) : null,
      newData: workflowConfig,
      operator: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      description: `${user.name} 更新了隐患工作流配置`,
      request,
    });

    return NextResponse.json({ success: true, data: newConfig });
  } catch (error) {
    console.error('更新配置失败:', error);
    return NextResponse.json(
      { success: false, error: '更新配置失败' },
      { status: 500 }
    );
  }
}

// ============================================================
// 辅助函数（示例，需根据实际项目调整）
// ============================================================

async function getCurrentUser(request: NextRequest): Promise<any> {
  // 实际项目中从 Session/JWT 获取用户信息
  // 这里仅作示例
  return {
    id: 'user-123',
    name: '张三',
    role: 'admin',
    department: { name: '安全部' },
  };
}

function generateHazardCode(): string {
  // 生成隐患编号，如：HZ-2024-001
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `HZ-${year}-${random}`;
}

async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  // 实际使用 bcrypt.compare
  return true;
}

async function hashPassword(password: string): Promise<string> {
  // 实际使用 bcrypt.hash
  return `hashed_${password}`;
}
