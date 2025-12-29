import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { convertToPdf } from '@/lib/converter';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const publicOnly = searchParams.get('publicOnly') === 'true';

    const materials = await prisma.trainingMaterial.findMany({
      where: publicOnly ? { isPublic: true } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: { select: { name: true } }
      }
    });
    return NextResponse.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    // 返回空数组而不是错误对象，以避免前端map错误
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, type, category, url, duration, isExamRequired, passingScore, isPublic, uploaderId, questions } = body;

    let convertedUrl: string | null = null;

    // Trigger conversion for PPTX/DOCX
    if (type === 'pptx' || type === 'docx') {
        const publicDir = path.join(process.cwd(), 'public');
        // Remove leading slash for path.join
        const relativePath = url.startsWith('/') ? url.slice(1) : url;
        const inputPath = path.join(publicDir, relativePath);

        convertedUrl = await convertToPdf(inputPath, title);
    }

    const material = await prisma.trainingMaterial.create({
      data: {
        title,
        description,
        type,
        category: category || null,
        url,
        convertedUrl,
        duration: duration ? parseInt(duration) : null,
        isExamRequired,
        passingScore: passingScore ? parseInt(passingScore) : null,
        isPublic: isPublic !== undefined ? isPublic : true,
        uploaderId,
        questions: isExamRequired && questions ? {
            create: questions.map((q: any) => ({
                type: q.type,
                question: q.question,
                options: JSON.stringify(q.options),
                answer: JSON.stringify(q.answer),
                score: q.score
            }))
        } : undefined
      }
    });

    return NextResponse.json(material);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create material' }, { status: 500 });
  }
}
