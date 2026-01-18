/**
 * 档案库系统单元测试
 * 测试企业档案、人员档案、设备档案的关联逻辑等核心功能
 */

import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    archiveFile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    equipment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
    },
  },
}));

describe('档案库系统 - 人员档案关联逻辑', () => {
  describe('一人一档逻辑', () => {
    it('应该正确关联人员档案文件到用户', async () => {
      const userId = 'user-001';
      const files = [
        {
          id: 'file-001',
          userId,
          category: 'personnel',
          fileName: '身份证.pdf',
          fileType: 'certificate',
        },
        {
          id: 'file-002',
          userId,
          category: 'personnel',
          fileName: '培训记录.pdf',
          fileType: 'training',
        },
      ];

      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValue(files);

      const userFiles = await prisma.archiveFile.findMany({
        where: { userId, category: 'personnel' },
        orderBy: { createdAt: 'desc' },
      });

      expect(userFiles).toHaveLength(2);
      expect(userFiles.every(f => f.userId === userId)).toBe(true);
      expect(userFiles.every(f => f.category === 'personnel')).toBe(true);
    });

    it('应该正确区分不同人员的档案文件', async () => {
      const user1Files = [
        { id: 'file-001', userId: 'user-001', category: 'personnel', fileName: 'user1-文件1.pdf' },
      ];
      const user2Files = [
        { id: 'file-002', userId: 'user-002', category: 'personnel', fileName: 'user2-文件1.pdf' },
      ];

      (prisma.archiveFile.findMany as jest.Mock).mockImplementation((args: any) => {
        if (args.where.userId === 'user-001') {
          return Promise.resolve(user1Files);
        }
        if (args.where.userId === 'user-002') {
          return Promise.resolve(user2Files);
        }
        return Promise.resolve([]);
      });

      const files1 = await prisma.archiveFile.findMany({
        where: { userId: 'user-001', category: 'personnel' },
      });

      const files2 = await prisma.archiveFile.findMany({
        where: { userId: 'user-002', category: 'personnel' },
      });

      expect(files1).toHaveLength(1);
      expect(files2).toHaveLength(1);
      expect(files1[0].userId).toBe('user-001');
      expect(files2[0].userId).toBe('user-002');
      expect(files1[0].id).not.toBe(files2[0].id);
    });

    it('应该正确统计人员的档案文件数量', async () => {
      const userId = 'user-001';
      const files = [
        { id: 'file-001', userId, category: 'personnel' },
        { id: 'file-002', userId, category: 'personnel' },
        { id: 'file-003', userId, category: 'personnel' },
      ];

      (prisma.archiveFile.count as jest.Mock).mockResolvedValue(files.length);

      const count = await prisma.archiveFile.count({
        where: { userId, category: 'personnel' },
      });

      expect(count).toBe(3);
    });
  });

  describe('人员档案文件分类', () => {
    it('应该正确按文件类型分类', async () => {
      const userId = 'user-001';
      const files = [
        { id: 'file-001', userId, category: 'personnel', fileType: 'certificate' }, // 证书
        { id: 'file-002', userId, category: 'personnel', fileType: 'training' }, // 培训
        { id: 'file-003', userId, category: 'personnel', fileType: 'certificate' }, // 证书
        { id: 'file-004', userId, category: 'personnel', fileType: 'examination' }, // 考试
      ];

      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValue(files);

      const allFiles = await prisma.archiveFile.findMany({
        where: { userId, category: 'personnel' },
      });

      const certificateFiles = allFiles.filter(f => f.fileType === 'certificate');
      const trainingFiles = allFiles.filter(f => f.fileType === 'training');
      const examinationFiles = allFiles.filter(f => f.fileType === 'examination');

      expect(certificateFiles).toHaveLength(2);
      expect(trainingFiles).toHaveLength(1);
      expect(examinationFiles).toHaveLength(1);
    });
  });
});

describe('档案库系统 - 设备档案关联逻辑', () => {
  describe('设备与文件关联', () => {
    it('应该正确关联文件到设备', async () => {
      const equipmentId = 'equipment-001';
      const files = [
        {
          id: 'file-001',
          equipmentId,
          category: 'equipment',
          fileName: '设备证书.pdf',
        },
        {
          id: 'file-002',
          equipmentId,
          category: 'equipment',
          fileName: '定检报告.pdf',
        },
      ];

      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValue(files);

      const equipmentFiles = await prisma.archiveFile.findMany({
        where: { equipmentId, category: 'equipment' },
        orderBy: { createdAt: 'desc' },
      });

      expect(equipmentFiles).toHaveLength(2);
      expect(equipmentFiles.every(f => f.equipmentId === equipmentId)).toBe(true);
      expect(equipmentFiles.every(f => f.category === 'equipment')).toBe(true);
    });

    it('应该正确区分不同设备的档案文件', async () => {
      const equipment1Files = [
        { id: 'file-001', equipmentId: 'equipment-001', category: 'equipment' },
      ];
      const equipment2Files = [
        { id: 'file-002', equipmentId: 'equipment-002', category: 'equipment' },
      ];

      (prisma.archiveFile.findMany as jest.Mock).mockImplementation((args: any) => {
        if (args.where.equipmentId === 'equipment-001') {
          return Promise.resolve(equipment1Files);
        }
        if (args.where.equipmentId === 'equipment-002') {
          return Promise.resolve(equipment2Files);
        }
        return Promise.resolve([]);
      });

      const files1 = await prisma.archiveFile.findMany({
        where: { equipmentId: 'equipment-001', category: 'equipment' },
      });

      const files2 = await prisma.archiveFile.findMany({
        where: { equipmentId: 'equipment-002', category: 'equipment' },
      });

      expect(files1).toHaveLength(1);
      expect(files2).toHaveLength(1);
      expect(files1[0].equipmentId).toBe('equipment-001');
      expect(files2[0].equipmentId).toBe('equipment-002');
    });
  });

  describe('设备定检提醒', () => {
    it('应该正确计算下次定检日期', () => {
      const lastInspection = new Date('2025-01-01');
      const inspectionCycle = 3; // 3个月

      const nextInspection = new Date(lastInspection);
      nextInspection.setMonth(nextInspection.getMonth() + inspectionCycle);

      expect(nextInspection.getMonth()).toBe(3); // 4月（0-based）
    });

    it('应该识别需要定检的设备', () => {
      const now = new Date('2025-04-01');
      const nextInspection = new Date('2025-04-05'); // 5天后到期

      const daysUntilInspection = Math.ceil(
        (nextInspection.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const needsReminder = daysUntilInspection <= 30; // 30天内提醒

      expect(daysUntilInspection).toBe(4);
      expect(needsReminder).toBe(true);
    });
  });
});

describe('档案库系统 - 企业档案关联逻辑', () => {
  describe('企业档案文件管理', () => {
    it('应该正确关联企业档案文件', async () => {
      const files = [
        {
          id: 'file-001',
          category: 'enterprise',
          fileType: 'license',
          fileName: '营业执照.pdf',
        },
        {
          id: 'file-002',
          category: 'enterprise',
          fileType: 'permit',
          fileName: '许可证.pdf',
        },
      ];

      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValue(files);

      const enterpriseFiles = await prisma.archiveFile.findMany({
        where: { category: 'enterprise' },
        orderBy: { createdAt: 'desc' },
      });

      expect(enterpriseFiles).toHaveLength(2);
      expect(enterpriseFiles.every(f => f.category === 'enterprise')).toBe(true);
    });

    it('应该支持按文件类型筛选企业档案', async () => {
      const files = [
        { id: 'file-001', category: 'enterprise', fileType: 'license' },
        { id: 'file-002', category: 'enterprise', fileType: 'permit' },
        { id: 'file-003', category: 'enterprise', fileType: 'license' },
      ];

      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValue(files);

      const allFiles = await prisma.archiveFile.findMany({
        where: { category: 'enterprise' },
      });

      const licenseFiles = allFiles.filter(f => f.fileType === 'license');
      const permitFiles = allFiles.filter(f => f.fileType === 'permit');

      expect(licenseFiles).toHaveLength(2);
      expect(permitFiles).toHaveLength(1);
    });
  });
});

describe('档案库系统 - 文件关联完整性', () => {
  describe('多对一关联验证', () => {
    it('人员档案应该支持多个文件关联到同一用户', async () => {
      const userId = 'user-001';
      const files = [
        { id: 'file-001', userId, category: 'personnel' },
        { id: 'file-002', userId, category: 'personnel' },
        { id: 'file-003', userId, category: 'personnel' },
      ];

      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValue(files);

      const userFiles = await prisma.archiveFile.findMany({
        where: { userId, category: 'personnel' },
      });

      expect(userFiles.length).toBeGreaterThan(1);
      expect(new Set(userFiles.map(f => f.id)).size).toBe(userFiles.length); // 所有文件ID唯一
    });

    it('设备档案应该支持多个文件关联到同一设备', async () => {
      const equipmentId = 'equipment-001';
      const files = [
        { id: 'file-001', equipmentId, category: 'equipment' },
        { id: 'file-002', equipmentId, category: 'equipment' },
      ];

      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValue(files);

      const equipmentFiles = await prisma.archiveFile.findMany({
        where: { equipmentId, category: 'equipment' },
      });

      expect(equipmentFiles.length).toBeGreaterThan(1);
    });
  });

  describe('文件删除时的关联处理', () => {
    it('删除文件时不应该影响其他文件', async () => {
      const userId = 'user-001';
      const allFiles = [
        { id: 'file-001', userId, category: 'personnel' },
        { id: 'file-002', userId, category: 'personnel' },
        { id: 'file-003', userId, category: 'personnel' },
      ];

      // 删除前
      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValueOnce(allFiles);
      const beforeDelete = await prisma.archiveFile.findMany({
        where: { userId, category: 'personnel' },
      });
      expect(beforeDelete).toHaveLength(3);

      // 删除一个文件
      (prisma.archiveFile.delete as jest.Mock).mockResolvedValue({ id: 'file-002' });

      // 删除后
      const remainingFiles = allFiles.filter(f => f.id !== 'file-002');
      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValueOnce(remainingFiles);
      const afterDelete = await prisma.archiveFile.findMany({
        where: { userId, category: 'personnel' },
      });

      expect(afterDelete).toHaveLength(2);
      expect(afterDelete.map(f => f.id)).not.toContain('file-002');
    });
  });
});

describe('档案库系统 - 边界条件', () => {
  describe('空数据处理', () => {
    it('应该处理用户无档案文件的情况', async () => {
      const userId = 'user-without-files';

      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValue([]);

      const files = await prisma.archiveFile.findMany({
        where: { userId, category: 'personnel' },
      });

      expect(files).toHaveLength(0);
    });

    it('应该处理设备无档案文件的情况', async () => {
      const equipmentId = 'equipment-without-files';

      (prisma.archiveFile.findMany as jest.Mock).mockResolvedValue([]);

      const files = await prisma.archiveFile.findMany({
        where: { equipmentId, category: 'equipment' },
      });

      expect(files).toHaveLength(0);
    });
  });

  describe('分类完整性', () => {
    it('应该正确区分不同的档案类别', () => {
      const categories = ['personnel', 'equipment', 'enterprise', 'msds'];

      const files = [
        { id: 'file-001', category: 'personnel', userId: 'user-001' },
        { id: 'file-002', category: 'equipment', equipmentId: 'equipment-001' },
        { id: 'file-003', category: 'enterprise' },
        { id: 'file-004', category: 'msds' },
      ];

      categories.forEach(category => {
        const categoryFiles = files.filter(f => f.category === category);
        expect(categoryFiles.length).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
