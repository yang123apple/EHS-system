"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// import { User, db } from '@/lib/mockDb'; // 删除这行引用
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';

const LOGIN_TIME_KEY = 'ehs_login_time';
const AUTO_LOGOUT_MSG_KEY = 'ehs_auto_logout_msg';

// 重新定义一下 User 接口，或者从 userDb 导入 (但 userDb 含 fs 不能在前端用)
// 建议在这里简单定义一下，或者创建一个 shared/types.ts
interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  role: 'admin' | 'user';
  department: string;
  departmentId?: string;  // 部门ID
  jobTitle?: string;       // 职位
  permissions: any;
  password?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  // updateProfile: (data: Partial<User>) => void; // 暂时注释掉，如果需要个人中心修改再放开
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const login = async (username: string, password: string) => {
    try {
      // 修改点：调用 API 登录
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      });

      const data = await res.json();

      if (res.ok && data.success) {
        console.log('🔍 [调试-登录] 登录成功，返回的 user 对象:', data.user);
        console.log('🔍 [调试-登录] user.id =', data.user?.id);
        console.log('🔍 [调试-登录] user 的所有 keys:', Object.keys(data.user || {}));
        setUser(data.user);
        localStorage.setItem('ehs_user', JSON.stringify(data.user)); // 存整个对象简单点
        localStorage.setItem(LOGIN_TIME_KEY, Date.now().toString()); // 记录登录时间
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const logout = async () => {
    // 在清除本地状态前，先记录退出日志
    if (user) {
      try {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          body: { userId: user.id, userName: user.name },
        });
      } catch (error) {
        console.error('记录退出日志失败:', error);
        // 即使记录失败也继续退出流程
      }
    }

    setUser(null);
    localStorage.removeItem('ehs_user');
    localStorage.removeItem(LOGIN_TIME_KEY);
    router.push('/login');
  };

  // 凌晨2点强制下线检测
  const checkForceLogout = useCallback(() => {
    const stored = localStorage.getItem('ehs_user');
    if (!stored) return;

    const loginTimeStr = localStorage.getItem(LOGIN_TIME_KEY);
    if (!loginTimeStr) return;

    const loginTime = Number(loginTimeStr);
    // 修复4：防范非法值（NaN 会导致条件永远为 false，静默失效）
    if (isNaN(loginTime)) return;

    const now = new Date();
    const today2AM = new Date(now);
    today2AM.setHours(2, 0, 0, 0);

    // 若当前时间已过今天凌晨2点，且用户在2点之前登录，则强制下线
    if (now.getTime() >= today2AM.getTime() && loginTime < today2AM.getTime()) {
      // 修复7：先写消息再删 ehs_user，保证其他 tab 的 storage 事件触发时消息已存在
      localStorage.setItem(AUTO_LOGOUT_MSG_KEY, '长时间未操作，已自动下线');
      localStorage.removeItem('ehs_user');
      localStorage.removeItem(LOGIN_TIME_KEY);
      setUser(null);

      // 修复6：fire-and-forget 通知服务端清除 ehs_user_id Cookie
      try {
        const parsedUser = JSON.parse(stored) as Pick<User, 'id' | 'name'>;
        if (parsedUser?.id && parsedUser?.name) {
          apiFetch('/api/auth/logout', {
            method: 'POST',
            body: { userId: parsedUser.id, userName: parsedUser.name },
          }).catch(() => {});
        }
      } catch {}

      router.push('/login');
    }
  }, [router]);

  // Effect 1：仅在 mount 时从 localStorage 恢复用户状态（空依赖，执行一次）
  // 修复3：将初始化与轮询拆分为独立 effect，避免 router 变化时重复读取 localStorage
  useEffect(() => {
    const stored = localStorage.getItem('ehs_user');
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored);
        console.log('🔍 [调试-初始化] 从 localStorage 读取的 user:', parsedUser);
        console.log('🔍 [调试-初始化] user.id =', parsedUser?.id);
        setUser(parsedUser);
      } catch (e) {
        localStorage.removeItem('ehs_user');
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 2：凌晨2点强制下线轮询 + 多标签页同步下线
  useEffect(() => {
    // 页面加载时立即检测一次
    checkForceLogout();

    // 每30秒轮询检测凌晨2点强制下线条件
    const timer = setInterval(checkForceLogout, 30 * 1000);

    // 修复5：监听其他标签页的 localStorage 变化，实现多标签页同步下线
    // storage 事件仅在其他标签页修改 localStorage 时触发（不包括当前标签页）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ehs_user' && e.newValue === null) {
        // 另一个标签页已登出（手动退出或凌晨2点强制下线），本标签页同步下线
        // AUTO_LOGOUT_MSG_KEY 若已由发起方 tab 提前写入，login/page.tsx 将自动读取并展示
        setUser(null);
        localStorage.removeItem(LOGIN_TIME_KEY);
        router.push('/login');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkForceLogout, router]);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
