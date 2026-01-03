# 培训模块根路径重定向实现说明

## 概述

`/training` 根路径实现了基于角色的自动重定向功能：
- **Admin/Manager** → `/training/tasks` (管理页面)
- **Regular Employee** → `/training/my-tasks` (个人任务页面)
- **未登录用户** → `/login`

## 实现方式

使用 Next.js App Router 的 Server Component，在服务端进行角色检查和重定向。

## 重要提示：Cookie 认证设置

由于项目目前使用 `localStorage` 进行客户端认证，而 Server Component 无法访问 `localStorage`，因此需要修改登录流程来设置 cookie。

### 方案 1：修改登录 API 设置 Cookie（推荐）

在 `src/app/api/auth/login/route.ts` 中，登录成功时设置 cookie：

```typescript
// 在登录成功的响应中设置 cookie
const response = NextResponse.json({ success: true, user: safeUser });

// 设置包含用户ID的 cookie
response.cookies.set('ehs_user_id', user.id, {
  httpOnly: true,  // 防止 XSS 攻击
  secure: process.env.NODE_ENV === 'production',  // 生产环境使用 HTTPS
  sameSite: 'lax',  // CSRF 保护
  maxAge: 60 * 60 * 24 * 7,  // 7 天过期
  path: '/',
});

return response;
```

### 方案 2：使用客户端组件（备选）

如果不想修改登录流程，可以使用客户端组件来处理重定向：

```typescript
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function TrainingPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role === 'admin' || user.role === 'manager') {
      router.push('/training/tasks');
    } else {
      router.push('/training/my-tasks');
    }
  }, [user, router]);

  return null; // 或者显示加载中状态
}
```

## 当前实现

当前实现（`src/app/training/page.tsx`）会：
1. 尝试从 `ehs_user_id` cookie 读取用户ID
2. 如果没有，尝试从 `ehs_user` cookie 解析 JSON 获取用户ID
3. 如果都没有，重定向到登录页
4. 从数据库查询用户信息
5. 根据用户角色重定向到相应页面

## 边缘情况处理

1. **用户未登录**：重定向到 `/login`
2. **用户不存在**：重定向到 `/login`
3. **角色未定义**：默认重定向到 `/training/my-tasks`（安全默认值）
4. **未知角色**：默认重定向到 `/training/my-tasks`

## 测试建议

1. 测试 Admin 用户访问 `/training` → 应重定向到 `/training/tasks`
2. 测试 Manager 用户访问 `/training` → 应重定向到 `/training/tasks`
3. 测试普通员工访问 `/training` → 应重定向到 `/training/my-tasks`
4. 测试未登录用户访问 `/training` → 应重定向到 `/login`

