import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdmin } from '@/middleware/auth';

// PATCH: Reorder departments (same-level siblings only)
export const PATCH = withAdmin(async (req, context, user) => {
  try {
    const body = await req.json();
    const { updates } = body; // Array of { id: string, sortOrder: number }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: '无效的更新数据' }, { status: 400 });
    }

    // Validate all updates have required fields
    for (const update of updates) {
      if (!update.id || typeof update.sortOrder !== 'number') {
        return NextResponse.json({ error: '每个更新项必须包含 id 和 sortOrder' }, { status: 400 });
      }
    }

    // Perform batch update
    await db.reorderDepartments(updates);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Reorder departments error:', e);
    return NextResponse.json({ error: '排序失败' }, { status: 500 });
  }
});
