/**
 * 应用初始化API
 * 在服务器启动时被调用
 */

import { NextResponse } from 'next/server';
import { initializeApp } from '@/lib/startup';

let initPromise: Promise<void> | null = null;

export async function GET() {
  try {
    // 确保只初始化一次
    if (!initPromise) {
      initPromise = initializeApp();
    }
    
    await initPromise;
    
    return NextResponse.json({ 
      success: true, 
      message: '应用初始化完成' 
    });
  } catch (error: any) {
    console.error('初始化失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '应用初始化失败', 
        error: error.message 
      },
      { status: 500 }
    );
  }
}
