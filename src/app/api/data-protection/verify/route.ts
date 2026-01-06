/**
 * 备份文件验证 API
 * 
 * POST /api/data-protection/verify
 * 
 * 验证指定备份文件的有效性
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataProtectionService } from '@/services/dataProtection.service';

/**
 * POST - 验证备份文件
 * 
 * 请求体：
 * {
 *   "filename": "full_backup_2026-01-02_12-21-42.zip"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    // 验证参数
    if (!filename) {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少文件名参数' 
        },
        { status: 400 }
      );
    }

    // 基本安全检查
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { 
          success: false, 
          error: '无效的文件名' 
        },
        { status: 400 }
      );
    }

    // 调用服务验证
    const service = DataProtectionService.getInstance();
    const verification = await service.verifyBackup(filename);
    
    return NextResponse.json({
      success: true,
      data: verification,
    });
  } catch (error: any) {
    console.error('验证备份文件失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '验证失败' 
      },
      { status: 500 }
    );
  }
}
