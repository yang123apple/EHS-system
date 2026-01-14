'use client';

import React, { Suspense, lazy } from 'react';
import { User, Settings, Building2, BarChart3, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { PermissionManager } from '@/lib/permissions';

// 使用动态导入按需加载组件，减少初始编译时间
const EnterpriseArchiveView = lazy(() => import('./EnterpriseArchiveView'));
const EquipmentArchiveView = lazy(() => import('./EquipmentArchiveView'));
const PersonnelArchiveView = lazy(() => import('./PersonnelArchiveView'));
const MSDSArchiveView = lazy(() => import('./MSDSArchiveView'));
const ArchiveStatsView = lazy(() => import('./ArchiveStatsView'));

type ArchiveCategory = 'enterprise' | 'equipment' | 'personnel' | 'msds' | 'stats';

const categories: { 
    id: ArchiveCategory; 
    name: string; 
    icon: any; 
    color: string;
    permission: string; // 权限key
}[] = [
    { id: 'enterprise', name: '一企一档', icon: Building2, color: 'text-blue-600 bg-blue-50', permission: 'enterprise_view' },
    { id: 'equipment', name: '一机一档', icon: Settings, color: 'text-orange-600 bg-orange-50', permission: 'equipment_view' },
    { id: 'personnel', name: '一人一档', icon: User, color: 'text-green-600 bg-green-50', permission: 'personnel_view' },
    { id: 'msds', name: '化学品MSDS库', icon: FlaskConical, color: 'text-cyan-600 bg-cyan-50', permission: 'msds_view' },
    { id: 'stats', name: '统计图表', icon: BarChart3, color: 'text-purple-600 bg-purple-50', permission: '' }, // stats 不需要权限检查
];

// 加载占位符组件
const LoadingPlaceholder = () => (
    <div className="p-6 flex items-center justify-center h-full">
        <div className="text-slate-400">加载中...</div>
    </div>
);

export default function ArchiveExplorer() {
    const { user } = useAuth();
    const [activeCategory, setActiveCategory] = React.useState<ArchiveCategory>('enterprise');

    // 根据权限过滤可见的分类
    const visibleCategories = categories.filter(cat => {
        if (!cat.permission) return true; // stats 不需要权限检查
        // 检查是否有档案库系统的基础权限
        const hasAccess = PermissionManager.hasPermission(user, 'archives', 'access');
        if (!hasAccess) return false;
        // 检查是否有该分类的查看权限
        return PermissionManager.hasPermission(user, 'archives', cat.permission);
    });

    // 如果当前选中的分类不可见，自动切换到第一个可见的分类
    React.useEffect(() => {
        if (visibleCategories.length > 0 && !visibleCategories.find(cat => cat.id === activeCategory)) {
            setActiveCategory(visibleCategories[0].id);
        }
    }, [visibleCategories, activeCategory]);

    // 如果没有可见的分类，显示提示
    if (visibleCategories.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex items-center justify-center">
                <div className="text-center text-slate-400">
                    <p className="text-lg mb-2">暂无权限访问档案库</p>
                    <p className="text-sm">请联系管理员分配相应权限</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex overflow-hidden">
            {/* Sidebar Categories */}
            <div className="w-64 border-r border-slate-100 bg-slate-50 p-4 space-y-2 shrink-0">
                <h3 className="text-sm font-semibold text-slate-500 mb-4 px-3">档案库分类</h3>
                {visibleCategories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={cn(
                            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left",
                            activeCategory === cat.id
                                ? "bg-white shadow-sm text-slate-900 font-medium"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                    >
                        <cat.icon size={18} className={cat.color.split(' ')[0]} />
                        <span>{cat.name}</span>
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto">
                <Suspense fallback={<LoadingPlaceholder />}>
                    {activeCategory === 'enterprise' && <EnterpriseArchiveView />}
                    {activeCategory === 'equipment' && <EquipmentArchiveView />}
                    {activeCategory === 'personnel' && <PersonnelArchiveView />}
                    {activeCategory === 'msds' && <MSDSArchiveView />}
                    {activeCategory === 'stats' && <ArchiveStatsView />}
                </Suspense>
            </div>
        </div>
    );
}
