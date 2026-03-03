// src/app/api/archives/personnel/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/middleware/auth';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

// PATCH: 更新人员基本信息 + 职业健康记录
export const PATCH = async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
        const permResult = await requirePermission(req, 'archives', 'personnel_upload');
        if (permResult instanceof NextResponse) return permResult;

        const { id } = await context.params;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        const body = await req.json();
        const {
            jobTitle,
            departmentId,
            isActive,
            hazardFactors,
            requirePeriodicExam,
            lastExamDate,
            examCycle,
        } = body;

        // 更新用户基本信息
        const userUpdate: Record<string, unknown> = {};
        if (jobTitle !== undefined) userUpdate.jobTitle = jobTitle || null;
        if (departmentId !== undefined) userUpdate.departmentId = departmentId || null;
        if (isActive !== undefined) userUpdate.isActive = Boolean(isActive);

        if (Object.keys(userUpdate).length > 0) {
            await prisma.user.update({ where: { id }, data: userUpdate });
        }

        // 幽灵数据防护：requirePeriodicExam=false 时三个日期字段全部置 null
        const shouldHaveExam = Boolean(requirePeriodicExam);
        const safeLastExamDate = shouldHaveExam && lastExamDate ? String(lastExamDate) : null;
        const safeExamCycle = shouldHaveExam && examCycle ? Number(examCycle) : null;

        // 服务端用 dayjs 重算 nextExamDate，不信任前端传值
        // dayjs.utc() 直接解析 YYYY-MM-DD 为 UTC 00:00，避免时区偏移
        // .add(N, 'year') 内部已处理闰年：Feb 29 → Feb 28（不溢出到 Mar 1）
        const safeNextExamDate =
            safeLastExamDate && safeExamCycle
                ? dayjs.utc(safeLastExamDate).add(safeExamCycle, 'year').format('YYYY-MM-DD')
                : null;

        // Upsert 职业健康记录 — 不捕获异常，写库失败直接抛 500，前端必须感知
        const healthData = {
            hazardFactors: hazardFactors || null,
            requirePeriodicExam: shouldHaveExam,
            lastExamDate: safeLastExamDate ? dayjs.utc(safeLastExamDate).toDate() : null,
            examCycle: safeExamCycle,
            nextExamDate: safeNextExamDate ? dayjs.utc(safeNextExamDate).toDate() : null,
        };
        await (prisma as any).personnelHealthRecord.upsert({
            where: { userId: id },
            create: { userId: id, ...healthData },
            update: healthData,
        });

        // 返回更新后的用户信息
        const updatedUser = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                jobTitle: true,
                isActive: true,
                departmentId: true,
                department: { select: { name: true } }
            }
        });

        return NextResponse.json({
            success: true,
            user: updatedUser
                ? { ...updatedUser, department: updatedUser.department?.name || '未分配' }
                : null
        });
    } catch (error) {
        console.error('更新人员信息失败:', error);
        return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 });
    }
};
