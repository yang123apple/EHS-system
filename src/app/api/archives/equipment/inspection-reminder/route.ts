// src/app/api/archives/equipment/inspection-reminder/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotificationsFromTemplate } from '@/lib/notificationService';
import { withAuth } from '@/middleware/auth';

/**
 * 检查设备定检到期提醒
 * 应该在定时任务中调用，例如每天执行一次
 */
export async function checkInspectionReminders() {
    try {
        const now = new Date();
        const reminders = [
            { days: 30, label: '1个月' },
            { days: 15, label: '半个月' },
            { days: 7, label: '一周' },
            { days: 3, label: '3天' }
        ];

        // 获取所有需要定检的特种设备
        const equipments = await prisma.equipment.findMany({
            where: {
                isSpecialEquip: true,
                status: 'active',
                nextInspection: { not: null }
            },
            include: {
                // 可以关联设备管理员等信息
            }
        });

        let reminderCount = 0;

        for (const equipment of equipments) {
            if (!equipment.nextInspection) continue;

            const inspectionDate = new Date(equipment.nextInspection);
            const diffDays = Math.ceil((inspectionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            // 检查是否需要发送提醒
            for (const reminder of reminders) {
                if (diffDays === reminder.days) {
                    // 获取所有管理员用户（这里简化处理，实际应该根据设备关联的管理员）
                    const admins = await prisma.user.findMany({
                        where: {
                            role: 'admin'
                        },
                        select: { id: true }
                    });

                    const recipientIds = admins.map(a => a.id);

                    if (recipientIds.length > 0) {
                        // 创建通知
                        await createNotificationsFromTemplate({
                            triggerEvent: 'equipment_inspection_due',
                            recipientIds,
                            context: {
                                equipment: {
                                    id: equipment.id,
                                    name: equipment.name,
                                    code: equipment.code,
                                    nextInspection: equipment.nextInspection.toISOString(),
                                    reminderDays: reminder.days,
                                    reminderLabel: reminder.label
                                }
                            },
                            relatedType: 'equipment',
                            relatedId: equipment.id
                        });

                        reminderCount++;
                    }
                    break; // 每个设备只发送一次提醒
                }
            }
        }

        return {
            success: true,
            checked: equipments.length,
            remindersSent: reminderCount
        };
    } catch (e) {
        console.error('检查设备定检提醒失败:', e);
        return {
            success: false,
            error: e instanceof Error ? e.message : '未知错误'
        };
    }
}

// GET: 手动触发检查（仅用于测试，生产环境应该使用定时任务）
export const GET = withAuth(async () => {
    const result = await checkInspectionReminders();
    return NextResponse.json(result);
});

