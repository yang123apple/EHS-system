'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import ArchiveFileCard from './ArchiveFileCard';
import FileUploadModal from './FileUploadModal';
import { apiFetch } from '@/lib/apiClient';

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

export default function EnterpriseArchiveView() {
    const [files, setFiles] = React.useState<ArchiveFile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showUploadModal, setShowUploadModal] = React.useState(false);
    const [fileTypes, setFileTypes] = React.useState<string[]>([]);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [total, setTotal] = React.useState(0);

    React.useEffect(() => {
        loadConfig();
        loadFiles();
    }, [page]);

    const loadConfig = async () => {
        try {
            const res = await apiFetch('/api/archives/config');
            const config = await res.json();
            setFileTypes(config.enterprise_types || []);
        } catch (e) {
            console.error('加载配置失败', e);
        }
    };

    const loadFiles = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/api/archives/enterprise?page=${page}&limit=12`);
            const data = await res.json();
            setFiles(data.data || []);
            setTotalPages(data.meta?.totalPages || 1);
            setTotal(data.meta?.total || 0);
        } catch (e) {
            console.error('加载文件失败', e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (formData: FormData) => {
        try {
            const res = await apiFetch('/api/archives/enterprise', {
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

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">一企一档</h2>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={18} />
                    <span>上传文件</span>
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                    加载中...
                </div>
            ) : files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <div className="text-center mb-4">
                        <Plus size={48} className="mx-auto mb-2 opacity-30" />
                        <p>暂无档案文件</p>
                        <p className="text-xs mt-1">点击"上传文件"按钮添加档案</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {files.map((file) => (
                                <ArchiveFileCard
                                    key={file.id}
                                    file={file}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 分页 */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                            <div className="text-sm text-slate-500">
                                共 {total} 个文件，第 {page} / {totalPages} 页
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

            <FileUploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onUpload={handleUpload}
                fileTypes={fileTypes}
                title="上传企业档案文件"
            />
        </div>
    );
}

