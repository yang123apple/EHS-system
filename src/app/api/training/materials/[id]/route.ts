import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const material = await prisma.trainingMaterial.findUnique({
      where: { id },
      include: {
        uploader: { select: { name: true } },
        questions: true
      }
    });
    if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(material);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch material' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { title, description, category, isPublic, isExamRequired, passingScore, questions } = body;

        // 更新材料信息
        const material = await prisma.trainingMaterial.update({
            where: { id },
            data: {
                title,
                description,
                category,
                isPublic,
                isExamRequired,
                passingScore
            }
        });

        // 删除旧的考试题目
        await prisma.examQuestion.deleteMany({
            where: { materialId: id }
        });

        // 创建新的考试题目
        if (isExamRequired && questions && questions.length > 0) {
            await prisma.examQuestion.createMany({
                data: questions.map((q: any) => ({
                    materialId: id,
                    question: q.question,
                    type: q.type,
                    options: JSON.stringify(q.options),
                    correctAnswer: JSON.stringify(q.correctAnswer)
                }))
            });
        }

        return NextResponse.json(material);
    } catch (error) {
        console.error('更新学习内容失败:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.trainingMaterial.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
