/**
 * 备份文件下载 API
 * 
 * GET /api/data-protection/download?filename=full_backup_xxx.zip
 * 
 * 安全措施：
 * - 验证文件名格式（防止路径遍历攻击）
 * - 仅允许下载 data/backups/ 目录中的 .zip 文件
 * - 检查文件是否存在
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET - 下载备份文件
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    // 1. 验证文件名参数
    if (!filename) {
      return NextResponse.json(
        { success: false, error: '缺少文件名参数' },
        { status: 400 }
      );
    }

    // 2. 安全检查：防止路径遍历攻击
    // 只允许文件名，不允许包含路径分隔符
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      console.warn(`⚠️  检测到可疑的文件名: ${filename}`);
      return NextResponse.json(
        { success: false, error: '无效的文件名' },
        { status: 400 }
      );
    }

    // 3. 验证文件名格式（必须是 .zip 文件）
    if (!filename.endsWith('.zip')) {
      return NextResponse.json(
        { success: false, error: '只能下载 ZIP 备份文件' },
        { status: 400 }
      );
    }

    // 4. 验证文件名格式（必须以 full_backup_ 开头）
    if (!filename.startsWith('full_backup_')) {
      return NextResponse.json(
        { success: false, error: '无效的备份文件名格式' },
        { status: 400 }
      );
    }

    // 5. 构建安全的文件路径
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    const filePath = path.join(backupDir, filename);

    // 6. 二次验证：确保解析后的路径仍在备份目录内（防止符号链接攻击）
    const realBackupDir = fs.realpathSync(backupDir);
    const realFilePath = fs.existsSync(filePath) ? fs.realpathSync(filePath) : filePath;
    
    if (!realFilePath.startsWith(realBackupDir)) {
      console.warn(`⚠️  检测到路径遍历尝试: ${filename}`);
      return NextResponse.json(
        { success: false, error: '无效的文件路径' },
        { status: 403 }
      );
    }

    // 7. 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: '备份文件不存在' },
        { status: 404 }
      );
    }

    // 8. 获取文件信息
    const stat = fs.statSync(filePath);
    
    // 检查是否是文件（不是目录）
    if (!stat.isFile()) {
      return NextResponse.json(
        { success: false, error: '无效的文件' },
        { status: 400 }
      );
    }

    // 检查文件大小
    if (stat.size === 0) {
      return NextResponse.json(
        { success: false, error: '备份文件为空' },
        { status: 400 }
      );
    }

    console.log(`📦 开始下载备份: ${filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

    // 9. 读取文件并创建响应
    const fileBuffer = fs.readFileSync(filePath);

    // 10. 设置响应头
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Length', stat.size.toString());
    headers.set('Cache-Control', 'no-cache');
    
    // 添加一些额外的安全和元数据头
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Download-Options', 'noopen');
    headers.set('X-File-Size', stat.size.toString());
    headers.set('X-File-Modified', stat.mtime.toISOString());

    // 11. 返回文件流
    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });

  } catch (error: any) {
    console.error('❌ 下载备份文件失败:', error);
    
    // 区分不同类型的错误
    if (error.code === 'ENOENT') {
      return NextResponse.json(
        { success: false, error: '文件不存在' },
        { status: 404 }
      );
    } else if (error.code === 'EACCES') {
      return NextResponse.json(
        { success: false, error: '无权访问文件' },
        { status: 403 }
      );
    } else {
      return NextResponse.json(
        { success: false, error: error.message || '下载失败' },
        { status: 500 }
      );
    }
  }
}
