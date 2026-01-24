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
  private lastInitAttempt: number = 0; // 上次初始化尝试的时间戳
  private readonly INIT_RETRY_INTERVAL = 30000; // 30秒内不重复尝试初始化

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
    // 如果已经初始化，直接返回（避免重复初始化）
    if (this.initialized && this.client) {
      return;
    }
    
    // 防止并发初始化：如果正在初始化，等待完成
    if (this.lastInitAttempt > 0 && (Date.now() - this.lastInitAttempt) < 5000) {
      // 如果最近 5 秒内尝试过初始化，等待一下再重试
      const waitTime = 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // 再次检查是否已初始化（可能在等待期间其他请求已成功初始化）
      if (this.initialized && this.client) {
        return;
      }
    }

    // 如果最近尝试过初始化且失败，避免频繁重试
    const now = Date.now();
    if (this.lastInitAttempt > 0 && (now - this.lastInitAttempt) < this.INIT_RETRY_INTERVAL) {
      const waitTime = Math.ceil((this.INIT_RETRY_INTERVAL - (now - this.lastInitAttempt)) / 1000);
      // 检测是否为本地 MinIO
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const projectRoot = process.cwd();
      const binMinio = path.join(projectRoot, 'bin', 'minio');
      const binMinioExe = path.join(projectRoot, 'bin', 'minio.exe');
      const hasLocalMinio = fs.existsSync(binMinio) || fs.existsSync(binMinioExe);
      const isWindows = os.platform() === 'win32';
      
      let startCommand = '';
      if (hasLocalMinio) {
        if (isWindows) {
          startCommand = '.\\start-minio-local.bat 或 .\\bin\\minio.exe server .\\data\\minio-data --console-address ":9001"';
        } else {
          startCommand = './start-minio-local.sh 或 ./bin/minio server ./data/minio-data --console-address ":9001"';
        }
      } else {
        startCommand = 'docker-compose -f docker-compose.minio.yml up -d';
      }
      
      throw new Error(`MinIO 连接失败，请等待 ${waitTime} 秒后重试。请检查 MinIO 服务是否运行（${startCommand}）`);
    }

    this.lastInitAttempt = now;
    const config = this.getConfig();
    
    // 记录配置信息（用于错误日志）
    let configInfo = `${config.useSSL ? 'https' : 'http'}://${config.endPoint}:${config.port}`;
    
    // 对于本地 MinIO，确保使用正确的 endpoint
    // 如果配置是 localhost，尝试使用 127.0.0.1 以提高连接稳定性
    let effectiveEndpoint = config.endPoint;
    const isLocalhost = config.endPoint === 'localhost' || config.endPoint === '127.0.0.1';
    const isLocalNetworkIP = /^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\./.test(config.endPoint);
    
    if (config.endPoint === 'localhost' && !config.useSSL) {
      // 对于本地 HTTP 连接，127.0.0.1 通常更稳定
      effectiveEndpoint = '127.0.0.1';
    }
    
    // 快速检测：如果配置的是局域网 IP，先检查 localhost 是否可连接
    if (isLocalNetworkIP && !isLocalhost) {
      console.log(`[MinIO] 检测到配置的 endpoint 是 ${config.endPoint}（局域网 IP），检查 localhost 是否可用...`);
      try {
        const http = require('http');
        const testLocalhost = await new Promise<boolean>((resolve) => {
          const req = http.get(`http://127.0.0.1:${config.port}/minio/health/live`, { timeout: 2000 }, (res: any) => {
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
        });
        
        if (testLocalhost) {
          console.warn(`[MinIO] ⚠ 检测到配置的 endpoint 是 ${config.endPoint}，但 MinIO 实际运行在 localhost`);
          console.warn(`[MinIO] ⚠ 自动切换到 127.0.0.1 进行连接`);
          console.warn(`[MinIO] ⚠ 建议：将 .env.local 中的 MINIO_ENDPOINT 设置为 localhost 或 127.0.0.1`);
          // 使用 localhost 连接
          effectiveEndpoint = '127.0.0.1';
          configInfo = `${config.useSSL ? 'https' : 'http'}://127.0.0.1:${config.port}`;
        } else {
          console.log(`[MinIO] localhost 不可用，使用配置的 endpoint: ${config.endPoint}`);
        }
      } catch (e) {
        console.log(`[MinIO] localhost 检测失败，使用配置的 endpoint: ${config.endPoint}`);
        // 忽略检测错误，继续使用原配置
      }
    }
    
    try {
      this.client = new Client({
        endPoint: effectiveEndpoint,
        port: config.port,
        useSSL: config.useSSL,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
        // 添加连接选项以提高稳定性
        region: 'us-east-1', // MinIO 默认区域
      });

      // 测试连接（减少超时时间到 5 秒，快速失败）
      // 注意：这个 timeoutPromise 在重试循环中不再使用，改为在每次重试时创建新的超时

      // 先尝试简单的连接测试，减少重试次数
      let connectionSuccess = false;
      let lastError: any = null;
      
      // 尝试连接，最多重试 2 次（快速失败）
      for (let retry = 1; retry <= 2; retry++) {
        let retryTimeoutId: NodeJS.Timeout | null = null;
        let timeoutCleared = false;
        
        try {
          // 使用 Promise.race 进行连接测试
          const connectionPromise = this.client.listBuckets();
          
          // 创建一个可取消的超时 Promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            retryTimeoutId = setTimeout(() => {
              if (!timeoutCleared) {
                timeoutCleared = true;
                reject(new Error(`连接超时（5秒）：无法连接到 ${configInfo}`));
              }
            }, 5000);
          });
          
          try {
            const result = await Promise.race([
              connectionPromise,
              timeoutPromise,
            ]) as any;
            
            // 连接成功，清除超时（防止未捕获的 rejection）
            timeoutCleared = true;
            if (retryTimeoutId) {
              clearTimeout(retryTimeoutId);
              retryTimeoutId = null;
            }
            
            connectionSuccess = true;
            if (retry > 1) {
              console.log(`[MinIO] ✓ 连接成功（第 ${retry} 次尝试）`);
            }
            break;
          } catch (raceError: any) {
            // 连接失败，清除超时
            timeoutCleared = true;
            if (retryTimeoutId) {
              clearTimeout(retryTimeoutId);
              retryTimeoutId = null;
            }
            throw raceError;
          }
        } catch (err: any) {
          lastError = err;
          const errorMsg = err.message || String(err);
          
          if (retry < 2) {
            // 只等待 2 秒后重试一次
            console.log(`[MinIO] ⚠ 连接失败 (${retry}/2): ${errorMsg.substring(0, 80)}...`);
            console.log(`[MinIO] ⏳ 2 秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            console.error(`[MinIO] ❌ 连接失败，已重试 2 次`);
            console.error(`[MinIO] 错误: ${errorMsg.substring(0, 200)}`);
          }
        }
      }
      
      if (!connectionSuccess) {
        throw lastError || new Error('MinIO 连接失败');
      }

      // 初始化 Buckets
      await this.initializeBuckets();

      this.initialized = true;
      this.lastInitAttempt = 0; // 重置失败时间戳
      console.log(`✅ MinIO 初始化成功: ${configInfo}`);
    } catch (error: any) {
      // 清理失败的连接
      this.client = null;
      this.initialized = false;
      
      // 增强错误信息
      const isLocalhost = config.endPoint === 'localhost' || config.endPoint === '127.0.0.1';
      let errorMsg = error.message.includes('连接超时') 
        ? error.message 
        : `MinIO 初始化失败 (${configInfo}): ${error.message || String(error)}`;
      
      // 记录详细的错误信息用于调试
      const errorCode = error.code || error.name || 'Unknown';
      const errorDetails = {
        message: error.message,
        code: errorCode,
        endpoint: effectiveEndpoint,
        port: config.port,
        useSSL: config.useSSL,
        configInfo,
      };
      
      console.error('[MinIO] 连接失败详情:', JSON.stringify(errorDetails, null, 2));
      
      // 如果是本地 MinIO 连接失败，添加更具体的提示
      if (isLocalhost && (error.message.includes('连接超时') || error.message.includes('ECONNREFUSED') || errorCode === 'ECONNREFUSED')) {
        errorMsg += `\n\n本地 MinIO 故障排查：\n  1. 检查服务是否运行: ps aux | grep minio 或 lsof -ti:9000\n  2. 检查端口监听: netstat -an | grep 9000\n  3. 尝试手动启动: ./bin/minio server ./data/minio-data --console-address ":9001"\n  4. 检查数据目录权限: ls -la ./data/minio-data\n  5. 检查健康端点: curl http://localhost:9000/minio/health/live`;
      }
      
      const enhancedError = new Error(errorMsg);
      (enhancedError as any).originalError = error;
      (enhancedError as any).config = configInfo;
      (enhancedError as any).effectiveEndpoint = effectiveEndpoint;
      (enhancedError as any).errorDetails = errorDetails;
      
      throw enhancedError;
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
      // 只在创建新 bucket 时设置策略
      await this.setBucketPolicy(this.BUCKETS.PRIVATE, BucketPolicy.PRIVATE);
    }

    // 创建公开 Bucket
    const publicExists = await this.client.bucketExists(this.BUCKETS.PUBLIC);
    if (!publicExists) {
      await this.client.makeBucket(this.BUCKETS.PUBLIC, 'us-east-1');
      console.log(`✓ 创建 Bucket: ${this.BUCKETS.PUBLIC}`);
      // 只在创建新 bucket 时设置策略
      await this.setBucketPolicy(this.BUCKETS.PUBLIC, BucketPolicy.PUBLIC);
    }
    // 如果 bucket 已存在，跳过策略设置（避免重复设置）
  }

  /**
   * 设置 Bucket 策略
   * 只在创建新 bucket 时调用，避免重复设置
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
      // MinIO SDK v8: presignedPutObject(bucket, object, expires) 不支持额外 headers 参数
      // 若需要非 PUT 方法，使用通用 presignedUrl
      const upperMethod = String(method).toUpperCase();
      const url =
        upperMethod === 'PUT'
          ? await this.client.presignedPutObject(bucketName, objectName, expires)
          : await this.client.presignedUrl(upperMethod, bucketName, objectName, expires);

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
   * 添加超时处理，避免长时间等待
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
      // 设置超时（10秒）
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('删除文件超时')), 10000);
      });

      await Promise.race([
        this.client.removeObject(bucketName, objectName),
        timeoutPromise
      ]);
      
      return true;
    } catch (error: any) {
      // 如果是超时错误，记录但不抛出
      if (error.message === '删除文件超时') {
        console.warn('删除文件超时:', bucketName, objectName);
        return false;
      }
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

