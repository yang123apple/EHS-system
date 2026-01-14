// src/app/api/archives/enterprise/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, logApiOperation, requirePermission } from '@/middleware/auth';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import { uploadArchiveFile } from '@/lib/archiveUploadHelper';

const storage = minioStorageService;

// GET: 获取企业档案文件列表（支持分页和搜索）
export const GET = async (req: NextRequest) => {
    const permResult = await requirePermission(req, 'archives', 'enterprise_view');
    if (permResult instanceof NextResponse) return permResult;
    const { user } = permResult;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const fileType = searchParams.get('fileType') || undefined;
    const q = searchParams.get('q') || '';

    const skip = (page - 1) * limit;

    const whereCondition: any = {
        category: 'enterprise'
    };

    if (fileType) {
        whereCondition.fileType = fileType;
    }

    // 搜索功能：支持按名称、原始文件名、描述搜索
    if (q) {
        whereCondition.OR = [
            { name: { contains: q } },
            { originalName: { contains: q } },
            { description: { contains: q } }
        ];
    }

    const [files, total] = await Promise.all([
        prisma.archiveFile.findMany({
            where: whereCondition,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        }),
        prisma.archiveFile.count({ where: whereCondition })
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
        data: filesWithUrls,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    });
};

// POST: 上传企业档案文件
export const POST = async (req: NextRequest) => {
    const permResult = await requirePermission(req, 'archives', 'enterprise_upload');
    if (permResult instanceof NextResponse) return permResult;
    const { user } = permResult;
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string;
    const name = formData.get('name') as string | null;
    const isDynamic = formData.get('isDynamic') === 'true';
    const description = formData.get('description') as string || '';

    if (!file || !fileType) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 检查文件类型
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 });
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
            category: 'enterprise',
            uploaderId: user?.id,
            uploaderName: user?.name,
            objectNamePrefix: 'archives/enterprise'
        });

        // 记录操作日志
        if (user) {
            await logApiOperation(user, 'archive', 'upload', {
                targetId: archiveFile.id,
                fileName: archiveFile.originalName,
                fileType: archiveFile.fileType,
                category: 'enterprise',
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
