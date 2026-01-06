import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req, context, user) => {
  try {
    // Use authenticated user's ID
    const assignments = await prisma.trainingAssignment.findMany({
      where: { userId: user.id },
      include: {
        task: {
            include: {
                material: true
            }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(assignments);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
});
