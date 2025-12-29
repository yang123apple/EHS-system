import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deptId = searchParams.get('deptId');

    if (!deptId) return NextResponse.json({ error: 'deptId required' }, { status: 400 });

    const users = await prisma.user.findMany({
        where: { departmentId: deptId },
        select: { id: true, name: true, jobTitle: true }
    });

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
