
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Breadcrumbs() {
  const pathname = usePathname();
  const paths = pathname.split('/').filter(Boolean);

  const pathNames: Record<string, string> = {
    dashboard: "工作台",
    admin: "系统管理",
    account: "账户管理",
    org: "组织架构",
    "work-permit": "作业许可",
    "hidden-danger": "隐患排查",
    docs: "文档管理",
    training: "培训管理",
    "my-tasks": "我的任务",
    profile: "个人中心",
    login: "登录",
    notifications: "消息通知"
  };

  if (pathname === '/dashboard') return null;

  return (
    <nav className="flex items-center text-sm text-slate-500 mb-4 animate-fade-in">
      <Link href="/dashboard" className="hover:text-hytzer-blue transition-colors flex items-center gap-1">
        <Home size={14} />
      </Link>
      {paths.map((path, index) => {
        const href = `/${paths.slice(0, index + 1).join('/')}`;
        const isLast = index === paths.length - 1;
        const name = pathNames[path] || path;

        return (
          <div key={path} className="flex items-center">
            <ChevronRight size={14} className="mx-2 text-slate-400" />
            {isLast ? (
              <span className="font-medium text-slate-700">{name}</span>
            ) : (
              <Link href={href} className="hover:text-hytzer-blue transition-colors">
                {name}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
