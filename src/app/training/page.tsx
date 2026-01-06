import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

/**
 * 培训模块根路径 - 基于角色的重定向
 * 
 * 重定向规则：
 * - Admin/Manager -> /training/tasks (管理页面)
 * - Regular Employee -> /training/my-tasks (个人任务页面)
 * - 未登录 -> /login
 * 
 * 注意：此实现需要项目支持 cookies 认证。
 * 如果项目目前使用 localStorage，需要修改登录流程来设置 cookie。
 * 建议在登录 API 中设置一个包含用户ID的 cookie（如 'ehs_user_id'）。
 */
export default async function TrainingPage() {
  const cookieStore = await cookies();
  
  // 尝试从 cookies 中获取用户ID
  // 优先检查 'ehs_user_id' cookie（推荐）
  let userId = cookieStore.get('ehs_user_id')?.value;
  
  // 调试信息：检查所有 cookies
  if (process.env.NODE_ENV === 'development') {
    const allCookies = cookieStore.getAll();
    console.log('[Training Page] 所有 cookies:', allCookies.map(c => ({ name: c.name, value: c.value?.substring(0, 20) + '...' })));
    console.log('[Training Page] ehs_user_id:', userId);
  }
  
  // 如果没有找到，尝试从 'ehs_user' cookie 中解析（如果存储的是 JSON）
  if (!userId) {
    const userCookie = cookieStore.get('ehs_user')?.value;
    if (userCookie) {
      try {
        const parsed = JSON.parse(userCookie);
        userId = parsed.id;
        if (process.env.NODE_ENV === 'development') {
          console.log('[Training Page] 从 ehs_user cookie 解析出 userId:', userId);
        }
      } catch (e) {
        // 解析失败，继续检查其他方式
        console.warn('[Training Page] 无法解析 ehs_user cookie:', e);
      }
    }
  }
  
  // 如果仍然没有用户ID，重定向到登录页
  if (!userId) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Training Page] 未找到用户ID，重定向到登录页');
    }
    redirect('/login');
  }

  // 从数据库获取用户信息
  const user = await getUserById(userId);
  
  // 如果用户不存在，重定向到登录页
  if (!user) {
    redirect('/login');
  }

  // 根据用户角色重定向
  return redirectBasedOnRole(user.role);
}

/**
 * 从数据库获取用户信息
 */
async function getUserById(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
      },
    });
    return user;
  } catch (error) {
    console.error('[Training Page] 获取用户信息失败:', error);
    return null;
  }
}

/**
 * 根据用户角色重定向到相应页面
 */
function redirectBasedOnRole(role: string | null | undefined) {
  // Admin 或 Manager 重定向到管理页面
  if (role === 'admin' || role === 'manager') {
    redirect('/training/tasks');
  }
  
  // 普通员工重定向到个人任务页面
  if (role === 'user') {
    redirect('/training/my-tasks');
  }
  
  // 如果角色未定义或未知，默认重定向到个人任务页面
  // 这是一个安全的默认选择，因为个人任务页面通常对所有用户可见
  redirect('/training/my-tasks');
}

