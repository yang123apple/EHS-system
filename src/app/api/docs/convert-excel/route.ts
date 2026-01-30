// src/app/api/docs/convert-excel/route.ts
// 用于在服务端处理 Excel 转 HTML，避免在客户端导入 Node 模块
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { withErrorHandling, withAuth } from '@/middleware/auth';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import { parseFileRecordFromDb } from '@/utils/storage';

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, context: { params: Promise<{}> }, user) => {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    try {
      let arrayBuffer: ArrayBuffer;

      // 检查是否是 MinIO 路径格式 (bucket:key)
      const minioRecord = parseFileRecordFromDb(url);
      if (minioRecord) {
        console.log('📊 [Excel转换API] 从MinIO下载文件:', url);
        console.log('  - Bucket:', minioRecord.bucket);
        console.log('  - ObjectName:', minioRecord.objectName);

        try {
          const buffer = await minioStorageService.downloadFile(
            minioRecord.bucket,
            minioRecord.objectName
          );
          console.log('📊 [Excel转换API] MinIO文件下载成功, 大小:', buffer.length, 'bytes');
          arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
        } catch (error) {
          console.error('❌ [Excel转换API] MinIO下载失败:', error);
          throw new Error(`找不到文件: ${url}`);
        }
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        // 如果是完整 URL，需要下载文件
        console.log('📊 [Excel转换API] 从远程URL下载文件:', url);
        // Next.js 16: 服务端 fetch 也需要明确指定缓存策略
        const response = await fetch(url, {
          cache: 'no-store' // 确保获取最新文件
        });
        if (!response.ok) {
          throw new Error(`无法下载文件: ${response.statusText}`);
        }
        arrayBuffer = await response.arrayBuffer();
        console.log('📊 [Excel转换API] 文件下载成功, 大小:', arrayBuffer.byteLength, 'bytes');
      } else {
        // 相对路径，从 public 目录读取
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'public', url);
        const buffer = await fs.readFile(filePath);
        arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        console.log('📊 [Excel转换API] 本地文件读取成功, 大小:', arrayBuffer.byteLength, 'bytes');
      }

      // 使用 xlsx 库解析 Excel
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const html = XLSX.utils.sheet_to_html(workbook.Sheets[workbook.SheetNames[0]], { 
        id: 'excel-preview-table' 
      });
      
      return NextResponse.json({ html });
    } catch (error) {
      console.error('Excel 转换失败:', error);
      return NextResponse.json(
        { error: 'Excel 转换失败', details: error instanceof Error ? error.message : '未知错误' },
        { status: 500 }
      );
    }
  })
);

