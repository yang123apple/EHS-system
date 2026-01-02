// src/app/api/docs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission, logApiOperation, withErrorHandling } from '@/middleware/auth';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'docs');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const safeDeleteFile = (urlPath: string) => {
  if (!urlPath) return;
  try {
    const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
    const p = path.join(PUBLIC_DIR, relativePath);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch(e) { 
    console.error("File delete error:", e); 
  }
};

// 辅助函数：保存历史版本文件
async function saveHistoryVersion(
  documentId: string,
  filePath: string,
  fileType: 'docx' | 'xlsx' | 'pdf',
  uploader: string | null | undefined
): Promise<void> {
  if (!filePath) return;
  
  try {
    const relativePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const sourcePath = path.join(PUBLIC_DIR, relativePath);
    
    // 检查源文件是否存在
    if (!fs.existsSync(sourcePath)) {
      console.warn(`源文件不存在，跳过历史版本保存: ${sourcePath}`);
      return;
    }
    
    // 从原文件路径中提取文件名（保留原文件名）
    const originalFileName = path.basename(sourcePath);
    
    // 生成历史版本文件名（使用时间戳确保唯一性，即使原文件名相同）
    const timestamp = Date.now();
    const historyFileName = `HIST-${timestamp}-${originalFileName}`;
    const historyPath = path.join(UPLOAD_DIR, historyFileName);
    
    // 复制文件到历史目录（不删除原文件）
    fs.copyFileSync(sourcePath, historyPath);
    
    // 创建历史记录（使用原文件名）
    await prisma.documentHistory.create({
      data: {
        documentId,
        type: fileType,
        name: originalFileName,
        path: `/uploads/docs/${historyFileName}`,
        uploader: uploader || null,
        uploadTime: new Date()
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
      uploader: h.uploader || ''
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

      const pdfFile = formData.get('pdfFile') as File;
      if (pdfFile && pdfFile.name.endsWith('.pdf')) {
        // 保存历史版本（如果存在旧PDF文件）
        if (currentDoc.pdfPath) {
          await saveHistoryVersion(
            id,
            currentDoc.pdfPath,
            'pdf',
            uploader
          );
        }
        
        const buffer = Buffer.from(await pdfFile.arrayBuffer());
        const uniqueName = `PDF-${Date.now()}-${pdfFile.name}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, uniqueName), buffer);
        updateData.pdfPath = `/uploads/docs/${uniqueName}`;
      }

      const mainFile = formData.get('mainFile') as File;
      if (mainFile) {
        const isDocx = mainFile.name.endsWith('.docx');
        const isXlsx = mainFile.name.endsWith('.xlsx');
        
        if (isDocx || isXlsx) {
          const ext = isXlsx ? 'xlsx' : 'docx';
          
          // 保存历史版本（如果存在旧文件）
          if (currentDoc.docxPath) {
            await saveHistoryVersion(
              id,
              currentDoc.docxPath,
              ext,
              uploader
            );
          }

          const buffer = Buffer.from(await mainFile.arrayBuffer());
          const uniqueName = `${ext.toUpperCase()}-${Date.now()}-${mainFile.name}`;
          fs.writeFileSync(path.join(UPLOAD_DIR, uniqueName), buffer);
          
          // Extract search text
          const newSearchText = await extractTextFromFile(buffer, !!isXlsx);
          updateData.searchText = newSearchText;

          updateData.docxPath = `/uploads/docs/${uniqueName}`;
          updateData.type = ext;
          updateData.uploadTime = new Date();
          updateData.uploader = uploader;
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

    return NextResponse.json({ 
      success: true,
      doc: {
        ...updatedDoc,
        uploadTime: updatedDoc.uploadTime.getTime()
      }
    });
  })
);
