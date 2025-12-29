import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // 从HazardConfig表中获取培训类型设置
    const [categoriesConfig, watermarkTextConfig, watermarkEnabledConfig] = await Promise.all([
      prisma.hazardConfig.findUnique({ where: { key: 'training_categories' } }),
      prisma.hazardConfig.findUnique({ where: { key: 'training_watermark_text' } }),
      prisma.hazardConfig.findUnique({ where: { key: 'training_watermark_enabled' } })
    ]);

    return NextResponse.json({
      categories: categoriesConfig ? JSON.parse(categoriesConfig.value) : ['安全培训', '技术培训', '管理培训', '合规培训'],
      watermarkText: watermarkTextConfig?.value || '',
      watermarkEnabled: watermarkEnabledConfig ? JSON.parse(watermarkEnabledConfig.value) : true
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { categories, watermarkText, watermarkEnabled } = body;

    // 更新或创建配置
    await Promise.all([
      prisma.hazardConfig.upsert({
        where: { key: 'training_categories' },
        update: { value: JSON.stringify(categories) },
        create: {
          key: 'training_categories',
          value: JSON.stringify(categories),
          description: '培训系统学习类型配置'
        }
      }),
      prisma.hazardConfig.upsert({
        where: { key: 'training_watermark_text' },
        update: { value: watermarkText || '' },
        create: {
          key: 'training_watermark_text',
          value: watermarkText || '',
          description: '培训系统水印文本'
        }
      }),
      prisma.hazardConfig.upsert({
        where: { key: 'training_watermark_enabled' },
        update: { value: JSON.stringify(watermarkEnabled !== false) },
        create: {
          key: 'training_watermark_enabled',
          value: JSON.stringify(watermarkEnabled !== false),
          description: '培训系统水印启用状态'
        }
      })
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
