// src/app/api/docs/watermark/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, withAuth, withPermission } from '@/middleware/auth';

// 获取文档管理系统水印配置
export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, context, user) => {
    try {
      const [textConfig, includeUserConfig, includeTimeConfig] = await Promise.all([
        prisma.hazardConfig.findUnique({ where: { key: 'doc_sys_watermark_text' } }),
        prisma.hazardConfig.findUnique({ where: { key: 'doc_sys_watermark_include_user' } }),
        prisma.hazardConfig.findUnique({ where: { key: 'doc_sys_watermark_include_time' } })
      ]);

      return NextResponse.json({
        text: textConfig?.value || '',
        includeUser: includeUserConfig ? JSON.parse(includeUserConfig.value) : false,
        includeTime: includeTimeConfig ? JSON.parse(includeTimeConfig.value) : false
      });
    } catch (error) {
      console.error('获取水印配置失败:', error);
      return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
    }
  })
);

// 保存文档管理系统水印配置
export const POST = withErrorHandling(
  withPermission('doc_sys', 'edit_watermark', async (req: NextRequest, context, user) => {
    try {
      const body = await req.json();
      const { text, includeUser, includeTime } = body;

      await Promise.all([
        prisma.hazardConfig.upsert({
          where: { key: 'doc_sys_watermark_text' },
          update: { value: text || '' },
          create: {
            key: 'doc_sys_watermark_text',
            value: text || '',
            description: '文档管理系统水印文本'
          }
        }),
        prisma.hazardConfig.upsert({
          where: { key: 'doc_sys_watermark_include_user' },
          update: { value: JSON.stringify(!!includeUser) },
          create: {
            key: 'doc_sys_watermark_include_user',
            value: JSON.stringify(!!includeUser),
            description: '文档管理系统水印是否包含用户名和ID'
          }
        }),
        prisma.hazardConfig.upsert({
          where: { key: 'doc_sys_watermark_include_time' },
          update: { value: JSON.stringify(!!includeTime) },
          create: {
            key: 'doc_sys_watermark_include_time',
            value: JSON.stringify(!!includeTime),
            description: '文档管理系统水印是否包含当前时间'
          }
        })
      ]);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('保存水印配置失败:', error);
      return NextResponse.json({ error: '保存配置失败' }, { status: 500 });
    }
  })
);


