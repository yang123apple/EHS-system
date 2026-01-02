// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PeopleFinder } from '@/lib/peopleFinder';
import { logUserLogin, getClientIP } from '@/services/systemLogService';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    
    // 使用 Prisma 查询，包含 department 关联
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        department: true  // 包含部门信息
      }
    });

    // 简单的明文密码比对（实际生产应使用 bcrypt 等）
    if (user && user.password === password) {
      // 递归查找 directManagerId（如果用户没有设置，则通过部门层级查找）
      // 如果用户已设置 directManagerId，优先使用；否则通过递归查找部门层级来确定
      let directManagerId = user.directManagerId;
      if (!directManagerId) {
        directManagerId = await PeopleFinder.findDirectManagerId(user.id);
      }
      
      // 登录成功，解析 permissions，并添加部门名称字段和 directManagerId
      const safeUser = {
        ...user,
        permissions: user.permissions ? JSON.parse(user.permissions) : {},
        department: user.department?.name || null,  // 添加部门名称字段
        directManagerId: directManagerId || null  // 设置 directManagerId（递归查找的结果）
      };

      // 记录登录日志
      const clientIP = getClientIP(req);
      await logUserLogin(user.id, user.name, clientIP);

      return NextResponse.json({ success: true, user: safeUser });
    } else {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
