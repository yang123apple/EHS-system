// src/app/api/docs/convert/route.ts
// 用于在服务端处理 DOCX 转 HTML，避免在客户端导入 Node 模块
import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { withErrorHandling, withAuth } from '@/middleware/auth';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import { parseFileRecordFromDb } from '@/utils/storage';
import { processDocxHtml } from '@/lib/docxProcessor';

/**
 * Mammoth 自定义样式映射：
 *   - 补全中文 Word 常见标题样式名变体（含无空格版本 "标题1"）
 *   - ":fresh" 防止 mammoth 把连续同级标题合并成嵌套列表
 *   - 其余样式继续走 mammoth 默认映射（表格、列表等保留）
 */
const MAMMOTH_STYLE_MAP = [
  // 中文：带空格（最常见）
  "p[style-name='标题 1'] => h1:fresh",
  "p[style-name='标题 2'] => h2:fresh",
  "p[style-name='标题 3'] => h3:fresh",
  "p[style-name='标题 4'] => h4:fresh",
  // 中文：无空格（部分模板）
  "p[style-name='标题1'] => h1:fresh",
  "p[style-name='标题2'] => h2:fresh",
  "p[style-name='标题3'] => h3:fresh",
  "p[style-name='标题4'] => h4:fresh",
  // 英文：首字母大写（Word 默认）
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  // 英文：全小写（旧版或自定义）
  "p[style-name='heading 1'] => h1:fresh",
  "p[style-name='heading 2'] => h2:fresh",
  "p[style-name='heading 3'] => h3:fresh",
  "p[style-name='heading 4'] => h4:fresh",
];

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, context: { params: Promise<{}> }, user) => {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    console.log('📄 [DOCX转换API] 接收到请求, URL参数:', url);

    if (!url) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    try {
      let buffer: Buffer;

      // 检查是否是 MinIO 路径格式 (bucket:key)
      const minioRecord = parseFileRecordFromDb(url);
      if (minioRecord) {
        console.log('📄 [DOCX转换API] 从MinIO下载文件:', url);
        console.log('  - Bucket:', minioRecord.bucket);
        console.log('  - ObjectName:', minioRecord.objectName);

        try {
          buffer = await minioStorageService.downloadFile(
            minioRecord.bucket,
            minioRecord.objectName
          );
          console.log('📄 [DOCX转换API] MinIO文件下载成功, 大小:', buffer.length, 'bytes');
        } catch (error) {
          console.error('❌ [DOCX转换API] MinIO下载失败:', error);
          throw new Error(`找不到文件: ${url}`);
        }
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
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
        buffer = Buffer.from(arrayBuffer);
        console.log('📄 [DOCX转换API] 文件下载成功, 大小:', buffer.length, 'bytes');
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

        let foundBuffer: Buffer | null = null;
        let foundPath: string | null = null;

        for (const tryPath of possiblePaths) {
          try {
            const stats = await fs.stat(tryPath);
            if (stats.isFile()) {
              foundBuffer = await fs.readFile(tryPath);
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

        if (!foundBuffer || !foundPath) {
          throw new Error(`找不到文件: ${url}`);
        }

        buffer = foundBuffer;
        console.log('📄 [DOCX转换API] 开始Mammoth转换, Buffer大小:', buffer.length, 'bytes');
      }

      // 🔴 mammoth 转换：指定样式映射以正确处理中文 Word 标题样式
      const result = await mammoth.convertToHtml({ buffer }, {
        styleMap: MAMMOTH_STYLE_MAP,
      });

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

      // 🔴 后处理：向 H2/H3 注入锚点 id，提取目录树，检测是否已有编号
      const { html: processedHtml, toc, hasExistingNumbers } = processDocxHtml(result.value);
      console.log('📄 [DOCX转换API] TOC提取完成，共', toc.length, '个顶层标题，已有编号:', hasExistingNumbers);

      return NextResponse.json({ html: processedHtml, toc, hasExistingNumbers, messages: result.messages });
    } catch (error) {
      console.error('❌ [DOCX转换API] 转换失败:', error);
      return NextResponse.json(
        { error: '文档转换失败', details: error instanceof Error ? error.message : '未知错误' },
        { status: 500 }
      );
    }
  })
);
