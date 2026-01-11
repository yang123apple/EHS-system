/**
 * 本地文件系统上传辅助函数
 * 确保文件保存到本地并同步到FileMetadata表（用于备份索引）
 */

import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface UploadLocalFileParams {
    file: File;
    buffer: Buffer;
    uploadDir: string; // 如 'public/uploads/docs'
    category: string; // 如 'docs', 'avatars', 'thumbnails', 'training'
    uploaderId?: string;
    subDir?: string; // 可选的子目录，如 'docs' 会变成 'public/uploads/docs'
}

/**
 * 上传文件到本地文件系统并同步到FileMetadata表
 */
export async function uploadLocalFile(params: UploadLocalFileParams) {
    const {
        file,
        buffer,
        uploadDir,
        category,
        uploaderId,
        subDir
    } = params;

    // 确保上传目录存在
    const fullUploadDir = path.join(process.cwd(), uploadDir);
    if (subDir) {
        const subDirPath = path.join(fullUploadDir, subDir);
        if (!fs.existsSync(subDirPath)) {
            fs.mkdirSync(subDirPath, { recursive: true });
        }
    } else {
        if (!fs.existsSync(fullUploadDir)) {
            fs.mkdirSync(fullUploadDir, { recursive: true });
        }
    }

    // 生成唯一文件名
    const fileId = Date.now().toString(36);
    const ext = path.extname(file.name) || '';
    const safeFileName = `${file.name.replace(/\s/g, '_')}-${fileId}${ext}`;
    
    // 确定最终文件路径
    const finalDir = subDir ? path.join(fullUploadDir, subDir) : fullUploadDir;
    const filePath = path.join(finalDir, safeFileName);
    const relativePath = subDir 
        ? `/uploads/${subDir}/${safeFileName}`
        : `/uploads/${safeFileName}`;

    let fileWritten = false;

    try {
        // 先写入文件
        fs.writeFileSync(filePath, buffer);
        fileWritten = true;

        // 计算MD5哈希
        const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');

        // 同步到FileMetadata表（用于备份索引）
        try {
            await prisma.fileMetadata.upsert({
                where: { filePath: relativePath },
                update: {
                    fileName: file.name,
                    fileType: ext.replace('.', '') || 'unknown',
                    fileSize: file.size,
                    md5Hash,
                    category,
                    uploaderId,
                    uploadedAt: new Date()
                },
                create: {
                    filePath: relativePath,
                    fileName: file.name,
                    fileType: ext.replace('.', '') || 'unknown',
                    fileSize: file.size,
                    md5Hash,
                    category,
                    uploaderId,
                    uploadedAt: new Date()
                }
            });
        } catch (metaError) {
            // FileMetadata保存失败不影响主流程，只记录日志
            console.warn('保存FileMetadata失败（不影响主流程）:', metaError);
        }

        return {
            success: true,
            filePath: relativePath,
            fullPath: filePath,
            fileName: safeFileName
        };
    } catch (error) {
        // 如果FileMetadata保存失败，清理已写入的文件
        if (fileWritten && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (cleanupError) {
                console.error('清理文件失败:', cleanupError);
            }
        }
        throw error;
    }
}

