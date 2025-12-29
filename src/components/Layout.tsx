"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
// 1. 引入需要的图标：Network (组织架构), Users (账户), LayoutDashboard (工作台)
import { LogOut, User as UserIcon, ChevronDown, LayoutDashboard, Users, Network, Menu, X, GraduationCap } from 'lucide-react';
import { usePathname } from 'next/navigation';
import NotificationPanel from '@/components/common/NotificationPanel';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          
          {/* 左侧：Logo 与 导航菜单 */}
          <div className="flex items-center gap-2 sm:gap-8">
            {/* 移动端汉堡菜单按钮 */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            {/* Logo 区域 */}
            <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="relative h-8 w-24 sm:h-10 sm:w-32">
                    <Image 
                    src="/logo1.png" 
                    alt="Hytzer EHS" 
                    fill 
                    className="object-contain object-left brightness-0 invert" 
                    sizes="(max-width: 640px) 96px, 128px" 
                    priority 
                    />
                </div>
                <div className="h-6 w-[1px] bg-slate-600 mx-2 hidden lg:block"></div>
                <span className="text-base sm:text-lg font-semibold tracking-wide hidden lg:block">EHS 管理系统</span>
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

                <Link
                    href="/training"
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                        isActive('/training') ? 'text-white' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <GraduationCap size={18} />
                    EHS培训
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

                        <div className="h-6 w-[1px] bg-slate-600 mx-2 hidden lg:block"></div>

                        <Link
                            href="/training/admin/content"
                            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                                isActive('/training/admin/content') ? 'text-white' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            培训内容
                        </Link>
                         <Link
                            href="/training/admin/tasks"
                            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                                isActive('/training/admin/tasks') ? 'text-white' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            培训任务
                        </Link>
                    </>
                )}
            </nav>
          </div>

          {/* 右侧：通知 + 用户菜单 */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* 通知图标 */}
            <NotificationPanel />
            
            {/* 用户下拉菜单 */}
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-1 sm:gap-3 hover:bg-slate-800 px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition-colors cursor-pointer"
              >
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-slate-400">ID: {user.id}</p>
                </div>
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-hytzer-blue flex items-center justify-center overflow-hidden border-2 border-slate-600 relative">
                  {user.avatar ? (
                     <Image
                       src={user.avatar}
                       alt="Avatar"
                       fill
                       className="object-cover"
                       sizes="(max-width: 640px) 32px, 40px"
                     />
                  ) : (
                     <span className="text-base sm:text-lg font-bold">{user.name?.[0]}</span>
                  )}
                </div>
                <ChevronDown size={16} className="text-slate-400 hidden sm:block" />
              </button>

              {/* 下拉菜单 */}
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 text-slate-800 border border-slate-200 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                      <p className="font-bold text-sm">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.role === 'admin' ? '管理员' : '普通用户'}</p>
                  </div>
                  
                  {/* 移动端菜单补充 (如果屏幕小，上面导航隐藏了，这里可以显示) */}
                  <div className="md:hidden border-b border-slate-100 mb-1">
                      <Link href="/dashboard" className="flex items-center px-4 py-2 hover:bg-slate-50 text-sm">工作台</Link>
                      <Link href="/training" className="flex items-center px-4 py-2 hover:bg-slate-50 text-sm">EHS培训</Link>
                      {user.role === 'admin' && (
                          <>
                              <Link href="/admin/account" className="flex items-center px-4 py-2 hover:bg-slate-50 text-sm">账户管理</Link>
                              <Link href="/admin/org" className="flex items-center px-4 py-2 hover:bg-slate-50 text-sm">组织架构</Link>
                              <Link href="/training/admin/content" className="flex items-center px-4 py-2 hover:bg-slate-50 text-sm">培训内容(Admin)</Link>
                              <Link href="/training/admin/tasks" className="flex items-center px-4 py-2 hover:bg-slate-50 text-sm">培训任务(Admin)</Link>
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
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* 移动端侧边导航菜单 */}
        {isMobileMenuOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
            <div className="fixed top-14 left-0 bottom-0 w-64 bg-hytzer-dark border-r border-slate-700 z-50 md:hidden overflow-y-auto">
              <nav className="p-4 space-y-2">
                <Link 
                  href="/dashboard" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname === '/dashboard' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <LayoutDashboard size={20} />
                  工作台
                </Link>

                <Link
                  href="/training"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/training') ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <GraduationCap size={20} />
                  EHS培训
                </Link>
                
                {user.role === 'admin' && (
                  <>
                    <Link 
                      href="/admin/account" 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive('/admin/account') ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Users size={20} />
                      账户管理
                    </Link>
                    
                    <Link 
                      href="/admin/org" 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive('/admin/org') ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Network size={20} />
                      组织架构
                    </Link>

                    <Link
                      href="/training/admin/content"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive('/training/admin/content') ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      培训内容
                    </Link>
                     <Link
                      href="/training/admin/tasks"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive('/training/admin/tasks') ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      培训任务
                    </Link>
                  </>
                )}
              </nav>
            </div>
          </>
        )}
      </header>

      {/* 页面主体 */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {children}
      </main>
    </div>
  );
}