/**
 * MinIO 存储服务
 * 提供对象存储的完整功能，包括预签名 URL 生成
 * 
 * 设计原则：
 * - 大文件必须使用 Presigned URL 直传，避免流经 Node.js 服务器
 * - 小文件（<10MB）可以使用服务端上传
 * - 自动管理 Bucket 策略和生命周期
 */

import { minioService } from '@/lib/minio';
import crypto from 'crypto';
import path from 'path';

// 文件存储元数据
export interface FileMetadata {
  bucket: 'private' | 'public';
  objectName: string;  // MinIO 中的对象键（Key）
  originalName: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
  uploadedBy?: string;
}

// 预签名上传请求
export interface PresignedUploadRequest {
  url: string;           // 预签名 PUT URL
  objectName: string;    // 对象键（用于保存到数据库）
  bucket: 'private' | 'public';
  expiresIn: number;     // 过期时间（秒）
}

// 文件访问 URL（私有文件需要预签名）
export interface FileAccessUrl {
  url: string;
  expiresAt?: Date;      // 私有文件的过期时间
  isPublic: boolean;
}

class MinioStorageService {
  private static instance: MinioStorageService;

  // 文件大小阈值：超过此大小必须使用 Presigned URL
  private readonly PRESIGNED_UPLOAD_THRESHOLD = 10 * 1024 * 1024; // 10MB

  // 预签名 URL 默认过期时间（秒）
  private readonly DEFAULT_PRESIGNED_EXPIRES = 7 * 24 * 60 * 60; // 7天

  // 私有文件访问 URL 过期时间（秒）
  private readonly PRIVATE_ACCESS_EXPIRES = 3600; // 1小时

  private constructor() {
    // 私有构造函数，单例模式
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MinioStorageService {
    if (!MinioStorageService.instance) {
      MinioStorageService.instance = new MinioStorageService();
    }
    return MinioStorageService.instance;
  }

  /**
   * 生成唯一的对象名称
   * 格式：{category}/{timestamp}-{uuid}-{sanitizedFilename}
   * 
   * @param originalFilename 原始文件名
   * @param category 文件分类（如：training, docs, avatars）
   * @returns 对象键（Key）
   */
  public generateObjectName(
    originalFilename: string,
    category?: string
  ): string {
    return minioService.generateObjectName(originalFilename, category);
  }

  /**
   * 生成预签名上传 URL（用于前端直传）
   * 
   * 这是解决大文件上传性能问题的核心方法：
   * 1. 前端请求此 API 获取预签名 URL
   * 2. 前端直接 PUT 文件到 MinIO（不经过 Node.js 服务器）
   * 3. 上传成功后，前端通知后端保存元数据到数据库
   * 
   * @param bucket 存储桶类型
   * @param originalFilename 原始文件名
   * @param contentType MIME 类型
   * @param category 文件分类
   * @param expiresIn 过期时间（秒），默认7天
   * @returns 预签名上传请求
   */
  public async generatePresignedUploadUrl(
    bucket: 'private' | 'public',
    originalFilename: string,
    contentType: string = 'application/octet-stream',
    category?: string,
    expiresIn: number = this.DEFAULT_PRESIGNED_EXPIRES
  ): Promise<PresignedUploadRequest> {
    // 生成对象键
    const objectName = this.generateObjectName(originalFilename, category);

    // 生成预签名 PUT URL
    const url = await minioService.generatePresignedPutUrl(
      bucket,
      objectName,
      {
        expires: expiresIn,
        method: 'PUT',
        contentType,
      }
    );

    return {
      url,
      objectName,
      bucket,
      expiresIn,
    };
  }

  /**
   * 判断文件是否应该使用预签名上传
   * 
   * @param fileSize 文件大小（字节）
   * @returns 是否应该使用预签名上传
   */
  public shouldUsePresignedUpload(fileSize: number): boolean {
    return fileSize >= this.PRESIGNED_UPLOAD_THRESHOLD;
  }

  /**
   * 服务端上传文件（仅用于小文件）
   * 
   * 注意：大文件（>10MB）应该使用 Presigned URL 直传
   * 
   * @param bucket 存储桶类型
   * @param objectName 对象键
   * @param fileBuffer 文件缓冲区
   * @param contentType MIME 类型
   * @returns 上传结果
   */
  public async uploadFile(
    bucket: 'private' | 'public',
    objectName: string,
    fileBuffer: Buffer,
    contentType?: string
  ) {
    // 检查文件大小
    if (fileBuffer.length >= this.PRESIGNED_UPLOAD_THRESHOLD) {
      throw new Error(
        `文件过大（${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB），请使用 Presigned URL 直传`
      );
    }

    return await minioService.uploadFile(bucket, objectName, fileBuffer, contentType);
  }

  /**
   * 获取文件访问 URL
   * 
   * 对于公开文件，返回永久 URL
   * 对于私有文件，返回预签名 URL（临时访问）
   * 
   * @param bucket 存储桶类型
   * @param objectName 对象键
   * @param expiresIn 私有文件访问过期时间（秒），默认1小时
   * @returns 文件访问 URL
   */
  public async getFileAccessUrl(
    bucket: 'private' | 'public',
    objectName: string,
    expiresIn: number = this.PRIVATE_ACCESS_EXPIRES
  ): Promise<FileAccessUrl> {
    if (bucket === 'public') {
      // 公开文件：返回永久 URL
      const config = minioService.getClient();
      const bucketName = minioService.getBucketName('public');
      const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
      const port = process.env.MINIO_PORT || '9000';
      const useSSL = process.env.MINIO_USE_SSL === 'true';
      const protocol = useSSL ? 'https' : 'http';
      
      return {
        url: `${protocol}://${endpoint}:${port}/${bucketName}/${objectName}`,
        isPublic: true,
      };
    } else {
      // 私有文件：返回预签名 URL
      const url = await minioService.generatePresignedGetUrl(
        'private',
        objectName,
        expiresIn
      );

      return {
        url,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        isPublic: false,
      };
    }
  }

  /**
   * 从数据库记录获取文件访问 URL
   * 
   * 数据库存储格式建议：
   * - 格式1（推荐）: "private:training/1234567890-uuid-filename.mp4"
   * - 格式2: JSON: {"bucket": "private", "key": "training/..."}
   * 
   * @param dbRecord 数据库中的文件路径记录
   * @param expiresIn 私有文件访问过期时间（秒）
   * @returns 文件访问 URL
   */
  public async getFileUrlFromDbRecord(
    dbRecord: string,
    expiresIn: number = this.PRIVATE_ACCESS_EXPIRES
  ): Promise<FileAccessUrl> {
    // 解析数据库记录
    const { bucket, objectName } = this.parseDbRecord(dbRecord);

    return await this.getFileAccessUrl(bucket, objectName, expiresIn);
  }

  /**
   * 解析数据库记录
   * 
   * 支持两种格式：
   * 1. "bucket:key" (推荐)
   * 2. 旧格式兼容: "/uploads/..." -> 转换为 public bucket
   * 
   * @param dbRecord 数据库记录
   * @returns 解析后的 bucket 和 objectName
   */
  private parseDbRecord(dbRecord: string): { bucket: 'private' | 'public'; objectName: string } {
    // 格式1: "bucket:key"
    if (dbRecord.includes(':')) {
      const [bucket, ...keyParts] = dbRecord.split(':');
      if (bucket === 'private' || bucket === 'public') {
        return {
          bucket: bucket as 'private' | 'public',
          objectName: keyParts.join(':'), // 支持 key 中包含冒号
        };
      }
    }

    // 格式2: 旧格式兼容 "/uploads/..." -> public bucket
    if (dbRecord.startsWith('/uploads/')) {
      return {
        bucket: 'public',
        objectName: dbRecord.replace('/uploads/', ''),
      };
    }

    // 默认：假设是 public bucket 的 key
    return {
      bucket: 'public',
      objectName: dbRecord,
    };
  }

  /**
   * 格式化数据库存储值
   * 
   * 将 bucket 和 key 格式化为数据库存储格式
   * 格式: "bucket:key"
   * 
   * @param bucket 存储桶类型
   * @param objectName 对象键
   * @returns 数据库存储格式
   */
  public formatDbRecord(bucket: 'private' | 'public', objectName: string): string {
    return `${bucket}:${objectName}`;
  }

  /**
   * 删除文件
   * 
   * @param bucket 存储桶类型
   * @param objectName 对象键
   * @returns 是否删除成功
   */
  public async deleteFile(
    bucket: 'private' | 'public',
    objectName: string
  ): Promise<boolean> {
    return await minioService.deleteFile(bucket, objectName);
  }

  /**
   * 检查文件是否存在
   * 
   * @param bucket 存储桶类型
   * @param objectName 对象键
   * @returns 文件是否存在
   */
  public async fileExists(
    bucket: 'private' | 'public',
    objectName: string
  ): Promise<boolean> {
    return await minioService.fileExists(bucket, objectName);
  }

  /**
   * 获取文件信息
   * 
   * @param bucket 存储桶类型
   * @param objectName 对象键
   * @returns 文件信息
   */
  public async getFileInfo(
    bucket: 'private' | 'public',
    objectName: string
  ) {
    return await minioService.getFileInfo(bucket, objectName);
  }
}

// 导出单例实例
export const minioStorageService = MinioStorageService.getInstance();

