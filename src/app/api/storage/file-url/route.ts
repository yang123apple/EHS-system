// src/app/api/storage/file-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import { minioService } from '@/lib/minio';

/**
 * 获取 MinIO 文件访问 URL
 * GET /api/storage/file-url?objectName=xxx&expiresIn=3600
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const objectName = searchParams.get('objectName');
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600');

    console.log('[file-url API] 收到请求:', { objectName, expiresIn });

    if (!objectName) {
      return NextResponse.json(
        { error: '缺少 objectName 参数' },
        { status: 400 }
      );
    }

    // 如果已经是完整 URL（兼容旧数据），直接返回
    if (objectName.startsWith('data:') || objectName.startsWith('http')) {
      console.log('[file-url API] 已是完整URL，直接返回');
      return NextResponse.json({ url: objectName });
    }

    // 🔧 关键修复：确保 MinIO 已初始化
    try {
      await minioService.initialize();
      console.log('[file-url API] MinIO 初始化成功');
    } catch (initError: any) {
      console.error('[file-url API] MinIO 初始化失败:', initError);
      return NextResponse.json(
        { error: `MinIO 初始化失败: ${initError.message}` },
        { status: 500 }
      );
    }

    // 获取文件访问 URL
    console.log('[file-url API] 开始获取预签名URL');
    const fileUrl = await minioStorageService.getFileUrlFromDbRecord(
      objectName,
      expiresIn
    );

    console.log('[file-url API] 成功生成URL:', fileUrl.url?.substring(0, 100));

    return NextResponse.json({
      url: fileUrl.url,
      isPublic: fileUrl.isPublic,
      expiresAt: fileUrl.expiresAt?.toISOString(),
    });
  } catch (error: any) {
    console.error('[file-url API] 获取失败:', {
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { error: error.message || '获取文件 URL 失败' },
      { status: 500 }
    );
  }
}
