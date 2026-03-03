// src/app/api/archives/personnel/[id]/files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, logApiOperation, requirePermission } from '@/middleware/auth';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import { uploadArchiveFile } from '@/lib/archiveUploadHelper';

const storage = minioStorageService;

// GET: 获取人员档案文件列表
export const GET = async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
        const permResult = await requirePermission(req, 'archives', 'personnel_view');
        if (permResult instanceof NextResponse) return permResult;
        const { id } = await context.params;
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '12');

        const skip = (page - 1) * limit;

        // 用户信息 + 职业健康记录并发查询，任何一方失败都不影响另一方
        const [user, healthRecord] = await Promise.all([
            prisma.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    username: true,
                    name: true,
                    avatar: true,
                    jobTitle: true,
                    isActive: true,
                    departmentId: true,
                    department: { select: { name: true } }
                }
            }),
            Promise.resolve(
                (prisma as any).personnelHealthRecord?.findUnique({ where: { userId: id } })
            ).catch(() => null)
        ]);

        if (!user) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        const [files, total] = await Promise.all([
            prisma.archiveFile.findMany({
                where: { userId: id, category: 'personnel' },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.archiveFile.count({ where: { userId: id, category: 'personnel' } })
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
            user: { ...user, department: user.department?.name || '未分配' },
            healthRecord: healthRecord || null,
            data: filesWithUrls,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('获取人员档案失败:', error);
        return NextResponse.json({ error: '获取数据失败，请重试' }, { status: 500 });
    }
};

// POST: 上传人员档案文件
export const POST = async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const permResult = await requirePermission(req, 'archives', 'personnel_upload');
    if (permResult instanceof NextResponse) return permResult;
    const { user: currentUser } = permResult;
    const { id } = await context.params;

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
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
            category: 'personnel',
            userId: id,
            uploaderId: currentUser?.id,
            uploaderName: currentUser?.name,
            objectNamePrefix: `archives/personnel/${id}`
        });

        // 记录操作日志
        if (currentUser) {
            await logApiOperation(currentUser, 'archive', 'upload', {
                targetId: archiveFile.id,
                fileName: archiveFile.originalName,
                fileType: archiveFile.fileType,
                category: 'personnel',
                userId: id,
                userName: targetUser.name,
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
