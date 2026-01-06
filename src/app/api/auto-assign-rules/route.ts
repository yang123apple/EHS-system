import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission } from '@/middleware/auth';

export const GET = withAuth(async (req: NextRequest, context, user) => {
  const rules = await prisma.autoAssignRule.findMany({ include: { task: true }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(rules);
});

export const POST = withPermission('training', 'create_task', async (req: NextRequest, context, user) => {
  const body = await req.json();
  // expected: { taskId, mode, eventType, condition, isActive }
  try {
    const r = await prisma.autoAssignRule.create({ data: {
      taskId: body.taskId,
      mode: body.mode || 'event',
      eventType: body.eventType || null,
      condition: body.condition ? JSON.stringify(body.condition) : null,
      isActive: body.isActive === undefined ? true : !!body.isActive
    } });
    return NextResponse.json(r);
  } catch (e) {
    console.error('create autoAssign rule error', e);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
});

export const PUT = withPermission('training', 'edit_task', async (req: NextRequest, context, user) => {
  const body = await req.json();
  try {
    const updated = await prisma.autoAssignRule.update({ where: { id: body.id }, data: {
      mode: body.mode,
      eventType: body.eventType || null,
      condition: body.condition ? JSON.stringify(body.condition) : null,
      isActive: body.isActive
    } });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('update autoAssign rule error', e);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
});

export const DELETE = withPermission('training', 'delete_task', async (req: NextRequest, context, user) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });
  try {
    await prisma.autoAssignRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('delete autoAssign rule error', e);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
});
