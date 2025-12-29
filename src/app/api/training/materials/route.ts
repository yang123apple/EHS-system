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
    console.log('[Training Materials API] 开始创建学习材料...');
    const body = await req.json();
    console.log('[Training Materials API] 接收到的数据:', JSON.stringify(body, null, 2));
    
    const { title, description, type, category, url, duration, isExamRequired, passingScore, isPublic, uploaderId, questions } = body;

    // 验证必需字段
    if (!title || !type || !url || !uploaderId) {
      console.error('[Training Materials API] 缺少必需字段:', { title, type, url, uploaderId });
      return NextResponse.json({ 
        error: '缺少必需字段',
        details: { title: !!title, type: !!type, url: !!url, uploaderId: !!uploaderId }
      }, { status: 400 });
    }

    let convertedUrl: string | null = null;

    // Trigger conversion for PPTX/DOCX
    if (type === 'pptx' || type === 'docx') {
        console.log('[Training Materials API] 开始转换文档为 PDF...');
        try {
          const publicDir = path.join(process.cwd(), 'public');
          // Remove leading slash for path.join
          const relativePath = url.startsWith('/') ? url.slice(1) : url;
          const inputPath = path.join(publicDir, relativePath);
          console.log('[Training Materials API] 输入文件路径:', inputPath);

          convertedUrl = await convertToPdf(inputPath, title);
          console.log('[Training Materials API] PDF 转换成功:', convertedUrl);
        } catch (convError) {
          console.error('[Training Materials API] PDF 转换失败:', convError);
          // 转换失败不阻止创建，只是没有 PDF 预览
          convertedUrl = null;
        }
    }

    console.log('[Training Materials API] 准备创建数据库记录...');
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

    console.log('[Training Materials API] 学习材料创建成功:', material.id);
    return NextResponse.json(material);
  } catch (error) {
    console.error('[Training Materials API] 创建失败:', error);
    console.error('[Training Materials API] 错误详情:', error instanceof Error ? error.message : String(error));
    console.error('[Training Materials API] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json({ 
      error: 'Failed to create material',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
