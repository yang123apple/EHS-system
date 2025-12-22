"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
// import { User, db } from '@/lib/mockDb'; // 删除这行引用
import { useRouter } from 'next/navigation';

// 重新定义一下 User 接口，或者从 userDb 导入 (但 userDb 含 fs 不能在前端用)
// 建议在这里简单定义一下，或者创建一个 shared/types.ts
interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  role: 'admin' | 'user';
  department: string;
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        console.log('🔍 [调试-登录] 登录成功，返回的 user 对象:', data.user);
        console.log('🔍 [调试-登录] user.id =', data.user?.id);
        console.log('🔍 [调试-登录] user 的所有 keys:', Object.keys(data.user || {}));
        setUser(data.user);
        localStorage.setItem('ehs_user', JSON.stringify(data.user)); // 存整个对象简单点
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ehs_user');
    router.push('/login');
  };

  // 初始化检查
  useEffect(() => {
    const stored = localStorage.getItem('ehs_user');
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored);
        console.log('🔍 [调试-初始化] 从 localStorage 读取的 user:', parsedUser);
        console.log('🔍 [调试-初始化] user.id =', parsedUser?.id);
        setUser(parsedUser);
      } catch(e) {
        localStorage.removeItem('ehs_user');
      }
    }
  }, []);

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