// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { logUserLogout, getClientIP } from '@/services/systemLogService';

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
    await logUserLogout(userId, userName, clientIP);

    return NextResponse.json({ 
      success: true, 
      message: '退出成功' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
