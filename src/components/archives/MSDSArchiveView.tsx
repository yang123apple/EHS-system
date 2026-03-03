'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import ArchiveFileCard from './ArchiveFileCard';
import FileUploadModal from './FileUploadModal';
import FileEditModal from './FileEditModal';
import dynamic from 'next/dynamic';
const SecurePDFViewer = dynamic(() => import('./SecurePDFViewer'), { ssr: false });
import Pagination from './Pagination';
import { apiFetch } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { PermissionManager } from '@/lib/permissions';
import { PermissionDenied } from '@/components/common/PermissionDenied';

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

export default function MSDSArchiveView() {
    const { user } = useAuth();
    const [files, setFiles] = React.useState<ArchiveFile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showUploadModal, setShowUploadModal] = React.useState(false);
    const [showEditModal, setShowEditModal] = React.useState(false);
    const [editingFile, setEditingFile] = React.useState<ArchiveFile | null>(null);
    const [fileTypes, setFileTypes] = React.useState<string[]>([]);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [total, setTotal] = React.useState(0);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [fileTypeFilter, setFileTypeFilter] = React.useState('');
    const [pdfViewerOpen, setPdfViewerOpen] = React.useState(false);
    const [pdfFile, setPdfFile] = React.useState<ArchiveFile | null>(null);

    // 权限检查（派生值，非 Hook）
    const canView = PermissionManager.hasPermission(user, 'archives', 'msds_view') ||
                    PermissionManager.hasPermission(user, 'archives', 'access');
    const canUpload = PermissionManager.hasPermission(user, 'archives', 'msds_upload');
    const canDelete = PermissionManager.hasPermission(user, 'archives', 'msds_delete');

    // ── 函数定义（在所有 Hook 调用之前）──

    const loadConfig = React.useCallback(async () => {
        try {
            const res = await apiFetch('/api/archives/config');
            const config = await res.json();
            setFileTypes(config.msds_types || []);
        } catch (e) {
            console.error('加载配置失败', e);
        }
    }, []);

    const loadFiles = React.useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: page.toString(), limit: '12' });
            if (searchQuery) params.append('q', searchQuery);
            if (fileTypeFilter) params.append('fileType', fileTypeFilter);
            const res = await apiFetch(`/api/archives/msds?${params}`, { signal });
            const data = await res.json();
            setFiles(data.data || []);
            setTotalPages(data.meta?.totalPages || 1);
            setTotal(data.meta?.total || 0);
            setLoading(false);
        } catch (e) {
            if ((e as Error).name === 'AbortError') return;
            console.error('加载文件失败', e);
            setLoading(false);
        }
    }, [page, searchQuery, fileTypeFilter]);

    // ── useEffect（全部在条件 return 之前）──

    React.useEffect(() => {
        if (!canView) return;
        const controller = new AbortController();
        loadFiles(controller.signal);
        return () => controller.abort();
    }, [canView, loadFiles]);

    React.useEffect(() => {
        if (!canView) return;
        loadConfig();
    }, [canView, loadConfig]);

    // 当上传弹窗打开时，重新加载文件类型配置，确保获取最新的文件类型库
    React.useEffect(() => {
        if (!canView) return;
        if (showUploadModal) loadConfig();
    }, [canView, showUploadModal, loadConfig]);

    // ── 条件 return（所有 Hook 调用完成后）──

    if (!canView) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <PermissionDenied
                    action="查看MSDS库"
                    requiredPermission="archives.msds_view"
                />
            </div>
        );
    }

    // ── 事件处理函数 ──

    const handleUpload = async (formData: FormData) => {
        try {
            const res = await apiFetch('/api/archives/msds', {
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
            const res = await apiFetch(`/api/archives/files/${id}`, { method: 'DELETE' });
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

    const handleEdit = (file: ArchiveFile) => {
        setEditingFile(file);
        setShowEditModal(true);
    };

    const handleEditSuccess = async () => {
        await loadFiles();
        setShowEditModal(false);
        setEditingFile(null);
    };

    const handlePreview = (file: ArchiveFile) => {
        if (file.mimeType.includes('pdf')) {
            setPdfFile(file);
            setPdfViewerOpen(true);
        } else if (file.accessUrl) {
            window.open(file.accessUrl, '_blank');
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">化学品MSDS库</h2>
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="搜索文件名称或描述..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-64"
                    />
                    <select
                        value={fileTypeFilter}
                        onChange={(e) => {
                            setFileTypeFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700"
                    >
                        <option value="">全部类型</option>
                        {fileTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                    {canUpload && (
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus size={18} />
                            <span>上传文件</span>
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                    加载中...
                </div>
            ) : files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <div className="text-center mb-4">
                        <Plus size={48} className="mx-auto mb-2 opacity-30" />
                        {fileTypeFilter || searchQuery ? (
                            <>
                                <p>暂无符合条件的MSDS文件</p>
                                <p className="text-xs mt-1">请尝试调整筛选条件</p>
                            </>
                        ) : (
                            <>
                                <p>暂无MSDS文件</p>
                                <p className="text-xs mt-1">点击"上传文件"按钮添加MSDS文档</p>
                            </>
                        )}
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
                                    onDelete={canDelete ? handleDelete : undefined}
                                    onPreview={handlePreview}
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
                        itemName="文件"
                    />
                </>
            )}

            <FileUploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onUpload={handleUpload}
                fileTypes={fileTypes}
                title="上传MSDS文件"
            />

            <FileEditModal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingFile(null);
                }}
                file={editingFile}
                fileTypes={fileTypes}
                onSuccess={handleEditSuccess}
                title="编辑MSDS文件"
            />

            <SecurePDFViewer
                isOpen={pdfViewerOpen}
                onClose={() => {
                    setPdfViewerOpen(false);
                    setPdfFile(null);
                }}
                pdfUrl={pdfFile?.accessUrl || ''}
                fileName={pdfFile?.name || 'PDF文档'}
            />
        </div>
    );
}
