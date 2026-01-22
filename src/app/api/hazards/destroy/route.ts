// src/app/api/hazards/destroy/route.ts
/**
 * 隐患硬删除（物理删除）API
 * 
 * 功能：物理删除隐患记录及关联的 MinIO 文件
 * 场景：清理脏数据、测试数据或合规性强制删除
 * 权限：仅限 Admin 用户
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, withAuth, logApiOperation } from '@/middleware/auth';
import { safeJsonParseArray } from '@/utils/jsonUtils';

/**
 * 清理 MinIO 中的孤儿文件
 * @param photoPaths 照片路径数组
 */
async function cleanupMinIOFiles(photoPaths: string[]) {
  if (!photoPaths || photoPaths.length === 0) {
    return { success: true, cleaned: 0 };
  }

  try {
    // 动态导入 MinIO 客户端
    const { minioClient, MINIO_BUCKET } = await import('@/lib/minio');
    
    let cleanedCount = 0;
    const errors: string[] = [];

    for (const path of photoPaths) {
      if (!path) continue;

      try {
        // 提取对象名称（去掉 bucket 前缀，如果有的话）
        const objectName = path.includes(':') 
          ? path.split(':')[1] 
          : path.startsWith('/') 
            ? path.substring(1) 
            : path;

        // 删除 MinIO 对象
        await minioClient.removeObject(MINIO_BUCKET, objectName);
        cleanedCount++;
        console.log(`✅ [MinIO清理] 已删除文件: ${objectName}`);
      } catch (error: any) {
        const errorMsg = `删除文件失败 ${path}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ [MinIO清理] ${errorMsg}`);
      }
    }

    return {
      success: errors.length === 0,
      cleaned: cleanedCount,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error: any) {
    console.error('[MinIO清理] MinIO 客户端初始化失败:', error);
    return {
      success: false,
      cleaned: 0,
      errors: [`MinIO 客户端错误: ${error.message}`]
    };
  }
}

export const DELETE = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    // 🔒 权限检查：仅限 Admin
    if (user.role !== 'admin') {
      console.warn(`⚠️ [硬删除] 非管理员用户 ${user.name} (${user.id}) 尝试硬删除隐患`);
      return NextResponse.json(
        { error: '权限不足：仅管理员可执行硬删除操作' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const hazardId = searchParams.get('id');

    if (!hazardId) {
      return NextResponse.json(
        { error: '缺少必要参数：id' },
        { status: 400 }
      );
    }

    // 1. 获取隐患完整信息（用于清理文件和日志记录）
    const hazard = await prisma.hazardRecord.findUnique({
      where: { id: hazardId },
      select: {
        id: true,
        code: true,
        type: true,
        location: true,
        status: true,
        isVoided: true,
        photos: true,
        rectifyPhotos: true,
        verifyPhotos: true,
        reporterName: true,
        reportTime: true
      }
    });

    if (!hazard) {
      return NextResponse.json(
        { error: '隐患记录不存在' },
        { status: 404 }
      );
    }

    // 2. 收集所有需要清理的文件路径
    const allPhotos = [
      ...safeJsonParseArray(hazard.photos),
      ...safeJsonParseArray(hazard.rectifyPhotos),
      ...safeJsonParseArray(hazard.verifyPhotos)
    ].filter(Boolean);

    console.log(`🗑️ [硬删除] 准备删除隐患 ${hazard.code}，关联文件数：${allPhotos.length}`);

    // 3. 在事务中执行删除（确保数据一致性）
    const result = await prisma.$transaction(async (tx) => {
      // 3.1 删除关联的候选处理人记录
      const deletedCandidates = await tx.hazardCandidateHandler.deleteMany({
        where: { hazardId }
      });

      // 3.2 删除关联的抄送记录
      const deletedCC = await tx.hazardCC.deleteMany({
        where: { hazardId }
      });

      // 3.3 删除关联的延期记录
      const deletedExtensions = await tx.hazardExtension.deleteMany({
        where: { hazardId }
      });

      // 3.4 删除关联的签名记录
      const deletedSignatures = await tx.signatureRecord.deleteMany({
        where: { hazardId }
      });

      // 3.5 删除隐患记录本身
      await tx.hazardRecord.delete({
        where: { id: hazardId }
      });

      return {
        deletedCandidates: deletedCandidates.count,
        deletedCC: deletedCC.count,
        deletedExtensions: deletedExtensions.count,
        deletedSignatures: deletedSignatures.count
      };
    });

    // 4. 清理 MinIO 文件（在事务外执行，即使失败也不影响数据删除）
    const cleanupResult = await cleanupMinIOFiles(allPhotos);

    // 5. 记录系统日志
    await logApiOperation(user, 'hidden_danger', 'destroy', {
      hazardId: hazard.code || hazardId,
      type: hazard.type,
      location: hazard.location,
      status: hazard.status,
      isVoided: hazard.isVoided,
      filesCleanup: cleanupResult,
      relatedRecords: result
    });

    console.log(`✅ [硬删除] 隐患 ${hazard.code} 已物理删除`);
    console.log(`   - 候选处理人记录：${result.deletedCandidates} 条`);
    console.log(`   - 抄送记录：${result.deletedCC} 条`);
    console.log(`   - 延期记录：${result.deletedExtensions} 条`);
    console.log(`   - 签名记录：${result.deletedSignatures} 条`);
    console.log(`   - MinIO 文件：${cleanupResult.cleaned}/${allPhotos.length} 个`);

    return NextResponse.json({
      success: true,
      message: '隐患已物理删除',
      data: {
        hazardCode: hazard.code,
        filesCleanup: {
          total: allPhotos.length,
          cleaned: cleanupResult.cleaned,
          success: cleanupResult.success,
          errors: cleanupResult.errors
        },
        relatedRecords: {
          candidateHandlers: result.deletedCandidates,
          ccRecords: result.deletedCC,
          extensions: result.deletedExtensions,
          signatures: result.deletedSignatures
        }
      }
    });
  })
);
