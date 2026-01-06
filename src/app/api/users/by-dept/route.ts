import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req, context, user) => {
  const { searchParams } = new URL(req.url);
  const deptId = searchParams.get('deptId');

  if (!deptId) {
    return NextResponse.json({ error: 'Department ID required' }, { status: 400 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { departmentId: deptId },
      select: {
          id: true,
          name: true,
          jobTitle: true,
          departmentId: true
      }
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
});
