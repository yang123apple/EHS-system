'use client';

import React from 'react';
import { Folder, FileText, User, Settings, Building2, Plus, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import EnterpriseArchiveView from './EnterpriseArchiveView';
import EquipmentArchiveView from './EquipmentArchiveView';
import PersonnelArchiveView from './PersonnelArchiveView';
import ArchiveStatsView from './ArchiveStatsView';

type ArchiveCategory = 'enterprise' | 'equipment' | 'personnel' | 'stats';

const categories: { id: ArchiveCategory; name: string; icon: any; color: string }[] = [
    { id: 'enterprise', name: '一企一档', icon: Building2, color: 'text-blue-600 bg-blue-50' },
    { id: 'equipment', name: '一机一档', icon: Settings, color: 'text-orange-600 bg-orange-50' },
    { id: 'personnel', name: '一人一档', icon: User, color: 'text-green-600 bg-green-50' },
    { id: 'stats', name: '统计图表', icon: BarChart3, color: 'text-purple-600 bg-purple-50' },
];

export default function ArchiveExplorer() {
    const [activeCategory, setActiveCategory] = React.useState<ArchiveCategory>('enterprise');

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex overflow-hidden">
            {/* Sidebar Categories */}
            <div className="w-64 border-r border-slate-100 bg-slate-50 p-4 space-y-2 shrink-0">
                <h3 className="text-sm font-semibold text-slate-500 mb-4 px-3">档案库分类</h3>
                {categories.map((cat) => (
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
                {activeCategory === 'enterprise' && <EnterpriseArchiveView />}
                {activeCategory === 'equipment' && <EquipmentArchiveView />}
                {activeCategory === 'personnel' && <PersonnelArchiveView />}
                {activeCategory === 'stats' && <ArchiveStatsView />}
            </div>
        </div>
    );
}
