// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PeopleFinder } from '@/lib/peopleFinder';
import { getClientIP } from '@/services/systemLogService';
import AuditService from '@/services/audit.service';
import { LogModule } from '@/types/audit';
import bcrypt from 'bcryptjs';

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

    // 使用 bcrypt 验证密码哈希
    const isPasswordValid = user && user.password && await bcrypt.compare(password, user.password);
    
    // 🟢 检查用户是否在职（离职用户无法登录）
    if (user && user.isActive === false) {
      return NextResponse.json({ error: '该账号已离职，无法登录系统' }, { status: 403 });
    }
    
    if (isPasswordValid) {
        // 检测是否为首次登录：查询历史登录日志数量
        try {
          const priorLogins = await prisma.systemLog.count({ where: { userId: user.id, action: 'LOGIN' } });
          const isFirstLogin = priorLogins === 0;

          if (isFirstLogin) {
            // 将事件放入队列，由 worker 负责处理（提高可靠性且可重试）
            try {
              const { enqueueAutoAssign } = await import('@/services/queue.service');
              await enqueueAutoAssign('user_first_login', { userId: user.id });
            } catch (e) {
              // 回退：如果队列失败，仍尝试直接触发（非阻塞）
              import('@/services/autoAssign.service').then(mod => {
                mod.processEvent('user_first_login', { userId: user.id }).catch(err => console.error('autoAssign first login fallback error', err));
              }).catch(err => console.error('load autoAssign.service fallback failed', err));
            }
          }
        } catch (e) {
          console.error('首次登录检测失败', e);
        }
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
      try {
        const clientIP = getClientIP(req);
        await AuditService.logLogin({
          module: LogModule.AUTH,
          businessId: user.id,
          targetType: 'user',
          targetLabel: user.name,
          operator: {
            id: user.id,
            name: user.name,
            role: user.role,
            departmentId: user.departmentId || undefined,
            departmentName: user.department?.name || undefined,
            jobTitle: user.jobTitle || undefined,
          },
          request: req,
          clientInfo: { ip: clientIP },
        });
      } catch (logError) {
        console.error('记录登录日志失败:', logError);
        // 日志记录失败不影响登录流程
      }

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
