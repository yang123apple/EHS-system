import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdmin } from '@/middleware/auth';

// POST: Reparent a department (move it under a new parent)
export const POST = withAdmin(async (req, context, user) => {
  try {
    const body = await req.json();
    const { departmentId, newParentId } = body;

    if (!departmentId || typeof departmentId !== 'string') {
      return NextResponse.json({ error: '缺少或无效的 departmentId' }, { status: 400 });
    }
    if (newParentId !== null && newParentId !== undefined && typeof newParentId !== 'string') {
      return NextResponse.json({ error: '无效的 newParentId' }, { status: 400 });
    }

    const result = await db.reparentDepartment(departmentId, newParentId ?? null);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Reparent department error:', e);
    return NextResponse.json({ error: '移动失败' }, { status: 500 });
  }
});
