// src/app/api/docs/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth'; // 用于提取 Word 文本
import * as XLSX from 'xlsx';  // 用于提取 Excel 文本

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const DB_FILE = path.join(process.cwd(), 'data', 'docs.json');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(DB_FILE))) fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const getDbData = () => {
  if (!fs.existsSync(DB_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } 
  catch (e) { return []; }
};
const saveDbData = (data: any) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

export async function GET() { return NextResponse.json(getDbData()); }

// 辅助函数：提取文件纯文本
async function extractTextFromFile(buffer: Buffer, isXlsx: boolean): Promise<string> {
    try {
        if (isXlsx) {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            let text = '';
            // 遍历所有 Sheet 提取文本
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                // 使用 sheet_to_txt 提取制表符分隔的文本
                text += XLSX.utils.sheet_to_txt(sheet) + ' ';
            });
            return text;
        } else {
            // DOCX
            const result = await mammoth.extractRawText({ buffer: buffer });
            return result.value; 
        }
    } catch (e) {
        console.error("Text extraction failed:", e);
        return ""; // 提取失败则存空字符串，不影响文件保存
    }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    const isDocx = file?.name.endsWith('.docx');
    const isXlsx = file?.name.endsWith('.xlsx');

    if (!file || (!isDocx && !isXlsx)) {
      return NextResponse.json({ error: '仅支持上传 DOCX 或 XLSX 格式' }, { status: 400 });
    }

    const level = parseInt(formData.get('level') as string);
    const parentId = formData.get('parentId') as string;
    const dept = formData.get('dept') as string;
    const uploader = formData.get('uploader') as string;
    const userInputPrefix = formData.get('prefix') as string; 

    if (isXlsx && level !== 4) return NextResponse.json({ error: 'Excel (XLSX) 文件仅允许作为 4级记录表上传' }, { status: 400 });

    const fileId = Date.now().toString(36);
    const ext = isXlsx ? 'xlsx' : 'docx';
    const safeFileName = `${ext.toUpperCase()}-${fileId}.${ext}`; 
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 1. 保存物理文件
    try {
        fs.writeFileSync(path.join(UPLOAD_DIR, safeFileName), buffer);
    } catch (ioError) {
        return NextResponse.json({ error: '服务器写入文件失败' }, { status: 500 });
    }

    // 2. === 新增：提取并存储搜索文本 ===
    const searchText = await extractTextFromFile(buffer, !!isXlsx);

    // 3. 编号逻辑
    const currentFiles = getDbData();
    let finalPrefix = '';
    let suffix = 1;

    if (level === 4) {
        if (!parentId) return NextResponse.json({ error: '4级文件必须选择上级' }, { status: 400 });
        const parentFile = currentFiles.find((f: any) => f.id === parentId);
        if (!parentFile) return NextResponse.json({ error: '上级文件不存在' }, { status: 404 });
        finalPrefix = parentFile.fullNum; 
        const siblings = currentFiles.filter((f: any) => f.parentId === parentId && f.level === 4);
        if (siblings.length > 0) {
            const maxSuffix = Math.max(...siblings.map((f: any) => Number(f.suffix) || 0));
            suffix = maxSuffix + 1;
        }
    } else {
        if (!userInputPrefix) return NextResponse.json({ error: '请输入前缀' }, { status: 400 });
        finalPrefix = userInputPrefix.toUpperCase();
        const samePrefixFiles = currentFiles.filter((f: any) => f.prefix === finalPrefix);
        if (samePrefixFiles.length > 0) {
            const maxSuffix = Math.max(...samePrefixFiles.map((f: any) => Number(f.suffix) || 0));
            suffix = maxSuffix + 1;
        }
    }
    
    const suffixStr = suffix.toString().padStart(3, '0');
    const fullNum = `${finalPrefix}-${suffixStr}`;

    const newDoc = {
      id: fileId,
      name: file.name.replace(`.${ext}`, ''),
      docxPath: `/uploads/${safeFileName}`, 
      pdfPath: null,
      prefix: finalPrefix,
      suffix: suffix,
      fullNum: fullNum,
      level: level,
      parentId: parentId || null,
      dept: dept,
      type: isXlsx ? 'xlsx' : 'docx', 
      uploadTime: Date.now(),
      uploader: uploader,
      searchText: searchText // === 新增字段 ===
    };

    currentFiles.push(newDoc);
    saveDbData(currentFiles);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("UPLOAD ERROR:", error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}