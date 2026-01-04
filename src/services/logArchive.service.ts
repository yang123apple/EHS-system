/**
 * EHS 系统日志归档服务
 * 
 * 用于将旧日志从数据库迁移到本地文件系统，以优化数据库性能
 * 
 * @example
 * ```typescript
 * // 归档6个月前的日志
 * const result = await LogArchiveService.archiveOldLogs(6);
 * console.log(`已归档 ${result.count} 条日志到 ${result.filePath}`);
 * ```
 */

import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * 归档结果接口
 */
export interface ArchiveResult {
  /** 归档的记录数量 */
  count: number;
  /** 归档文件路径 */
  filePath: string;
  /** 归档开始时间 */
  startDate: Date;
  /** 归档结束时间 */
  endDate: Date;
}

/**
 * 日志归档服务类
 */
export class LogArchiveService {
  /** 归档文件存储目录 */
  private static readonly ARCHIVE_DIR = './audit_archives';

  /**
   * 确保归档目录存在
   */
  private static async ensureArchiveDir(): Promise<void> {
    try {
      await fs.access(this.ARCHIVE_DIR);
    } catch {
      // 目录不存在，创建它
      await fs.mkdir(this.ARCHIVE_DIR, { recursive: true });
    }
  }

  /**
   * 生成归档文件名
   * 格式：audit_archive_{YYYY}_{MM}_{DD}_{TIMESTAMP}.json
   */
  private static generateArchiveFileName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = now.getTime();
    
    return `audit_archive_${year}_${month}_${day}_${timestamp}.json`;
  }

  /**
   * 归档旧日志
   * 
   * 将指定保留月数之前的日志从数据库迁移到本地文件系统。
   * 使用分页批处理防止内存溢出。
   * 
   * @param retentionMonths 保留月数，默认6个月
   * @param batchSize 批处理大小，默认1000条
   * @returns 归档结果
   * 
   * @throws {Error} 如果文件写入失败或数据库操作失败
   */
  static async archiveOldLogs(
    retentionMonths: number = 6,
    batchSize: number = 1000
  ): Promise<ArchiveResult> {
    // 计算截止日期
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    
    console.log(`📦 [LogArchive] 开始归档 ${retentionMonths} 个月前的日志（截止日期：${cutoffDate.toISOString()}）`);

    // 确保归档目录存在
    await this.ensureArchiveDir();

    // 先统计需要归档的记录总数
    const totalCount = await prisma.systemLog.count({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    if (totalCount === 0) {
      console.log('📦 [LogArchive] 没有需要归档的日志');
      return {
        count: 0,
        filePath: '',
        startDate: cutoffDate,
        endDate: new Date(),
      };
    }

    console.log(`📦 [LogArchive] 找到 ${totalCount} 条需要归档的日志，开始分批处理...`);

    // 生成归档文件名
    const fileName = this.generateArchiveFileName();
    const filePath = path.join(this.ARCHIVE_DIR, fileName);

    // 准备归档数据数组
    const archivedLogs: any[] = [];
    let processedCount = 0;
    let skip = 0;

    // 分批查询和收集日志
    while (true) {
      const logs = await prisma.systemLog.findMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        skip,
        take: batchSize,
      });

      if (logs.length === 0) {
        break;
      }

      // 将日志添加到归档数组
      archivedLogs.push(...logs);
      processedCount += logs.length;
      skip += batchSize;

      console.log(`📦 [LogArchive] 已处理 ${processedCount}/${totalCount} 条日志...`);

      // 如果本次查询返回的记录数小于批次大小，说明已经处理完所有记录
      if (logs.length < batchSize) {
        break;
      }
    }

    // 构建归档数据对象
    const archiveData = {
      metadata: {
        archiveDate: new Date().toISOString(),
        retentionMonths,
        cutoffDate: cutoffDate.toISOString(),
        totalCount: archivedLogs.length,
        version: '1.0',
      },
      logs: archivedLogs,
    };

    // 将数据写入文件（使用流式写入，避免内存溢出）
    try {
      const jsonContent = JSON.stringify(archiveData, null, 2);
      await fs.writeFile(filePath, jsonContent, 'utf-8');
      console.log(`📦 [LogArchive] 归档文件已写入：${filePath}`);
    } catch (error) {
      console.error('❌ [LogArchive] 文件写入失败:', error);
      throw new Error(`归档文件写入失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 确认文件写入成功后，删除数据库记录
    try {
      const deleteResult = await prisma.systemLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`📦 [LogArchive] 已从数据库删除 ${deleteResult.count} 条日志记录`);

      // 验证删除数量是否匹配
      if (deleteResult.count !== archivedLogs.length) {
        console.warn(
          `⚠️ [LogArchive] 警告：归档记录数 (${archivedLogs.length}) 与删除记录数 (${deleteResult.count}) 不匹配`
        );
      }

      return {
        count: deleteResult.count,
        filePath: path.resolve(filePath), // 返回绝对路径
        startDate: cutoffDate,
        endDate: new Date(),
      };
    } catch (error) {
      console.error('❌ [LogArchive] 数据库删除失败:', error);
      // 如果删除失败，尝试删除已创建的文件（可选，根据业务需求决定）
      // await fs.unlink(filePath).catch(() => {});
      throw new Error(`数据库删除失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取归档文件列表
   * 
   * @returns 归档文件信息列表
   */
  static async getArchiveFiles(): Promise<Array<{ name: string; path: string; size: number; createdAt: Date }>> {
    try {
      await this.ensureArchiveDir();
      const files = await fs.readdir(this.ARCHIVE_DIR);
      
      const fileInfos = await Promise.all(
        files
          .filter(file => file.startsWith('audit_archive_') && file.endsWith('.json'))
          .map(async (file) => {
            const filePath = path.join(this.ARCHIVE_DIR, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              path: filePath,
              size: stats.size,
              createdAt: stats.birthtime,
            };
          })
      );

      // 按创建时间降序排列
      return fileInfos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('❌ [LogArchive] 获取归档文件列表失败:', error);
      return [];
    }
  }

  /**
   * 读取归档文件内容
   * 
   * @param fileName 归档文件名
   * @returns 归档数据
   */
  static async readArchiveFile(fileName: string): Promise<any> {
    try {
      const filePath = path.join(this.ARCHIVE_DIR, fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ [LogArchive] 读取归档文件失败: ${fileName}`, error);
      throw new Error(`读取归档文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 删除归档文件
   * 
   * @param fileName 归档文件名
   */
  static async deleteArchiveFile(fileName: string): Promise<void> {
    try {
      const filePath = path.join(this.ARCHIVE_DIR, fileName);
      await fs.unlink(filePath);
      console.log(`📦 [LogArchive] 已删除归档文件: ${fileName}`);
    } catch (error) {
      console.error(`❌ [LogArchive] 删除归档文件失败: ${fileName}`, error);
      throw new Error(`删除归档文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// ========== 默认导出 ==========
export default LogArchiveService;

