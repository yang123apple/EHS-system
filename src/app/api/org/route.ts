import { NextRequest, NextResponse } from 'next/server';
// 🟢 引用新的持久化 db
import { db } from '@/lib/db'; 
import { withErrorHandling, withAuth, withAdmin } from '@/middleware/auth';

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, context, user) => {
    const tree = await db.getOrgTree();
    return NextResponse.json(tree);
  })
);

export const POST = withErrorHandling(
  withAdmin(async (req: NextRequest, context, user) => {
  const body = await req.json();
  const { name, managerId, parentId } = body;

  // 计算层级
  let level = 1;
  if (parentId) {
    const allDepts = await db.getDepartments();
    const parent = allDepts.find(d => d.id === parentId);
    if (parent) level = parent.level + 1;
  }

  const newDept = await db.createDepartment({
    name,
    parentId: parentId || null,
    managerId,
    level
  });
  
  return NextResponse.json(newDept);
}