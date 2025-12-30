'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Upload, Calendar, Settings, Library, GraduationCap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  
  // 检查用户是否有上传学习内容权限
  const hasUploadPermission = user?.role === 'admin' || 
    (user?.permissions && JSON.parse(user.permissions).includes('upload_training_content'));

  const isActive = (path: string) => pathname === path;

  // 菜单配置
  const myLearningItems = [
    { href: '/training/my-tasks', label: '我的任务', icon: BookOpen },
  ];

  const knowledgeBaseItems = [
    { href: '/training/knowledge-base', label: '公共知识库', icon: Library },
  ];

  const adminItems = [
    { href: '/training/materials', label: '学习内容库', icon: Upload },
    { href: '/training/tasks', label: '任务发布', icon: Calendar },
  ];

  const systemItems = [
    { href: '/training/settings', label: '系统设置', icon: Settings },
  ];

  const NavItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = isActive(href);
    
    return (
      <Link 
        href={href}
        className={`
          group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
          transition-all duration-200 font-medium text-sm
          ${active 
            ? 'bg-blue-50 text-blue-700' 
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }
        `}
      >
        {/* Active Indicator */}
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full" />
        )}
        
        <Icon 
          size={18} 
          className={`
            transition-colors duration-200 flex-shrink-0
            ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}
          `}
        />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="px-3 mb-2 mt-6 first:mt-0">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
        {children}
      </h3>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <div className="w-64 bg-slate-50/50 backdrop-blur-xl border-r border-slate-200/60 flex flex-col">
        {/* Header */}
        <div className="px-5 py-6 border-b border-slate-200/60">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <GraduationCap className="text-white" size={20} strokeWidth={2.5} />
            </div>
            {/* Title */}
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                EHS培训系统
              </h1>
              <p className="text-xs text-slate-500 font-medium">Training System</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* 我的学习 */}
          <SectionTitle>我的学习</SectionTitle>
          {myLearningItems.map(item => (
            <NavItem key={item.href} {...item} />
          ))}
          
          {/* 知识库 */}
          <SectionTitle>知识库</SectionTitle>
          {knowledgeBaseItems.map(item => (
            <NavItem key={item.href} {...item} />
          ))}

          {/* 管理中心 */}
          {(user?.role === 'admin' || hasUploadPermission) && (
            <>
              <SectionTitle>管理中心</SectionTitle>
              {adminItems.map(item => (
                <NavItem key={item.href} {...item} />
              ))}
            </>
          )}
          
          {/* 系统设置 */}
          {user?.role === 'admin' && (
            <>
              <SectionTitle>系统</SectionTitle>
              {systemItems.map(item => (
                <NavItem key={item.href} {...item} />
              ))}
            </>
          )}
        </nav>

        {/* Footer - Optional User Info */}
        {user && (
          <div className="px-5 py-4 border-t border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {user.role === 'admin' ? '管理员' : '用户'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
