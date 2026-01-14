'use client';

import React from 'react';
import { Plus, Settings as SettingsIcon } from 'lucide-react';
import EquipmentCard from './EquipmentCard';
import EquipmentCreateModal from './EquipmentCreateModal';
import Pagination from './Pagination';
import { apiFetch } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { PermissionManager } from '@/lib/permissions';
import { PermissionDenied } from '@/components/common/PermissionDenied';

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
    const { user } = useAuth();
    const [equipments, setEquipments] = React.useState<Equipment[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [total, setTotal] = React.useState(0);
    const [searchQuery, setSearchQuery] = React.useState('');

    // 权限检查
    const canView = PermissionManager.hasPermission(user, 'archives', 'equipment_view') || 
                    PermissionManager.hasPermission(user, 'archives', 'access');
    const canCreate = PermissionManager.hasPermission(user, 'archives', 'equipment_create');
    const canUpload = PermissionManager.hasPermission(user, 'archives', 'equipment_upload');
    const canDelete = PermissionManager.hasPermission(user, 'archives', 'equipment_delete');
    const canEdit = PermissionManager.hasPermission(user, 'archives', 'equipment_edit');

    // 如果没有查看权限，显示权限不足提示
    if (!canView) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <PermissionDenied 
                    action="查看一机一档库"
                    requiredPermission="archives.equipment_view"
                />
            </div>
        );
    }

    React.useEffect(() => {
        loadEquipments();
    }, [page, searchQuery]);

    const loadEquipments = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '12'
            });
            if (searchQuery) {
                params.append('q', searchQuery);
            }
            const res = await apiFetch(`/api/archives/equipment?${params}`);
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
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="搜索设备名称、编号或描述..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-64"
                    />
                    {canCreate && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                        >
                            <Plus size={18} />
                            <span>添加设备</span>
                        </button>
                    )}
                </div>
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
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        total={total}
                        onPageChange={setPage}
                        itemName="设备"
                    />
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

