import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req, context, user) => {
  const { searchParams } = new URL(req.url);
  const deptId = searchParams.get('deptId');
  const activeOnly = searchParams.get('activeOnly') === 'true'; // 🟢 新增：是否只查询在职用户

  if (!deptId) {
    return NextResponse.json({ error: 'Department ID required' }, { status: 400 });
  }

  try {
    const whereCondition: any = { departmentId: deptId };
    
    // 🟢 新增：如果 activeOnly 为 true，只返回在职用户
    if (activeOnly) {
      whereCondition.isActive = true;
    }

    const users = await prisma.user.findMany({
      where: whereCondition,
      select: {
          id: true,
          name: true,
          jobTitle: true,
          departmentId: true,
          isActive: true // 🟢 返回在职状态
      }
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
});
