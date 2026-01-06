import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// 仅在开发环境下可用的迁移 API
export async function POST(request: NextRequest) {
  // 安全检查：仅在开发环境下允许
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      success: false,
      message: '生产环境不允许执行此操作',
    }, { status: 403 });
  }

  try {
    const { action } = await request.json();

    if (action === 'migrate') {
      // 执行数据库迁移
      const { stdout, stderr } = await execPromise('node node_modules/prisma/build/index.js migrate deploy', {
        cwd: process.cwd(),
      });

      return NextResponse.json({
        success: true,
        message: '迁移执行成功',
        output: stdout,
        error: stderr,
      });
    } else if (action === 'generate') {
      // 生成 Prisma 客户端
      const { stdout, stderr } = await execPromise('node node_modules/prisma/build/index.js generate', {
        cwd: process.cwd(),
      });

      return NextResponse.json({
        success: true,
        message: 'Prisma 客户端生成成功',
        output: stdout,
        error: stderr,
      });
    }

    return NextResponse.json({
      success: false,
      message: '未知操作',
    }, { status: 400 });
  } catch (error: any) {
    console.error('执行迁移失败:', error);
    return NextResponse.json({
      success: false,
      message: error.message,
      details: error.stderr || error.stdout,
    }, { status: 500 });
  }
}
