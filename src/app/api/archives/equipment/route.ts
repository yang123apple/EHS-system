// src/app/api/archives/equipment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withAdmin, logApiOperation, requirePermission } from '@/middleware/auth';

// GET: 获取设备列表（支持分页和搜索）
export const GET = async (req: NextRequest) => {
    const permResult = await requirePermission(req, 'archives', 'equipment_view');
    if (permResult instanceof NextResponse) return permResult;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const status = searchParams.get('status') || undefined;
    const isSpecial = searchParams.get('isSpecial');
    const q = searchParams.get('q') || '';

    const skip = (page - 1) * limit;

    const whereCondition: any = {};

    if (status) {
        whereCondition.status = status;
    }

    if (isSpecial !== null && isSpecial !== undefined) {
        whereCondition.isSpecialEquip = isSpecial === 'true';
    }

    // 搜索功能：支持按名称、编号、描述搜索
    if (q) {
        whereCondition.OR = [
            { name: { contains: q } },
            { code: { contains: q } },
            { description: { contains: q } }
        ];
    }

    const [equipments, total] = await Promise.all([
        prisma.equipment.findMany({
            where: whereCondition,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                _count: {
                    select: { files: true }
                }
            }
        }),
        prisma.equipment.count({ where: whereCondition })
    ]);

    return NextResponse.json({
        data: equipments,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    });
};

// POST: 创建新设备
export const POST = async (req: NextRequest) => {
    const permResult = await requirePermission(req, 'archives', 'equipment_create');
    if (permResult instanceof NextResponse) return permResult;
    const { user } = permResult;
    const body = await req.json();
    const { name, code, description, startDate, expectedEndDate, isSpecialEquip, inspectionCycle } = body;

    if (!name || !code || !startDate) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 检查编号是否重复
    const existing = await prisma.equipment.findUnique({ where: { code } });
    if (existing) {
        return NextResponse.json({ error: '设备编号已存在' }, { status: 400 });
    }

    // 计算下次定检日期
    let nextInspection = null;
    if (isSpecialEquip && inspectionCycle) {
        const start = new Date(startDate);
        nextInspection = new Date(start);
        nextInspection.setMonth(nextInspection.getMonth() + inspectionCycle);
    }

    const equipment = await prisma.equipment.create({
        data: {
            name,
            code,
            description,
            startDate: new Date(startDate),
            expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
            isSpecialEquip: isSpecialEquip || false,
            inspectionCycle: inspectionCycle || null,
            lastInspection: new Date(startDate),
            nextInspection
        }
    });

    // 记录操作日志
    await logApiOperation(user, 'archive', 'create', {
        targetId: equipment.id,
        equipmentName: equipment.name,
        equipmentCode: equipment.code,
        isSpecialEquip: equipment.isSpecialEquip,
        inspectionCycle: equipment.inspectionCycle
    });

    return NextResponse.json(equipment);
};
