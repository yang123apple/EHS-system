// src/app/api/docs/[id]/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { withAuth, withPermission, logApiOperation } from '@/middleware/auth';

const DB_FILE = path.join(process.cwd(), 'data', 'docs.json');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'docs');

const getDbData = () => {
  if (!fs.existsSync(DB_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } 
  catch (e) { return []; }
};
const saveDbData = (data: any) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const safeDeleteFile = (urlPath: string) => {
    if (!urlPath) return;
    try {
        const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
        const p = path.join(PUBLIC_DIR, relativePath);
        if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch(e) { console.error("File delete error:", e); }
};

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
    } catch (e) { return ""; }
}

export const GET = withAuth<{ params: Promise<{ id: string }> }>(async (req: Request, context, user) => {
  const { id } = await context.params;
  const files = getDbData();
  const file = files.find((f: any) => f.id === id);
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(file);
});

export const DELETE = withPermission<{ params: Promise<{ id: string }> }>('doc_sys', 'delete', async (req: Request, context, user) => {
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const historyId = searchParams.get('historyId');

  let files = getDbData();
  const index = files.findIndex((f: any) => f.id === id);
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  const target = files[index];

  if (historyId) {
    if (!target.history) return NextResponse.json({ error: 'History not found' }, { status: 404 });
    const histIndex = target.history.findIndex((h: any) => h.id === historyId);
    if (histIndex === -1) return NextResponse.json({ error: 'History item not found' }, { status: 404 });
    safeDeleteFile(target.history[histIndex].path);
    target.history.splice(histIndex, 1);
    files[index] = target;
    saveDbData(files);
    return NextResponse.json({ success: true, message: '历史版本已删除' });
  }

  safeDeleteFile(target.docxPath);
  safeDeleteFile(target.pdfPath);
  if (target.history) target.history.forEach((h: any) => safeDeleteFile(h.path));
  files = files.map((f: any) => f.parentId === id ? { ...f, parentId: null } : f);
  files = files.filter((f: any) => f.id !== id);
  saveDbData(files);

  // 记录删除操作
  await logApiOperation(
    user,
    'doc_sys',
    'delete_document',
    { documentId: id, documentName: target.name }
  );

  return NextResponse.json({ success: true });
});

export const PUT = withPermission<{ params: Promise<{ id: string }> }>('doc_sys', 'edit', async (req: Request, context, user) => {
  const { id } = await context.params;
  const contentType = req.headers.get('content-type') || '';
  
  let files = getDbData();
  const index = files.findIndex((f: any) => f.id === id);
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let updateData: any = {};
  const currentDoc = files[index];
  
  if (!currentDoc.history) currentDoc.history = [];

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    
    if(formData.has('name')) updateData.name = formData.get('name');
    if(formData.has('level')) updateData.level = parseInt(formData.get('level') as string);
    if(formData.has('dept')) updateData.dept = formData.get('dept');
    if(formData.has('parentId')) {
       const pid = formData.get('parentId') as string;
       updateData.parentId = pid === '' ? null : pid;
    }
    const uploader = formData.get('uploader') as string || currentDoc.uploader;

    const pdfFile = formData.get('pdfFile') as File;
    if (pdfFile && pdfFile.name.endsWith('.pdf')) {
      if (currentDoc.pdfPath) {
          currentDoc.history.push({
              id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
              type: 'pdf',
              name: `(副本) ${currentDoc.name}.pdf`, 
              path: currentDoc.pdfPath,
              uploadTime: currentDoc.uploadTime || Date.now(),
              uploader: currentDoc.uploader
          });
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
            currentDoc.history.push({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                type: currentDoc.type || 'docx',
                name: `(源文件) ${currentDoc.name}.${currentDoc.type === 'xlsx' ? 'xlsx' : 'docx'}`,
                path: currentDoc.docxPath,
                uploadTime: currentDoc.uploadTime,
                uploader: currentDoc.uploader
            });

            const ext = isXlsx ? 'xlsx' : 'docx';
            const buffer = Buffer.from(await mainFile.arrayBuffer());
            const uniqueName = `${ext.toUpperCase()}-${Date.now()}-${mainFile.name}`;
            fs.writeFileSync(path.join(UPLOAD_DIR, uniqueName), buffer);
            
            // === 新增：更新搜索文本 ===
            const newSearchText = await extractTextFromFile(buffer, !!isXlsx);
            updateData.searchText = newSearchText;

            updateData.docxPath = `/uploads/docs/${uniqueName}`;
            updateData.type = ext;
            updateData.uploadTime = Date.now(); 
            updateData.uploader = uploader;     
        }
    }

  } else {
    updateData = await req.json();
  }

  files[index] = { ...files[index], ...updateData, history: currentDoc.history };
  saveDbData(files);

  // 记录编辑操作
  await logApiOperation(
    user,
    'doc_sys',
    'edit_document',
    { 
      documentId: id, 
      documentName: files[index].name,
      changes: Object.keys(updateData)
    }
  );

  return NextResponse.json({ success: true });
});
