import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 检查文件是否存在的API端点
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
    }

    // 构建完整文件路径
    const publicDir = path.join(process.cwd(), 'public');
    // 移除开头的斜杠
    const relativePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const fullPath = path.join(publicDir, relativePath);

    // 安全检查：确保文件路径在public目录内
    if (!fullPath.startsWith(publicDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // 检查文件是否存在
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
      const stats = fs.statSync(fullPath);
      return NextResponse.json({
        exists: true,
        isFile: stats.isFile(),
        size: stats.size,
      });
    } else {
      return NextResponse.json({
        exists: false,
      });
    }
  } catch (error: any) {
    console.error('文件检查错误:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

