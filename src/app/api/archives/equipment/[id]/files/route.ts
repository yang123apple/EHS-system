// src/app/api/archives/equipment/[id]/files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, logApiOperation, requirePermission } from '@/middleware/auth';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import { uploadArchiveFile } from '@/lib/archiveUploadHelper';

const storage = minioStorageService;

// GET: 获取设备档案文件列表
export const GET = async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const permResult = await requirePermission(req, 'archives', 'equipment_view');
    if (permResult instanceof NextResponse) return permResult;
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');

    const skip = (page - 1) * limit;

    // 检查设备是否存在
    const equipment = await prisma.equipment.findUnique({ where: { id } });
    if (!equipment) {
        return NextResponse.json({ error: '设备不存在' }, { status: 404 });
    }

    const [files, total] = await Promise.all([
        prisma.archiveFile.findMany({
            where: { equipmentId: id, category: 'equipment' },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        }),
        prisma.archiveFile.count({ where: { equipmentId: id, category: 'equipment' } })
    ]);

    // 生成访问 URL
    const filesWithUrls = await Promise.all(
        files.map(async (file) => {
            let accessUrl = '';
            try {
                const urlInfo = await storage.getFileUrlFromDbRecord(file.filePath);
                accessUrl = urlInfo.url;
            } catch (e) {
                console.error('Failed to get file URL:', e);
            }
            return { ...file, accessUrl };
        })
    );

    return NextResponse.json({
        equipment,
        data: filesWithUrls,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
};

// POST: 上传设备档案文件
export const POST = async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const permResult = await requirePermission(req, 'archives', 'equipment_upload');
    if (permResult instanceof NextResponse) return permResult;
    const { user } = permResult;
    const { id } = await context.params;

    // 检查设备是否存在
    const equipment = await prisma.equipment.findUnique({ where: { id } });
    if (!equipment) {
        return NextResponse.json({ error: '设备不存在' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string;
    const name = formData.get('name') as string | null;
    const isDynamic = formData.get('isDynamic') === 'true';
    const description = formData.get('description') as string || '';

    if (!file || !fileType) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 上传文件（使用统一的辅助函数，确保数据一致性）
    const buffer = Buffer.from(await file.arrayBuffer());
    
    try {
        const archiveFile = await uploadArchiveFile({
            file,
            buffer,
            fileType,
            name: name || undefined,
            isDynamic,
            description,
            category: 'equipment',
            equipmentId: id,
            uploaderId: user?.id,
            uploaderName: user?.name,
            objectNamePrefix: `archives/equipment/${id}`
        });

        // 记录操作日志
        if (user) {
            await logApiOperation(user, 'archive', 'upload', {
                targetId: archiveFile.id,
                fileName: archiveFile.originalName,
                fileType: archiveFile.fileType,
                category: 'equipment',
                equipmentId: id,
                equipmentName: equipment.name,
                fileSize: archiveFile.fileSize
            });
        }

        return NextResponse.json(archiveFile);
    } catch (error) {
        console.error('上传档案文件失败:', error);
        return NextResponse.json(
            { error: '上传失败，请重试' },
            { status: 500 }
        );
    }
};
