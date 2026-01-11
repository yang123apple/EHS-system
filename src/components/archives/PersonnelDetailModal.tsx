'use client';

import React from 'react';
import { X, Plus, User } from 'lucide-react';
import ArchiveFileCard from './ArchiveFileCard';
import FileUploadModal from './FileUploadModal';
import { apiFetch } from '@/lib/apiClient';

interface Personnel {
    id: string;
    username: string;
    name: string;
    avatar?: string;
    jobTitle?: string;
    department: string;
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

interface PersonnelDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    personnelId: string;
}

export default function PersonnelDetailModal({ isOpen, onClose, personnelId }: PersonnelDetailModalProps) {
    const [personnel, setPersonnel] = React.useState<Personnel | null>(null);
    const [files, setFiles] = React.useState<ArchiveFile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showUploadModal, setShowUploadModal] = React.useState(false);
    const [fileTypes, setFileTypes] = React.useState<string[]>([]);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);

    React.useEffect(() => {
        if (isOpen && personnelId) {
            loadPersonnel();
            loadFiles();
            loadConfig();
        }
    }, [isOpen, personnelId, page]);

    const loadConfig = async () => {
        try {
            const res = await apiFetch('/api/archives/config');
            const config = await res.json();
            setFileTypes(config.personnel_types || []);
        } catch (e) {
            console.error('加载配置失败', e);
        }
    };

    const loadPersonnel = async () => {
        try {
            const res = await apiFetch(`/api/archives/personnel/${personnelId}/files`);
            const data = await res.json();
            setPersonnel(data.user || null);
        } catch (e) {
            console.error('加载人员信息失败', e);
        }
    };

    const loadFiles = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/api/archives/personnel/${personnelId}/files?page=${page}&limit=12`);
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
            const res = await apiFetch(`/api/archives/personnel/${personnelId}/files`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                await loadFiles();
                setShowUploadModal(false);
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

    if (!isOpen || !personnel) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-lg">
                                {personnel.avatar ? (
                                    <img
                                        src={personnel.avatar}
                                        alt={personnel.name}
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <User size={24} className="text-green-600" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">{personnel.name}</h2>
                                <p className="text-xs text-slate-500">{personnel.username}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-4 overflow-y-auto flex-1">
                        {/* 人员基本信息 */}
                        <div className="bg-slate-50 rounded-lg p-4 mb-4">
                            <h3 className="font-semibold text-slate-900 mb-3">人员基本信息</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-slate-500">姓名:</span>
                                    <span className="ml-2 text-slate-900">{personnel.name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">用户名:</span>
                                    <span className="ml-2 text-slate-900">{personnel.username}</span>
                                </div>
                                {personnel.jobTitle && (
                                    <div>
                                        <span className="text-slate-500">职位:</span>
                                        <span className="ml-2 text-slate-900">{personnel.jobTitle}</span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-slate-500">部门:</span>
                                    <span className="ml-2 text-slate-900">{personnel.department}</span>
                                </div>
                            </div>
                        </div>

                        {/* 档案文件 */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-900">档案文件 ({files.length})</h3>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
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
                title="上传人员档案文件"
            />
        </>
    );
}

