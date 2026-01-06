import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, withAuth, withAdmin } from '@/middleware/auth';

// 默认配置
const DEFAULT_TYPES = ['火灾', '爆炸', '中毒', '窒息', '触电', '机械伤害'];
const DEFAULT_AREAS = ['施工现场', '仓库', '办公室', '车间', '其他'];

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, context, user) => {
  try {
    // 从数据库获取配置
    const typesConfig = await prisma.hazardConfig.findUnique({
      where: { key: 'hazard_types' }
    });
    
    const areasConfig = await prisma.hazardConfig.findUnique({
      where: { key: 'hazard_areas' }
    });

    const data = {
      types: typesConfig ? JSON.parse(typesConfig.value) : DEFAULT_TYPES,
      areas: areasConfig ? JSON.parse(areasConfig.value) : DEFAULT_AREAS
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('获取隐患配置失败:', error);
    // 发生错误时返回默认配置
    return NextResponse.json({
      types: DEFAULT_TYPES,
      areas: DEFAULT_AREAS
    });
  }
  })
);

export const POST = withErrorHandling(
  withAdmin(async (req: NextRequest, context, user) => {
    const body = await req.json();
    
    // 保存隐患类型
    if (body.types) {
      await prisma.hazardConfig.upsert({
        where: { key: 'hazard_types' },
        update: {
          value: JSON.stringify(body.types),
          updatedAt: new Date()
        },
        create: {
          key: 'hazard_types',
          value: JSON.stringify(body.types),
          description: '隐患分类配置'
        }
      });
    }

    // 保存发现区域（暂时保留，虽然前端已移除）
    if (body.areas) {
      await prisma.hazardConfig.upsert({
        where: { key: 'hazard_areas' },
        update: {
          value: JSON.stringify(body.areas),
          updatedAt: new Date()
        },
        create: {
          key: 'hazard_areas',
          value: JSON.stringify(body.areas),
          description: '发现区域配置'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: '配置保存成功'
    });
  })
);
