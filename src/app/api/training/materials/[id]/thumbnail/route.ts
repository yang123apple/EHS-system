import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

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

    // 如果已经有缩略图，直接返回
    if (material.thumbnail) {
      return NextResponse.json({ thumbnail: material.thumbnail });
    }

    const publicDir = path.join(process.cwd(), 'public');
    const thumbnailDir = path.join(publicDir, 'uploads', 'thumbnails');
    
    // 确保缩略图目录存在
    await fs.mkdir(thumbnailDir, { recursive: true });

    let thumbnailPath = '';
    const timestamp = Date.now();

    if (material.type === 'video') {
      // 为视频生成缩略图 (需要 ffmpeg)
      const videoPath = path.join(publicDir, material.url);
      const thumbnailFileName = `thumb-${id}-${timestamp}.jpg`;
      thumbnailPath = `/uploads/thumbnails/${thumbnailFileName}`;
      const thumbnailFullPath = path.join(thumbnailDir, thumbnailFileName);

      try {
        // 使用 ffmpeg 提取视频第1秒的帧作为缩略图
        await execAsync(
          `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=640:-1" "${thumbnailFullPath}"`
        );
      } catch (error) {
        console.error('FFmpeg 错误:', error);
        // 如果 ffmpeg 不可用，使用默认占位图
        thumbnailPath = '';
      }
    } else if (material.type === 'pdf' && material.convertedUrl) {
      // 为 PDF 生成缩略图 (需要 ImageMagick 或 pdf2pic)
      const pdfPath = path.join(publicDir, material.convertedUrl);
      const thumbnailFileName = `thumb-${id}-${timestamp}.jpg`;
      thumbnailPath = `/uploads/thumbnails/${thumbnailFileName}`;
      const thumbnailFullPath = path.join(thumbnailDir, thumbnailFileName);

      try {
        // 使用 ImageMagick 将 PDF 第一页转换为图片
        await execAsync(
          `magick convert -density 150 "${pdfPath}[0]" -quality 85 -resize 640x "${thumbnailFullPath}"`
        );
      } catch (error) {
        console.error('ImageMagick 错误:', error);
        // 如果 ImageMagick 不可用，使用默认占位图
        thumbnailPath = '';
      }
    }

    // 更新材料记录
    if (thumbnailPath) {
      await prisma.trainingMaterial.update({
        where: { id },
        data: { thumbnail: thumbnailPath },
      });

      // 同步到FileMetadata表（用于备份索引）
      try {
        const thumbnailFullPath = path.join(publicDir, thumbnailPath);
        if (fsSync.existsSync(thumbnailFullPath)) {
          const fsPromises = await import('fs/promises');
          const buffer = await fsPromises.readFile(thumbnailFullPath);
          const crypto = await import('crypto');
          const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');
          const stats = await fsPromises.stat(thumbnailFullPath);

          await prisma.fileMetadata.upsert({
            where: { filePath: thumbnailPath },
            update: {
              fileName: path.basename(thumbnailPath),
              fileType: 'jpg',
              fileSize: stats.size,
              md5Hash,
              category: 'thumbnails',
              uploadedAt: new Date()
            },
            create: {
              filePath: thumbnailPath,
              fileName: path.basename(thumbnailPath),
              fileType: 'jpg',
              fileSize: stats.size,
              md5Hash,
              category: 'thumbnails',
              uploadedAt: new Date()
            }
          });
        }
      } catch (metaError) {
        // FileMetadata保存失败不影响主流程，只记录日志
        console.warn('保存FileMetadata失败（不影响主流程）:', metaError);
      }

      return NextResponse.json({ 
        thumbnail: thumbnailPath,
        message: '缩略图生成成功' 
      });
    } else {
      return NextResponse.json({ 
        thumbnail: null,
        message: '缩略图生成失败，将使用默认占位图' 
      });
    }
  } catch (error: any) {
    console.error('生成缩略图错误:', error);
    return NextResponse.json(
      { error: '生成缩略图失败', details: error.message },
      { status: 500 }
    );
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
    console.error('获取缩略图错误:', error);
    return NextResponse.json(
      { error: '获取缩略图失败' },
      { status: 500 }
    );
  }
}
