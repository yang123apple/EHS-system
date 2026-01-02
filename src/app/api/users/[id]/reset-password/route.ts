import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdmin } from '@/middleware/auth';

// POST: 重置用户密码为默认密码 (123)
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async (req, context, currentUser) => {
  const { params } = context;
  const { id } = await params;
  
  // 检查用户是否存在
  const existingUser = await db.getUserById(id);
  if (!existingUser) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  // 防止重置管理员密码
  if (existingUser.username === 'admin') {
    return NextResponse.json({ error: '无法重置超级管理员密码' }, { status: 403 });
  }

  try {
    // 将密码重置为默认密码 "123"
    const updatedUser = await db.updateUser(id, { 
      password: '123' 
    });

    if (!updatedUser) {
      return NextResponse.json({ error: '重置密码失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '密码已重置为默认密码: 123' 
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    return NextResponse.json({ error: '重置密码失败' }, { status: 500 });
  }
});
