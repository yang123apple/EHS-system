/**
 * AuditService.logView 使用示例
 * 
 * 本文件展示了如何在 Next.js API Route 中使用 logView 方法
 * 来记录敏感数据的查看行为。
 */

import { NextRequest, NextResponse } from 'next/server';
import AuditService from '@/services/audit.service';
import { LogModule } from '@/types/audit';
import { requireAuth } from '@/middleware/auth';

/**
 * 示例 1：在获取事故调查报告详情的 API 中记录敏感查看
 * 
 * API Route: GET /api/incidents/[id]
 */
export async function GET_IncidentDetail(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 认证和权限检查
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 2. 获取事故调查报告数据
    const incidentId = params.id;
    // const incident = await getIncidentById(incidentId); // 伪代码

    // 3. 记录敏感数据查看（事故调查报告包含敏感信息）
    await AuditService.logView(
      {
        module: LogModule.HAZARD, // 或 LogModule.INCIDENT（如果定义了）
        businessId: incidentId,
        targetType: 'incident_report',
        targetLabel: `事故调查报告 [${incidentId}]`,
        targetLink: `/incidents/${incidentId}`,
        operator: {
          id: user.id,
          name: user.name,
          role: user.role,
          departmentId: user.departmentId,
          departmentName: user.departmentName,
          jobTitle: user.jobTitle,
        },
        request,
      },
      true, // isSensitive = true，会记录到数据库
      '查看事故调查报告详情，用于调查分析' // 查看理由
    );

    // 4. 返回数据
    return NextResponse.json({
      success: true,
      data: {
        // incident data
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}

/**
 * 示例 2：在获取员工健康档案的 API 中记录敏感查看
 * 
 * API Route: GET /api/employees/[id]/health-record
 */
export async function GET_EmployeeHealthRecord(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const employeeId = params.id;
    // const healthRecord = await getEmployeeHealthRecord(employeeId); // 伪代码

    // 记录敏感数据查看（健康档案是敏感信息）
    await AuditService.logView(
      {
        module: LogModule.USER, // 或 LogModule.HEALTH（如果定义了）
        businessId: employeeId,
        targetType: 'health_record',
        targetLabel: `员工健康档案 [${employeeId}]`,
        targetLink: `/employees/${employeeId}/health`,
        operator: {
          id: user.id,
          name: user.name,
          role: user.role,
          departmentId: user.departmentId,
          departmentName: user.departmentName,
        },
        request,
      },
      true, // 敏感数据，需要记录
      '查看员工健康档案，用于健康管理' // 查看理由
    );

    return NextResponse.json({
      success: true,
      data: {
        // health record data
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}

/**
 * 示例 3：普通列表页 - 不记录（isSensitive = false）
 * 
 * API Route: GET /api/incidents
 */
export async function GET_IncidentList(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 普通列表页访问，不需要记录（isSensitive = false）
    // 这样不会产生大量日志
    await AuditService.logView(
      {
        module: LogModule.HAZARD,
        operator: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        request,
      },
      false // isSensitive = false，不会写入数据库
    );

    // 获取列表数据
    // const incidents = await getIncidentList(); // 伪代码

    return NextResponse.json({
      success: true,
      data: {
        // list data
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}

/**
 * 示例 4：在 Server Component 中使用（如果需要在服务端组件中记录）
 * 
 * 注意：Server Component 中没有 request 对象，可以省略 request 参数
 */
export async function ServerComponentExample() {
  // 假设从 session 获取用户信息
  // const session = await getServerSession();
  // const user = session?.user;

  // 记录敏感数据查看
  await AuditService.logView(
    {
      module: LogModule.DOCUMENT,
      businessId: 'DOC-2024-001',
      targetType: 'confidential_document',
      targetLabel: '机密文档',
      operator: {
        id: 'user-id',
        name: '用户名',
        role: 'admin',
      },
      // request 参数在 Server Component 中可以省略
    },
    true,
    '查看机密文档内容'
  );

  // 返回组件内容
  return null;
}

/**
 * 使用建议：
 * 
 * 1. 敏感数据判断标准：
 *    - 包含个人隐私信息（健康档案、身份证号、联系方式等）
 *    - 包含商业机密（财务数据、技术方案等）
 *    - 包含安全事故核心证据（调查报告、现场照片等）
 *    - 包含敏感操作记录（审批流程、权限变更等）
 * 
 * 2. 普通数据（不需要记录）：
 *    - 列表页访问
 *    - 公开信息查看
 *    - 非敏感文档浏览
 * 
 * 3. 查看理由（reason）应该：
 *    - 简洁明了，说明查看目的
 *    - 便于后续审计追溯
 *    - 例如："调查事故原因"、"健康管理需要"、"审批流程审核"等
 * 
 * 4. 性能考虑：
 *    - logView 方法在 isSensitive=false 时会立即返回，不会执行数据库操作
 *    - 因此可以在所有查看操作中调用，由 isSensitive 参数控制是否真正记录
 */



