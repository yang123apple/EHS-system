/**
 * 预签名 URL API
 * 用于前端获取 Presigned URL 进行直传
 * 
 * 工作流程：
 * 1. 前端请求此 API，提供文件信息（文件名、类型、大小等）
 * 2. 后端生成 Presigned PUT URL 并返回
 * 3. 前端直接 PUT 文件到 MinIO（不经过 Node.js 服务器）
 * 4. 上传成功后，前端调用保存元数据 API，将文件信息写入数据库
 */

import { NextRequest, NextResponse } from 'next/server';
import { minioStorageService } from '@/services/storage/MinioStorageService';

/**
 * 业务类型到存储桶的映射
 * 安全策略：前端不允许直接指定 bucket，必须通过 businessType 映射
 */
const BUSINESS_TYPE_TO_BUCKET: Record<string, 'private' | 'public'> = {
  training: 'public',        // 培训材料：公开访问
  inspection: 'private',    // 隐患排查报告：私有访问
  system_policy: 'private', // 制度文件：私有访问
} as const;

type BusinessType = keyof typeof BUSINESS_TYPE_TO_BUCKET;

/**
 * POST - 生成预签名上传 URL
 * 
 * 请求体：
 * {
 *   "filename": "video.mp4",
 *   "contentType": "video/mp4",
 *   "size": 104857600,  // 文件大小（字节）
 *   "businessType": "training",  // 业务类型：'training' | 'inspection' | 'system_policy'
 *   "category": "training"  // 可选，文件分类（用于组织目录结构）
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, contentType, size, businessType, category } = body;

    // 参数验证
    if (!filename) {
      return NextResponse.json(
        { success: false, error: '缺少文件名' },
        { status: 400 }
      );
    }

    if (!contentType) {
      return NextResponse.json(
        { success: false, error: '缺少 Content-Type' },
        { status: 400 }
      );
    }

    // 验证 businessType（安全：不允许前端直接指定 bucket）
    if (!businessType) {
      return NextResponse.json(
        { success: false, error: '缺少 businessType 参数' },
        { status: 400 }
      );
    }

    if (!(businessType in BUSINESS_TYPE_TO_BUCKET)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `无效的 businessType: ${businessType}。支持的类型: ${Object.keys(BUSINESS_TYPE_TO_BUCKET).join(', ')}` 
        },
        { status: 400 }
      );
    }

    // 根据 businessType 强制映射到对应的 bucket（安全策略）
    const bucket = BUSINESS_TYPE_TO_BUCKET[businessType as BusinessType];

    // 检查文件大小，大文件必须使用 Presigned URL
    const fileSize = size || 0;
    if (fileSize > 0 && !minioStorageService.shouldUsePresignedUpload(fileSize)) {
      // 小文件可以提示使用服务端上传，但这里仍然返回 Presigned URL
      // 保持接口一致性
    }

    // 使用 category 或 businessType 作为目录前缀
    const objectCategory = category || businessType;

    // 生成预签名上传 URL（bucket 由后端强制映射，前端无法控制）
    const presignedRequest = await minioStorageService.generatePresignedUploadUrl(
      bucket,
      filename,
      contentType,
      objectCategory
    );

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: presignedRequest.url,
        objectName: presignedRequest.objectName,
        bucket: presignedRequest.bucket, // 返回实际使用的 bucket（用于前端显示）
        businessType, // 返回业务类型（用于前端确认）
        expiresIn: presignedRequest.expiresIn,
        expiresAt: new Date(Date.now() + presignedRequest.expiresIn * 1000).toISOString(),
        // 数据库存储格式（推荐）
        dbRecord: minioStorageService.formatDbRecord(
          presignedRequest.bucket,
          presignedRequest.objectName
        ),
      },
    });
  } catch (error: any) {
    console.error('生成预签名 URL 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '生成预签名 URL 失败' },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取文件访问 URL（用于私有文件）
 * 
 * 查询参数：
 * - bucket: "private" 或 "public"
 * - objectName: 对象键
 * - expiresIn: 过期时间（秒），默认 3600
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket') as 'private' | 'public' | null;
    const objectName = searchParams.get('objectName');
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600', 10);

    if (!bucket || !objectName) {
      return NextResponse.json(
        { success: false, error: '缺少 bucket 或 objectName 参数' },
        { status: 400 }
      );
    }

    if (bucket !== 'private' && bucket !== 'public') {
      return NextResponse.json(
        { success: false, error: 'bucket 必须是 "private" 或 "public"' },
        { status: 400 }
      );
    }

    // 获取文件访问 URL
    const fileAccessUrl = await minioStorageService.getFileAccessUrl(
      bucket,
      objectName,
      expiresIn
    );

    return NextResponse.json({
      success: true,
      data: fileAccessUrl,
    });
  } catch (error: any) {
    console.error('获取文件访问 URL 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取文件访问 URL 失败' },
      { status: 500 }
    );
  }
}
