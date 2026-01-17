/**
 * 隐患抄送用户服务
 * 规范化管理抄送关系，提升查询性能
 */

import { prisma } from '@/lib/prisma';

export interface CCUserInput {
  userId: string;
  userName?: string;
}

/**
 * 设置隐患的抄送用户列表（替换现有列表）
 * @param hazardId 隐患ID
 * @param ccUsers 抄送用户列表
 */
export async function setCCUsers(
  hazardId: string,
  ccUsers: CCUserInput[]
): Promise<void> {
  // 使用事务确保一致性
  await prisma.$transaction(async (tx) => {
    // 1. 删除旧的抄送记录
    await tx.hazardCC.deleteMany({
      where: { hazardId }
    });

    // 2. 创建新的抄送记录
    if (ccUsers.length > 0) {
      // 获取用户信息（如果未提供 userName）
      const userIds = ccUsers.map(u => u.userId);
      const users = await tx.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true }
      });

      const userMap = new Map(users.map(u => [u.id, u.name]));

      await tx.hazardCC.createMany({
        data: ccUsers.map(cc => ({
          hazardId,
          userId: cc.userId,
          userName: cc.userName || userMap.get(cc.userId) || null
        }))
      });
    }
  });
}

/**
 * 添加抄送用户（不删除现有记录）
 * @param hazardId 隐患ID
 * @param ccUsers 要添加的抄送用户列表
 */
export async function addCCUsers(
  hazardId: string,
  ccUsers: CCUserInput[]
): Promise<void> {
  if (ccUsers.length === 0) return;

  // 获取用户信息（如果未提供 userName）
  const userIds = ccUsers.map(u => u.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true }
  });

  const userMap = new Map(users.map(u => [u.id, u.name]));

  // 使用 createMany 的 skipDuplicates 选项避免重复
  await prisma.hazardCC.createMany({
    data: ccUsers.map(cc => ({
      hazardId,
      userId: cc.userId,
      userName: cc.userName || userMap.get(cc.userId) || null
    })),
    skipDuplicates: true
  });
}

/**
 * 获取隐患的抄送用户列表
 * @param hazardId 隐患ID
 */
export async function getCCUsers(hazardId: string): Promise<Array<{
  userId: string;
  userName: string | null;
}>> {
  const records = await prisma.hazardCC.findMany({
    where: { hazardId },
    orderBy: { createdAt: 'asc' }
  });

  return records.map(r => ({
    userId: r.userId,
    userName: r.userName
  }));
}

/**
 * 删除隐患的抄送用户
 * @param hazardId 隐患ID
 * @param userIds 要删除的用户ID列表（可选，不传则删除所有）
 */
export async function removeCCUsers(
  hazardId: string,
  userIds?: string[]
): Promise<void> {
  const where: any = { hazardId };
  if (userIds && userIds.length > 0) {
    where.userId = { in: userIds };
  }

  await prisma.hazardCC.deleteMany({ where });
}

/**
 * 检查用户是否是隐患的抄送人
 * @param hazardId 隐患ID
 * @param userId 用户ID
 */
export async function isCCUser(
  hazardId: string,
  userId: string
): Promise<boolean> {
  const record = await prisma.hazardCC.findUnique({
    where: {
      hazardId_userId: {
        hazardId,
        userId
      }
    }
  });

  return !!record;
}
