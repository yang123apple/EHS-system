/**
 * 隐患编号池服务
 *
 * 功能：
 * 1. 编号获取：优先从编号池获取可用编号，保持编号连续性
 * 2. 编号释放：软删除时将编号释放到池中，供后续重用
 * 3. 编号移除：硬删除时永久移除编号
 * 4. 过期清理：定期清理过期编号，避免编号池无限增长
 *
 * 设计原则：
 * - 并发安全：使用数据库事务保证并发操作的一致性
 * - 编号连续性：优先重用小序号，避免编号出现大的跳跃
 * - 可追溯性：记录编号的释放和重用历史，便于审计
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// 编号池状态枚举
export enum CodePoolStatus {
  AVAILABLE = 'available', // 可用
  USED = 'used',           // 已使用
  EXPIRED = 'expired'      // 过期
}

export class HazardCodePoolService {
  /**
   * 获取可用编号（优先从编号池获取，否则生成新编号）
   *
   * @param operatorId 操作人ID
   * @returns 可用的隐患编号
   */
  static async acquireCode(operatorId: string): Promise<string> {
    const now = new Date();
    const datePrefix = this.getDatePrefix(now);
    const prefix = `Hazard${datePrefix}`;

    // 🔒 使用事务保证并发安全
    return await prisma.$transaction(async (tx) => {
      // 1. 尝试从编号池获取可用编号（按序号从小到大排序，优先使用小序号）
      // 🔧 性能优化：拆分查询，避免 OR 条件影响索引使用

      // 1.1 优先查询永久有效的编号（expiresAt = null）
      let availableCode = await tx.hazardCodePool.findFirst({
        where: {
          datePrefix,
          status: CodePoolStatus.AVAILABLE,
          expiresAt: null
        },
        orderBy: [
          { sequence: 'asc' } // ✅ 优先使用小序号，保持编号连续性
        ]
      });

      // 1.2 如果没有永久有效的编号，查询未过期的编号
      if (!availableCode) {
        availableCode = await tx.hazardCodePool.findFirst({
          where: {
            datePrefix,
            status: CodePoolStatus.AVAILABLE,
            expiresAt: { gt: now }
          },
          orderBy: [
            { sequence: 'asc' }
          ]
        });
      }

      if (availableCode) {
        // 2. 标记为已使用（使用乐观锁：只更新状态为 AVAILABLE 的记录）
        const updateResult = await tx.hazardCodePool.updateMany({
          where: {
            id: availableCode.id,
            status: CodePoolStatus.AVAILABLE  // ✅ 乐观锁：确保状态未被其他事务修改
          },
          data: {
            status: CodePoolStatus.USED,
            usedAt: now,
            usedBy: operatorId
          }
        });

        // 检查是否成功更新（防止并发冲突）
        if (updateResult.count === 0) {
          // 编号已被其他事务占用，递归重试
          console.warn(`⚠️ [编号回收] 编号 ${availableCode.code} 已被占用，重新获取`);
          return await this.acquireCode(operatorId);
        }

        console.log(`♻️ [编号回收] 重用编号: ${availableCode.code} (序号: ${availableCode.sequence})`);
        return availableCode.code;
      }

      // 3. 编号池为空，生成新编号
      const newCode = await this.generateNewCode(tx, datePrefix, prefix);
      console.log(`✅ [编号生成] 新编号: ${newCode}`);
      return newCode;
    });
  }

  /**
   * 释放编号到编号池（软删除时调用）
   *
   * @param code 要释放的编号
   * @param operatorId 操作人ID
   * @param expiryDays 过期天数，默认30天
   */
  static async releaseCode(
    code: string,
    operatorId: string,
    expiryDays: number = 30
  ): Promise<void> {
    const datePrefix = this.extractDatePrefix(code);
    const sequence = this.extractSequence(code);

    if (!datePrefix || sequence === null) {
      console.warn(`⚠️ [编号回收] 无效编号格式: ${code}`);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    await prisma.hazardCodePool.upsert({
      where: { code },
      update: {
        status: CodePoolStatus.AVAILABLE,
        releasedBy: operatorId,
        releasedAt: now,
        expiresAt,
        usedAt: null,
        usedBy: null
      },
      create: {
        code,
        datePrefix,
        sequence,
        status: CodePoolStatus.AVAILABLE,
        releasedBy: operatorId,
        releasedAt: now,
        expiresAt
      }
    });

    console.log(`♻️ [编号回收] 编号已释放到池: ${code} (序号: ${sequence}), 过期时间: ${expiresAt.toISOString()}`);
  }

  /**
   * 永久移除编号（硬删除时调用）
   *
   * @param code 要移除的编号
   */
  static async removeCode(code: string): Promise<void> {
    await prisma.hazardCodePool.deleteMany({
      where: { code }
    });

    console.log(`🗑️ [编号回收] 编号已永久移除: ${code}`);
  }

  /**
   * 清理过期编号（定时任务）
   *
   * @returns 清理的记录数
   */
  static async cleanExpiredCodes(): Promise<number> {
    const result = await prisma.hazardCodePool.deleteMany({
      where: {
        status: CodePoolStatus.AVAILABLE,
        expiresAt: {
          lt: new Date()
        }
      }
    });

    console.log(`🧹 [编号回收] 清理过期编号: ${result.count} 条`);
    return result.count;
  }

  /**
   * 获取编号池统计信息
   *
   * @param datePrefix 可选的日期前缀，如：20250202
   * @returns 统计信息
   */
  static async getPoolStats(datePrefix?: string) {
    const where: Prisma.HazardCodePoolWhereInput = datePrefix
      ? { datePrefix }
      : {};

    const [total, available, used, expired] = await Promise.all([
      prisma.hazardCodePool.count({ where }),
      prisma.hazardCodePool.count({
        where: { ...where, status: CodePoolStatus.AVAILABLE }
      }),
      prisma.hazardCodePool.count({
        where: { ...where, status: CodePoolStatus.USED }
      }),
      prisma.hazardCodePool.count({
        where: {
          ...where,
          status: CodePoolStatus.AVAILABLE,
          expiresAt: { lt: new Date() }
        }
      })
    ]);

    return {
      total,
      available,
      used,
      expired,
      datePrefix: datePrefix || 'all'
    };
  }

  // ====== 辅助方法 ======

  /**
   * 获取日期前缀（YYYYMMDD格式）
   */
  private static getDatePrefix(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * 从编号中提取日期前缀
   * @example extractDatePrefix('Hazard20250202001') => '20250202'
   */
  private static extractDatePrefix(code: string): string | null {
    const match = code.match(/^Hazard(\d{8})\d{3}$/);
    return match ? match[1] : null;
  }

  /**
   * 从编号中提取序号
   * @example extractSequence('Hazard20250202001') => 1
   */
  private static extractSequence(code: string): number | null {
    const match = code.match(/^Hazard\d{8}(\d{3})$/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * 生成新编号（当编号池为空时）
   *
   * 🔧 优化：
   * 1. 一次性查询所有已使用的序号
   * 2. 在内存中计算第一个可用序号
   * 3. 避免循环查询数据库，提升并发性能
   *
   * 逻辑：
   * 1. 查询当天已存在的所有编号（包括已作废的）
   * 2. 找到第一个未使用的序号
   * 3. 如果所有序号都被占用，抛出错误
   */
  private static async generateNewCode(
    tx: Prisma.TransactionClient,
    datePrefix: string,
    prefix: string
  ): Promise<string> {
    // 计算当天的起止时间
    const todayStart = new Date(
      parseInt(datePrefix.substring(0, 4)),
      parseInt(datePrefix.substring(4, 6)) - 1,
      parseInt(datePrefix.substring(6, 8))
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // 🔧 优化：一次性查询所有已使用的编号
    const existingRecords = await tx.hazardRecord.findMany({
      where: {
        code: { startsWith: prefix },
        createdAt: { gte: todayStart, lt: todayEnd }
      },
      select: { code: true }
    });

    // 🔧 优化：提取所有已使用的序号到 Set 中（O(1) 查找）
    const usedSequences = new Set<number>();
    for (const record of existingRecords) {
      if (record.code) {
        const seq = parseInt(record.code.slice(-3), 10);
        if (!isNaN(seq) && seq >= 1 && seq <= 999) {
          usedSequences.add(seq);
        }
      }
    }

    // 🔧 优化：找到第一个未使用的序号（从1开始）
    let newSeq = 1;
    while (newSeq <= 999 && usedSequences.has(newSeq)) {
      newSeq++;
    }

    // 检查是否超过最大限制
    if (newSeq > 999) {
      throw new Error(
        `当天隐患编号已用尽（最大999条），日期: ${datePrefix}。` +
        `请联系管理员检查是否有异常数据。`
      );
    }

    const newCode = `${prefix}${String(newSeq).padStart(3, '0')}`;

    // 双重检查：确保编号唯一（防止并发冲突）
    // 注意：这里仍然可能有并发冲突，但会由 unique 约束捕获，触发重试
    const existing = await tx.hazardRecord.findUnique({
      where: { code: newCode }
    });

    if (existing) {
      // 🔧 如果编号已存在（并发冲突），递归重试
      // 注意：这种情况应该很少发生，因为我们已经检查了所有已用序号
      console.warn(`⚠️ [编号生成] 并发冲突检测到，编号 ${newCode} 已存在，重新生成`);

      // 重新查询并生成（递归调用）
      return await this.generateNewCode(tx, datePrefix, prefix);
    }

    return newCode;
  }

  /**
   * 标记编号为已使用（恢复已作废隐患时调用）
   *
   * @param code 编号
   * @param operatorId 操作人ID
   */
  static async markCodeAsUsed(code: string, operatorId: string): Promise<void> {
    await prisma.hazardCodePool.updateMany({
      where: {
        code,
        status: CodePoolStatus.AVAILABLE
      },
      data: {
        status: CodePoolStatus.USED,
        usedAt: new Date(),
        usedBy: operatorId
      }
    });

    console.log(`✅ [编号回收] 编号已标记为使用: ${code}`);
  }
}
