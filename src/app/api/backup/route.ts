// src/app/api/backup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DataProtectionService } from '@/services/dataProtection.service';

/**
 * GET /api/backup
 * 获取备份列表和状态
 */
export async function GET(request: NextRequest) {
  try {
    const service = DataProtectionService.getInstance();
    
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // 获取备份状态
    if (action === 'status') {
      const status = await service.getBackupStatus();
      return NextResponse.json({
        success: true,
        data: status,
      });
    }

    // 获取备份列表（默认）
    const backups = await service.getBackupsList();
    return NextResponse.json({
      success: true,
      data: backups,
    });
  } catch (error: any) {
    console.error('获取备份信息失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '获取备份信息失败' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backup
 * 执行手动备份
 */
export async function POST(request: NextRequest) {
  try {
    const service = DataProtectionService.getInstance();
    const result = await service.manualBackup();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        backupFile: result.backupFile,
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.message 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('执行备份失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '备份失败' 
      },
      { status: 500 }
    );
  }
}
