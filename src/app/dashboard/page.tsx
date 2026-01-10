
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
  TrendingDown
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
    }
  ];

  const visibleModules = modules.filter(item => {
      if (user?.role === 'admin') return true;
      return user?.permissions && user.permissions[item.key] !== undefined;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section - 更紧凑 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <ShieldCheck className="text-blue-600 w-6 h-6"/>
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
              className="group block"
            >
              <Card className={cn(
                "h-[170px] transition-all duration-200 bg-white border",
                item.borderColor,
                item.hoverBorder,
                item.hoverBg,
                "hover:shadow-md hover:-translate-y-0.5"
              )}>
                <CardContent className="p-4 h-full flex flex-col">
                  {/* Header - 图标和状态 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("p-2 rounded-lg", item.iconBg)}>
                      <IconComponent className={cn("w-4 h-4", item.iconColor)} />
                    </div>
                    <Badge 
                      variant={item.statusColor} 
                      className="text-[10px] px-1.5 py-0.5 h-5 font-medium"
                    >
                      {item.status}
                    </Badge>
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-1.5 group-hover:text-blue-600 transition-colors leading-tight">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-medium text-slate-400 group-hover:text-slate-600">
                      <span>进入模块</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {visibleModules.length === 0 && user?.role !== 'admin' && (
          <div className="col-span-full py-12 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-400">
            <ShieldCheck size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm">暂无任何系统访问权限，请联系管理员分配。</p>
          </div>
        )}

        {/* Admin Card */}
        {user?.role === 'admin' && (
          <Link href="/admin/account" className="group block">
            <Card className="h-[170px] bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 hover:border-blue-600/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden">
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <CardContent className="p-4 h-full flex flex-col relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700 text-blue-400">
                    <Settings className="w-4 h-4" />
                  </div>
                  <Badge className="bg-blue-900/50 text-blue-400 border-blue-800 text-[10px] px-1.5 py-0.5 h-5 font-medium">
                    ADMIN
                  </Badge>
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1.5 group-hover:text-blue-400 transition-colors leading-tight">
                      账户管理系统
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      仅管理员可见：管理员工账号、部门架构及权限配置。
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] font-medium text-slate-500 group-hover:text-slate-300">
                    <span>管理设置</span>
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
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
    <Card className="border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-500">{label}</span>
          <div className="opacity-70">{icon}</div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className={cn("text-2xl font-bold tracking-tight", color)}>
            {value}
          </div>
          <span className="text-xs text-slate-400 font-medium">{unit}</span>
          {trend && (
            <div className={cn(
              "ml-auto flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded",
              trendType === "up" 
                ? "text-green-600 bg-green-50" 
                : "text-red-600 bg-red-50"
            )}>
              {trendType === "up" ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{trend}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
