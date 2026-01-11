// src/app/api/archives/personnel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';

// GET: 获取人员列表（从用户表读取）
export const GET = withAuth(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const q = searchParams.get('q') || '';
    const dept = searchParams.get('dept') || '';

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

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where: whereCondition,
            orderBy: { name: 'asc' },
            skip,
            take: limit,
            select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                jobTitle: true,
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
});
