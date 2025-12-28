// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    
    // 使用 Prisma 查询
    const user = await prisma.user.findUnique({
      where: { username }
    });

    // 简单的明文密码比对（实际生产应使用 bcrypt 等）
    if (user && user.password === password) {
      // 登录成功，解析 permissions
      const safeUser = {
        ...user,
        permissions: user.permissions ? JSON.parse(user.permissions) : {}
      };

      return NextResponse.json({ success: true, user: safeUser });
    } else {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
