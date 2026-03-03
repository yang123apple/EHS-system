'use client';

import React from 'react';
import { User, Search, Filter } from 'lucide-react';
import PersonnelCard from './PersonnelCard';
import Pagination from './Pagination';
import { apiFetch } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { PermissionManager } from '@/lib/permissions';
import { PermissionDenied } from '@/components/common/PermissionDenied';
import PeopleSelector from '@/components/common/PeopleSelector';

interface Personnel {
    id: string;
    username: string;
    name: string;
    avatar?: string;
    jobTitle?: string;
    department: string;
    fileCount: number;
    isActive?: boolean; // 🟢 在职状态
}

export default function PersonnelArchiveView() {
    const { user } = useAuth();
    const [personnelList, setPersonnelList] = React.useState<Personnel[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [total, setTotal] = React.useState(0);
    const [searchInput, setSearchInput] = React.useState('');   // 输入框当前值
    const [deptFilter, setDeptFilter] = React.useState('');     // 部门选择器当前值
    const [fileTypeInput, setFileTypeInput] = React.useState(''); // 文件类型选择器当前值
    const [appliedQuery, setAppliedQuery] = React.useState(''); // 已应用的搜索词
    const [appliedDept, setAppliedDept] = React.useState('');   // 已应用的部门筛选
    const [appliedFileType, setAppliedFileType] = React.useState(''); // 已应用的文件类型筛选
    const [showDeptSelector, setShowDeptSelector] = React.useState(false);
    const [fileTypes, setFileTypes] = React.useState<string[]>([]);

    // 权限检查（派生值，非 Hook）
    const canView = PermissionManager.hasPermission(user, 'archives', 'personnel_view') ||
                    PermissionManager.hasPermission(user, 'archives', 'access');

    // ── 函数定义（在所有 Hook 调用之前）──

    const loadConfig = React.useCallback(async () => {
        try {
            const res = await apiFetch('/api/archives/config');
            const config = await res.json();
            setFileTypes(config.personnel_types || []);
        } catch (e) {
            console.error('加载配置失败', e);
        }
    }, []);

    const loadPersonnel = React.useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: page.toString(), limit: '12' });
            if (appliedQuery) params.append('q', appliedQuery);
            if (appliedDept) params.append('dept', appliedDept);
            if (appliedFileType) params.append('fileType', appliedFileType);
            const res = await apiFetch(`/api/archives/personnel?${params}`, { signal });
            const data = await res.json();
            setPersonnelList(data.data || []);
            setTotalPages(data.meta?.totalPages || 1);
            setTotal(data.meta?.total || 0);
            setLoading(false);
        } catch (e) {
            if ((e as Error).name === 'AbortError') return;
            console.error('加载人员失败', e);
            setLoading(false);
        }
    }, [page, appliedQuery, appliedDept, appliedFileType]);

    // ── useEffect（全部在条件 return 之前）──

    React.useEffect(() => {
        if (!canView) return;
        const controller = new AbortController();
        loadPersonnel(controller.signal);
        return () => controller.abort();
    }, [canView, loadPersonnel]);

    React.useEffect(() => {
        if (!canView) return;
        loadConfig();
    }, [canView, loadConfig]);

    // ── 条件 return（所有 Hook 调用完成后）──

    if (!canView) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <PermissionDenied
                    action="查看一人一档库"
                    requiredPermission="archives.personnel_view"
                />
            </div>
        );
    }

    // ── 事件处理函数 ──

    // 手动触发搜索
    const handleSearch = () => {
        setPage(1);
        setAppliedQuery(searchInput);
        setAppliedDept(deptFilter);
        setAppliedFileType(fileTypeInput);
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">一人一档</h2>
                <div className="flex gap-2">
                    {/* 姓名搜索框 */}
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                        <input
                            type="text"
                            placeholder="搜索姓名或用户名..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-48 outline-none focus:ring-2 focus:ring-hytzer-blue"
                        />
                    </div>
                    {/* 部门筛选按钮 */}
                    <div className="relative w-36">
                        <Filter className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" size={14} />
                        <button
                            type="button"
                            onClick={() => setShowDeptSelector(true)}
                            className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-left flex items-center justify-between hover:bg-slate-50 outline-none"
                        >
                            <span className="truncate text-slate-700">{deptFilter || '所有部门'}</span>
                            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                    {/* 文件类型筛选 */}
                    {fileTypes.length > 0 && (
                        <select
                            value={fileTypeInput}
                            onChange={(e) => setFileTypeInput(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 w-36"
                        >
                            <option value="">全部类型</option>
                            {fileTypes.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    )}
                    {/* 搜索按钮 */}
                    <button
                        type="button"
                        onClick={handleSearch}
                        className="flex items-center gap-1.5 px-4 py-2 bg-hytzer-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shrink-0"
                    >
                        <Search size={14} />
                        搜索
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                    加载中...
                </div>
            ) : personnelList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <div className="text-center mb-4">
                        <User size={48} className="mx-auto mb-2 opacity-30" />
                        {appliedFileType || appliedQuery || appliedDept ? (
                            <>
                                <p>暂无符合条件的人员档案</p>
                                <p className="text-xs mt-1">请尝试调整筛选条件</p>
                            </>
                        ) : (
                            <>
                                <p>暂无人员档案</p>
                                <p className="text-xs mt-1">人员档案将从用户数据库自动生成</p>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {personnelList.map((person) => (
                                <PersonnelCard
                                    key={person.id}
                                    personnel={person}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 分页 */}
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        total={total}
                        onPageChange={setPage}
                        itemName="人员"
                    />
                </>
            )}

            {/* 部门选择弹窗 */}
            <PeopleSelector
                isOpen={showDeptSelector}
                onClose={() => setShowDeptSelector(false)}
                onConfirm={(selection) => {
                    if (Array.isArray(selection) && selection.length > 0) {
                        // @ts-ignore
                        const dept = selection[0];
                        setDeptFilter(dept.name);
                    } else {
                        setDeptFilter('');
                    }
                    setShowDeptSelector(false);
                }}
                mode="dept"
                multiSelect={false}
                title="选择部门"
            />
        </div>
    );
}
