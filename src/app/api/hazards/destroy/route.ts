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
    // 动态导入 MinIO 服务
    const { minioService } = await import('@/lib/minio');
    
    let cleanedCount = 0;
    const errors: string[] = [];

    const resolveMinioTarget = (filePath: string): { bucket: 'private' | 'public'; objectName: string } => {
      // 格式1: "bucket:key" (显式指定 bucket)
      if (filePath.includes(':')) {
        const [bucket, ...keyParts] = filePath.split(':');
        if (bucket === 'private' || bucket === 'public') {
          return {
            bucket,
            objectName: keyParts.join(':'), // 支持 key 中包含冒号
          };
        }
      }

      const normalized = filePath.startsWith('/') ? filePath.substring(1) : filePath;

      // 格式2: 隐患相关文件 -> private bucket
      if (normalized.startsWith('hazard/') || normalized.startsWith('hazards/')) {
        return { bucket: 'private', objectName: normalized };
      }

      // 格式3: 旧格式兼容 "/uploads/..." -> public bucket
      if (normalized.startsWith('uploads/')) {
        return { bucket: 'public', objectName: normalized.replace(/^uploads\//, '') };
      }

      // 格式4: 培训资料 -> public bucket
      if (normalized.startsWith('training/')) {
        return { bucket: 'public', objectName: normalized };
      }

      // 默认：假设是 public bucket 的 key
      return { bucket: 'public', objectName: normalized };
    };

    for (const filePath of photoPaths) {
      if (!filePath) continue;

      // 跳过 base64 编码的数据 URL（不是实际文件，无需删除）
      if (filePath.startsWith('data:')) {
        console.log(`⏭️ [MinIO清理] 跳过 base64 数据 URL: ${filePath.substring(0, 50)}...`);
        continue;
      }

      // 跳过 HTTP/HTTPS URL（外部链接，不是 MinIO 文件）
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        console.log(`⏭️ [MinIO清理] 跳过外部 URL: ${filePath}`);
        continue;
      }

      try {
        const { bucket, objectName } = resolveMinioTarget(filePath);
        const deleted = await minioService.deleteFile(bucket, objectName);
        if (deleted) {
          cleanedCount++;
          console.log(`✅ [MinIO清理] 已删除文件: ${objectName}`);
        } else {
          const errorMsg = `删除文件失败 ${filePath}`;
          errors.push(errorMsg);
          console.error(`❌ [MinIO清理] ${errorMsg}`);
        }
      } catch (error: any) {
        const errorMsg = `删除文件失败 ${filePath}: ${error.message}`;
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
        // ⚠️ 旧字段（保持兼容）
        rectifyPhotos: true,
        verifyPhotos: true,
        // ✅ 新字段（如果存在）
        rectificationPhotos: true,
        verificationPhotos: true,
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
      ...safeJsonParseArray(hazard.rectificationPhotos || hazard.rectifyPhotos),
      ...safeJsonParseArray(hazard.verificationPhotos || hazard.verifyPhotos)
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

      // 🗑️ 3.5 从编号池中永久移除编号（如果存在）
      let deletedCodePool = 0;
      if (hazard.code) {
        const codePoolResult = await tx.hazardCodePool.deleteMany({
          where: { code: hazard.code }
        });
        deletedCodePool = codePoolResult.count;
        if (deletedCodePool > 0) {
          console.log(`🗑️ [编号回收] 编号 ${hazard.code} 已从编号池永久移除`);
        }
      }

      // 3.6 删除隐患记录本身
      await tx.hazardRecord.delete({
        where: { id: hazardId }
      });

      return {
        deletedCandidates: deletedCandidates.count,
        deletedCC: deletedCC.count,
        deletedExtensions: deletedExtensions.count,
        deletedSignatures: deletedSignatures.count,
        deletedCodePool
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
    console.log(`   - 编号池记录：${result.deletedCodePool} 条`);
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
          signatures: result.deletedSignatures,
          codePoolRecords: result.deletedCodePool
        }
      }
    });
  })
);
