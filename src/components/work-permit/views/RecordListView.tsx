import { useState } from 'react';
import { Search, Filter, Calendar, List } from 'lucide-react';
import { PermitRecord } from '@/types/work-permit';

interface Props {
    records: PermitRecord[];
    hasPerm: (perm: string) => boolean;
    onViewRecord: (r: PermitRecord) => void;
    onDeleteRecord: (id: string) => void;
    currentPage?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
    filters: { project: string; type: string; date: string };
    onFilterChange: (newFilters: any) => void;
    totalCount?: number;
}

export default function RecordListView({
    records, hasPerm, onViewRecord, onDeleteRecord,
    currentPage = 1, totalPages = 1, onPageChange,
    filters, onFilterChange, totalCount
}: Props) {
    // 静态类型列表 (可扩展)
    const staticTypes = ['动火', '高处', '受限空间', '吊装', '临时用电', '其他'];

    return (
        <>
            {/* 顶部筛选栏 */}
            <div className="bg-white border-b border-slate-200 p-4 flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2 text-slate-500 font-bold mr-4">
                    <List size={20} /> 所有作业记录
                </div>
                <div className="flex gap-3 text-sm flex-1 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2 flex-1 max-w-xs focus-within:border-blue-300 transition">
                        <Search size={16} className="text-slate-400" />
                        <input
                            className="bg-transparent outline-none w-full"
                            placeholder="搜索项目名称..."
                            value={filters.project}
                            onChange={e => onFilterChange({ ...filters, project: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2">
                        <Filter size={16} className="text-slate-400" />
                        <select
                            className="bg-transparent outline-none text-slate-600 cursor-pointer min-w-[100px]"
                            value={filters.type}
                            onChange={e => onFilterChange({ ...filters, type: e.target.value })}
                        >
                            <option value="">所有类型</option>
                            {staticTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2">
                        <Calendar size={16} className="text-slate-400" />
                        <input
                            type="date"
                            className="bg-transparent outline-none text-slate-600 cursor-pointer"
                            value={filters.date}
                            onChange={e => onFilterChange({ ...filters, date: e.target.value })}
                        />
                    </div>
                    {(filters.project || filters.type || filters.date) && (
                        <button
                            onClick={() => onFilterChange({ project: '', type: '', date: '' })}
                            className="text-blue-600 hover:underline px-2"
                        >
                            重置
                        </button>
                    )}
                </div>
                <div className="text-xs text-slate-400">共 {totalCount || records.length} 条记录</div>
            </div>

            {/* 列表表格 */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b font-bold text-slate-600">
                            <tr>
                                <th className="p-4 w-32">项目编号</th>
                                <th className="p-4">项目名称</th>
                                <th className="p-4">表单名称</th>
                                <th className="p-4">类型</th>
                                <th className="p-4">提交时间</th>
                                <th className="p-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length === 0 ? (
                                <tr><td colSpan={6} className="p-10 text-center text-slate-400">暂无符合条件的记录</td></tr>
                            ) : (
                                records.map(r => (
                                    <tr key={r.id} className="border-b hover:bg-slate-50 transition">
                                        <td className="p-4 font-mono text-slate-500 text-xs">{r.project?.code || "-"}</td>
                                        <td className="p-4 font-medium text-slate-800">{r.project?.name || "未知项目"}</td>
                                        <td className="p-4 text-slate-600">{r.template.name}</td>
                                        <td className="p-4">
                                            <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs border border-blue-100">{r.template.type}</span>
                                        </td>
                                        <td className="p-4 text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
                                        <td className="p-4 text-right flex justify-end gap-3">
                                            <button onClick={() => onViewRecord(r)} className="text-blue-600 font-bold hover:underline">查看</button>
                                            {hasPerm('delete_permit') && (
                                                <button onClick={() => onDeleteRecord(r.id)} className="text-red-600 hover:underline">删除</button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Pagination Controls */}
            {onPageChange && totalPages > 1 && (
                <div className="bg-white border-t border-slate-200 p-3 flex justify-center items-center gap-4">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50 text-sm"
                    >
                        上一页
                    </button>
                    <span className="text-sm text-slate-600">第 {currentPage} 页 / 共 {totalPages} 页</span>
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50 text-sm"
                    >
                        下一页
                    </button>
                </div>
            )}
        </>
    );
}