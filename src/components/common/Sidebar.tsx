/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Network,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  ShieldAlert,
  FileText,
  Archive,
  BookOpen
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileOpen: boolean;
  closeMobileMenu: () => void;
}

export default function Sidebar({ isCollapsed, toggleSidebar, isMobileOpen, closeMobileMenu }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => pathname.startsWith(path);

  const navItems = [
    { name: '工作台', href: '/dashboard', icon: LayoutDashboard },
    { name: 'EHS档案库', href: '/archives', icon: Archive, permission: 'doc_sys' },
    { name: '作业许可', href: '/work-permit', icon: FileText, permission: 'work_permit' },
    { name: '隐患排查', href: '/hidden-danger', icon: ShieldAlert, permission: 'hidden_danger' },
    { name: '文档管理', href: '/docs', icon: BookOpen, permission: 'doc_sys' },
    // Admin only items
    { name: '账户管理', href: '/admin/account', icon: Users, role: 'admin' },
    { name: '组织架构', href: '/admin/org', icon: Network, role: 'admin' },
  ];

  const visibleNavItems = navItems.filter(item => {
    if (item.role && user?.role !== item.role) return false;
    if (item.permission && user?.role !== 'admin') {
      if (!user?.permissions) return false;

      let perms = user.permissions;
      // Handle case where permissions is a JSON string
      if (typeof perms === 'string') {
        try {
          perms = JSON.parse(perms);
        } catch (e) {
          return false;
        }
      }

      if (perms[item.permission] === undefined) {
        return false;
      }
    }
    return true;
  });

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col shadow-sm",
          isCollapsed ? "w-16" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn("h-16 flex items-center border-b border-slate-100", isCollapsed ? "justify-center" : "px-6")}>
          <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden" onClick={closeMobileMenu}>
            <div className="relative h-8 w-8 shrink-0">
              <Image
                src="/logo1.png"
                alt="Hytzer EHS"
                fill
                className="object-contain" // removed brightness/invert as bg is white now
                sizes="32px"
              />
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-slate-900 tracking-tight text-lg whitespace-nowrap">
                Hytzer EHS
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobileMenu}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative",
                isActive(item.href)
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon size={20} className={cn("shrink-0", isActive(item.href) ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
              {!isCollapsed && <span>{item.name}</span>}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-md">
                  {item.name}
                </div>
              )}
            </Link>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-slate-100 space-y-1">
          <button
            onClick={toggleSidebar}
            className="hidden md:flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900 w-full transition-colors"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!isCollapsed && <span className="text-sm">收起侧边栏</span>}
          </button>

          <button
            onClick={logout}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 w-full transition-colors",
              isCollapsed && "justify-center"
            )}
            title={isCollapsed ? "退出登录" : undefined}
          >
            <LogOut size={20} />
            {!isCollapsed && <span className="text-sm">退出登录</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
