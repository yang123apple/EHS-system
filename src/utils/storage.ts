/**
 * 存储工具函数
 * 提供数据库记录与 MinIO URL 之间的转换
 */

import { minioStorageService } from '@/services/storage/MinioStorageService';

/**
 * 从数据库记录获取文件访问 URL
 * 
 * 数据库存储格式建议：
 * - 格式1（推荐）: "private:training/1234567890-uuid-filename.mp4"
 * - 格式2: JSON 字符串: {"bucket": "private", "key": "training/..."}
 * - 格式3（兼容旧格式）: "/uploads/filename.mp4" -> 转换为 public bucket
 * 
 * @param dbRecord 数据库中的文件路径记录
 * @param expiresIn 私有文件访问过期时间（秒），默认 3600（1小时）
 * @returns 文件访问 URL 信息
 */
export async function getFileUrlFromDbRecord(
  dbRecord: string | null | undefined,
  expiresIn: number = 3600
): Promise<{
  url: string;
  expiresAt?: Date;
  isPublic: boolean;
} | null> {
  if (!dbRecord) {
    return null;
  }

  try {
    // 尝试解析 JSON 格式（格式2）
    if (dbRecord.startsWith('{')) {
      const parsed = JSON.parse(dbRecord);
      if (parsed.bucket && parsed.key) {
        return await minioStorageService.getFileAccessUrl(
          parsed.bucket,
          parsed.key,
          expiresIn
        );
      }
    }

    // 使用 MinIO 存储服务解析（支持格式1和格式3）
    return await minioStorageService.getFileUrlFromDbRecord(dbRecord, expiresIn);
  } catch (error) {
    console.error('解析数据库文件记录失败:', error);
    return null;
  }
}

/**
 * 格式化文件信息为数据库存储格式
 * 
 * 推荐格式: "bucket:key"
 * 例如: "private:training/1234567890-uuid-video.mp4"
 * 
 * @param bucket 存储桶类型
 * @param objectName 对象键
 * @returns 数据库存储格式字符串
 */
export function formatFileRecordForDb(
  bucket: 'private' | 'public',
  objectName: string
): string {
  return minioStorageService.formatDbRecord(bucket, objectName);
}

/**
 * 解析数据库文件记录
 * 
 * @param dbRecord 数据库记录
 * @returns 解析后的 bucket 和 objectName，如果解析失败返回 null
 */
export function parseFileRecordFromDb(
  dbRecord: string | null | undefined
): { bucket: 'private' | 'public'; objectName: string } | null {
  if (!dbRecord) {
    return null;
  }

  try {
    // 尝试解析 JSON 格式
    if (dbRecord.startsWith('{')) {
      const parsed = JSON.parse(dbRecord);
      if (parsed.bucket && parsed.key) {
        return {
          bucket: parsed.bucket as 'private' | 'public',
          objectName: parsed.key,
        };
      }
    }

    // 解析 "bucket:key" 格式
    if (dbRecord.includes(':')) {
      const [bucket, ...keyParts] = dbRecord.split(':');
      if (bucket === 'private' || bucket === 'public') {
        return {
          bucket: bucket as 'private' | 'public',
          objectName: keyParts.join(':'),
        };
      }
    }

    // 兼容旧格式 "/uploads/..." -> public bucket
    if (dbRecord.startsWith('/uploads/')) {
      return {
        bucket: 'public',
        objectName: dbRecord.replace('/uploads/', ''),
      };
    }

    // 默认假设是 public bucket 的 key
    return {
      bucket: 'public',
      objectName: dbRecord,
    };
  } catch (error) {
    console.error('解析数据库文件记录失败:', error);
    return null;
  }
}

/**
 * 判断文件是否应该使用 Presigned URL 上传
 * 
 * @param fileSize 文件大小（字节）
 * @returns 是否应该使用 Presigned URL
 */
export function shouldUsePresignedUpload(fileSize: number): boolean {
  return minioStorageService.shouldUsePresignedUpload(fileSize);
}

