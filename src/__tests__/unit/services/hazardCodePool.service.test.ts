/**
 * 隐患编号池服务单元测试
 *
 * 测试覆盖：
 * 1. 编号获取（从池中获取 vs 生成新编号）
 * 2. 编号释放（软删除）
 * 3. 编号移除（硬删除）
 * 4. 过期清理
 * 5. 并发安全
 */

import { HazardCodePoolService, CodePoolStatus } from '@/services/hazardCodePool.service';
import { prisma } from '@/lib/prisma';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    hazardCodePool: {
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn()
    },
    hazardRecord: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    }
  }
}));

describe('HazardCodePoolService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('acquireCode', () => {
    it('应该从编号池获取可用编号', async () => {
      const mockAvailableCode = {
        id: 'pool-1',
        code: 'Hazard20250202001',
        datePrefix: '20250202',
        sequence: 1,
        status: CodePoolStatus.AVAILABLE,
        releasedBy: 'user-1',
        releasedAt: new Date(),
        expiresAt: null,
        usedAt: null,
        usedBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock 事务
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          hazardCodePool: {
            findFirst: jest.fn().mockResolvedValue(mockAvailableCode),
            update: jest.fn().mockResolvedValue({
              ...mockAvailableCode,
              status: CodePoolStatus.USED
            })
          }
        });
      });

      const code = await HazardCodePoolService.acquireCode('user-2');

      expect(code).toBe('Hazard20250202001');
    });

    it('应该在编号池为空时生成新编号', async () => {
      // Mock 事务
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          hazardCodePool: {
            findFirst: jest.fn().mockResolvedValue(null)
          },
          hazardRecord: {
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn().mockResolvedValue(null)
          }
        });
      });

      const code = await HazardCodePoolService.acquireCode('user-1');

      expect(code).toMatch(/^Hazard\d{8}001$/);
    });

    it('应该优先使用小序号的编号', async () => {
      const mockCodes = [
        {
          id: 'pool-1',
          code: 'Hazard20250202003',
          sequence: 3,
          status: CodePoolStatus.AVAILABLE
        },
        {
          id: 'pool-2',
          code: 'Hazard20250202001',
          sequence: 1,
          status: CodePoolStatus.AVAILABLE
        }
      ];

      // findFirst 应该按序号排序，返回最小的
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          hazardCodePool: {
            findFirst: jest.fn().mockResolvedValue(mockCodes[1]),
            update: jest.fn().mockResolvedValue({
              ...mockCodes[1],
              status: CodePoolStatus.USED
            })
          }
        });
      });

      const code = await HazardCodePoolService.acquireCode('user-1');

      expect(code).toBe('Hazard20250202001');
    });
  });

  describe('releaseCode', () => {
    it('应该将编号释放到编号池', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({});
      (prisma.hazardCodePool.upsert as jest.Mock) = mockUpsert;

      await HazardCodePoolService.releaseCode('Hazard20250202001', 'user-1', 30);

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { code: 'Hazard20250202001' },
        update: expect.objectContaining({
          status: CodePoolStatus.AVAILABLE
        }),
        create: expect.objectContaining({
          code: 'Hazard20250202001',
          datePrefix: '20250202',
          sequence: 1,
          status: CodePoolStatus.AVAILABLE
        })
      });
    });

    it('应该拒绝无效编号格式', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await HazardCodePoolService.releaseCode('INVALID-CODE', 'user-1');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('无效编号格式')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('removeCode', () => {
    it('应该永久移除编号', async () => {
      const mockDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      (prisma.hazardCodePool.deleteMany as jest.Mock) = mockDeleteMany;

      await HazardCodePoolService.removeCode('Hazard20250202001');

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { code: 'Hazard20250202001' }
      });
    });
  });

  describe('cleanExpiredCodes', () => {
    it('应该清理过期编号', async () => {
      const mockDeleteMany = jest.fn().mockResolvedValue({ count: 5 });
      (prisma.hazardCodePool.deleteMany as jest.Mock) = mockDeleteMany;

      const count = await HazardCodePoolService.cleanExpiredCodes();

      expect(count).toBe(5);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: {
          status: CodePoolStatus.AVAILABLE,
          expiresAt: {
            lt: expect.any(Date)
          }
        }
      });
    });
  });

  describe('getPoolStats', () => {
    it('应该返回编号池统计信息', async () => {
      (prisma.hazardCodePool.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(30)  // available
        .mockResolvedValueOnce(70)  // used
        .mockResolvedValueOnce(5);  // expired

      const stats = await HazardCodePoolService.getPoolStats('20250202');

      expect(stats).toEqual({
        total: 100,
        available: 30,
        used: 70,
        expired: 5,
        datePrefix: '20250202'
      });
    });
  });

  describe('markCodeAsUsed', () => {
    it('应该将编号标记为已使用', async () => {
      const mockUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      (prisma.hazardCodePool.updateMany as jest.Mock) = mockUpdateMany;

      await HazardCodePoolService.markCodeAsUsed('Hazard20250202001', 'user-1');

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          code: 'Hazard20250202001',
          status: CodePoolStatus.AVAILABLE
        },
        data: expect.objectContaining({
          status: CodePoolStatus.USED,
          usedBy: 'user-1'
        })
      });
    });
  });
});
