import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 文件服务API路由，用于提供uploads目录下的文件
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await context.params;
    
    // 构建文件路径
    const relativePath = pathSegments.join('/');
    const publicDir = path.join(process.cwd(), 'public');
    const filePath = path.join(publicDir, relativePath);

    // 安全检查：确保文件路径在public目录内
    if (!filePath.startsWith(publicDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error(`文件不存在: ${filePath}`);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 检查是否为文件（不是目录）
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 });
    }

    // 读取文件
    const fileBuffer = fs.readFileSync(filePath);
    
    // 根据文件扩展名设置Content-Type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // 返回文件
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('文件服务错误:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

