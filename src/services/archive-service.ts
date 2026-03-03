
import { prisma } from '@/lib/prisma';
import { Document, Tag } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

export type CreateArchiveParams = {
  name: string;
  type: string;
  path: string;
  parentId?: string;
  level: number;
  dept?: string;
  uploader?: string;
  archiveCategory: 'enterprise' | 'equipment' | 'personnel' | 'msds';
  expiryDate?: Date;
  warningDays?: number;
  entityId?: string;
  tags?: string[]; // Tag names
};

export const archiveService = {
  /**
   * 创建新的档案文件
   */
  async createArchive(params: CreateArchiveParams) {
    const { tags, ...docData } = params;

    // 处理标签：如果不存在则创建，存在则关联
    const tagConnects = tags && tags.length > 0 ? await Promise.all(
      tags.map(async (tagName) => {
        const tag = await prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });
        return { id: tag.id };
      })
    ) : [];

    return prisma.document.create({
      data: {
        ...docData,
        tags: {
          connect: tagConnects,
        },
      },
    });
  },

  /**
   * 获取即将过期的证照
   * @param days 预警天数，默认为 30 天
   *
   * 时区说明：与 getPendingHealthExamCount 保持同一套时区逻辑，
   * 消除在 UTC 服务器上 new Date() + setDate() 带来的 8 小时零点漂移。
   */
  async getExpiringDocuments(days: number = 30) {
    const todaySH = dayjs().tz(TZ).startOf('day');
    const targetDateSH = todaySH.add(days, 'day').endOf('day');

    return prisma.document.findMany({
      where: {
        expiryDate: {
          gte: todaySH.utc().toDate(),
          lte: targetDateSH.utc().toDate(),
        },
      },
      include: {
        tags: true,
      },
      orderBy: {
        expiryDate: 'asc',
      },
    });
  },

  /**
   * 获取已过期的证照
   */
  async getExpiredDocuments() {
    return prisma.document.findMany({
      where: {
        expiryDate: {
          lt: new Date(),
        },
      },
      include: {
        tags: true,
      },
      orderBy: {
        expiryDate: 'desc',
      },
    });
  },

  /**
   * 根据标签获取文件
   */
  async getDocumentsByTag(tagName: string) {
    return prisma.document.findMany({
      where: {
        tags: {
          some: {
            name: tagName,
          },
        },
      },
      include: {
        tags: true,
      },
    });
  },

  /**
   * 根据分类获取文件（支持目录树结构）
   */
  async getArchivesByCategory(category: string, parentId: string | null = null) {
    return prisma.document.findMany({
      where: {
        archiveCategory: category,
        parentId: parentId,
      },
      include: {
        tags: true,
        children: {
            select: { id: true } // 只检查是否有子节点，不完全递归
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  /**
   * 获取近期需要职业健康体检的人员数量
   * @param days 查询天数范围，默认 60 天
   *
   * 时区说明：nextExamDate 由 exam-reminder 以 Asia/Shanghai 零点写入数据库（UTC 存储）。
   * 查询边界必须对齐上海时区，否则每天 00:00-08:00 CST 窗口内会有系统性漏计。
   */
  async getPendingHealthExamCount(days: number = 60) {
    const nowSH = dayjs().tz(TZ);
    // 今天上海零点 → UTC（不统计已过期，从今天起算）
    const startUtc = nowSH.startOf('day').utc().toDate();
    // N 天后上海 23:59:59 → UTC（包含最后一天的全天）
    const deadlineUtc = nowSH.add(days, 'day').endOf('day').utc().toDate();

    return prisma.personnelHealthRecord.count({
      where: {
        requirePeriodicExam: true,
        nextExamDate: {
          gte: startUtc,
          lte: deadlineUtc,
        },
      },
    });
  },

  /**
   * 搜索所有Tag
   */
  async getAllTags() {
    return prisma.tag.findMany({
        orderBy: {
            documents: {
                _count: 'desc'
            }
        }
    });
  }
};
