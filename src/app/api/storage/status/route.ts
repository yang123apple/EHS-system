/**
 * MinIO 存储服务状态 API
 * 检查 MinIO 连接状态和配置信息
 */

import { NextResponse } from 'next/server';
import { isMinIOInitialized } from '@/lib/startup';
import { minioService } from '@/lib/minio';

export async function GET() {
  try {
    const initialized = isMinIOInitialized();
    
    if (!initialized) {
      // 检测是否为本地 MinIO
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const projectRoot = process.cwd();
      const binMinio = path.join(projectRoot, 'bin', 'minio');
      const binMinioExe = path.join(projectRoot, 'bin', 'minio.exe');
      const hasLocalMinio = fs.existsSync(binMinio) || fs.existsSync(binMinioExe);
      const isWindows = os.platform() === 'win32';
      
      let suggestion = '';
      if (hasLocalMinio) {
        if (isWindows) {
          suggestion = '请检查本地 MinIO 服务是否运行: .\\start-minio-local.bat 或 .\\bin\\minio.exe server .\\data\\minio-data --console-address ":9001"';
        } else {
          suggestion = '请检查本地 MinIO 服务是否运行: ./start-minio-local.sh 或 ./bin/minio server ./data/minio-data --console-address ":9001"';
        }
      } else {
        suggestion = '请检查 MinIO 服务是否运行: docker-compose -f docker-compose.minio.yml up -d';
      }
      
      return NextResponse.json({
        success: false,
        initialized: false,
        message: 'MinIO 未初始化',
        error: 'MinIO 服务未启动或配置不正确',
        suggestion,
        deploymentType: hasLocalMinio ? '本地二进制（bin 文件夹）' : 'Docker 容器',
      });
    }

    // 获取 MinIO 详细信息
    try {
      const client = minioService.getClient();
      const buckets = await client.listBuckets();
      
      const config = {
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000', 10),
        useSSL: process.env.MINIO_USE_SSL === 'true',
      };

      return NextResponse.json({
        success: true,
        initialized: true,
        message: 'MinIO 服务运行正常',
        config: {
          ...config,
          endpoint: `${config.useSSL ? 'https' : 'http'}://${config.endPoint}:${config.port}`,
        },
        buckets: buckets.map(b => ({
          name: b.name,
          creationDate: b.creationDate,
        })),
        bucketsCount: buckets.length,
      });
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        initialized: true,
        message: 'MinIO 已初始化但连接失败',
        error: error.message,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        initialized: false,
        error: error.message || '检查 MinIO 状态失败',
      },
      { status: 500 }
    );
  }
}

