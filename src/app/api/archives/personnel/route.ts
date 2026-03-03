// src/app/api/archives/personnel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/auth';

// GET: 获取人员列表（从用户表读取）
export async function GET(req: NextRequest) {
    const permResult = await requirePermission(req, 'archives', 'personnel_view');
    if (permResult instanceof NextResponse) return permResult;
    
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const q = searchParams.get('q') || '';
    const dept = searchParams.get('dept') || '';
    const fileType = (searchParams.get('fileType') || '').trim();

    const skip = (page - 1) * limit;

    const whereCondition: any = {
        username: { not: 'admin' } // 排除管理员账户
    };

    if (q) {
        whereCondition.OR = [
            { name: { contains: q } },
            { username: { contains: q } }
        ];
    }

    if (dept) {
        whereCondition.department = { name: dept };
    }

    if (fileType) {
        const matchingFiles = await prisma.archiveFile.findMany({
            where: { category: 'personnel', fileType, userId: { not: null } },
            select: { userId: true }
        });
        const userIds = [...new Set(
            matchingFiles.map(f => f.userId).filter((id): id is string => id !== null)
        )];
        // 没有任何人上传过此类型文件，直接返回空
        if (userIds.length === 0) {
            return NextResponse.json({
                data: [],
                meta: { total: 0, page, limit, totalPages: 0 }
            });
        }
        whereCondition.id = { in: userIds };
    }

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where: whereCondition,
            orderBy: [
                { isActive: 'desc' }, // 在职员工 (true) 排在前面，已离职 (false) 排在最后
                { name: 'asc' }
            ],
            skip,
            take: limit,
            select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                jobTitle: true,
                isActive: true, // 🟢 包含在职状态
                department: {
                    select: { name: true }
                }
            }
        }),
        prisma.user.count({ where: whereCondition })
    ]);

    // 获取每个人的档案文件数量
    const usersWithFileCount = await Promise.all(
        users.map(async (user) => {
            const fileCount = await prisma.archiveFile.count({
                where: { userId: user.id, category: 'personnel' }
            });
            return {
                ...user,
                department: user.department?.name || '未分配',
                fileCount
            };
        })
    );

    return NextResponse.json({
        data: usersWithFileCount,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    });
}
