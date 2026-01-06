/**
 * MinIO Client 封装
 * 单例模式，提供对象存储服务
 */

import { Client } from 'minio';
import crypto from 'crypto';
import path from 'path';

// MinIO 配置接口
interface MinIOConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
}

// Bucket 策略枚举
export enum BucketPolicy {
  PRIVATE = 'private',  // 私有：需要认证才能访问
  PUBLIC = 'public',    // 公开：允许匿名读取
}

// 文件上传结果
export interface UploadResult {
  success: boolean;
  bucket: string;
  objectName: string;
  url?: string;
  error?: string;
}

// 预签名 URL 生成选项
export interface PresignedUrlOptions {
  expires?: number;  // 过期时间（秒），默认 7 天
  method?: 'GET' | 'PUT' | 'POST';
  contentType?: string;
}

class MinIOService {
  private static instance: MinIOService;
  private client: Client | null = null;
  private initialized: boolean = false;

  // Bucket 配置
  private readonly BUCKETS = {
    PRIVATE: 'ehs-private',  // 私有存储：隐患排查报告、敏感文件
    PUBLIC: 'ehs-public',    // 公开存储：学习资料、静态资源
  } as const;

  private constructor() {
    // 私有构造函数，防止外部实例化
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MinIOService {
    if (!MinIOService.instance) {
      MinIOService.instance = new MinIOService();
    }
    return MinIOService.instance;
  }

  /**
   * 初始化 MinIO Client
   */
  public async initialize(): Promise<void> {
    if (this.initialized && this.client) {
      return;
    }

    const config = this.getConfig();
    
    this.client = new Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });

    // 测试连接（设置超时）
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('连接超时')), 5000); // 5秒超时
    });

    try {
      await Promise.race([
        this.client.listBuckets(),
        timeoutPromise,
      ]) as any;

      // 初始化 Buckets
      await this.initializeBuckets();

      this.initialized = true;
    } catch (error: any) {
      // 清理失败的连接
      this.client = null;
      this.initialized = false;
      throw error;
    }
  }

  /**
   * 获取配置（从环境变量）
   */
  private getConfig(): MinIOConfig {
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = parseInt(process.env.MINIO_PORT || '9000', 10);
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const accessKey = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'admin';
    const secretKey = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'change-me-now';

    if (!accessKey || !secretKey) {
      throw new Error('MinIO 认证信息未配置');
    }

    return { endPoint, port, useSSL, accessKey, secretKey };
  }

  /**
   * 初始化 Buckets（如果不存在则创建）
   */
  private async initializeBuckets(): Promise<void> {
    if (!this.client) {
      throw new Error('MinIO Client 未初始化');
    }

    // 创建私有 Bucket
    const privateExists = await this.client.bucketExists(this.BUCKETS.PRIVATE);
    if (!privateExists) {
      await this.client.makeBucket(this.BUCKETS.PRIVATE, 'us-east-1');
      console.log(`✓ 创建 Bucket: ${this.BUCKETS.PRIVATE}`);
    }

    // 设置私有 Bucket 策略（拒绝匿名访问）
    await this.setBucketPolicy(this.BUCKETS.PRIVATE, BucketPolicy.PRIVATE);

    // 创建公开 Bucket
    const publicExists = await this.client.bucketExists(this.BUCKETS.PUBLIC);
    if (!publicExists) {
      await this.client.makeBucket(this.BUCKETS.PUBLIC, 'us-east-1');
      console.log(`✓ 创建 Bucket: ${this.BUCKETS.PUBLIC}`);
    }

    // 设置公开 Bucket 策略（允许匿名读取）
    await this.setBucketPolicy(this.BUCKETS.PUBLIC, BucketPolicy.PUBLIC);
  }

  /**
   * 设置 Bucket 策略
   */
  private async setBucketPolicy(bucketName: string, policy: BucketPolicy): Promise<void> {
    if (!this.client) {
      throw new Error('MinIO Client 未初始化');
    }

    try {
      if (policy === BucketPolicy.PRIVATE) {
        // 私有策略：只允许认证用户访问
        const privatePolicy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
              Condition: {
                StringEquals: {
                  's3:authType': 'REST-QUERY-STRING',
                },
              },
            },
          ],
        };
        await this.client.setBucketPolicy(bucketName, JSON.stringify(privatePolicy));
      } else if (policy === BucketPolicy.PUBLIC) {
        // 公开策略：允许匿名读取
        const publicPolicy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        };
        await this.client.setBucketPolicy(bucketName, JSON.stringify(publicPolicy));
      }
      console.log(`✓ 设置 Bucket 策略: ${bucketName} -> ${policy}`);
    } catch (error: any) {
      console.warn(`⚠ 设置 Bucket 策略失败: ${bucketName}`, error.message);
      // 策略设置失败不影响主要功能，只记录警告
    }
  }

  /**
   * 确保 Client 已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized || !this.client) {
      await this.initialize();
    }
  }

  /**
   * 生成唯一的对象名称（使用 UUID 避免重名）
   */
  public generateObjectName(originalFilename: string, prefix?: string): string {
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    const uuid = crypto.randomUUID();
    const timestamp = Date.now();
    
    // 格式：prefix/timestamp-uuid-baseName.ext
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const objectName = prefix 
      ? `${prefix}/${timestamp}-${uuid}-${sanitizedBaseName}${ext}`
      : `${timestamp}-${uuid}-${sanitizedBaseName}${ext}`;
    
    return objectName;
  }

  /**
   * 生成预签名 PUT URL（用于前端直接上传）
   */
  public async generatePresignedPutUrl(
    bucket: 'private' | 'public',
    objectName: string,
    options: PresignedUrlOptions = {}
  ): Promise<string> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('MinIO Client 未初始化');
    }

    const bucketName = bucket === 'private' ? this.BUCKETS.PRIVATE : this.BUCKETS.PUBLIC;
    const expires = options.expires || 7 * 24 * 60 * 60; // 默认 7 天
    const method = options.method || 'PUT';

    try {
      const url = await this.client.presignedPutObject(bucketName, objectName, expires, {
        'Content-Type': options.contentType || 'application/octet-stream',
      });

      return url;
    } catch (error: any) {
      console.error('生成预签名 URL 失败:', error);
      throw new Error(`生成预签名 URL 失败: ${error.message}`);
    }
  }

  /**
   * 生成预签名 GET URL（用于临时访问私有文件）
   */
  public async generatePresignedGetUrl(
    bucket: 'private' | 'public',
    objectName: string,
    expires: number = 3600
  ): Promise<string> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('MinIO Client 未初始化');
    }

    const bucketName = bucket === 'private' ? this.BUCKETS.PRIVATE : this.BUCKETS.PUBLIC;

    try {
      const url = await this.client.presignedGetObject(bucketName, objectName, expires);
      return url;
    } catch (error: any) {
      console.error('生成预签名 GET URL 失败:', error);
      throw new Error(`生成预签名 GET URL 失败: ${error.message}`);
    }
  }

  /**
   * 直接上传文件（小文件，流经服务器）
   */
  public async uploadFile(
    bucket: 'private' | 'public',
    objectName: string,
    fileBuffer: Buffer,
    contentType?: string
  ): Promise<UploadResult> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('MinIO Client 未初始化');
    }

    const bucketName = bucket === 'private' ? this.BUCKETS.PRIVATE : this.BUCKETS.PUBLIC;

    try {
      await this.client.putObject(bucketName, objectName, fileBuffer, fileBuffer.length, {
        'Content-Type': contentType || 'application/octet-stream',
      });

      const url = bucket === 'public' 
        ? await this.getPublicUrl(bucketName, objectName)
        : undefined;

      return {
        success: true,
        bucket: bucketName,
        objectName,
        url,
      };
    } catch (error: any) {
      console.error('上传文件失败:', error);
      return {
        success: false,
        bucket: bucketName,
        objectName,
        error: error.message,
      };
    }
  }

  /**
   * 删除文件
   */
  public async deleteFile(
    bucket: 'private' | 'public',
    objectName: string
  ): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('MinIO Client 未初始化');
    }

    const bucketName = bucket === 'private' ? this.BUCKETS.PRIVATE : this.BUCKETS.PUBLIC;

    try {
      await this.client.removeObject(bucketName, objectName);
      return true;
    } catch (error: any) {
      console.error('删除文件失败:', error);
      return false;
    }
  }

  /**
   * 获取公开文件的 URL
   */
  private async getPublicUrl(bucketName: string, objectName: string): Promise<string> {
    const config = this.getConfig();
    const protocol = config.useSSL ? 'https' : 'http';
    return `${protocol}://${config.endPoint}:${config.port}/${bucketName}/${objectName}`;
  }

  /**
   * 检查文件是否存在
   */
  public async fileExists(
    bucket: 'private' | 'public',
    objectName: string
  ): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('MinIO Client 未初始化');
    }

    const bucketName = bucket === 'private' ? this.BUCKETS.PRIVATE : this.BUCKETS.PUBLIC;

    try {
      await this.client.statObject(bucketName, objectName);
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  public async getFileInfo(
    bucket: 'private' | 'public',
    objectName: string
  ) {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('MinIO Client 未初始化');
    }

    const bucketName = bucket === 'private' ? this.BUCKETS.PRIVATE : this.BUCKETS.PUBLIC;

    try {
      const stat = await this.client.statObject(bucketName, objectName);
      return {
        exists: true,
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
        contentType: stat.metaData?.['content-type'],
      };
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * 获取 Client 实例（用于高级操作）
   */
  public getClient(): Client {
    if (!this.client) {
      throw new Error('MinIO Client 未初始化');
    }
    return this.client;
  }

  /**
   * 获取 Bucket 名称
   */
  public getBucketName(type: 'private' | 'public'): string {
    return type === 'private' ? this.BUCKETS.PRIVATE : this.BUCKETS.PUBLIC;
  }
}

// 导出单例实例
export const minioService = MinIOService.getInstance();

