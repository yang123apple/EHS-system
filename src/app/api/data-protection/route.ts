/**
 * 数据保护管理API
 * 提供备份列表查询、手动备份等功能
 * 
 * v2.0 更新：
 * - GET: 返回 ZIP 备份文件列表
 * - POST: 触发全量备份
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataProtectionService } from '@/services/dataProtection.service';

/**
 * GET - 获取备份文件列表
 * 
 * 查询参数：
 * - action=status: 获取备份状态和统计信息
 * - 默认: 返回所有备份文件列表
 */
export async function GET(request: NextRequest) {
  try {
    const service = DataProtectionService.getInstance();
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // 如果请求状态信息
    if (action === 'status') {
      const status = await service.getBackupStatus();
      return NextResponse.json({
        success: true,
        data: status,
      });
    }

    // 默认返回备份文件列表
    const backups = await service.getBackupsList();
    return NextResponse.json({
      success: true,
      data: backups,
      count: backups.length,
    });
  } catch (error: any) {
    console.error('获取备份信息失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取备份信息失败' },
      { status: 500 }
    );
  }
}

/**
 * POST - 手动触发全量备份
 * 
 * 请求体（可选）：
 * {
 *   "action": "backup"  // 兼容旧版本
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const service = DataProtectionService.getInstance();
    
    console.log('🔄 收到手动备份请求...');
    
    const result = await service.manualBackup();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        backupFile: result.backupFile,
        timestamp: new Date().toISOString(),
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
    console.error('❌ 手动备份失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '备份失败' 
      },
      { status: 500 }
    );
  }
}
