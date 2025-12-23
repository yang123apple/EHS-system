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
  Settings
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();

  // 定义工作台模块，注意：每个模块必须增加一个 'key' 字段
  // 这个 key 必须与 src/lib/mockDb.ts 中的 key 完全一致！
  const modules = [
    {
      key: "work_permit", // ✅ 对应 mockDb.ts 里的 work_permit
      title: "作业许可管理",
      description: "新建工程项目、办理动火/高处/有限空间等电子作业票",
      href: "/work-permit", 
      icon: <FileSignature size={24} />,
      color: "bg-orange-50 text-orange-600 border-orange-100",
      hover: "hover:border-orange-300 hover:shadow-orange-100"
    },
    {
      key: "hidden_danger", // ✅ 对应 mockDb.ts 里的 hidden_danger
      title: "隐患排查治理", // 修改标题，去掉“开发中”
      description: "随手拍隐患，整改全流程闭环管理",
      href: "/hidden-danger", // ✅ 修改这里：指向真实页面
      icon: <AlertTriangle size={24} />,
      color: "bg-red-50 text-red-600 border-red-100",
      hover: "hover:border-red-300 hover:shadow-red-100"
    },
    {
      key: "doc_sys", // ✅ 对应 mockDb.ts 里的 doc_sys
      title: "ESH文档管理系统",
      description: "EHS 手册、程序文件与记录管理",
      href: "/docs", 
      icon: <FolderOpen size={24} />,
      color: "bg-indigo-50 text-indigo-600 border-indigo-100",
      hover: "hover:border-indigo-300 hover:shadow-indigo-100"
    },
    {
      key: "data_dashboard", // ✅ 对应 mockDb.ts 里的 data_dashboard (若 mockDb 中没有此 key，普通用户将不可见)
      title: "EHS 数据看板 (开发中)",
      description: "实时监控安全生产指标与趋势分析",
      href: "#", 
      icon: <BarChart3 size={24} />,
      color: "bg-purple-50 text-purple-600 border-purple-100",
      hover: "hover:border-purple-300 hover:shadow-purple-100"
    }
  ];

  // ✅ 核心过滤逻辑：决定哪些卡片对当前用户可见
  const visibleModules = modules.filter(item => {
      // 1. 超级管理员：无条件查看所有
      if (user?.role === 'admin') return true;

      // 2. 普通用户：检查 permissions 对象
      // 如果 user.permissions['key'] 存在（即使是空数组 []），说明启用了该子系统
      // 如果 user.permissions['key'] 是 undefined，说明该子系统被禁用（不可见）
      return user?.permissions && user.permissions[item.key] !== undefined;
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* 顶部欢迎区 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-hytzer-blue w-6 h-6 sm:w-8 sm:h-8"/> 
            <span className="hidden sm:inline">EHS 安全管理工作台</span>
            <span className="sm:hidden">EHS 工作台</span>
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">欢迎回来，{user?.name || '用户'}，请选择您要处理的业务模块</p>
        </div>
        <div className="text-xs sm:text-sm text-slate-400 font-mono">
           {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* 核心功能入口 Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* 1. 渲染筛选后的模块 */}
        {visibleModules.map((item) => (
          <Link 
            key={item.key} 
            href={item.href}
            className={`
              relative group p-4 sm:p-6 rounded-xl border bg-white shadow-sm transition-all duration-300
              ${item.hover}
            `}
          >
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className={`p-2 sm:p-3 rounded-lg ${item.color}`}>
                {item.icon}
              </div>
              <ArrowRight className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-transform" size={18}/>
            </div>
            
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1 sm:mb-2 group-hover:text-hytzer-blue transition-colors">
              {item.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {item.description}
            </p>
          </Link>
        ))}

        {/* 如果没有任何模块权限，显示提示 */}
        {visibleModules.length === 0 && user?.role !== 'admin' && (
            <div className="col-span-full py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
                暂无任何系统访问权限，请联系管理员分配。
            </div>
        )}

        {/* 2. 管理员专属卡片 (硬编码逻辑，始终只对 admin 可见) */}
        {user?.role === 'admin' && (
           <Link href="/admin/account" className="group block">
             <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-4 sm:p-6 transition-all duration-300 hover:shadow-lg hover:border-hytzer-blue hover:-translate-y-1 h-full relative overflow-hidden">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-hytzer-blue/20 rounded-full blur-xl"></div>
               
               <div className="flex items-start justify-between relative z-10 mb-3 sm:mb-4">
                 <div className="bg-slate-700 p-2 sm:p-3 rounded-lg">
                   <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                 </div>
                 <span className="bg-hytzer-blue text-white text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded font-bold tracking-wider">ADMIN</span>
               </div>
               
               <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-hytzer-blue transition-colors relative z-10 mb-1 sm:mb-2">
                 账户管理系统
               </h3>
               <p className="text-xs sm:text-sm text-slate-400 relative z-10 leading-relaxed">
                 仅管理员可见：管理员工账号、部门架构及权限配置。
               </p>
             </div>
           </Link>
        )}

      </div>

      {/* 底部统计 */}
      <div className="pt-8 border-t border-slate-100">
        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">今日概览</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="进行中作业" value="3" unit="个" />
            <StatCard label="待审批单据" value="12" unit="条" color="text-orange-600" />
            <StatCard label="本月隐患" value="0" unit="起" color="text-green-600" />
            <StatCard label="在线人员" value="45" unit="人" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color = "text-slate-900" }: any) {
    return (
        <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className={`text-xl sm:text-2xl font-bold ${color}`}>
                {value} <span className="text-xs font-normal text-slate-400">{unit}</span>
            </div>
        </div>
    )
}