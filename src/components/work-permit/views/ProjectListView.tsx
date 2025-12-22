import { useState } from 'react';
import { Search, Filter, Calendar, Eye, Clock, FileText, Trash2, Hash } from 'lucide-react';
import { Project } from '@/types/work-permit';

interface Props {
    projects: Project[];
    hasPerm: (perm: string) => boolean;
    onOpenDetail: (p: Project) => void;
    onAdjustDate: (p: Project) => void;
    onNewPermit: (p: Project) => void;
    onDeleteProject: (id: string, name: string) => void;
}

export default function ProjectListView({ projects, hasPerm, onOpenDetail, onAdjustDate, onNewPermit, onDeleteProject }: Props) {
    // === 本地筛选状态 ===
    const [filterText, setFilterText] = useState('');
    const [searchField, setSearchField] = useState('name');
    const [filterDate, setFilterDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // 辅助函数：计算项目状态
    const getProjectStatus = (start: string, end: string) => {
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const s = new Date(start); s.setHours(0, 0, 0, 0);
        const e = new Date(end); e.setHours(0, 0, 0, 0);
        if (now < s) return { label: '未开始', color: 'bg-slate-100 text-slate-500 border-slate-200', value: 'upcoming' };
        if (now > e) return { label: '已结束', color: 'bg-gray-100 text-gray-400 border-gray-200', value: 'finished' };
        return { label: '进行中', color: 'bg-blue-50 text-blue-700 border-blue-100', value: 'ongoing' };
    };

    // 执行筛选
    const filteredProjects = projects.filter(p => {
        // 1. 文本搜索
        const term = filterText.toLowerCase();
        let matchesText = true;
        if (term) {
            if (searchField === 'contractNo') matchesText = (p.contractNo || '').toLowerCase().includes(term);
            else if (searchField === 'supplierName') matchesText = (p.supplierName || '').toLowerCase().includes(term);
            else if (searchField === 'location') matchesText = (p.location || '').toLowerCase().includes(term);
            else matchesText = (p.name.toLowerCase().includes(term) || (p.code ? p.code.toLowerCase().includes(term) : false));
        }

        // 2. 日期筛选
        let matchesDate = true;
        if (filterDate) {
            const startStr = new Date(p.startDate).toISOString().slice(0, 10);
            const endStr = new Date(p.endDate).toISOString().slice(0, 10);
            matchesDate = filterDate >= startStr && filterDate <= endStr;
        }

        // 3. 状态筛选
        let matchesStatus = true;
        if (filterStatus !== 'all') {
            const currentStatus = getProjectStatus(p.startDate, p.endDate).value;
            matchesStatus = currentStatus === filterStatus;
        }

        return matchesText && matchesDate && matchesStatus;
    });

    return (
        <>
            {/* 顶部工具栏 */}
            <div className="bg-white border-b border-slate-200 p-4 flex gap-4 items-center flex-wrap">
                <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2 flex-1 max-w-lg border border-transparent focus-within:border-blue-300 transition">
                    <Search size={18} className="text-slate-400 mr-2" />
                    <select
                        value={searchField}
                        onChange={e => setSearchField(e.target.value)}
                        className="bg-transparent text-sm font-medium text-slate-700 outline-none border-r border-slate-300 pr-2 mr-2 cursor-pointer"
                    >
                        <option value="name">工程名称</option>
                        <option value="location">施工地点</option>
                        <option value="supplierName">供应商</option>
                    </select>
                    <input
                        type="text"
                        placeholder="输入搜索关键词..."
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        className="bg-transparent outline-none text-sm flex-1"
                    />
                </div>

                <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2 border border-slate-200 ml-auto">
                    <Filter size={16} className="text-slate-400 mr-2" />
                    <select
                        className="bg-transparent text-sm text-slate-700 outline-none cursor-pointer"
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="all">所有状态</option>
                        <option value="ongoing">进行中</option>
                        <option value="upcoming">未开始</option>
                        <option value="finished">已结束</option>
                    </select>
                </div>

                <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2 border border-slate-200 ml-2" title="筛选在此日期进行中的项目">
                    <Calendar size={18} className="text-slate-400 mr-2" />
                    <input
                        type="date"
                        className="bg-transparent text-sm text-slate-700 outline-none cursor-pointer"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />
                    {filterDate && <button onClick={() => setFilterDate('')} className="ml-2 text-xs text-blue-600 hover:underline">重置</button>}
                </div>
            </div>

            {/* 卡片网格 */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredProjects.map(project => {
                        const status = getProjectStatus(project.startDate, project.endDate);
                        return (
                            <div key={project.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all flex flex-col">
                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="overflow-hidden">
                                            <div className="text-xs font-mono text-slate-400 mb-1 flex items-center gap-1">
                                                <Hash size={10} /> {project.code || "无编号"}
                                            </div>
                                            <h3 className="font-bold text-slate-800 text-lg truncate pr-2" title={project.name}>{project.name}</h3>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full border ${status.color} shrink-0`}>{status.label}</span>
                                    </div>
                                    <div className="text-sm text-slate-500 space-y-1 mb-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} /> 
                                            {new Date(project.startDate).toLocaleDateString()} ~ {new Date(project.endDate).toLocaleDateString()}
                                        </div>
                                        <div>地点: {project.location}</div>
                                        <div className="text-xs text-slate-400 mt-1">供应商: {project.supplierName}</div>
                                    </div>
                                </div>
                                <div className="border-t border-slate-100 p-3 bg-slate-50/50 rounded-b-xl flex justify-between items-center">
                                    <button onClick={() => onOpenDetail(project)} className="text-slate-600 hover:text-blue-600 text-sm flex items-center gap-1 font-medium transition-colors">
                                        <Eye size={16} /> 查看详情
                                    </button>
                                    <div className="flex gap-2">
                                        {status.value === 'finished' && hasPerm('adjust_schedule') && (
                                            <button onClick={() => onAdjustDate(project)} className="text-orange-600 hover:bg-orange-100 p-1.5 rounded transition" title="工期调整">
                                                <Clock size={16} />
                                            </button>
                                        )}
                                        {hasPerm('create_permit') && (
                                            <button onClick={() => onNewPermit(project)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded transition" title="新增关联表单">
                                                <FileText size={16} />
                                            </button>
                                        )}
                                        {hasPerm('delete_project') && (
                                            <button onClick={() => onDeleteProject(project.id, project.name)} className="text-red-600 hover:bg-red-100 p-1.5 rounded transition" title="删除项目">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {filteredProjects.length === 0 && (
                        <div className="col-span-full text-center py-20 text-slate-400 flex flex-col items-center">
                            <Search size={48} className="mb-4 text-slate-200" />
                            <p>未找到匹配的工程项目</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}