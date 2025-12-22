"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
// 1. 引入需要的图标：Network (组织架构), Users (账户), LayoutDashboard (工作台)
import { LogOut, User as UserIcon, ChevronDown, LayoutDashboard, Users, Network } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  // 如果是登录页，或者没有用户信息，不显示导航栏
  if (pathname === '/login' || !user) {
    return <>{children}</>; 
  }

  // 辅助函数：判断链接是否激活
  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <header className="bg-hytzer-dark text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* 左侧：Logo 与 导航菜单 */}
          <div className="flex items-center gap-8">
            {/* Logo 区域 */}
            <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
                <div className="relative h-10 w-32">
                    <Image 
                    src="/logo1.png" 
                    alt="Hytzer EHS" 
                    fill 
                    className="object-contain object-left brightness-0 invert" 
                    sizes="128px" 
                    priority 
                    />
                </div>
                <div className="h-6 w-[1px] bg-slate-600 mx-2 hidden sm:block"></div>
                <span className="text-lg font-semibold tracking-wide hidden sm:block">EHS 管理系统</span>
            </Link>

            {/* 2. 新增：中间导航菜单 (桌面端显示) */}
            <nav className="hidden md:flex items-center gap-6">
                <Link 
                    href="/dashboard" 
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                        pathname === '/dashboard' ? 'text-white' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <LayoutDashboard size={18} />
                    工作台
                </Link>

                {/* 仅管理员可见的菜单 */}
                {user.role === 'admin' && (
                    <>
                        <Link 
                            href="/admin/account" 
                            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                                isActive('/admin/account') ? 'text-white' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Users size={18} />
                            账户管理
                        </Link>
                        
                        {/* 这里就是你刚才找不到的组织架构入口 */}
                        <Link 
                            href="/admin/org" 
                            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                                isActive('/admin/org') ? 'text-white' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Network size={18} />
                            组织架构
                        </Link>
                    </>
                )}
            </nav>
          </div>

          {/* 右侧用户信息 */}
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-3 hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-slate-400">ID: {user.id}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-hytzer-blue flex items-center justify-center overflow-hidden border-2 border-slate-600">
                {user.avatar ? (
                   <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                   <span className="text-lg font-bold">{user.name?.[0]}</span>
                )}
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </button>

            {/* 下拉菜单 */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 text-slate-800 border border-slate-200 z-50">
                <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                    <p className="font-bold text-sm">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.role === 'admin' ? '管理员' : '普通用户'}</p>
                </div>
                
                {/* 移动端菜单补充 (如果屏幕小，上面导航隐藏了，这里可以显示) */}
                <div className="md:hidden border-b border-slate-100 mb-1">
                    <Link href="/dashboard" className="flex items-center px-4 py-2 hover:bg-slate-50 text-sm">工作台</Link>
                    {user.role === 'admin' && (
                        <>
                            <Link href="/admin/account" className="flex items-center px-4 py-2 hover:bg-slate-50 text-sm">账户管理</Link>
                            <Link href="/admin/org" className="flex items-center px-4 py-2 hover:bg-slate-50 text-sm">组织架构</Link>
                        </>
                    )}
                </div>

                <Link 
                  href="/profile" 
                  className="flex items-center px-4 py-2 hover:bg-slate-50 text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <UserIcon size={16} className="mr-2" /> 个人中心
                </Link>
                <button 
                  onClick={logout}
                  className="w-full flex items-center px-4 py-2 hover:bg-red-50 text-red-600 text-sm"
                >
                  <LogOut size={16} className="mr-2" /> 退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 页面主体 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}