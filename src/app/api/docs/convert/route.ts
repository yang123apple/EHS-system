// src/app/api/docs/convert/route.ts
// 用于在服务端处理 DOCX 转 HTML，避免在客户端导入 Node 模块
import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { withErrorHandling, withAuth } from '@/middleware/auth';

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, context: { params: Promise<{}> }, user) => {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    console.log('📄 [DOCX转换API] 接收到请求, URL参数:', url);

    if (!url) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    try {
      // 从 URL 获取文件路径（可能是相对路径或绝对路径）
      let filePath: string;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // 如果是完整 URL，需要下载文件
        console.log('📄 [DOCX转换API] 从远程URL下载文件:', url);
        // Next.js 16: 服务端 fetch 也需要明确指定缓存策略
        const response = await fetch(url, {
          cache: 'no-store' // 确保获取最新文件
        });
        if (!response.ok) {
          throw new Error(`无法下载文件: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        console.log('📄 [DOCX转换API] 文件下载成功, 大小:', arrayBuffer.byteLength, 'bytes');
        
        // 🔴 mammoth 默认会正确转换表格，使用默认配置即可
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        console.log('📄 [DOCX转换API] Mammoth转换完成');
        console.log('  - HTML长度:', result.value?.length || 0, 'characters');
        console.log('  - 消息数量:', result.messages?.length || 0);
        if (result.messages && result.messages.length > 0) {
          console.log('  - 转换消息:', result.messages);
        }
        
        // 🔴 如果HTML为空，返回特殊标记让前端知道
        if (!result.value || result.value.trim().length === 0) {
          console.warn('⚠️ [DOCX转换API] Mammoth转换结果为空，可能包含不支持的元素');
          return NextResponse.json({ 
            html: '', 
            empty: true,
            messages: result.messages,
            reason: 'mammoth_empty_result'
          });
        }
        
        return NextResponse.json({ html: result.value, messages: result.messages });
      } else {
        // 相对路径，需要判断是 public 目录还是 ehs-private 目录
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // 尝试多个可能的路径
        const possiblePaths = [
          path.join(process.cwd(), 'public', url),  // public/uploads/...
          path.join(process.cwd(), url.startsWith('/') ? url.substring(1) : url), // 相对于项目根目录
          path.join(process.cwd(), 'ehs-private', url.startsWith('/') ? url.substring(1) : url) // ehs-private/...
        ];
        
        console.log('📄 [DOCX转换API] 尝试查找本地文件，候选路径:');
        possiblePaths.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
        
        let buffer: Buffer | null = null;
        let foundPath: string | null = null;
        
        for (const tryPath of possiblePaths) {
          try {
            const stats = await fs.stat(tryPath);
            if (stats.isFile()) {
              buffer = await fs.readFile(tryPath);
              foundPath = tryPath;
              console.log('📄 [DOCX转换API] ✅ 找到文件:', tryPath);
              console.log('  - 文件大小:', stats.size, 'bytes');
              break;
            }
          } catch (err) {
            // 文件不存在，继续尝试下一个路径
            console.log('📄 [DOCX转换API] ❌ 路径不存在:', tryPath);
          }
        }
        
        if (!buffer || !foundPath) {
          throw new Error(`找不到文件: ${url}`);
        }
        
        console.log('📄 [DOCX转换API] 开始Mammoth转换, Buffer大小:', buffer.length, 'bytes');
        
        // 🔴 mammoth 默认会正确转换表格，使用默认配置即可
        const result = await mammoth.convertToHtml({ buffer });
        
        console.log('📄 [DOCX转换API] Mammoth转换完成');
        console.log('  - HTML长度:', result.value?.length || 0, 'characters');
        console.log('  - 消息数量:', result.messages?.length || 0);
        if (result.messages && result.messages.length > 0) {
          console.log('  - 转换消息:', result.messages);
        }
        
        // 🔴 如果HTML为空，返回特殊标记和详细诊断信息
        if (!result.value || result.value.trim().length === 0) {
          console.warn('⚠️ [DOCX转换API] 转换结果为空！');
          console.warn('  - result.value:', JSON.stringify(result.value));
          console.warn('  - 文件路径:', foundPath);
          console.warn('  - Buffer大小:', buffer.length, 'bytes');
          
          return NextResponse.json({ 
            html: '', 
            empty: true,
            messages: result.messages,
            reason: 'mammoth_empty_result',
            fileSize: buffer.length,
            filePath: url
          });
        }
        
        return NextResponse.json({ html: result.value, messages: result.messages });
      }
    } catch (error) {
      console.error('❌ [DOCX转换API] 转换失败:', error);
      return NextResponse.json(
        { error: '文档转换失败', details: error instanceof Error ? error.message : '未知错误' },
        { status: 500 }
      );
    }
  })
);
