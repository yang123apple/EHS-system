/**
 * 数据保护管理API
 * 提供手动备份、状态查询等功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataProtectionService } from '@/services/dataProtection.service';

/**
 * GET - 获取数据保护状态
 */
export async function GET() {
  try {
    const service = DataProtectionService.getInstance();
    const status = await service.getBackupStatus();
    
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('获取数据保护状态失败:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - 手动触发备份
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action !== 'backup') {
      return NextResponse.json(
        { success: false, message: '无效的操作' },
        { status: 400 }
      );
    }

    const service = DataProtectionService.getInstance();
    const result = await service.manualBackup();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: '手动备份成功',
      });
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('手动备份失败:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
