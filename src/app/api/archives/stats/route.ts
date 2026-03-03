// src/app/api/archives/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withErrorHandling } from '@/middleware/auth';

// GET: 获取档案统计数据
export const GET = withErrorHandling(withAuth(async () => {
    // 🟢 获取所有在职用户的 ID 列表（排除 admin 和离职人员）
    const activeUsers = await prisma.user.findMany({
        where: {
            username: { not: 'admin' },
            isActive: true // 只统计在职人员
        },
        select: { id: true }
    });
    const activeUserIds = activeUsers.map(u => u.id);

    // 1. 三级培训统计（只统计在职人员）
    const totalUsers = activeUsers.length;

    // 统计有"三级培训记录"文件的人数（只统计在职人员）
    const usersWithTraining = await prisma.archiveFile.groupBy({
        by: ['userId'],
        where: {
            category: 'personnel',
            fileType: '三级培训记录',
            userId: { in: activeUserIds } // 只统计在职人员的档案
        }
    });

    const trainedCount = usersWithTraining.length;

    // 2. 资质证书统计（只统计在职人员）
    const usersWithCertificate = await prisma.archiveFile.groupBy({
        by: ['userId'],
        where: {
            category: 'personnel',
            fileType: '资质证书',
            userId: { in: activeUserIds } // 只统计在职人员的档案
        }
    });

    // 3. 设备统计
    const totalEquipment = await prisma.equipment.count();
    const specialEquipment = await prisma.equipment.count({
        where: { isSpecialEquip: true }
    });

    // 4. 定检预警统计
    const now = new Date();
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const upcomingInspections = await prisma.equipment.count({
        where: {
            isSpecialEquip: true,
            nextInspection: {
                gte: now,
                lte: oneMonthLater
            }
        }
    });

    // 5. 企业档案统计
    const enterpriseFiles = await prisma.archiveFile.groupBy({
        by: ['fileType'],
        where: { category: 'enterprise' },
        _count: true
    });

    // 6. 人员档案统计
    const personnelFiles = await prisma.archiveFile.groupBy({
        by: ['fileType'],
        where: { category: 'personnel' },
        _count: true
    });

    // 7. 职业健康体检统计（只统计在职人员）
    const requireExamCount = await prisma.personnelHealthRecord.count({
        where: {
            userId: { in: activeUserIds },
            requirePeriodicExam: true
        }
    });

    const sixtyDaysLater = new Date();
    sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);

    const upcomingExamCount = await prisma.personnelHealthRecord.count({
        where: {
            userId: { in: activeUserIds },
            requirePeriodicExam: true,
            nextExamDate: {
                gte: now,
                lte: sixtyDaysLater
            }
        }
    });

    const overdueExamCount = await prisma.personnelHealthRecord.count({
        where: {
            userId: { in: activeUserIds },
            requirePeriodicExam: true,
            nextExamDate: {
                lt: now
            }
        }
    });

    return NextResponse.json({
        training: {
            total: totalUsers,
            trained: trainedCount,
            untrained: totalUsers - trainedCount,
            percentage: totalUsers > 0 ? Math.round((trainedCount / totalUsers) * 100) : 0
        },
        certificates: {
            usersWithCert: usersWithCertificate.length,
            total: totalUsers
        },
        equipment: {
            total: totalEquipment,
            special: specialEquipment,
            upcomingInspections
        },
        filesByType: {
            enterprise: enterpriseFiles.map(e => ({ type: e.fileType, count: e._count })),
            personnel: personnelFiles.map(e => ({ type: e.fileType, count: e._count }))
        },
        healthExam: {
            total: totalUsers,
            requireExam: requireExamCount,
            noExamRequired: totalUsers - requireExamCount,
            upcomingExam: upcomingExamCount,
            overdueExam: overdueExamCount
        }
    });
}));
