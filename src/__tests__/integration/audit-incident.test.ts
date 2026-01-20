/**
 * 事故模块日志系统集成测试
 * 
 * 验证 INCIDENT 模块的日志记录功能
 */

import { PrismaClient } from '@prisma/client';
import AuditService from '@/services/audit.service';
import { LogModule, LogAction } from '@/types/audit';

const prisma = new PrismaClient();

describe('Incident Module Audit Integration Tests', () => {
  let testUserId: string;
  let testIncidentId: string;

  beforeAll(async () => {
    // 创建测试用户
    const testUser = await prisma.user.create({
      data: {
        username: 'test_incident_user',
        name: '测试事故用户',
        password: 'test123',
        role: 'user',
      },
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.systemLog.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.incident.deleteMany({
      where: { reporterId: testUserId },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  test('应该记录事故创建日志', async () => {
    // 创建测试事故
    const incident = await prisma.incident.create({
      data: {
        code: 'INC-TEST-001',
        type: 'near_miss',
        severity: 'minor',
        occurredAt: new Date(),
        location: '测试地点',
        description: '测试事故描述',
        reporterId: testUserId,
        reporterName: '测试事故用户',
        reporterDept: '测试部门',
      },
    });
    testIncidentId = incident.id;

    // 记录审计日志
    await AuditService.recordLog({
      module: LogModule.INCIDENT,
      action: LogAction.CREATE,
      businessId: incident.code!,
      targetType: 'incident',
      targetLabel: incident.description.substring(0, 50),
      newData: incident,
      operator: {
        id: testUserId,
        name: '测试事故用户',
        role: 'user',
      },
    });

    // 验证日志已创建
    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.INCIDENT,
        action: LogAction.CREATE,
        targetId: incident.code!,
      },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].module).toBe(LogModule.INCIDENT);
    expect(logs[0].action).toBe(LogAction.CREATE);
    expect(logs[0].targetId).toBe(incident.code);
    expect(logs[0].userId).toBe(testUserId);
    expect(logs[0].snapshot).toBeTruthy();
  });

  test('应该记录事故提交日志', async () => {
    await AuditService.recordLog({
      module: LogModule.INCIDENT,
      action: LogAction.SUBMIT,
      businessId: 'INC-TEST-001',
      targetType: 'incident',
      targetLabel: '测试事故描述',
      operator: {
        id: testUserId,
        name: '测试事故用户',
        role: 'user',
      },
    });

    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.INCIDENT,
        action: LogAction.SUBMIT,
        targetId: 'INC-TEST-001',
      },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(LogAction.SUBMIT);
  });

  test('应该记录事故关闭日志', async () => {
    const oldData = await prisma.incident.findUnique({
      where: { id: testIncidentId },
    });

    const newData = await prisma.incident.update({
      where: { id: testIncidentId },
      data: {
        status: 'closed',
        closerId: testUserId,
        closerName: '测试事故用户',
        closeTime: new Date(),
        closeReason: '测试关闭原因',
      },
    });

    await AuditService.recordLog({
      module: LogModule.INCIDENT,
      action: LogAction.CLOSE,
      businessId: newData.code!,
      targetType: 'incident',
      targetLabel: newData.description.substring(0, 50),
      oldData,
      newData,
      operator: {
        id: testUserId,
        name: '测试事故用户',
        role: 'user',
      },
    });

    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.INCIDENT,
        action: LogAction.CLOSE,
        targetId: newData.code!,
      },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(LogAction.CLOSE);
    expect(logs[0].diff).toBeTruthy(); // 应该包含差异对比
    const diff = JSON.parse(logs[0].diff!);
    expect(diff.status).toBeDefined();
    expect(diff.status.old).toBe('reported');
    expect(diff.status.new).toBe('closed');
  });

  test('应该能够查询事故模块的所有日志', async () => {
    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.INCIDENT,
        targetId: 'INC-TEST-001',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(log => log.module === LogModule.INCIDENT)).toBe(true);
  });
});
