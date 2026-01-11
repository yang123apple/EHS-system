// src/app/api/archives/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, logApiOperation } from '@/middleware/auth';

// 默认配置值
const DEFAULT_CONFIG = {
    watermark: '海泽安全',
    enterprise_types: [
        '基础资质与证照',
        '建设项目"三同时"资料',
        '安全管理组织与责任制',
        '双重预防机制资料',
        '应急管理资料',
        '规章制度与操作规程',
        '教育培训资料',
        '职业健康资料'
    ],
    equipment_types: [
        '身份信息',
        '注册登记信息',
        '日常运维信息',
        '安全附件信息',
        '事故记录'
    ],
    personnel_types: [
        '三级培训记录',
        '资质证书',
        '职业健康情况',
        '行为记录'
    ]
};

// GET: 获取所有配置
export const GET = withAdmin(async () => {
    const configs = await prisma.archiveConfig.findMany();

    const result: Record<string, any> = { ...DEFAULT_CONFIG };

    for (const config of configs) {
        try {
            result[config.key] = JSON.parse(config.value);
        } catch {
            result[config.key] = config.value;
        }
    }

    return NextResponse.json(result);
});

// PUT: 更新配置
export const PUT = withAdmin(async (req: NextRequest, context, user) => {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
        return NextResponse.json({ error: '缺少 key 或 value' }, { status: 400 });
    }

    const allowedKeys = ['watermark', 'enterprise_types', 'equipment_types', 'personnel_types'];
    if (!allowedKeys.includes(key)) {
        return NextResponse.json({ error: '无效的配置项' }, { status: 400 });
    }

    // 获取旧配置值（用于日志）
    const oldConfig = await prisma.archiveConfig.findUnique({
        where: { key }
    });

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    await prisma.archiveConfig.upsert({
        where: { key },
        update: { value: stringValue },
        create: { key, value: stringValue }
    });

    // 记录操作日志
    await logApiOperation(user, 'archive', 'config', {
        targetId: key,
        configKey: key,
        oldValue: oldConfig?.value || null,
        newValue: stringValue,
        isNew: !oldConfig
    });

    return NextResponse.json({ success: true });
});
