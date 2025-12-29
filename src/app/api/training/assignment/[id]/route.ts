import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const assignment = await prisma.trainingAssignment.findUnique({
      where: { id },
      include: {
        task: {
            include: {
                material: true
            }
        }
      }
    });

    if (!assignment) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(assignment);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; // Assignment ID
    const body = await req.json();
    const { action, progress, examScore, isPassed } = body;
    // action: 'update_progress' | 'complete_exam'

    if (action === 'update_progress') {
        // Logic: if video last 30s or doc last page
        const assignment = await prisma.trainingAssignment.update({
            where: { id },
            data: {
                progress,
                status: 'in-progress',
                updatedAt: new Date()
            }
        });

        // If material has NO exam and is "complete" (handled by frontend telling us it's done or progress=100)
        // Check if material requires exam first
        const currentAssign = await prisma.trainingAssignment.findUnique({
             where: { id },
             include: { task: { include: { material: true } } }
        });

        if (currentAssign && !currentAssign.task.material.isExamRequired && progress === 100) {
             await prisma.trainingAssignment.update({
                 where: { id },
                 data: {
                     status: 'passed',
                     isPassed: true,
                     completedAt: new Date()
                 }
             });
        }

        return NextResponse.json({ success: true });
    } else if (action === 'complete_exam') {
        const assignment = await prisma.trainingAssignment.update({
            where: { id },
            data: {
                examScore,
                isPassed,
                status: isPassed ? 'passed' : 'failed', // Failed allows retry
                completedAt: isPassed ? new Date() : undefined
            }
        });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
