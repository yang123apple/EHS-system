import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 检查文件大小限制 500MB
    const maxSize = 500 * 1024 * 1024; // 500MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json({ error: '文件大小超过500MB限制' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + '-' + file.name.replace(/\s/g, '_');
    const filepath = join(uploadDir, filename);
    const relativePath = `/uploads/${filename}`;
    let fileWritten = false;

    try {
      await writeFile(filepath, buffer);
      fileWritten = true;

      // 同步到FileMetadata表（用于备份索引）
      try {
        const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');
        await prisma.fileMetadata.upsert({
          where: { filePath: relativePath },
          update: {
            fileName: file.name,
            fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown',
            fileSize: file.size,
            md5Hash,
            category: 'other',
            uploadedAt: new Date()
          },
          create: {
            filePath: relativePath,
            fileName: file.name,
            fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown',
            fileSize: file.size,
            md5Hash,
            category: 'other',
            uploadedAt: new Date()
          }
        });
      } catch (metaError) {
        // FileMetadata保存失败不影响主流程，只记录日志
        console.warn('保存FileMetadata失败（不影响主流程）:', metaError);
      }

      const url = relativePath;
      return NextResponse.json({ url });
    } catch (ioError) {
      // 如果FileMetadata保存失败，清理已写入的文件
      if (fileWritten) {
        try {
          await unlink(filepath);
        } catch (cleanupError) {
          console.error('清理文件失败:', cleanupError);
        }
      }
      throw ioError;
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
