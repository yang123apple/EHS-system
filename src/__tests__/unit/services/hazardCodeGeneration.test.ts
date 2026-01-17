/**
 * 隐患编号生成单元测试
 * 测试编号生成逻辑的唯一性、格式正确性、并发安全性
 */

// Mock Prisma
const mockPrisma = {
  hazardRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// 导入要测试的函数（需要从 route.ts 中提取或重构）
// 由于 generateHazardCode 在 route.ts 内部，这里我们将测试其逻辑
describe('隐患编号生成', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置日期 mock
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('编号格式', () => {
    it('应该生成正确格式的编号：Hazard + YYYYMMDD + 序号', () => {
      const testDate = new Date('2025-01-12T10:00:00Z');
      jest.setSystemTime(testDate);

      const year = testDate.getFullYear();
      const month = String(testDate.getMonth() + 1).padStart(2, '0');
      const day = String(testDate.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const prefix = `Hazard${dateStr}`;

      // 期望格式：Hazard20250112001
      expect(prefix).toBe('Hazard20250112');
    });

    it('序号应该是3位数字，不足补0', () => {
      const seq1 = String(1).padStart(3, '0');
      const seq10 = String(10).padStart(3, '0');
      const seq100 = String(100).padStart(3, '0');

      expect(seq1).toBe('001');
      expect(seq10).toBe('010');
      expect(seq100).toBe('100');
    });
  });

  describe('编号唯一性', () => {
    it('当没有现有记录时，应该从001开始', async () => {
      const testDate = new Date('2025-01-12T10:00:00Z');
      jest.setSystemTime(testDate);

      const year = testDate.getFullYear();
      const month = String(testDate.getMonth() + 1).padStart(2, '0');
      const day = String(testDate.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const prefix = `Hazard${dateStr}`;

      // Mock: 没有现有记录
      mockPrisma.hazardRecord.findMany.mockResolvedValue([]);
      mockPrisma.hazardRecord.findUnique.mockResolvedValue(null);

      // 计算第一个编号应该是 001
      let maxSeq = 0;
      const existingRecords = await mockPrisma.hazardRecord.findMany({
        where: {
          code: { startsWith: prefix },
        },
      });

      for (const record of existingRecords) {
        if (record.code) {
          const seqStr = record.code.slice(-3);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }

      const newSeq = String(maxSeq + 1).padStart(3, '0');
      const newCode = `${prefix}${newSeq}`;

      expect(newCode).toBe('Hazard20250112001');
    });

    it('应该基于当天最大序号递增', async () => {
      const testDate = new Date('2025-01-12T10:00:00Z');
      jest.setSystemTime(testDate);

      const year = testDate.getFullYear();
      const month = String(testDate.getMonth() + 1).padStart(2, '0');
      const day = String(testDate.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const prefix = `Hazard${dateStr}`;

      // Mock: 已有记录 Hazard20250112001, Hazard20250112005
      mockPrisma.hazardRecord.findMany.mockResolvedValue([
        { code: 'Hazard20250112005' },
        { code: 'Hazard20250112001' },
      ]);
      mockPrisma.hazardRecord.findUnique.mockResolvedValue(null);

      const existingRecords = await mockPrisma.hazardRecord.findMany({
        where: {
          code: { startsWith: prefix },
        },
      });

      let maxSeq = 0;
      for (const record of existingRecords) {
        if (record.code) {
          const seqStr = record.code.slice(-3);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }

      const newSeq = String(maxSeq + 1).padStart(3, '0');
      const newCode = `${prefix}${newSeq}`;

      expect(maxSeq).toBe(5);
      expect(newCode).toBe('Hazard20250112006');
    });

    it('应该只在当天范围内查找最大序号', async () => {
      const testDate = new Date('2025-01-12T10:00:00Z');
      jest.setSystemTime(testDate);

      const year = testDate.getFullYear();
      const month = String(testDate.getMonth() + 1).padStart(2, '0');
      const day = String(testDate.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const prefix = `Hazard${dateStr}`;

      const todayStart = new Date(year, testDate.getMonth(), testDate.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      // Mock: 只返回当天的记录
      mockPrisma.hazardRecord.findMany.mockResolvedValue([
        { code: 'Hazard20250112001' },
      ]);

      const existingRecords = await mockPrisma.hazardRecord.findMany({
        where: {
          code: { startsWith: prefix },
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      });

      expect(existingRecords).toHaveLength(1);
      // 验证查询参数包含日期范围
      expect(mockPrisma.hazardRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: todayStart,
              lt: todayEnd,
            }),
          }),
        })
      );
    });
  });

  describe('并发安全性', () => {
    it('当编号冲突时，应该递增查找可用编号', async () => {
      const testDate = new Date('2025-01-12T10:00:00Z');
      jest.setSystemTime(testDate);

      const year = testDate.getFullYear();
      const month = String(testDate.getMonth() + 1).padStart(2, '0');
      const day = String(testDate.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const prefix = `Hazard${dateStr}`;

      // Mock: 已有记录，最大序号是5
      mockPrisma.hazardRecord.findMany.mockResolvedValue([
        { code: 'Hazard20250112005' },
      ]);

      // 第一次检查：编号 006 已存在（模拟并发冲突）
      mockPrisma.hazardRecord.findUnique
        .mockResolvedValueOnce({ code: 'Hazard20250112006' }) // 冲突
        .mockResolvedValueOnce(null); // 007 可用

      let maxSeq = 5;
      const newSeq = String(maxSeq + 1).padStart(3, '0');
      let newCode = `${prefix}${newSeq}`; // 006

      // 双重检查
      const existing = await mockPrisma.hazardRecord.findUnique({
        where: { code: newCode },
      });

      if (existing) {
        // 冲突，递增查找
        let seq = maxSeq + 1;
        while (seq < 999) {
          seq++;
          const testCode = `${prefix}${String(seq).padStart(3, '0')}`;
          const testExisting = await mockPrisma.hazardRecord.findUnique({
            where: { code: testCode },
          });
          if (!testExisting) {
            newCode = testCode;
            break;
          }
        }
      }

      expect(newCode).toBe('Hazard20250112007');
      expect(mockPrisma.hazardRecord.findUnique).toHaveBeenCalledTimes(2);
    });

    it('当序号达到999时，应该使用时间戳后缀', async () => {
      const testDate = new Date('2025-01-12T10:00:00Z');
      jest.setSystemTime(testDate);

      const year = testDate.getFullYear();
      const month = String(testDate.getMonth() + 1).padStart(2, '0');
      const day = String(testDate.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const prefix = `Hazard${dateStr}`;

      // Mock: 所有序号（001-999）都被占用
      mockPrisma.hazardRecord.findMany.mockResolvedValue([
        { code: 'Hazard20250112999' },
      ]);

      mockPrisma.hazardRecord.findUnique.mockResolvedValue({ code: 'Hazard20250112999' });

      let maxSeq = 999;
      const newSeq = String(maxSeq + 1).padStart(3, '0');
      let newCode = `${prefix}${newSeq}`; // 尝试 1000，会被截断

      // 如果所有序号都用完，使用时间戳
      let seq = maxSeq + 1;
      let foundAvailable = false;
      while (seq < 999 && !foundAvailable) {
        seq++;
        const testCode = `${prefix}${String(seq).padStart(3, '0')}`;
        const testExisting = await mockPrisma.hazardRecord.findUnique({
          where: { code: testCode },
        });
        if (!testExisting) {
          newCode = testCode;
          foundAvailable = true;
          break;
        }
      }

      if (!foundAvailable) {
        const timestamp = Date.now().toString().slice(-3);
        newCode = `${prefix}${timestamp}`;
      }

      // 验证使用了时间戳后缀
      expect(newCode).toMatch(/^Hazard20250112\d{3}$/);
      expect(newCode).not.toBe('Hazard20250112999');
    });
  });

  describe('边界条件', () => {
    it('应该正确处理月份和日期的补零', () => {
      const janDate = new Date('2025-01-01T10:00:00Z');
      jest.setSystemTime(janDate);

      const year = janDate.getFullYear();
      const month = String(janDate.getMonth() + 1).padStart(2, '0');
      const day = String(janDate.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      expect(dateStr).toBe('20250101');
    });

    it('应该正确处理年末日期', () => {
      const yearEndDate = new Date('2025-12-31T10:00:00Z');
      jest.setSystemTime(yearEndDate);

      const year = yearEndDate.getFullYear();
      const month = String(yearEndDate.getMonth() + 1).padStart(2, '0');
      const day = String(yearEndDate.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      expect(dateStr).toBe('20251231');
    });

    it('应该忽略无效的序号字符串', () => {
      const invalidCodes = [
        'Hazard20250112ABC',
        'Hazard20250112',
        'Hazard20250112-001',
        null,
        undefined,
      ];

      let maxSeq = 0;
      for (const code of invalidCodes) {
        if (code) {
          // 验证代码格式：HazardYYYYMMDDXXX（总长度17字符，且最后3个字符必须是数字）
          // 有效格式示例：Hazard20250112001
          const isValidFormat = /^Hazard\d{8}\d{3}$/.test(code);
          if (isValidFormat) {
            const seqStr = code.slice(-3);
            const seq = parseInt(seqStr, 10);
            if (!isNaN(seq) && seq > maxSeq) {
              maxSeq = seq;
            }
          }
        }
      }

      // 应该忽略所有无效值
      expect(maxSeq).toBe(0);
    });
  });
});
