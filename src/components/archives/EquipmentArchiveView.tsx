'use client';

import React from 'react';
import { Plus, Settings as SettingsIcon } from 'lucide-react';
import EquipmentCard from './EquipmentCard';
import EquipmentCreateModal from './EquipmentCreateModal';
import { apiFetch } from '@/lib/apiClient';

interface Equipment {
    id: string;
    name: string;
    code: string;
    description?: string;
    startDate: string;
    expectedEndDate?: string;
    isSpecialEquip: boolean;
    inspectionCycle?: number;
    lastInspection?: string;
    nextInspection?: string;
    status: string;
    _count?: { files: number };
}

export default function EquipmentArchiveView() {
    const [equipments, setEquipments] = React.useState<Equipment[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [total, setTotal] = React.useState(0);

    React.useEffect(() => {
        loadEquipments();
    }, [page]);

    const loadEquipments = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/api/archives/equipment?page=${page}&limit=12`);
            const data = await res.json();
            setEquipments(data.data || []);
            setTotalPages(data.meta?.totalPages || 1);
            setTotal(data.meta?.total || 0);
        } catch (e) {
            console.error('加载设备失败', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSuccess = () => {
        setShowCreateModal(false);
        loadEquipments();
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">一机一档</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                    <Plus size={18} />
                    <span>添加设备</span>
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                    加载中...
                </div>
            ) : equipments.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <div className="text-center mb-4">
                        <SettingsIcon size={48} className="mx-auto mb-2 opacity-30" />
                        <p>暂无设备档案</p>
                        <p className="text-xs mt-1">点击"添加设备"按钮创建设备档案</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {equipments.map((equipment) => (
                                <EquipmentCard
                                    key={equipment.id}
                                    equipment={equipment}
                                    onUpdate={loadEquipments}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 分页 */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                            <div className="text-sm text-slate-500">
                                共 {total} 个设备，第 {page} / {totalPages} 页
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    上一页
                                </button>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            <EquipmentCreateModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={handleCreateSuccess}
            />
        </div>
    );
}

