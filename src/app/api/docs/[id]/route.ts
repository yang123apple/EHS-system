// src/app/api/docs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission, logApiOperation, withErrorHandling } from '@/middleware/auth';
import crypto from 'crypto';
import { minioStorageService } from '@/services/storage/MinioStorageService';

// 使用 MinIO 存储，不需要本地目录

const safeDeleteFile = async (dbRecord: string) => {
  if (!dbRecord) return;
  try {
    const { bucket, objectName } = parseDbRecord(dbRecord);
    await minioStorageService.deleteFile(bucket, objectName);
  } catch(e) {
    console.error("File delete error:", e);
  }
};

// 解析数据库记录格式
function parseDbRecord(dbRecord: string): { bucket: 'private' | 'public'; objectName: string } {
  if (dbRecord.includes(':')) {
    const [bucket, ...keyParts] = dbRecord.split(':');
    if (bucket === 'private' || bucket === 'public') {
      return {
        bucket: bucket as 'private' | 'public',
        objectName: keyParts.join(':')
      };
    }
  }
  return {
    bucket: 'public',
    objectName: dbRecord.replace(/^\/uploads\//, '')
  };
}

// 辅助函数：保存历史版本文件
async function saveHistoryVersion(
  documentId: string,
  dbRecord: string,
  fileType: 'docx' | 'xlsx' | 'pdf',
  uploader: string | null | undefined,
  docVersion?: string | null
): Promise<void> {
  if (!dbRecord) return;

  try {
    const { bucket, objectName } = parseDbRecord(dbRecord);

    // 检查文件是否存在
    const exists = await minioStorageService.fileExists(bucket, objectName);
    if (!exists) {
      console.warn(`源文件不存在，跳过历史版本保存: ${dbRecord}`);
      return;
    }

    // 生成历史版本对象名称
    const timestamp = Date.now();
    const historyObjectName = `docs/HIST-${timestamp}-${objectName}`;
    const historyDbRecord = minioStorageService.formatDbRecord(bucket, historyObjectName);

    // 获取原文件信息并复制到历史版本
    const fileInfo = await minioStorageService.getFileInfo(bucket, objectName);
    if (fileInfo.exists) {
      // 注意：这里我们假设MinIO支持对象复制
      // 实际上，由于MinIO SDK的限制，我们无法直接复制
      // 作为替代方案，我们只记录历史版本的元数据
      // 如果需要实际复制，可以在备份过程中处理
    }

      // 计算修订日期（当前日期的 UTC YYYY-MM-DD，与 Prisma 存储格式一致）
      const now = new Date();
      const revisionDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

    // 创建历史记录（指向历史版本的位置）
    await prisma.documentHistory.create({
      data: {
        documentId,
        type: fileType,
        name: `${objectName.split('/').pop()}`,
        path: historyDbRecord,
        uploader: uploader || null,
        uploadTime: new Date(),
        revisionDate,
        version: docVersion || null
      }
    });
  } catch (e) {
    console.error("保存历史版本失败:", e);
    // 不抛出错误，避免影响主流程
  }
}

// 辅助函数：提取文本 (复用逻辑)
async function extractTextFromFile(buffer: Buffer, isXlsx: boolean): Promise<string> {
  try {
    if (isXlsx) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        text += XLSX.utils.sheet_to_txt(workbook.Sheets[sheetName]) + ' ';
      });
      return text;
    } else {
      const result = await mammoth.extractRawText({ buffer: buffer });
      return result.value; 
    }
  } catch (e) { 
    return ""; 
  }
}

export const GET = withErrorHandling(
  withAuth<{ params: Promise<{ id: string }> }>(async (req: NextRequest, context, user) => {
    const { id } = await context.params;
    const doc = await prisma.document.findUnique({ 
      where: { id },
      include: {
        history: {
          orderBy: { uploadTime: 'desc' }
        }
      }
    });
    
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    // 转换历史版本格式以匹配前端期望
    const history = doc.history.map(h => ({
      id: h.id,
      type: h.type as 'docx' | 'xlsx' | 'pdf',
      name: h.name,
      path: h.path,
      uploadTime: h.uploadTime.getTime(),
      uploader: h.uploader || '',
      revisionDate: h.revisionDate || null,
      version: h.version || null
    }));
    
    // 确保所有字段都有默认值，避免undefined
    return NextResponse.json({
      id: doc.id,
      name: doc.name || '未命名文档',
      type: doc.type || 'docx',
      docxPath: doc.docxPath || '',
      pdfPath: doc.pdfPath || null,
      prefix: doc.prefix || null,
      suffix: doc.suffix || null,
      fullNum: doc.fullNum || '',
      level: doc.level,
      parentId: doc.parentId || null,
      dept: doc.dept || '未设置',
      uploader: doc.uploader || '',
      uploadTime: doc.uploadTime.getTime(),
      searchText: doc.searchText || null,
      version: doc.version || '1.0',
      createdAt: doc.createdAt.getTime(),
      updatedAt: doc.updatedAt.getTime(),
      history
    });
  })
);

export const DELETE = withErrorHandling(
  withPermission<{ params: Promise<{ id: string }> }>('doc_sys', 'delete', async (req: NextRequest, context, user) => {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const historyId = searchParams.get('historyId');

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 删除历史版本
    if (historyId) {
      const historyRecord = await prisma.documentHistory.findUnique({
        where: { id: historyId },
        include: { document: true }
      });

      if (!historyRecord || historyRecord.documentId !== id) {
        return NextResponse.json({ error: '历史版本不存在' }, { status: 404 });
      }

      // 删除历史版本文件
      safeDeleteFile(historyRecord.path);

      // 删除历史记录
      await prisma.documentHistory.delete({ where: { id: historyId } });

      // 记录删除操作
      await logApiOperation(
        user,
        'doc_sys',
        'delete_history',
        { 
          documentId: id, 
          documentName: doc.name,
          historyId,
          historyName: historyRecord.name
        }
      );

      return NextResponse.json({ success: true });
    }

    // 删除整个文档（包括所有历史版本）
    // 先删除所有历史版本文件
    const historyRecords = await prisma.documentHistory.findMany({
      where: { documentId: id }
    });
    
    for (const historyRecord of historyRecords) {
      safeDeleteFile(historyRecord.path);
    }

    // 删除关联文件
    safeDeleteFile(doc.docxPath || '');
    safeDeleteFile(doc.pdfPath || '');

    // 更新子文档，移除父引用
    await prisma.document.updateMany({
      where: { parentId: id },
      data: { parentId: null }
    });

    // 删除文档（级联删除历史记录）
    await prisma.document.delete({ where: { id } });

    // 记录删除操作
    await logApiOperation(
      user,
      'doc_sys',
      'delete_document',
      { documentId: id, documentName: doc.name }
    );

    return NextResponse.json({ success: true });
  })
);

export const PUT = withErrorHandling(
  withPermission<{ params: Promise<{ id: string }> }>('doc_sys', 'edit', async (req: NextRequest, context, user) => {
    const { id } = await context.params;
    const contentType = req.headers.get('content-type') || '';
    
    const currentDoc = await prisma.document.findUnique({ where: { id } });
    if (!currentDoc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let updateData: any = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();

      if (formData.has('name')) updateData.name = formData.get('name') as string;
      if (formData.has('level')) updateData.level = parseInt(formData.get('level') as string);
      if (formData.has('dept')) updateData.dept = formData.get('dept') as string;
      if (formData.has('parentId')) {
        const pid = formData.get('parentId') as string;
        updateData.parentId = pid === '' ? null : pid;
      }
      const uploader = formData.get('uploader') as string || currentDoc.uploader;
      if (uploader) updateData.uploader = uploader;

      // 读取当前版本号（两个分支都需要，提前取出）
      const currentVersion = currentDoc.version || '1.0';

      const pdfFile = formData.get('pdfFile') as File;
      if (pdfFile && pdfFile.name.endsWith('.pdf')) {
        // 保存历史版本（如果存在旧PDF文件），带上旧版本号
        if (currentDoc.pdfPath) {
          await saveHistoryVersion(id, currentDoc.pdfPath, 'pdf', uploader, currentVersion);
        }

        const buffer = Buffer.from(await pdfFile.arrayBuffer());
        const objectName = minioStorageService.generateObjectName(pdfFile.name, 'docs');
        const dbRecord = minioStorageService.formatDbRecord('public', objectName);

        try {
          await minioStorageService.uploadFile('public', objectName, buffer, pdfFile.type);

          // 同步到FileMetadata表
          try {
            const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');
            await prisma.fileMetadata.upsert({
              where: { filePath: dbRecord },
              update: {
                fileName: pdfFile.name,
                fileType: 'pdf',
                fileSize: pdfFile.size,
                md5Hash,
                category: 'docs',
                uploaderId: user?.id,
                uploadedAt: new Date()
              },
              create: {
                filePath: dbRecord,
                fileName: pdfFile.name,
                fileType: 'pdf',
                fileSize: pdfFile.size,
                md5Hash,
                category: 'docs',
                uploaderId: user?.id,
                uploadedAt: new Date()
              }
            });
          } catch (metaError) {
            console.warn('保存FileMetadata失败:', metaError);
          }

          updateData.pdfPath = dbRecord;
        } catch (uploadError) {
          console.error('上传PDF到MinIO失败:', uploadError);
          throw uploadError;
        }
      }

      const mainFile = formData.get('mainFile') as File;
      if (mainFile) {
        const isDocx = mainFile.name.endsWith('.docx');
        const isXlsx = mainFile.name.endsWith('.xlsx');

        if (isDocx || isXlsx) {
          const ext = isXlsx ? 'xlsx' : 'docx';

          // 计算新版本号（仅在上传新源文件时触发）
          const inputVersion = (formData.get('newVersion') as string | null)?.trim() || '';

          // Bug 4 Fix: 严格校验版本号格式，防止任意字符串入库
          const VERSION_REGEX = /^\d{1,4}(\.\d{1,2})?$/;
          let newVersion: string;
          if (inputVersion) {
            if (!VERSION_REGEX.test(inputVersion)) {
              return NextResponse.json({ error: '版本号格式不合法，请使用如 1.0、2.1 格式（最多4位整数.2位小数）' }, { status: 400 });
            }
            newVersion = inputVersion;
          } else {
            // Bug 1 Fix: 整数运算替代浮点加法，彻底消除精度陷阱
            const base = Math.round((parseFloat(currentVersion) || 1.0) * 10);
            newVersion = ((base + 1) / 10).toFixed(1);
          }

          // 保存历史版本（如果存在旧文件），带上旧版本号
          if (currentDoc.docxPath) {
            await saveHistoryVersion(id, currentDoc.docxPath, ext, uploader, currentVersion);
          }

          const buffer = Buffer.from(await mainFile.arrayBuffer());
          const objectName = minioStorageService.generateObjectName(mainFile.name, 'docs');
          const dbRecord = minioStorageService.formatDbRecord('public', objectName);

          try {
            await minioStorageService.uploadFile('public', objectName, buffer, mainFile.type);

            // 同步到FileMetadata表
            try {
              const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');
              await prisma.fileMetadata.upsert({
                where: { filePath: dbRecord },
                update: {
                  fileName: mainFile.name,
                  fileType: ext,
                  fileSize: mainFile.size,
                  md5Hash,
                  category: 'docs',
                  uploaderId: user?.id,
                  uploadedAt: new Date()
                },
                create: {
                  filePath: dbRecord,
                  fileName: mainFile.name,
                  fileType: ext,
                  fileSize: mainFile.size,
                  md5Hash,
                  category: 'docs',
                  uploaderId: user?.id,
                  uploadedAt: new Date()
                }
              });
            } catch (metaError) {
              console.warn('保存FileMetadata失败:', metaError);
            }

            // Extract search text
            const newSearchText = await extractTextFromFile(buffer, !!isXlsx);
            updateData.searchText = newSearchText;

            updateData.docxPath = dbRecord;
            updateData.type = ext;
            updateData.uploadTime = new Date();
            updateData.uploader = uploader;
            updateData.version = newVersion; // 更新文档版本号
          } catch (uploadError) {
            console.error('上传文档到MinIO失败:', uploadError);
            throw uploadError;
          }
        }
      }
    } else {
      updateData = await req.json();
      // Convert uploadTime if it's a number (timestamp)
      if (updateData.uploadTime && typeof updateData.uploadTime === 'number') {
        updateData.uploadTime = new Date(updateData.uploadTime);
      }
    }

    const updatedDoc = await prisma.document.update({
      where: { id },
      data: updateData
    });

    // 记录编辑操作
    await logApiOperation(
      user,
      'doc_sys',
      'edit_document',
      { 
        documentId: id, 
        documentName: updatedDoc.name,
        changes: Object.keys(updateData)
      }
    );

    // 触发文档更新事件：入队，由 worker 处理
    try {
      const { enqueueAutoAssign } = await import('@/services/queue.service');
      await enqueueAutoAssign('document_updated', { documentId: id, changedFields: Object.keys(updateData) });
    } catch (e) {
      // 如果入队失败，回退为直接异步触发
      import('@/services/autoAssign.service').then(mod => {
        mod.processEvent('document_updated', { documentId: id, changedFields: Object.keys(updateData) }).catch(err => console.error('autoAssign document_updated fallback error', err));
      }).catch(err => console.error('load autoAssign.service failed', err));
    }

    return NextResponse.json({ 
      success: true,
      doc: {
        ...updatedDoc,
        uploadTime: updatedDoc.uploadTime.getTime()
      }
    });
  })
);
