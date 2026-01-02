// src/app/api/backup/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DataProtectionService } from '@/services/dataProtection.service';

/**
 * POST /api/backup/verify
 * 验证指定的备份文件
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少文件名参数' 
        },
        { status: 400 }
      );
    }

    const service = DataProtectionService.getInstance();
    const verification = await service.verifyBackup(filename);
    
    return NextResponse.json({
      success: true,
      data: verification,
    });
  } catch (error: any) {
    console.error('验证备份失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '验证失败' 
      },
      { status: 500 }
    );
  }
}
