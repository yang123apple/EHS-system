// src/app/api/docs/convert-excel/route.ts
// 用于在服务端处理 Excel 转 HTML，避免在客户端导入 Node 模块
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { withErrorHandling, withAuth } from '@/middleware/auth';

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    try {
      // 从 URL 获取文件路径（可能是相对路径或绝对路径）
      let arrayBuffer: ArrayBuffer;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // 如果是完整 URL，需要下载文件
        // Next.js 16: 服务端 fetch 也需要明确指定缓存策略
        const response = await fetch(url, {
          cache: 'no-store' // 确保获取最新文件
        });
        if (!response.ok) {
          throw new Error(`无法下载文件: ${response.statusText}`);
        }
        arrayBuffer = await response.arrayBuffer();
      } else {
        // 相对路径，从 public 目录读取
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'public', url);
        const buffer = await fs.readFile(filePath);
        arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
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

