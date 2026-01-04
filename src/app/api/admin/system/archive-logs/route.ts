import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import LogArchiveService from '@/services/logArchive.service';

/**
 * POST /api/admin/system/archive-logs
 * 
 * 归档旧日志到本地文件系统
 * 
 * 权限要求：管理员权限（role === 'admin'）
 * 
 * 请求体：
 * {
 *   retentionMonths?: number,  // 保留月数，默认6个月
 *   batchSize?: number         // 批处理大小，默认1000
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ========== 权限检查 ==========
    // 要求用户已登录
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 检查是否为管理员（伪代码示例：实际应根据你的权限系统调整）
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: '权限不足',
          message: '只有管理员可以执行日志归档操作',
        },
        { status: 403 }
      );
    }

    // ========== 解析请求参数 ==========
    const body = await request.json().catch(() => ({}));
    const retentionMonths = body.retentionMonths ?? 6;
    const batchSize = body.batchSize ?? 1000;

    // 参数验证
    if (typeof retentionMonths !== 'number' || retentionMonths < 1) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误',
          message: 'retentionMonths 必须是一个大于等于1的数字',
        },
        { status: 400 }
      );
    }

    if (typeof batchSize !== 'number' || batchSize < 1 || batchSize > 10000) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误',
          message: 'batchSize 必须是一个1-10000之间的数字',
        },
        { status: 400 }
      );
    }

    // ========== 执行归档 ==========
    console.log(`📦 [Archive API] 管理员 ${user.name} (${user.id}) 开始执行日志归档...`);
    
    const result = await LogArchiveService.archiveOldLogs(retentionMonths, batchSize);

    // ========== 返回结果 ==========
    return NextResponse.json({
      success: true,
      message: '日志归档完成',
      data: {
        archivedCount: result.count,
        filePath: result.filePath,
        startDate: result.startDate.toISOString(),
        endDate: result.endDate.toISOString(),
        retentionMonths,
      },
    });
  } catch (error) {
    console.error('❌ [Archive API] 日志归档失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '归档失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/system/archive-logs
 * 
 * 功能1：获取归档文件列表（不带参数）
 * 功能2：读取归档文件内容（带 ?file=filename.json 参数）
 * 
 * 权限要求：管理员权限
 */
export async function GET(request: NextRequest) {
  try {
    // ========== 权限检查 ==========
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 检查是否为管理员
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: '权限不足',
          message: '只有管理员可以查看归档文件',
        },
        { status: 403 }
      );
    }

    // ========== 检查是否有 file 查询参数 ==========
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    // 功能2：读取文件内容
    if (fileName) {
      // 验证文件名安全性（防止目录遍历攻击）
      // 只允许包含字母、数字、下划线、点、连字符
      if (!/^[a-zA-Z0-9_.-]+\.json$/.test(fileName)) {
        return NextResponse.json(
          {
            success: false,
            error: '文件名格式错误',
            message: '文件名只能包含字母、数字、下划线、点和连字符，且必须以 .json 结尾',
          },
          { status: 400 }
        );
      }

      // 确保文件名以 audit_archive_ 开头（额外的安全检查）
      if (!fileName.startsWith('audit_archive_')) {
        return NextResponse.json(
          {
            success: false,
            error: '文件名格式错误',
            message: '归档文件名必须以 audit_archive_ 开头',
          },
          { status: 400 }
        );
      }

      try {
        // 读取文件内容
        const archiveData = await LogArchiveService.readArchiveFile(fileName);
        
        return NextResponse.json({
          success: true,
          data: archiveData,
        });
      } catch (error) {
        console.error(`❌ [Archive API] 读取归档文件失败: ${fileName}`, error);
        
        return NextResponse.json(
          {
            success: false,
            error: '读取文件失败',
            message: error instanceof Error ? error.message : '未知错误',
          },
          { status: 500 }
        );
      }
    }

    // 功能1：获取归档文件列表
    const files = await LogArchiveService.getArchiveFiles();

    return NextResponse.json({
      success: true,
      data: {
        files: files.map(file => ({
          fileName: file.name,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
          createdAt: file.createdAt.toISOString(),
        })),
        totalCount: files.length,
      },
    });
  } catch (error) {
    console.error('❌ [Archive API] 获取归档文件列表失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

