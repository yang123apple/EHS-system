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

    // 🔧 关键修复：确保 MinIO 已初始化（带重试机制）
    let initError: any = null;
    const maxRetries = 2; // 最多重试 2 次
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await minioService.initialize();
        console.log(`[file-url API] MinIO 初始化成功 (尝试 ${attempt}/${maxRetries})`);
        initError = null;
        break; // 成功则跳出循环
      } catch (err: any) {
        initError = err;
        console.error(`[file-url API] MinIO 初始化失败 (尝试 ${attempt}/${maxRetries}):`, err.message);
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          const waitTime = attempt * 1000; // 递增等待时间：1秒、2秒
          console.log(`[file-url API] ${waitTime}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // 如果所有重试都失败，返回错误
    if (initError) {
      const errorMessage = initError.message || 'MinIO 初始化失败';
      const config = initError.config || '未知配置';
      
      // 判断是否为本地 MinIO（通过检查配置）
      const isLocalMinio = !config.includes('docker') && (config.includes('localhost') || config.includes('127.0.0.1'));
      
      const errorDetails: any = {
        error: errorMessage,
        objectName,
        config: config, // 包含配置信息
        deploymentType: isLocalMinio ? '本地二进制（bin 文件夹）' : 'Docker 容器'
      };
      
      // 根据部署类型提供不同的建议
      if (isLocalMinio) {
        errorDetails.suggestion = '请检查本地 MinIO 服务是否运行';
        errorDetails.startCommands = {
          mac_linux: './start-minio-local.sh 或 ./bin/minio server ./data/minio-data --console-address ":9001"',
          windows: '.\\start-minio-local.bat 或 .\\start-minio.ps1 或 .\\bin\\minio.exe server .\\data\\minio-data --console-address ":9001"'
        };
      } else {
        errorDetails.suggestion = '请检查 MinIO 服务是否运行';
        errorDetails.startCommand = 'docker-compose -f docker-compose.minio.yml up -d';
      }
      
      // 如果是连接超时，添加更多提示
      if (errorMessage.includes('连接超时') || errorMessage.includes('无法连接')) {
        errorDetails.troubleshooting = [
          `1. 检查 MinIO 服务是否运行: ${isLocalMinio ? 'lsof -ti:9000 或 ps aux | grep minio' : 'docker ps | grep minio'}`,
          '2. 检查网络连接和端口配置',
          `3. 验证环境变量是否正确（当前配置: ${config}）`,
          '4. 检查防火墙设置是否阻止了连接',
          isLocalMinio ? '5. 如果使用本地 MinIO，确保 bin/minio 或 bin/minio.exe 有执行权限' : '5. 检查 Docker 容器日志: docker logs ehs-minio'
        ];
      }
      
      // 如果错误包含等待时间提示，也添加到响应中
      if (errorMessage.includes('请等待')) {
        errorDetails.retryAfter = errorMessage.match(/(\d+)\s*秒/)?.[1] || null;
      }
      
      console.error('[file-url API] MinIO 初始化最终失败:', {
        ...errorDetails,
        originalError: initError.originalError?.message || initError.message
      });
      return NextResponse.json(errorDetails, { status: 500 });
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
    const errorMessage = error?.message || String(error) || '获取文件 URL 失败';
    const errorStack = error?.stack;
    
    // 尝试从 request URL 获取 objectName（如果可用）
    let objectName: string | null = null;
    try {
      const { searchParams } = new URL(request.url);
      objectName = searchParams.get('objectName');
    } catch {
      // 忽略解析错误
    }
    
    console.error('[file-url API] 获取失败:', {
      error: errorMessage,
      stack: errorStack,
      errorType: error?.name || typeof error,
      objectName
    });
    
    // 返回详细的错误信息（开发环境包含堆栈）
    return NextResponse.json(
      { 
        error: errorMessage,
        ...(objectName && { objectName }),
        ...(process.env.NODE_ENV === 'development' && errorStack && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}
