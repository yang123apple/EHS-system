import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, withAuth, withPermission, withResourcePermission, logApiOperation } from '@/middleware/auth';
import fs from 'fs';
import path from 'path';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import { parseFileRecordFromDb } from '@/utils/storage';

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user) => {
    const { id } = await params;
    const material = await prisma.trainingMaterial.findUnique({
      where: { id },
      include: {
        uploader: { select: { name: true } },
        questions: true
      }
    });
    if (!material) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 转换缩略图 URL（如果是 MinIO 格式）
    let thumbnailUrl = material.thumbnail;
    if (thumbnailUrl && (thumbnailUrl.startsWith('public:') || thumbnailUrl.startsWith('private:'))) {
      try {
        const urlInfo = await minioStorageService.getFileUrlFromDbRecord(thumbnailUrl);
        thumbnailUrl = urlInfo.url;
      } catch (error) {
        console.error('[Training Material GET] 转换缩略图URL失败:', error);
        thumbnailUrl = null;
      }
    }

    return NextResponse.json({
      ...material,
      thumbnail: thumbnailUrl
    });
  })
);

export const PUT = withErrorHandling(
  withResourcePermission(
    'training',
    'edit_material',
    async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
      const { id } = await params;
      const material = await prisma.trainingMaterial.findUnique({
        where: { id },
        select: { uploaderId: true }
      });
      return material?.uploaderId || null;
    },
    async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user) => {
      const { id } = await params;
      const body = await req.json();
      console.log('[Edit Material API] 接收到的数据:', JSON.stringify(body, null, 2));
      
      const { title, description, category, isPublic, isExamRequired, passingScore, examMode, randomQuestionCount, questions } = body;

      // 更新材料信息
      const material = await prisma.trainingMaterial.update({
        where: { id },
        data: {
          title,
          description,
          category,
          isPublic,
          isExamRequired,
          passingScore,
          examMode: examMode || 'standard',
          randomQuestionCount: examMode === 'random' && randomQuestionCount ? randomQuestionCount : null
        }
      });

    // 删除旧的考试题目
    await prisma.examQuestion.deleteMany({
      where: { materialId: id }
    });

    // 创建新的考试题目
    if (isExamRequired && questions && questions.length > 0) {
      console.log('[Edit Material API] 创建考试题目:', questions.length, '道题');
      await prisma.examQuestion.createMany({
        data: questions.map((q: any) => ({
          materialId: id,
          question: q.question,
          type: q.type,
          options: JSON.stringify(q.options),
          answer: JSON.stringify(q.correctAnswer || q.answer),
          score: q.score || 10
        }))
      });
    }

      // 记录操作日志
      await logApiOperation(user, 'training', 'edit_material', {
        materialId: id,
        title: material.title
      });

      console.log('[Edit Material API] 更新成功');
      return NextResponse.json(material);
    }
  )
);

// ✅ 修复：安全删除文件 — Transactional Outbox 模式
// 策略：在事务内先插入 FileDeletionQueue（pending）再删除 DB 记录，
// 事务 commit 后再尝试 MinIO 删除，成功则标记 completed。
// 这保证即使 MinIO 删除失败或进程崩溃，文件引用不会丢失。
const safeDeleteFileWithQueue = async (
  tx: Omit<typeof prisma, '$queryRaw' | '$executeRaw' | '$queryRawUnsafe' | '$executeRawUnsafe' | '$transaction'>,
  urlPath: string | null | undefined
): Promise<{ filePath: string; bucket: string; objectName: string } | null> => {
  if (!urlPath) return null;

  const parsedRecord = parseFileRecordFromDb(urlPath);
  if (!parsedRecord) {
    // 本地文件，事务外直接删除
    const publicDir = path.join(process.cwd(), 'public');
    const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
    const filePath = path.join(publicDir, relativePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[Delete Material API] 本地文件删除成功:', filePath);
    }
    return null;
  }

  // MinIO 文件：在事务内插入删除队列（保证原子性）
  await tx.fileDeletionQueue.create({
    data: {
      filePath: urlPath,
      bucket: parsedRecord.bucket,
      objectName: parsedRecord.objectName,
      status: 'pending',
    }
  });

  return { filePath: urlPath, bucket: parsedRecord.bucket, objectName: parsedRecord.objectName };
};

// 事务外执行 MinIO 删除，成功则标记 completed
const executeMinioDeletes = async (
  pendingDeletes: Array<{ filePath: string; bucket: string; objectName: string }>
): Promise<void> => {
  for (const item of pendingDeletes) {
    try {
      await minioStorageService.deleteFile(item.bucket, item.objectName);
      console.log('[Delete Material API] MinIO文件删除成功:', item.filePath);

      // 标记为已完成
      await prisma.fileDeletionQueue.updateMany({
        where: { filePath: item.filePath, status: 'pending' },
        data: { status: 'completed', lastTriedAt: new Date() }
      });

      // 同步删除 FileMetadata
      try {
        await prisma.fileMetadata.deleteMany({ where: { filePath: item.filePath } });
      } catch (metaError) {
        console.warn('[Delete Material API] FileMetadata删除失败:', metaError);
      }
    } catch (minioError: any) {
      // MinIO 删除失败，队列记录保留为 pending，后台任务将重试
      const errorMsg = minioError instanceof Error ? minioError.message : String(minioError);
      console.error('[Delete Material API] MinIO删除失败（保留在队列中供重试）:', item.filePath, errorMsg);
      await prisma.fileDeletionQueue.updateMany({
        where: { filePath: item.filePath, status: 'pending' },
        data: { status: 'retrying', errorMsg, lastTriedAt: new Date() }
      });
    }
  }
};

export const DELETE = withErrorHandling(
  withResourcePermission(
    'training',
    'delete_material',
    async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
      const { id } = await context.params;
      const material = await prisma.trainingMaterial.findUnique({
        where: { id },
        select: { uploaderId: true }
      });
      return material?.uploaderId || null;
    },
    async (req: NextRequest, context: { params: Promise<{ id: string }> }, user) => {
      const { id } = await context.params;
      
      console.log('[Delete Material API] 开始删除学习内容:', id);
      
      // 获取材料信息（包括文件路径）
      const material = await prisma.trainingMaterial.findUnique({
        where: { id },
        select: { 
          title: true,
          url: true,
          convertedUrl: true,
          thumbnail: true
        }
      });
      
      if (!material) {
        console.log('[Delete Material API] 学习内容不存在:', id);
        return NextResponse.json({ error: '学习内容不存在' }, { status: 404 });
      }
      
      console.log('[Delete Material API] 找到学习内容:', {
        title: material.title,
        url: material.url,
        convertedUrl: material.convertedUrl,
        thumbnail: material.thumbnail
      });
      
      // 先检查是否有关联的培训任务，如果有则禁止删除（在删除文件之前检查）
      try {
        const relatedTasks = await prisma.trainingTask.findMany({
          where: { materialId: id },
          select: { id: true, title: true }
        });
        
        if (relatedTasks.length > 0) {
          console.log(`[Delete Material API] 发现 ${relatedTasks.length} 个关联的培训任务，禁止删除`);
          return NextResponse.json({ 
            error: `无法删除该学习内容，因为存在 ${relatedTasks.length} 个关联的培训任务。请先删除或修改相关培训任务后再试。`,
            relatedTasksCount: relatedTasks.length
          }, { status: 400 });
        }
      } catch (taskError: any) {
        console.error('[Delete Material API] 检查关联任务失败:', taskError);
        throw new Error(`检查关联的培训任务失败: ${taskError instanceof Error ? taskError.message : String(taskError)}`);
      }
      
      // 确认没有关联任务后，使用事务原子删除：队列插入 + DB 记录删除
      const pendingDeletes: Array<{ filePath: string; bucket: string; objectName: string }> = [];

      await prisma.$transaction(async (tx) => {
        // 在事务内为每个 MinIO 文件插入删除队列
        const urlQueue = await safeDeleteFileWithQueue(tx, material.url);
        if (urlQueue) pendingDeletes.push(urlQueue);

        const convertedQueue = await safeDeleteFileWithQueue(tx, material.convertedUrl);
        if (convertedQueue) pendingDeletes.push(convertedQueue);

        const thumbnailQueue = await safeDeleteFileWithQueue(tx, material.thumbnail);
        if (thumbnailQueue) pendingDeletes.push(thumbnailQueue);

        // 同一事务内删除 DB 记录
        await tx.trainingMaterial.delete({ where: { id } });
        console.log('[Delete Material API] 事务提交：DB记录已删除，队列已创建');
      });

      // 事务 commit 后，尝试执行 MinIO 删除（异步，失败不影响响应）
      executeMinioDeletes(pendingDeletes).catch((err) => {
        console.error('[Delete Material API] MinIO删除执行失败:', err);
      });

      // 记录操作日志
      try {
        await logApiOperation(user, 'training', 'delete_material', {
          materialId: id,
          title: material.title
        });
      } catch (logError) {
        console.error('[Delete Material API] 记录操作日志失败:', logError);
      }

      console.log('[Delete Material API] 删除完成');
      return NextResponse.json({ success: true });
    }
  )
);
