import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req, context, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) return NextResponse.json({ error: 'TaskId required' }, { status: 400 });

    const total = await prisma.trainingAssignment.count({ where: { taskId } });
    const completed = await prisma.trainingAssignment.count({ where: { taskId, isPassed: true } });
    const failed = await prisma.trainingAssignment.count({ where: { taskId, status: 'failed' } });

    return NextResponse.json({
        total,
        completed,
        incomplete: total - completed,
        failed
    });
  } catch (error) {
    return NextResponse.json({ error: 'Stats failed' }, { status: 500 });
  }
});
