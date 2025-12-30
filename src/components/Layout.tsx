/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { Menu, Bell, Search, ChevronDown } from 'lucide-react';
import NotificationPanel from '@/components/common/NotificationPanel';
import Sidebar from '@/components/common/Sidebar';
import Breadcrumbs from '@/components/common/Breadcrumbs';
import { cn } from '@/lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // No layout for login or unauthenticated users
  if (pathname === '/login' || !user) {
    return <>{children}</>; 
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Component */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobileOpen={mobileMenuOpen}
        closeMobileMenu={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={cn(
            "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out",
            sidebarCollapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 shadow-sm/50 flex items-center justify-between px-4 sm:px-6 lg:px-8 backdrop-blur-sm bg-white/90">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                    <Menu size={20} />
                </button>

                {/* Search Bar (Optional / Placeholder) */}
                <div className="hidden sm:flex items-center relative max-w-md w-64">
                    <Search className="absolute left-3 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="全局搜索..."
                        className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-100 border-transparent rounded-md focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
                <NotificationPanel />
                
                <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                <div className="relative">
                    <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="flex items-center gap-3 hover:bg-slate-50 py-1 px-1.5 rounded-full sm:rounded-lg transition-colors border border-transparent hover:border-slate-100"
                    >
                        <div className="flex flex-col items-end hidden sm:block">
                            <span className="text-sm font-medium text-slate-700">{user.name}</span>
                            <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">{user.role}</span>
                        </div>
                        <div className="relative h-8 w-8 rounded-full overflow-hidden border border-slate-200 bg-slate-100">
                             {user.avatar ? (
                                <Image
                                src={user.avatar}
                                alt="Avatar"
                                fill
                                className="object-cover"
                                />
                             ) : (
                                <span className="flex items-center justify-center h-full w-full text-xs font-bold text-slate-500">{user.name?.[0]}</span>
                             )}
                        </div>
                        <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
                    </button>

                    {userMenuOpen && (
                        <>
                         <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)}></div>
                         <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-40 animate-fade-in">
                            <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                                <p className="text-sm font-medium text-slate-900">{user.name}</p>
                                <p className="text-xs text-slate-500 truncate">{user.id}</p>
                            </div>
                            <Link href="/profile" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => setUserMenuOpen(false)}>个人中心</Link>
                            <Link href="/settings" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => setUserMenuOpen(false)}>系统设置</Link>
                         </div>
                        </>
                    )}
                </div>
            </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <Breadcrumbs />
            {children}
        </main>
      </div>
    </div>
  );
}
