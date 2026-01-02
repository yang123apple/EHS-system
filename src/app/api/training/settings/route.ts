import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withAdmin, withErrorHandling, logApiOperation } from '@/middleware/auth';

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, context, user) => {
    try {
      console.log('[Training Settings API] 开始获取设置...');
      
      // 从HazardConfig表中获取培训类型设置
      const [categoriesConfig, watermarkTextConfig, watermarkEnabledConfig, watermarkIncludeUserConfig, watermarkIncludeTimeConfig] = await Promise.all([
        prisma.hazardConfig.findUnique({ where: { key: 'training_categories' } }),
        prisma.hazardConfig.findUnique({ where: { key: 'training_watermark_text' } }),
        prisma.hazardConfig.findUnique({ where: { key: 'training_watermark_enabled' } }),
        prisma.hazardConfig.findUnique({ where: { key: 'training_watermark_include_user' } }),
        prisma.hazardConfig.findUnique({ where: { key: 'training_watermark_include_time' } })
      ]);

      console.log('[Training Settings API] 数据库查询结果:', {
        categoriesConfig: categoriesConfig ? '存在' : '不存在',
        categoriesValue: categoriesConfig?.value
      });

      // 如果没有配置，返回空数组而不是默认值
      let categories: string[] = [];
      if (categoriesConfig && categoriesConfig.value) {
        try {
          categories = JSON.parse(categoriesConfig.value);
          if (!Array.isArray(categories)) {
            console.warn('[Training Settings API] 解析的学习类型不是数组:', categories);
            categories = [];
          }
        } catch (e) {
          console.error('[Training Settings API] 解析学习类型配置失败:', e);
          categories = [];
        }
      } else {
        console.log('[Training Settings API] 没有找到学习类型配置，返回空数组');
      }

      console.log('[Training Settings API] 返回的学习类型:', categories);

      const result = {
        categories,
        watermarkText: watermarkTextConfig?.value || '',
        watermarkEnabled: watermarkEnabledConfig ? JSON.parse(watermarkEnabledConfig.value) : true,
        watermarkIncludeUser: watermarkIncludeUserConfig ? JSON.parse(watermarkIncludeUserConfig.value) : false,
        watermarkIncludeTime: watermarkIncludeTimeConfig ? JSON.parse(watermarkIncludeTimeConfig.value) : false
      };

      return NextResponse.json(result);
    } catch (error) {
      console.error('[Training Settings API] 获取培训设置失败:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
  })
);

export const POST = withErrorHandling(
  withAdmin(async (req: NextRequest, context, user) => {
    try {
      const body = await req.json();
      console.log('[Training Settings API] 接收到的数据:', JSON.stringify(body, null, 2));
      const { categories, watermarkText, watermarkEnabled, watermarkIncludeUser, watermarkIncludeTime } = body;

      // 验证 categories 是否为数组
      if (!Array.isArray(categories)) {
        console.error('[Training Settings API] categories 不是数组:', categories);
        return NextResponse.json({ error: 'categories 必须是数组' }, { status: 400 });
      }

      console.log('[Training Settings API] 准备保存学习类型:', categories);

      // 更新或创建配置
      const result = await Promise.all([
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
        }),
        prisma.hazardConfig.upsert({
          where: { key: 'training_watermark_include_user' },
          update: { value: JSON.stringify(!!watermarkIncludeUser) },
          create: {
            key: 'training_watermark_include_user',
            value: JSON.stringify(!!watermarkIncludeUser),
            description: '培训系统水印是否包含用户名和ID'
          }
        }),
        prisma.hazardConfig.upsert({
          where: { key: 'training_watermark_include_time' },
          update: { value: JSON.stringify(!!watermarkIncludeTime) },
          create: {
            key: 'training_watermark_include_time',
            value: JSON.stringify(!!watermarkIncludeTime),
            description: '培训系统水印是否包含当前时间'
          }
        })
      ]);

      console.log('[Training Settings API] 配置保存成功');

      // 验证保存结果
      const savedConfig = await prisma.hazardConfig.findUnique({
        where: { key: 'training_categories' }
      });
      
      if (savedConfig) {
        const savedCategories = JSON.parse(savedConfig.value);
        console.log('[Training Settings API] 验证保存的学习类型:', savedCategories);
      } else {
        console.error('[Training Settings API] 保存后无法找到配置记录');
      }

      // 记录操作日志
      await logApiOperation(
        user,
        'training',
        'update_settings',
        { categories, watermarkEnabled }
      );

      return NextResponse.json({ success: true, categories });
    } catch (error) {
      console.error('[Training Settings API] 更新培训设置失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ 
        error: 'Failed to update settings',
        details: errorMessage
      }, { status: 500 });
    }
  })
);
