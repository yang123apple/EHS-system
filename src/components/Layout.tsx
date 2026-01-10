
"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Network, ChevronDown, Settings } from 'lucide-react';
import NotificationPanel from '@/components/common/NotificationPanel';
import Breadcrumbs from '@/components/common/Breadcrumbs';
import { cn } from '@/lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // No layout for login or unauthenticated users
  if (pathname === '/login' || !user) {
    return <>{children}</>; 
  }

  const isActive = (path: string) => pathname.startsWith(path);

  const navItems = [
    { name: '工作台', href: '/dashboard', icon: LayoutDashboard },
    { name: '账户管理', href: '/admin/account', icon: Users, role: 'admin' },
    { name: '组织架构', href: '/admin/org', icon: Network, role: 'admin' },
  ];

  const visibleNavItems = navItems.filter(item => {
    if (item.role && user?.role !== item.role) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-16 shadow-lg" style={{ backgroundColor: '#2C3E50' }}>
        <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left Section: Logo + Navigation */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-4">
              <div className="relative h-[120px] w-[120px] shrink-0 -my-8">
                <Image
                  src="/logo1.png"
                  alt="EHS管理系统"
                  fill
                  className="object-contain brightness-0 invert"
                  sizes="120px"
                />
              </div>
              <div className="h-8 w-px bg-slate-400/50"></div>
              <span className="font-bold text-white tracking-tight text-xl whitespace-nowrap hidden sm:block">
                EHS管理系统
              </span>
            </Link>

            {/* Navigation Items */}
            <nav className="hidden md:flex items-center gap-1">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium",
                    isActive(item.href)
                      ? "bg-slate-700 text-white"
                      : "text-slate-200 hover:bg-slate-700/50 hover:text-white"
                  )}
                >
                  <item.icon size={18} className={cn(isActive(item.href) ? "text-white" : "text-slate-300")} />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Right Section: Notifications + User Menu */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* System Settings Icon (Admin Only) */}
            {user.role === 'admin' && (
              <>
                <Link
                  href="/admin"
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isActive('/admin')
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                  )}
                  title="系统设置"
                >
                  <Settings size={20} />
                </Link>
                <div className="h-6 w-px bg-slate-500 hidden sm:block"></div>
              </>
            )}

            <NotificationPanel />
            
            <div className="h-6 w-px bg-slate-500 mx-1 hidden sm:block"></div>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 hover:bg-slate-700/50 py-1 px-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-600"
              >
                <div className="relative h-8 w-8 rounded-full overflow-hidden border border-slate-400 bg-slate-700">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt="Avatar"
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  ) : (
                    <span className="flex items-center justify-center h-full w-full text-xs font-bold text-white">{user.name?.[0]}</span>
                  )}
                </div>
                <ChevronDown size={14} className="text-slate-300 hidden sm:block" />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setUserMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-[9999] animate-fade-in">
                    <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                      <p className="text-sm font-medium text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.id}</p>
                    </div>
                    <Link href="/profile" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => setUserMenuOpen(false)}>个人中心</Link>
                    {user.role === 'admin' && (
                      <Link href="/admin" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => setUserMenuOpen(false)}>系统设置</Link>
                    )}
                    <button onClick={() => { logout(); setUserMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">退出系统</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto w-full">
          <Breadcrumbs />
          {children}
        </div>
      </main>
    </div>
  );
}
