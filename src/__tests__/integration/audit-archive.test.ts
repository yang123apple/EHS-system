/**
 * 档案库模块日志系统集成测试
 * 
 * 验证 ARCHIVE 模块的日志记录功能
 */

import { PrismaClient } from '@prisma/client';
import AuditService from '@/services/audit.service';
import { LogModule, LogAction } from '@/types/audit';

const prisma = new PrismaClient();

describe('Archive Module Audit Integration Tests', () => {
  let testUserId: string;
  let testEquipmentId: string;
  let testArchiveFileId: string;

  beforeAll(async () => {
    // 创建测试用户
    const testUser = await prisma.user.create({
      data: {
        username: 'test_archive_user',
        name: '测试档案用户',
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
    await prisma.archiveFile.deleteMany({
      where: { uploaderId: testUserId },
    });
    await prisma.equipment.deleteMany({
      where: { code: 'EQ-TEST-001' },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  test('应该记录设备创建日志', async () => {
    // 创建测试设备
    const equipment = await prisma.equipment.create({
      data: {
        name: '测试设备',
        code: 'EQ-TEST-001',
        description: '测试设备描述',
        startDate: new Date(),
        isSpecialEquip: true,
        inspectionCycle: 12,
      },
    });
    testEquipmentId = equipment.id;

    // 记录审计日志
    await AuditService.recordLog({
      module: LogModule.ARCHIVE,
      action: LogAction.CREATE,
      businessId: equipment.code,
      targetType: 'equipment',
      targetLabel: equipment.name,
      newData: equipment,
      operator: {
        id: testUserId,
        name: '测试档案用户',
        role: 'user',
      },
    });

    // 验证日志已创建
    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.ARCHIVE,
        action: LogAction.CREATE,
        targetId: equipment.code,
      },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].module).toBe(LogModule.ARCHIVE);
    expect(logs[0].action).toBe(LogAction.CREATE);
    expect(logs[0].targetType).toBe('equipment');
    expect(logs[0].snapshot).toBeTruthy();
  });

  test('应该记录档案文件上传日志', async () => {
    // 创建测试档案文件
    const archiveFile = await prisma.archiveFile.create({
      data: {
        name: '测试档案文件',
        fileType: '营业执照',
        category: 'enterprise',
        filePath: 'ehs-private/archives/enterprise/test-file.pdf',
        originalName: 'test-file.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024000,
        uploaderId: testUserId,
        uploaderName: '测试档案用户',
      },
    });
    testArchiveFileId = archiveFile.id;

    await AuditService.recordLog({
      module: LogModule.ARCHIVE,
      action: LogAction.UPLOAD,
      businessId: archiveFile.id,
      targetType: 'archive_file',
      targetLabel: archiveFile.name,
      newData: archiveFile,
      operator: {
        id: testUserId,
        name: '测试档案用户',
        role: 'user',
      },
    });

    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.ARCHIVE,
        action: LogAction.UPLOAD,
        targetId: archiveFile.id,
      },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(LogAction.UPLOAD);
    expect(logs[0].targetType).toBe('archive_file');
  });

  test('应该记录档案文件查看日志', async () => {
    await AuditService.recordLog({
      module: LogModule.ARCHIVE,
      action: LogAction.VIEW,
      businessId: testArchiveFileId,
      targetType: 'archive_file',
      targetLabel: '测试档案文件',
      operator: {
        id: testUserId,
        name: '测试档案用户',
        role: 'user',
      },
    });

    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.ARCHIVE,
        action: LogAction.VIEW,
        targetId: testArchiveFileId,
      },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(LogAction.VIEW);
  });

  test('应该记录档案文件下载日志', async () => {
    await AuditService.recordLog({
      module: LogModule.ARCHIVE,
      action: LogAction.DOWNLOAD,
      businessId: testArchiveFileId,
      targetType: 'archive_file',
      targetLabel: '测试档案文件',
      operator: {
        id: testUserId,
        name: '测试档案用户',
        role: 'user',
      },
    });

    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.ARCHIVE,
        action: LogAction.DOWNLOAD,
        targetId: testArchiveFileId,
      },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(LogAction.DOWNLOAD);
  });

  test('应该记录设备信息更新日志', async () => {
    const oldData = await prisma.equipment.findUnique({
      where: { id: testEquipmentId },
    });

    const newData = await prisma.equipment.update({
      where: { id: testEquipmentId },
      data: {
        nextInspection: new Date('2026-06-01'),
        lastInspection: new Date('2025-06-01'),
      },
    });

    await AuditService.recordLog({
      module: LogModule.ARCHIVE,
      action: LogAction.UPDATE,
      businessId: newData.code,
      targetType: 'equipment',
      targetLabel: newData.name,
      oldData,
      newData,
      operator: {
        id: testUserId,
        name: '测试档案用户',
        role: 'user',
      },
    });

    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.ARCHIVE,
        action: LogAction.UPDATE,
        targetId: newData.code,
      },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].diff).toBeTruthy();
    const diff = JSON.parse(logs[0].diff!);
    expect(diff.nextInspection).toBeDefined();
    expect(diff.lastInspection).toBeDefined();
  });

  test('应该记录档案配置更新日志', async () => {
    const config = await prisma.archiveConfig.upsert({
      where: { key: 'test_config' },
      update: {
        value: JSON.stringify({ enabled: true, testMode: true }),
      },
      create: {
        key: 'test_config',
        value: JSON.stringify({ enabled: true, testMode: true }),
      },
    });

    await AuditService.recordLog({
      module: LogModule.ARCHIVE,
      action: LogAction.CONFIG,
      businessId: config.key,
      targetType: 'archive_config',
      targetLabel: config.key,
      newData: config,
      operator: {
        id: testUserId,
        name: '测试档案用户',
        role: 'admin',
      },
    });

    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.ARCHIVE,
        action: LogAction.CONFIG,
        targetId: config.key,
      },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(LogAction.CONFIG);

    // 清理配置
    await prisma.archiveConfig.delete({
      where: { key: 'test_config' },
    });
  });

  test('应该能够查询档案模块的所有日志', async () => {
    const logs = await prisma.systemLog.findMany({
      where: {
        module: LogModule.ARCHIVE,
        userId: testUserId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(log => log.module === LogModule.ARCHIVE)).toBe(true);
    
    // 验证包含各种操作类型
    const actions = logs.map(log => log.action);
    expect(actions).toContain(LogAction.CREATE);
    expect(actions).toContain(LogAction.UPLOAD);
    expect(actions).toContain(LogAction.VIEW);
    expect(actions).toContain(LogAction.DOWNLOAD);
    expect(actions).toContain(LogAction.UPDATE);
  });
});
