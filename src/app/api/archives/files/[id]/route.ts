// src/app/api/archives/files/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withAdmin, logApiOperation, requirePermission } from '@/middleware/auth';
import { minioStorageService } from '@/services/storage/MinioStorageService';

const storage = minioStorageService;

// 根据文件类别获取权限名
function getPermissionByCategory(category: string, action: 'edit' | 'delete'): string {
    const permissionMap: Record<string, { edit: string; delete: string }> = {
        'enterprise': { edit: 'enterprise_edit', delete: 'enterprise_delete' },
        'equipment': { edit: 'equipment_edit', delete: 'equipment_delete' },
        'personnel': { edit: 'personnel_delete', delete: 'personnel_delete' }, // 一人一档没有edit权限
        'msds': { edit: 'msds_delete', delete: 'msds_delete' }, // MSDS没有edit权限
    };
    return permissionMap[category]?.[action] || 'enterprise_delete';
}

// PUT: 更新档案文件信息
export const PUT = async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;

    try {
        // 查找文件记录
        const file = await prisma.archiveFile.findUnique({
            where: { id }
        });

        if (!file) {
            return NextResponse.json({ error: '文件不存在' }, { status: 404 });
        }

        // 根据文件类别检查权限
        const permission = getPermissionByCategory(file.category, 'edit');
        const permResult = await requirePermission(req, 'archives', permission);
        if (permResult instanceof NextResponse) return permResult;
        const { user } = permResult;

        const body = await req.json();
        const { name, fileType, isDynamic, description } = body;

        // 验证必填字段
        if (!name || !fileType) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        // 更新文件信息
        const updatedFile = await prisma.archiveFile.update({
            where: { id },
            data: {
                name: name.trim(),
                fileType,
                isDynamic: isDynamic === true || isDynamic === 'true',
                description: description?.trim() || null
            }
        });

        // 记录操作日志
        await logApiOperation(user, 'archive', 'update', {
            targetId: file.id,
            fileName: file.originalName,
            fileType: file.fileType,
            category: file.category,
            changes: {
                name: name !== file.name ? { old: file.name, new: name } : undefined,
                fileType: fileType !== file.fileType ? { old: file.fileType, new: fileType } : undefined,
                isDynamic: isDynamic !== file.isDynamic ? { old: file.isDynamic, new: isDynamic } : undefined,
                description: description !== file.description ? { old: file.description, new: description } : undefined
            }
        });

        return NextResponse.json(updatedFile);
    } catch (e) {
        console.error('更新文件失败:', e);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }
});

// DELETE: 删除档案文件
export const DELETE = async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;

    try {
        // 查找文件记录
        const file = await prisma.archiveFile.findUnique({
            where: { id }
        });

        if (!file) {
            return NextResponse.json({ error: '文件不存在' }, { status: 404 });
        }

        // 根据文件类别检查权限
        const permission = getPermissionByCategory(file.category, 'delete');
        const permResult = await requirePermission(req, 'archives', permission);
        if (permResult instanceof NextResponse) return permResult;
        const { user } = permResult;

        // 先删除数据库记录（即使 MinIO 删除失败，也要保证数据一致性）
        await prisma.archiveFile.delete({
            where: { id }
        });

        // 异步删除 MinIO 文件（不阻塞响应，设置超时）
        const deleteMinIOFile = async () => {
            try {
                // 解析文件路径
                let bucket: 'private' | 'public' = 'private';
                let objectName = '';

                if (file.filePath.includes(':')) {
                    // 格式: "bucket:objectName"
                    const parts = file.filePath.split(':');
                    const bucketPart = parts[0];
                    if (bucketPart === 'private' || bucketPart === 'public') {
                        bucket = bucketPart as 'private' | 'public';
                        objectName = parts.slice(1).join(':'); // 支持 objectName 中包含冒号
                    } else {
                        // 如果第一部分不是 bucket，则默认为 private
                        bucket = 'private';
                        objectName = file.filePath;
                    }
                } else {
                    // 旧格式兼容：默认为 private
                    bucket = 'private';
                    objectName = file.filePath;
                }

                if (!objectName) {
                    console.warn('无法解析文件路径:', file.filePath);
                    return;
                }

                // 设置超时（5秒）
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('删除文件超时')), 5000);
                });

                await Promise.race([
                    storage.deleteFile(bucket, objectName),
                    timeoutPromise
                ]);
            } catch (e) {
                // MinIO 删除失败不影响主流程，只记录日志
                console.error('删除MinIO文件失败（不影响主流程）:', e);
            }
        };

        // 异步执行 MinIO 删除（不等待完成）
        deleteMinIOFile().catch(err => {
            console.error('异步删除MinIO文件失败:', err);
        });

        // 异步记录操作日志（不阻塞响应）
        logApiOperation(user, 'archive', 'delete', {
            targetId: file.id,
            fileName: file.originalName,
            fileType: file.fileType,
            category: file.category,
            fileSize: file.fileSize
        }).catch(err => {
            console.error('记录操作日志失败:', err);
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('删除文件失败:', e);
        return NextResponse.json({ 
            error: e instanceof Error ? e.message : '删除失败' 
        }, { status: 500 });
    }
});

