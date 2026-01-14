'use client';

import React from 'react';
import { User } from 'lucide-react';
import PersonnelCard from './PersonnelCard';
import Pagination from './Pagination';
import { apiFetch } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { PermissionManager } from '@/lib/permissions';
import { PermissionDenied } from '@/components/common/PermissionDenied';

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
    const [searchQuery, setSearchQuery] = React.useState('');

    // 权限检查
    const canView = PermissionManager.hasPermission(user, 'archives', 'personnel_view') || 
                    PermissionManager.hasPermission(user, 'archives', 'access');

    // 如果没有查看权限，显示权限不足提示
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

    React.useEffect(() => {
        loadPersonnel();
    }, [page, searchQuery]);

    const loadPersonnel = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '12'
            });
            if (searchQuery) {
                params.append('q', searchQuery);
            }
            const res = await apiFetch(`/api/archives/personnel?${params}`);
            const data = await res.json();
            setPersonnelList(data.data || []);
            setTotalPages(data.meta?.totalPages || 1);
            setTotal(data.meta?.total || 0);
        } catch (e) {
            console.error('加载人员失败', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">一人一档</h2>
                <input
                    type="text"
                    placeholder="搜索姓名或用户名..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                    }}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-64"
                />
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                    加载中...
                </div>
            ) : personnelList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <div className="text-center mb-4">
                        <User size={48} className="mx-auto mb-2 opacity-30" />
                        <p>暂无人员档案</p>
                        <p className="text-xs mt-1">人员档案将从用户数据库自动生成</p>
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
        </div>
    );
}

