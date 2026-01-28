import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import crypto from 'crypto';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import { parseFileRecordFromDb } from '@/utils/storage';

const execAsync = promisify(exec);

// 僵尸锁超时时间：5 分钟（ms）。超过此时间的 PENDING 状态视为僵尸锁，可被覆盖
const THUMBNAIL_PENDING_TTL_MS = 5 * 60 * 1000;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let tempDir: string | null = null;
  let workerStartTime: Date | null = null; // Track our lock timestamp

  try {
    const { id } = await context.params;

    // ✅ 乐观锁：仅当 thumbnail 为 null 时设置 PENDING + 时间戳
    const now = new Date();
    let updated = await prisma.trainingMaterial.updateMany({
      where: {
        id,
        thumbnail: null
      },
      data: {
        thumbnail: 'PENDING',
        thumbnailPendingSince: now
      }
    });

    if (updated.count === 0) {
      // 检查是否为僵尸锁（PENDING 超过 TTL）
      const material = await prisma.trainingMaterial.findUnique({
        where: { id },
        select: { thumbnail: true, thumbnailPendingSince: true }
      });

      if (material?.thumbnail === 'PENDING') {
        const pendingSince = material.thumbnailPendingSince;
        const isZombieLock = pendingSince && (now.getTime() - pendingSince.getTime() > THUMBNAIL_PENDING_TTL_MS);

        if (isZombieLock) {
          // 僵尸锁恢复：强制重置为新的 PENDING
          console.log('[Thumbnail] 检测到僵尸锁，自动恢复:', id, '上次PENDING时间:', pendingSince);
          updated = await prisma.trainingMaterial.updateMany({
            where: {
              id,
              thumbnail: 'PENDING',
              thumbnailPendingSince: pendingSince // 确认时间戳未变，避免与另一个恢复线程冲突
            },
            data: {
              thumbnail: 'PENDING',
              thumbnailPendingSince: now
            }
          });

          if (updated.count === 0) {
            // 另一个请求同时恢复了
            return NextResponse.json({
              thumbnail: null,
              message: '缩略图正在由其他请求生成，请稍后重试'
            }, { status: 202 });
          }
          // 成功接管僵尸锁，继续生成
          workerStartTime = now;
        } else {
          // PENDING 未超时，正常等待
          return NextResponse.json({
            thumbnail: null,
            message: '缩略图生成中，请稍后重试'
          }, { status: 202 });
        }
      } else {
        // 已有缩略图
        return NextResponse.json({
          thumbnail: material?.thumbnail || null,
          message: '缩略图已存在'
        });
      }
    } else {
      // 成功获得新锁
      workerStartTime = now;
    }

    // 获取材料信息
    const material = await prisma.trainingMaterial.findUnique({
      where: { id },
    });

    if (!material) {
      return NextResponse.json(
        { error: '材料不存在' },
        { status: 404 }
      );
    }

    // ✅ 路径安全：确认临时目录在系统临时目录下
    const safeTmpBase = os.tmpdir();
    tempDir = await fs.mkdtemp(path.join(safeTmpBase, 'thumbnail-'));
    if (!tempDir.startsWith(safeTmpBase)) {
      throw new Error(`路径安全检查失败: tempDir=${tempDir} 不在 ${safeTmpBase} 之下`);
    }

    let thumbnailBuffer: Buffer | null = null;
    const timestamp = Date.now();
    const thumbnailFileName = `thumb-${id}-${timestamp}.jpg`;

    if (material.type === 'video') {
      try {
        console.log('[Thumbnail] 为视频生成缩略图:', material.url);

        let videoPath: string;
        const parsedRecord = parseFileRecordFromDb(material.url);

        if (parsedRecord) {
          const videoBuffer = await minioStorageService.downloadFile(
            parsedRecord.bucket,
            parsedRecord.objectName
          );
          const videoExt = path.extname(parsedRecord.objectName) || '.mp4';
          videoPath = path.join(tempDir, `video${videoExt}`);
          await fs.writeFile(videoPath, videoBuffer);
        } else {
          videoPath = path.join(process.cwd(), 'public', material.url);
        }

        const thumbnailTempPath = path.join(tempDir, thumbnailFileName);

        await execAsync(
          `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=640:-1" "${thumbnailTempPath}"`,
          { timeout: 30000 }
        );

        thumbnailBuffer = await fs.readFile(thumbnailTempPath);
        console.log('[Thumbnail] 视频缩略图生成成功');
      } catch (error) {
        console.error('[Thumbnail] FFmpeg 错误:', error);
        await prisma.trainingMaterial.update({
          where: { id },
          data: { thumbnail: null, thumbnailPendingSince: null }
        });
        return NextResponse.json({
          thumbnail: null,
          message: '缩略图生成失败：需要安装 ffmpeg'
        }, { status: 500 });
      }
    } else if (material.type === 'pdf' && material.convertedUrl) {
      try {
        console.log('[Thumbnail] 为PDF生成缩略图:', material.convertedUrl);

        let pdfPath: string;
        const parsedRecord = parseFileRecordFromDb(material.convertedUrl);

        if (parsedRecord) {
          const pdfBuffer = await minioStorageService.downloadFile(
            parsedRecord.bucket,
            parsedRecord.objectName
          );
          pdfPath = path.join(tempDir, 'document.pdf');
          await fs.writeFile(pdfPath, pdfBuffer);
        } else {
          pdfPath = path.join(process.cwd(), 'public', material.convertedUrl);
        }

        const thumbnailTempPath = path.join(tempDir, thumbnailFileName);

        await execAsync(
          `magick convert -density 150 "${pdfPath}[0]" -quality 85 -resize 640x "${thumbnailTempPath}"`,
          { timeout: 30000 }
        );

        thumbnailBuffer = await fs.readFile(thumbnailTempPath);
        console.log('[Thumbnail] PDF缩略图生成成功');
      } catch (error) {
        console.error('[Thumbnail] ImageMagick 错误:', error);
        await prisma.trainingMaterial.update({
          where: { id },
          data: { thumbnail: null, thumbnailPendingSince: null }
        });
        return NextResponse.json({
          thumbnail: null,
          message: '缩略图生成失败：需要安装 ImageMagick'
        }, { status: 500 });
      }
    }

    // 上传缩略图到 MinIO
    if (thumbnailBuffer) {
      const objectName = minioStorageService.generateObjectName(thumbnailFileName, 'thumbnails');
      await minioStorageService.uploadFile('public', objectName, thumbnailBuffer, 'image/jpeg');

      const thumbnailDbRecord = minioStorageService.formatDbRecord('public', objectName);

      // ✅ 修复 Late Write Race: 仅当锁仍由本 worker 持有时才更新
      const updateResult = await prisma.trainingMaterial.updateMany({
        where: {
          id,
          thumbnail: 'PENDING',
          thumbnailPendingSince: workerStartTime // 验证锁所有权
        },
        data: { thumbnail: thumbnailDbRecord, thumbnailPendingSince: null },
      });

      if (updateResult.count === 0) {
        // 锁已被其他请求/清理脚本重置或接管
        console.warn('[Thumbnail] 锁已失效，清理孤立的缩略图文件:', thumbnailDbRecord);
        try {
          // 删除孤立的 MinIO 文件
          await minioStorageService.deleteFile('public', objectName);
        } catch (cleanupError) {
          console.error('[Thumbnail] 清理孤立缩略图失败:', cleanupError);
        }
        return NextResponse.json({
          thumbnail: null,
          message: '缩略图生成已被其他请求取代，已清理孤立文件'
        }, { status: 409 }); // 409 Conflict
      }

      // 同步到FileMetadata表
      try {
        const md5Hash = crypto.createHash('md5').update(thumbnailBuffer).digest('hex');
        await prisma.fileMetadata.upsert({
          where: { filePath: thumbnailDbRecord },
          update: {
            fileName: thumbnailFileName,
            fileType: 'jpg',
            fileSize: thumbnailBuffer.length,
            md5Hash,
            category: 'thumbnails',
            uploadedAt: new Date()
          },
          create: {
            filePath: thumbnailDbRecord,
            fileName: thumbnailFileName,
            fileType: 'jpg',
            fileSize: thumbnailBuffer.length,
            md5Hash,
            category: 'thumbnails',
            uploadedAt: new Date()
          }
        });
      } catch (metaError) {
        console.warn('[Thumbnail] 保存FileMetadata失败（不影响主流程）:', metaError);
      }

      return NextResponse.json({
        thumbnail: thumbnailDbRecord,
        message: '缩略图生成成功'
      });
    } else {
      await prisma.trainingMaterial.update({
        where: { id },
        data: { thumbnail: null, thumbnailPendingSince: null }
      });

      return NextResponse.json({
        thumbnail: null,
        message: '不支持的文件类型或缩略图生成失败'
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Thumbnail] 生成缩略图错误:', error);

    // 清除 PENDING 标记和时间戳
    try {
      const { id } = await context.params;
      await prisma.trainingMaterial.updateMany({
        where: { id, thumbnail: 'PENDING' },
        data: { thumbnail: null, thumbnailPendingSince: null }
      });
    } catch (e) {
      console.error('[Thumbnail] 清除PENDING标记失败:', e);
    }

    return NextResponse.json(
      { error: '生成缩略图失败', details: error.message },
      { status: 500 }
    );
  } finally {
    // ✅ 路径安全验证（symlink-safe）+ finally 确保清理
    if (tempDir) {
      try {
        // 使用 path.resolve() 处理 symlink（如 macOS 的 /tmp -> /private/tmp）
        const safeTmpBase = path.resolve(os.tmpdir());
        const resolvedTempDir = path.resolve(tempDir);

        if (resolvedTempDir.startsWith(safeTmpBase)) {
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log('[Thumbnail] 临时文件清理成功:', tempDir);
        } else {
          console.error('[Thumbnail] 路径安全检查失败，跳过删除:', tempDir, '(resolved:', resolvedTempDir, ', expected prefix:', safeTmpBase, ')');
        }
      } catch (cleanupError) {
        console.error('[Thumbnail] 临时文件清理失败:', cleanupError);
      }
    }
  }
}

// 获取缩略图
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const material = await prisma.trainingMaterial.findUnique({
      where: { id },
      select: { thumbnail: true },
    });

    if (!material) {
      return NextResponse.json(
        { error: '材料不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ thumbnail: material.thumbnail });
  } catch (error: any) {
    console.error('[Thumbnail] 获取缩略图错误:', error);
    return NextResponse.json(
      { error: '获取缩略图失败' },
      { status: 500 }
    );
  }
}
