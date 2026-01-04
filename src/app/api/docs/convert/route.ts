// src/app/api/docs/convert/route.ts
// 用于在服务端处理 DOCX 转 HTML，避免在客户端导入 Node 模块
import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { withErrorHandling, withAuth } from '@/middleware/auth';

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, context: { params: Promise<{}> }, user) => {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    try {
      // 从 URL 获取文件路径（可能是相对路径或绝对路径）
      let filePath: string;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // 如果是完整 URL，需要下载文件
        // Next.js 16: 服务端 fetch 也需要明确指定缓存策略
        const response = await fetch(url, {
          cache: 'no-store' // 确保获取最新文件
        });
        if (!response.ok) {
          throw new Error(`无法下载文件: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        return NextResponse.json({ html: result.value });
      } else {
        // 相对路径，从 public 目录读取
        const fs = await import('fs/promises');
        const path = await import('path');
        filePath = path.join(process.cwd(), 'public', url);
        
        const buffer = await fs.readFile(filePath);
        const result = await mammoth.convertToHtml({ buffer });
        return NextResponse.json({ html: result.value });
      }
    } catch (error) {
      console.error('DOCX 转换失败:', error);
      return NextResponse.json(
        { error: '文档转换失败', details: error instanceof Error ? error.message : '未知错误' },
        { status: 500 }
      );
    }
  })
);

