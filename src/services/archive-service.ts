
import { prisma } from '@/lib/prisma';
import { Document, Tag } from '@prisma/client';

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
   */
  async getExpiringDocuments(days: number = 30) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    return prisma.document.findMany({
      where: {
        expiryDate: {
          lte: targetDate,
          gte: new Date(), // 只查询尚未过期的（或者包含已过期的？通常需要分开，这里暂且查未来30天内到期的）
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
