import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { convertToPdf } from '@/lib/converter';
import path from 'path';
import { withErrorHandling, withAuth, withPermission, logApiOperation } from '@/middleware/auth';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import { parseFileRecordFromDb } from '@/utils/storage';

export const GET = withErrorHandling(withAuth(async (req: NextRequest, context, user) => {
  const { searchParams } = new URL(req.url);
  const publicOnly = searchParams.get('publicOnly') === 'true';

  const materials = await prisma.trainingMaterial.findMany({
    where: publicOnly ? { isPublic: true } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      uploader: { select: { id: true, name: true } }
    }
  });

  // 转换 MinIO URL 为可访问的 URL
  const materialsWithUrls = await Promise.all(
    materials.map(async (material) => {
      let thumbnailUrl = material.thumbnail;

      // 如果存在缩略图且是 MinIO 格式，转换为可访问的 URL
      if (thumbnailUrl && (thumbnailUrl.startsWith('public:') || thumbnailUrl.startsWith('private:'))) {
        try {
          const urlInfo = await minioStorageService.getFileUrlFromDbRecord(thumbnailUrl);
          thumbnailUrl = urlInfo.url;
        } catch (error) {
          console.error('[Training Materials API] 转换缩略图URL失败:', error);
          thumbnailUrl = null; // 转换失败则设为 null
        }
      }

      return {
        ...material,
        thumbnail: thumbnailUrl
      };
    })
  );

  return NextResponse.json(materialsWithUrls);
}));

export const POST = withErrorHandling(
  withPermission('training', 'create_material', async (req: NextRequest, context, user) => {
    console.log('[Training Materials API] 开始创建学习材料...');
    const body = await req.json();
    console.log('[Training Materials API] 接收到的数据:', JSON.stringify(body, null, 2));

    const { title, description, type, category, url, duration, isExamRequired, passingScore, examMode, randomQuestionCount, isPublic, uploaderId, questions } = body;

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
        // 从 MinIO 下载文件到临时目录
        const fs = await import('fs/promises');
        const os = await import('os');
        const pathModule = await import('path');

        // ✅ 使用共享工具解析 MinIO 记录
        const parsedRecord = parseFileRecordFromDb(url);
        if (!parsedRecord) {
          throw new Error('无法解析文件路径');
        }

        const { bucket, objectName } = parsedRecord;
        const fileBuffer = await minioStorageService.downloadFile(bucket, objectName);

        // 创建临时文件
        const tempDir = await fs.mkdtemp(pathModule.join(os.tmpdir(), 'material-convert-'));
        const ext = type === 'pptx' ? '.pptx' : '.docx';
        const tempFilePath = pathModule.join(tempDir, `document${ext}`);
        await fs.writeFile(tempFilePath, fileBuffer);

        console.log('[Training Materials API] 临时文件创建:', tempFilePath);

        // 转换为 PDF（现在返回 MinIO 记录格式）
        convertedUrl = await convertToPdf(tempFilePath, title);

        // 清理临时文件
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.warn('[Training Materials API] 清理临时文件失败:', cleanupError);
        }

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
        examMode: examMode || 'standard',
        randomQuestionCount: examMode === 'random' && randomQuestionCount ? randomQuestionCount : null,
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

    // 记录操作日志
    await logApiOperation(user, 'training', 'create_material', {
      materialId: material.id,
      title: material.title,
      type: material.type
    });

    return NextResponse.json(material);
  })
);
