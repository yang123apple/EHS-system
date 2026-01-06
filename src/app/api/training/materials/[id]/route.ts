import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, withAuth, withPermission, withResourcePermission, logApiOperation } from '@/middleware/auth';
import fs from 'fs';
import path from 'path';

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
    return NextResponse.json(material);
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

// 安全删除文件的辅助函数
const safeDeleteFile = (urlPath: string | null | undefined): { success: boolean; error?: string } => {
  if (!urlPath) {
    return { success: true };
  }
  
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
    const filePath = path.join(publicDir, relativePath);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[Delete Material API] 已删除文件:', filePath);
      return { success: true };
    } else {
      console.log('[Delete Material API] 文件不存在，跳过删除:', filePath);
      return { success: true };
    }
  } catch (e: any) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[Delete Material API] 删除文件失败:', urlPath, errorMsg);
    return { success: false, error: errorMsg };
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
      
      // 确认没有关联任务后，再删除相关文件（即使失败也继续）
      const fileDeleteResults = {
        url: safeDeleteFile(material.url),
        convertedUrl: safeDeleteFile(material.convertedUrl),
        thumbnail: safeDeleteFile(material.thumbnail)
      };
      
      const fileDeleteErrors = Object.entries(fileDeleteResults)
        .filter(([_, result]) => !result.success)
        .map(([key, result]) => `${key}: ${result.error}`);
      
      if (fileDeleteErrors.length > 0) {
        console.warn('[Delete Material API] 部分文件删除失败:', fileDeleteErrors);
      }
      
      // 删除数据库记录（即使文件删除失败也继续）
      try {
        await prisma.trainingMaterial.delete({
          where: { id }
        });
        console.log('[Delete Material API] 数据库记录已删除');
      } catch (dbError: any) {
        console.error('[Delete Material API] 删除数据库记录失败:', dbError);
        throw new Error(`删除数据库记录失败: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      }
      
      // 记录操作日志
      try {
        await logApiOperation(user, 'training', 'delete_material', {
          materialId: id,
          title: material.title,
          fileDeleteResults: fileDeleteErrors.length > 0 ? { errors: fileDeleteErrors } : 'success'
        });
      } catch (logError) {
        console.error('[Delete Material API] 记录操作日志失败:', logError);
        // 日志失败不影响删除操作
      }
      
      console.log('[Delete Material API] 删除完成');
      return NextResponse.json({ 
        success: true,
        fileDeleteWarnings: fileDeleteErrors.length > 0 ? fileDeleteErrors : undefined
      });
    }
  )
);
