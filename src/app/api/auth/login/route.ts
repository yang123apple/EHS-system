// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PeopleFinder } from '@/lib/peopleFinder';
import { logUserLogin, getClientIP } from '@/services/systemLogService';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    
    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }
    
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
        try {
          directManagerId = await PeopleFinder.findDirectManagerId(user.id);
        } catch (error) {
          console.error('查找主管ID失败:', error);
          // 查找主管失败不影响登录，继续使用 null
        }
      }
      
      // 登录成功，解析 permissions，并添加部门名称字段和 directManagerId
      let permissions = {};
      try {
        permissions = user.permissions ? JSON.parse(user.permissions) : {};
      } catch (error) {
        console.error('解析 permissions 失败:', error);
        // permissions 解析失败使用空对象
      }
      
      const safeUser = {
        ...user,
        permissions,
        department: user.department?.name || null,  // 添加部门名称字段
        directManagerId: directManagerId || null  // 设置 directManagerId（递归查找的结果）
      };

      // 记录登录日志（不阻塞登录流程）
      // 暂时注释掉，以排查问题
      // try {
      //   const clientIP = getClientIP(req);
      //   await logUserLogin(user.id, user.name, clientIP);
      // } catch (logError) {
      //   console.error('记录登录日志失败:', logError);
      //   // 日志记录失败不影响登录流程
      // }

      // 创建响应并设置 cookie，用于 Server Component 认证
      const response = NextResponse.json({ success: true, user: safeUser });
      
      // 设置包含用户ID的 cookie，用于 Server Component 访问
      response.cookies.set('ehs_user_id', user.id, {
        httpOnly: false,  // 设置为 false，以便客户端也能读取（如果需要）
        secure: process.env.NODE_ENV === 'production',  // 生产环境使用 HTTPS
        sameSite: 'lax',  // CSRF 保护
        maxAge: 60 * 60 * 24 * 7,  // 7 天过期
        path: '/',
      });

      return response;
    } else {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
  } catch (e) {
    console.error("Login error:", e);
    const errorMessage = e instanceof Error ? e.message : '服务器内部错误';
    const errorStack = e instanceof Error ? e.stack : undefined;
    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
      error: e
    });
    
    // 在开发环境下返回详细的错误信息
    return NextResponse.json({ 
      error: 'Server error',
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: errorStack,
        details: String(e)
      })
    }, { status: 500 });
  }
}
