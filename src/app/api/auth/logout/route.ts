// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { getClientIP } from '@/utils/requestAdapter';
import AuditService from '@/services/audit.service';
import { LogModule, LogAction } from '@/types/audit';

export async function POST(req: Request) {
  try {
    const { userId, userName } = await req.json();
    
    if (!userId || !userName) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 记录退出日志
    const clientIP = getClientIP(req);
    await AuditService.recordLog({
      module: LogModule.AUTH,
      action: LogAction.LOGOUT,
      businessId: userId,
      targetType: 'user',
      targetLabel: userName,
      operator: {
        id: userId,
        name: userName,
        role: 'user', // 登出时角色信息可能已不可用，使用默认值
      },
      description: `用户 ${userName} 退出系统`,
      request: req,
      clientInfo: {
        ip: clientIP,
      },
    });

    // 清除认证 cookie
    const response = NextResponse.json({ 
      success: true, 
      message: '退出成功' 
    });
    
    // 清除 ehs_user_id cookie
    response.cookies.set('ehs_user_id', '', {
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
