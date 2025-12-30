/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  FileSignature, 
  AlertTriangle, 
  BarChart3, 
  ArrowRight,
  ShieldCheck,
  FolderOpen,
  Settings,
  GraduationCap
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();

  const modules = [
    {
      key: "work_permit",
      title: "作业许可管理",
      description: "新建工程项目、办理动火/高处/有限空间等电子作业票",
      href: "/work-permit", 
      icon: <FileSignature size={20} />,
      colorClass: "bg-orange-50 text-orange-600 border-orange-100",
      borderHover: "group-hover:border-orange-200",
      status: "进行中",
      statusColor: "warning" as const
    },
    {
      key: "hidden_danger",
      title: "隐患排查治理",
      description: "随手拍隐患，整改全流程闭环管理",
      href: "/hidden-danger",
      icon: <AlertTriangle size={20} />,
      colorClass: "bg-red-50 text-red-600 border-red-100",
      borderHover: "group-hover:border-red-200",
      status: "需关注",
      statusColor: "danger" as const
    },
    {
      key: "doc_sys",
      title: "ESH文档管理系统",
      description: "EHS 手册、程序文件与记录管理",
      href: "/docs", 
      icon: <FolderOpen size={20} />,
      colorClass: "bg-indigo-50 text-indigo-600 border-indigo-100",
      borderHover: "group-hover:border-indigo-200",
      status: "已同步",
      statusColor: "info" as const
    },
    {
      key: "training",
      title: "培训管理系统",
      description: "在线培训、考试管理与学习进度跟踪",
      href: "/training/my-tasks", 
      icon: <GraduationCap size={20} />,
      colorClass: "bg-green-50 text-green-600 border-green-100",
      borderHover: "group-hover:border-green-200",
      status: "正常",
      statusColor: "success" as const
    },
    {
      key: "data_dashboard",
      title: "EHS 数据看板 (开发中)",
      description: "实时监控安全生产指标与趋势分析",
      href: "#", 
      icon: <BarChart3 size={20} />,
      colorClass: "bg-purple-50 text-purple-600 border-purple-100",
      borderHover: "group-hover:border-purple-200",
      status: "Dev",
      statusColor: "default" as const
    }
  ];

  const visibleModules = modules.filter(item => {
      if (user?.role === 'admin') return true;
      return user?.permissions && user.permissions[item.key] !== undefined;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <ShieldCheck className="text-blue-700 w-8 h-8"/>
            <span>EHS 安全管理工作台</span>
          </h1>
          <p className="text-slate-500 mt-2 text-base">欢迎回来，{user?.name || '用户'}，请选择您要处理的业务模块</p>
        </div>
        <div className="text-sm text-slate-400 font-mono bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
           {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Bento Grid / Module Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {visibleModules.map((item) => (
          <Link 
            key={item.key} 
            href={item.href}
            className="group block h-full"
          >
            <Card className={cn(
                "h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-white border-slate-200 relative overflow-hidden",
                item.borderHover
            )}>
                <CardContent className="p-6 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className={cn("p-2.5 rounded-lg border", item.colorClass)}>
                            {item.icon}
                        </div>
                        <Badge variant={item.statusColor} className="shadow-none">
                            {item.status}
                        </Badge>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                            {item.title}
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            {item.description}
                        </p>
                    </div>

                    {/* Footer / Action Hint */}
                    <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-medium text-slate-400 group-hover:text-slate-600">
                        <span>进入模块</span>
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                </CardContent>
            </Card>
          </Link>
        ))}

        {visibleModules.length === 0 && user?.role !== 'admin' && (
            <div className="col-span-full py-16 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-300 text-slate-400">
                <ShieldCheck size={48} className="mx-auto mb-4 text-slate-300" />
                <p>暂无任何系统访问权限，请联系管理员分配。</p>
            </div>
        )}

        {/* Admin Card */}
        {user?.role === 'admin' && (
           <Link href="/admin/account" className="group block h-full">
             <Card className="h-full bg-slate-900 border-slate-800 hover:border-blue-700/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
               {/* Background Glow */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
               
               <CardContent className="p-6 flex flex-col h-full relative z-10">
                   <div className="flex items-start justify-between mb-4">
                     <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 text-blue-400">
                       <Settings size={20} />
                     </div>
                     <Badge className="bg-blue-900/50 text-blue-400 border-blue-800 hover:bg-blue-900/70">ADMIN</Badge>
                   </div>

                   <div className="flex-1">
                       <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                         账户管理系统
                       </h3>
                       <p className="text-sm text-slate-400 leading-relaxed">
                         仅管理员可见：管理员工账号、部门架构及权限配置。
                       </p>
                   </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-medium text-slate-500 group-hover:text-slate-300">
                        <span>管理设置</span>
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
               </CardContent>
             </Card>
           </Link>
        )}
      </div>

      {/* Stats Section */}
      <div className="pt-8 border-t border-slate-100">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">实时概览</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard label="进行中作业" value="3" unit="个" icon={<FileSignature size={18} />} trend="+1" />
            <StatCard label="待审批单据" value="12" unit="条" color="text-orange-600" icon={<AlertTriangle size={18} className="text-orange-500" />} />
            <StatCard label="本月隐患" value="0" unit="起" color="text-green-600" icon={<ShieldCheck size={18} className="text-green-500" />} />
            <StatCard label="在线人员" value="45" unit="人" icon={<UsersIcon size={18} className="text-blue-500" />} />
        </div>
      </div>
    </div>
  );
}

import { Users as UsersIcon } from 'lucide-react';

function StatCard({ label, value, unit, color = "text-slate-900", icon, trend }: any) {
    return (
        <Card className="border-slate-100 shadow-sm hover:shadow bg-slate-50/50">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">{label}</span>
                    {icon && <div className="opacity-80">{icon}</div>}
                </div>
                <div className="flex items-end gap-2">
                    <div className={`text-2xl font-bold ${color}`}>
                        {value}
                    </div>
                    <span className="text-xs text-slate-400 mb-1 font-medium">{unit}</span>
                    {trend && (
                        <span className="ml-auto text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                            {trend}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
