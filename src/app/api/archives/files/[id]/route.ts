// src/app/api/archives/files/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withAdmin, logApiOperation } from '@/middleware/auth';
import { minioStorageService } from '@/services/storage/MinioStorageService';

const storage = minioStorageService;

// DELETE: 删除档案文件
export const DELETE = withAdmin<{ params: Promise<{ id: string }> }>(async (req, context, user) => {
    const { id } = await context.params;

    try {
        // 查找文件记录
        const file = await prisma.archiveFile.findUnique({
            where: { id }
        });

        if (!file) {
            return NextResponse.json({ error: '文件不存在' }, { status: 404 });
        }

        // 从 MinIO 删除文件
        try {
            // 手动解析文件路径
            const filePathParts = file.filePath.includes(':') 
                ? file.filePath.split(':') 
                : ['private', file.filePath];
            const bucket = (filePathParts[0] === 'private' || filePathParts[0] === 'public') 
                ? filePathParts[0] as 'private' | 'public'
                : 'private';
            const objectName = filePathParts.slice(1).join(':');

            await storage.deleteFile(bucket, objectName);
        } catch (e) {
            console.error('删除MinIO文件失败:', e);
            // 继续删除数据库记录，即使MinIO删除失败
        }

        // 从数据库删除记录
        await prisma.archiveFile.delete({
            where: { id }
        });

        // 记录操作日志
        await logApiOperation(user, 'archive', 'delete', {
            targetId: file.id,
            fileName: file.originalName,
            fileType: file.fileType,
            category: file.category,
            fileSize: file.fileSize
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('删除文件失败:', e);
        return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }
});

