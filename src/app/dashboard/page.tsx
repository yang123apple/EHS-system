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
  GraduationCap,
  Users,
  TrendingUp,
  TrendingDown,
  Archive,
  FileWarning
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
      icon: FileSignature,
      iconColor: "text-orange-600",
      iconBg: "bg-orange-50",
      borderColor: "border-orange-200",
      hoverBorder: "group-hover:border-orange-300",
      hoverBg: "group-hover:bg-orange-50/50",
      status: "进行中",
      statusColor: "warning" as const
    },
    {
      key: "hidden_danger",
      title: "隐患排查治理",
      description: "随手拍隐患，整改全流程闭环管理",
      href: "/hidden-danger",
      icon: AlertTriangle,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      borderColor: "border-red-200",
      hoverBorder: "group-hover:border-red-300",
      hoverBg: "group-hover:bg-red-50/50",
      status: "需关注",
      statusColor: "danger" as const
    },
    {
      key: "doc_sys",
      title: "ESH文档管理系统",
      description: "EHS 手册、程序文件与记录管理",
      href: "/docs",
      icon: FolderOpen,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      borderColor: "border-indigo-200",
      hoverBorder: "group-hover:border-indigo-300",
      hoverBg: "group-hover:bg-indigo-50/50",
      status: "已同步",
      statusColor: "info" as const
    },
    {
      key: "training",
      title: "培训管理系统",
      description: "在线培训、考试管理与学习进度跟踪",
      href: "/training/my-tasks",
      icon: GraduationCap,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
      borderColor: "border-green-200",
      hoverBorder: "group-hover:border-green-300",
      hoverBg: "group-hover:bg-green-50/50",
      status: "正常",
      statusColor: "success" as const
    },
    {
      key: "data_dashboard",
      title: "EHS 数据看板",
      description: "实时监控安全生产指标与趋势分析",
      href: "#",
      icon: BarChart3,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50",
      borderColor: "border-purple-200",
      hoverBorder: "group-hover:border-purple-300",
      hoverBg: "group-hover:bg-purple-50/50",
      status: "开发中",
      statusColor: "default" as const
    },
    {
      key: "archives",
      title: "EHS 档案库",
      description: "企业证照、人员资质、设备检修档案管理",
      href: "/archives",
      icon: Archive,
      iconColor: "text-teal-600",
      iconBg: "bg-teal-50",
      borderColor: "border-teal-200",
      hoverBorder: "group-hover:border-teal-300",
      hoverBg: "group-hover:bg-teal-50/50",
      status: "正常",
      statusColor: "success" as const
    },
    {
      key: "incident",
      title: "事故事件管理",
      description: "事故上报、调查分析、整改闭环全流程管理",
      href: "/incident",
      icon: FileWarning,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      borderColor: "border-amber-200",
      hoverBorder: "group-hover:border-amber-300",
      hoverBg: "group-hover:bg-amber-50/50",
      status: "正常",
      statusColor: "success" as const
    }
  ];

  const visibleModules = modules.filter(item => {
    if (user?.role === 'admin') return true;
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

    return perms[item.key] !== undefined;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section - 更紧凑 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <ShieldCheck className="text-blue-600 w-6 h-6" />
            <span>EHS 安全管理工作台</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">欢迎回来，{user?.name || '用户'}，请选择您要处理的业务模块</p>
        </div>
        <div className="text-xs text-slate-500 font-mono bg-white px-3 py-1.5 rounded-md border border-slate-200">
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Module Cards - 紧凑化设计 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {visibleModules.map((item) => {
          const IconComponent = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="group block h-full"
            >
              <Card 
                variant="clay"
                className={cn(
                  "h-full min-h-[190px] relative overflow-hidden flex flex-col",
                  "group-hover:shadow-[0_16px_48px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.95)]"
                )}
              >
                {/* 背景渐变装饰 */}
                <div className={cn(
                  "absolute -right-12 -top-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl",
                  item.iconBg.replace("bg-", "bg-").replace("-50", "-200/30")
                )} />
                
                <CardContent className="p-5 h-full flex flex-col relative z-10 min-h-0">
                  {/* Header - 图标和状态 */}
                  <div className="flex items-start justify-between mb-4 flex-shrink-0">
                    <div className={cn(
                      "p-3 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-300 group-hover:scale-110 group-hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)]",
                      item.iconBg
                    )}>
                      <IconComponent className={cn("w-5 h-5", item.iconColor)} />
                    </div>
                    <Badge
                      variant={item.statusColor}
                      className="text-[10px] px-2 py-1 h-5 font-semibold rounded-full shadow-sm backdrop-blur-sm flex-shrink-0"
                    >
                      {item.status}
                    </Badge>
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="space-y-2 flex-1 min-h-0">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight tracking-tight line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 font-medium">
                        {item.description}
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500 group-hover:text-slate-700 transition-colors flex-shrink-0 gap-2">
                      <span className="truncate">进入模块</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300 flex-shrink-0" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {visibleModules.length === 0 && user?.role !== 'admin' && (
          <Card variant="clay" className="col-span-full py-16 text-center border-dashed border-slate-300/60 bg-gradient-to-br from-slate-50/80 via-white/60 to-slate-100/40">
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] mb-4">
                <ShieldCheck size={40} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">暂无任何系统访问权限，请联系管理员分配。</p>
            </div>
          </Card>
        )}

        {/* Admin Card */}
        {user?.role === 'admin' && (
          <Link href="/admin/account" className="group block h-full">
            <Card 
              variant="clay"
              className="h-full min-h-[190px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden group-hover:shadow-[0_16px_48px_rgba(59,130,246,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col"
            >
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute bottom-6 left-6 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <CardContent className="p-5 h-full flex flex-col relative z-10 min-h-0">
                <div className="flex items-start justify-between mb-4 flex-shrink-0">
                  <div className="bg-slate-800/60 backdrop-blur-xl p-3 rounded-2xl border border-slate-700/50 text-blue-400 shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-300">
                    <Settings className="w-5 h-5" />
                  </div>
                  <Badge className="bg-blue-900/40 backdrop-blur-sm text-blue-300 border border-blue-800/50 text-[10px] px-2 py-1 h-5 font-bold rounded-full shadow-sm flex-shrink-0">
                    ADMIN
                  </Badge>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="space-y-2 flex-1 min-h-0">
                    <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors leading-tight tracking-tight line-clamp-2">
                      账户管理系统
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 font-medium">
                      仅管理员可见：管理员工账号、部门架构及权限配置。
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] font-semibold text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0 gap-2">
                    <span className="truncate">管理设置</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300 flex-shrink-0" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Stats Section - 对齐并优化 */}
      <div className="pt-6 border-t border-slate-200">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">实时概览</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="进行中作业"
            value="3"
            unit="个"
            icon={<FileSignature className="w-4 h-4 text-orange-500" />}
            trend="+1"
            trendType="up"
          />
          <StatCard
            label="待审批单据"
            value="12"
            unit="条"
            color="text-orange-600"
            icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
          />
          <StatCard
            label="本月隐患"
            value="0"
            unit="起"
            color="text-green-600"
            icon={<ShieldCheck className="w-4 h-4 text-green-500" />}
          />
          <StatCard
            label="在线人员"
            value="45"
            unit="人"
            icon={<Users className="w-4 h-4 text-blue-500" />}
          />
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  unit: string;
  color?: string;
  icon: React.ReactNode;
  trend?: string;
  trendType?: "up" | "down";
}

function StatCard({ label, value, unit, color = "text-slate-900", icon, trend, trendType = "up" }: StatCardProps) {
  return (
    <Card 
      variant="clay"
      className="relative overflow-hidden group"
    >
      {/* 背景装饰渐变 */}
      <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br from-blue-100/40 to-purple-100/40 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <CardContent className="p-6 relative z-10 min-h-0">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate flex-1 mr-2">{label}</span>
          <div className="opacity-80 group-hover:opacity-100 transition-opacity p-2 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm flex-shrink-0">
            {icon}
          </div>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap min-h-0">
          <div className={cn("text-3xl font-bold tracking-tight leading-none truncate", color)}>
            {value}
          </div>
          <span className="text-sm text-slate-500 font-semibold flex-shrink-0">{unit}</span>
          {trend && (
            <div className={cn(
              "ml-auto flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm flex-shrink-0",
              trendType === "up"
                ? "text-green-700 bg-green-50/80 border border-green-200/50"
                : "text-red-700 bg-red-50/80 border border-red-200/50"
            )}>
              {trendType === "up" ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>{trend}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
