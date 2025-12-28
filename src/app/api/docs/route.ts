// src/app/api/docs/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth'; // 用于提取 Word 文本
import * as XLSX from 'xlsx';  // 用于提取 Excel 文本
import { prisma } from '@/lib/prisma';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export async function GET() {
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' }
  });
  // 转换 uploadTime (bigint/datetime 差异)
  // 我们的 schema 中 uploadTime 是 DateTime，但原 JSON 中是 timestamp number
  // 前端可能期望 number，这里我们做个转换或者前端兼容
  const safeDocs = docs.map(d => ({
    ...d,
    uploadTime: d.uploadTime.getTime() // 转换为毫秒时间戳兼容前端
  }));
  return NextResponse.json(safeDocs);
}

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

    const ext = isXlsx ? 'xlsx' : 'docx';
    // 文件保存到磁盘
    const fileId = Date.now().toString(36);
    const safeFileName = `${ext.toUpperCase()}-${fileId}.${ext}`; 
    const buffer = Buffer.from(await file.arrayBuffer());
    
    try {
        fs.writeFileSync(path.join(UPLOAD_DIR, safeFileName), buffer);
    } catch (ioError) {
        return NextResponse.json({ error: '服务器写入文件失败' }, { status: 500 });
    }

    // 2. 提取文本
    const searchText = await extractTextFromFile(buffer, !!isXlsx);

    // 3. 编号逻辑
    let finalPrefix = '';
    let suffix = 1;

    if (level === 4) {
        if (!parentId) return NextResponse.json({ error: '4级文件必须选择上级' }, { status: 400 });
        const parentFile = await prisma.document.findUnique({ where: { id: parentId } });
        if (!parentFile) return NextResponse.json({ error: '上级文件不存在' }, { status: 404 });

        finalPrefix = parentFile.fullNum || '';

        // 查找最大的 suffix
        const maxSibling = await prisma.document.findFirst({
          where: { parentId, level: 4 },
          orderBy: { suffix: 'desc' }
        });
        if (maxSibling && maxSibling.suffix) {
          suffix = maxSibling.suffix + 1;
        }
    } else {
        if (!userInputPrefix) return NextResponse.json({ error: '请输入前缀' }, { status: 400 });
        finalPrefix = userInputPrefix.toUpperCase();

        const maxSamePrefix = await prisma.document.findFirst({
          where: { prefix: finalPrefix },
          orderBy: { suffix: 'desc' }
        });

        if (maxSamePrefix && maxSamePrefix.suffix) {
          suffix = maxSamePrefix.suffix + 1;
        }
    }
    
    const suffixStr = suffix.toString().padStart(3, '0');
    const fullNum = `${finalPrefix}-${suffixStr}`;

    const newDoc = await prisma.document.create({
      data: {
        name: file.name.replace(`.${ext}`, ''),
        type: ext,
        docxPath: `/uploads/${safeFileName}`,
        level,
        parentId: parentId || null,
        dept,
        uploader,
        uploadTime: new Date(), // Prisma DateTime
        searchText,
        prefix: finalPrefix,
        suffix,
        fullNum
      }
    });

    return NextResponse.json({ success: true, doc: newDoc });

  } catch (error: any) {
    console.error("UPLOAD ERROR:", error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
