/**
 * 档案文件上传辅助函数
 * 确保数据一致性和备份索引同步
 */

import { prisma } from '@/lib/prisma';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import crypto from 'crypto';

interface UploadArchiveFileParams {
    file: File;
    buffer: Buffer;
    fileType: string;
    isDynamic: boolean;
    description?: string;
    category: 'enterprise' | 'equipment' | 'personnel';
    uploaderId?: string;
    uploaderName?: string;
    equipmentId?: string;
    userId?: string;
    objectNamePrefix?: string; // 如 'archives/enterprise' 或 'archives/equipment/{id}'
}

export async function uploadArchiveFile(params: UploadArchiveFileParams) {
    const {
        file,
        buffer,
        fileType,
        isDynamic,
        description,
        category,
        uploaderId,
        uploaderName,
        equipmentId,
        userId,
        objectNamePrefix = `archives/${category}`
    } = params;

    // 生成对象名称
    const objectName = minioStorageService.generateObjectName(file.name, objectNamePrefix);
    const filePath = minioStorageService.formatDbRecord('private', objectName);
    let minioUploaded = false;

    try {
        // 先上传到MinIO
        await minioStorageService.uploadFile('private', objectName, buffer, file.type);
        minioUploaded = true;

        // 计算MD5哈希（用于FileMetadata表）
        const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');

        // 使用事务保存到数据库（ArchiveFile和FileMetadata）
        const archiveFile = await prisma.$transaction(async (tx) => {
            // 保存到ArchiveFile表
            const archive = await tx.archiveFile.create({
                data: {
                    name: file.name.replace(/\.[^/.]+$/, ''), // 去除扩展名
                    fileType,
                    isDynamic,
                    description,
                    filePath,
                    originalName: file.name,
                    mimeType: file.type,
                    fileSize: file.size,
                    category,
                    equipmentId,
                    userId,
                    uploaderId,
                    uploaderName
                }
            });

            // 同步到FileMetadata表（用于备份索引）
            try {
                await tx.fileMetadata.upsert({
                    where: { filePath: filePath },
                    update: {
                        fileName: file.name,
                        fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown',
                        fileSize: file.size,
                        md5Hash,
                        category: 'archives',
                        uploaderId,
                        uploadedAt: new Date()
                    },
                    create: {
                        filePath: filePath,
                        fileName: file.name,
                        fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown',
                        fileSize: file.size,
                        md5Hash,
                        category: 'archives',
                        uploaderId,
                        uploadedAt: new Date()
                    }
                });
            } catch (metaError) {
                // FileMetadata保存失败不影响主流程，只记录日志
                console.warn('保存FileMetadata失败（不影响主流程）:', metaError);
            }

            return archive;
        });

        return archiveFile;
    } catch (error) {
        // 如果数据库保存失败，清理MinIO中的文件
        if (minioUploaded) {
            try {
                const { bucket, objectName: objName } = parseFilePath(filePath);
                await minioStorageService.deleteFile(bucket, objName);
            } catch (cleanupError) {
                console.error('清理MinIO文件失败:', cleanupError);
            }
        }
        throw error;
    }
}

/**
 * 解析文件路径
 */
function parseFilePath(filePath: string): { bucket: 'private' | 'public'; objectName: string } {
    if (filePath.includes(':')) {
        const [bucket, ...keyParts] = filePath.split(':');
        if (bucket === 'private' || bucket === 'public') {
            return {
                bucket: bucket as 'private' | 'public',
                objectName: keyParts.join(':')
            };
        }
    }
    return {
        bucket: 'private',
        objectName: filePath
    };
}

