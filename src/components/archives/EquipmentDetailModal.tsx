'use client';

import React from 'react';
import { X, Plus, Calendar, Settings, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import ArchiveFileCard from './ArchiveFileCard';
import FileUploadModal from './FileUploadModal';
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
}

interface ArchiveFile {
    id: string;
    name: string;
    fileType: string;
    isDynamic: boolean;
    description?: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    uploaderName?: string;
    createdAt: string;
    accessUrl?: string;
}

interface EquipmentDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    equipmentId: string;
    onUpdate?: () => void;
}

export default function EquipmentDetailModal({ isOpen, onClose, equipmentId, onUpdate }: EquipmentDetailModalProps) {
    const [equipment, setEquipment] = React.useState<Equipment | null>(null);
    const [files, setFiles] = React.useState<ArchiveFile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showUploadModal, setShowUploadModal] = React.useState(false);
    const [fileTypes, setFileTypes] = React.useState<string[]>([]);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);

    React.useEffect(() => {
        if (isOpen && equipmentId) {
            loadEquipment();
            loadFiles();
            loadConfig();
        }
    }, [isOpen, equipmentId, page]);

    const loadConfig = async () => {
        try {
            const res = await apiFetch('/api/archives/config');
            const config = await res.json();
            setFileTypes(config.equipment_types || []);
        } catch (e) {
            console.error('加载配置失败', e);
        }
    };

    const loadEquipment = async () => {
        try {
            const res = await apiFetch(`/api/archives/equipment`);
            const data = await res.json();
            const found = data.data?.find((eq: Equipment) => eq.id === equipmentId);
            setEquipment(found || null);
        } catch (e) {
            console.error('加载设备失败', e);
        }
    };

    const loadFiles = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/api/archives/equipment/${equipmentId}/files?page=${page}&limit=12`);
            const data = await res.json();
            setFiles(data.data || []);
            setTotalPages(data.meta?.totalPages || 1);
        } catch (e) {
            console.error('加载文件失败', e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (formData: FormData) => {
        try {
            const res = await apiFetch(`/api/archives/equipment/${equipmentId}/files`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                await loadFiles();
                setShowUploadModal(false);
                onUpdate?.();
            } else {
                const error = await res.json();
                alert(error.error || '上传失败');
            }
        } catch (e) {
            console.error('上传失败', e);
            alert('上传失败，请重试');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await apiFetch(`/api/archives/files/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                await loadFiles();
            } else {
                alert('删除失败');
            }
        } catch (e) {
            console.error('删除失败', e);
            alert('删除失败');
        }
    };

    if (!isOpen || !equipment) return null;

    const isInspectionDue = equipment.nextInspection && new Date(equipment.nextInspection) <= new Date();

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-50 rounded-lg">
                                <Settings size={24} className="text-orange-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">{equipment.name}</h2>
                                <p className="text-xs text-slate-500">编号: {equipment.code}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-4 overflow-y-auto flex-1">
                        {/* 设备基本信息 */}
                        <div className="bg-slate-50 rounded-lg p-4 mb-4">
                            <h3 className="font-semibold text-slate-900 mb-3">设备基本信息</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-slate-500">设备名称:</span>
                                    <span className="ml-2 text-slate-900">{equipment.name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">设备编号:</span>
                                    <span className="ml-2 text-slate-900">{equipment.code}</span>
                                </div>
                                {equipment.description && (
                                    <div className="col-span-2">
                                        <span className="text-slate-500">设备描述:</span>
                                        <span className="ml-2 text-slate-900">{equipment.description}</span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-slate-500">启用时间:</span>
                                    <span className="ml-2 text-slate-900">
                                        {format(new Date(equipment.startDate), 'yyyy-MM-dd')}
                                    </span>
                                </div>
                                {equipment.expectedEndDate && (
                                    <div>
                                        <span className="text-slate-500">预计报废时间:</span>
                                        <span className="ml-2 text-slate-900">
                                            {format(new Date(equipment.expectedEndDate), 'yyyy-MM-dd')}
                                        </span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-slate-500">是否特种设备:</span>
                                    <span className={`ml-2 ${equipment.isSpecialEquip ? 'text-red-600' : 'text-slate-900'}`}>
                                        {equipment.isSpecialEquip ? '是' : '否'}
                                    </span>
                                </div>
                                {equipment.isSpecialEquip && equipment.inspectionCycle && (
                                    <div>
                                        <span className="text-slate-500">定检周期:</span>
                                        <span className="ml-2 text-slate-900">{equipment.inspectionCycle} 月</span>
                                    </div>
                                )}
                                {equipment.nextInspection && (
                                    <div className={isInspectionDue ? 'col-span-2' : ''}>
                                        <span className="text-slate-500">下次定检时间:</span>
                                        <span className={`ml-2 flex items-center gap-1 ${isInspectionDue ? 'text-orange-600 font-medium' : 'text-slate-900'}`}>
                                            {format(new Date(equipment.nextInspection), 'yyyy-MM-dd')}
                                            {isInspectionDue && <AlertCircle size={14} />}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 档案文件 */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-900">档案文件 ({files.length})</h3>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                            >
                                <Plus size={16} />
                                <span>上传文件</span>
                            </button>
                        </div>

                        {loading ? (
                            <div className="text-center py-8 text-slate-400">加载中...</div>
                        ) : files.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <p>暂无档案文件</p>
                                <p className="text-xs mt-1">点击"上传文件"按钮添加档案</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {files.map((file) => (
                                    <ArchiveFileCard
                                        key={file.id}
                                        file={file}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        )}

                        {/* 分页 */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-200">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    上一页
                                </button>
                                <span className="text-sm text-slate-500">第 {page} / {totalPages} 页</span>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    下一页
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <FileUploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onUpload={handleUpload}
                fileTypes={fileTypes}
                title="上传设备档案文件"
            />
        </>
    );
}

