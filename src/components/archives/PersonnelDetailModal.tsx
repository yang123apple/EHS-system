'use client';

import React from 'react';
import { X, Plus, User, Pencil, Save, XCircle } from 'lucide-react';
import ArchiveFileCard from './ArchiveFileCard';
import FileUploadModal from './FileUploadModal';
import FileEditModal from './FileEditModal';
import dynamic from 'next/dynamic';
const SecurePDFViewer = dynamic(() => import('./SecurePDFViewer'), { ssr: false });
import PeopleSelector, { type SelectorMode } from '@/components/common/PeopleSelector';
import { apiFetch } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { PermissionManager } from '@/lib/permissions';
import { useToast } from '@/components/common/Toast';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

interface Personnel {
    id: string;
    username: string;
    name: string;
    avatar?: string;
    jobTitle?: string;
    department: string;
    departmentId?: string | null;
    isActive?: boolean;
}

interface HealthRecord {
    hazardFactors?: string | null;
    requirePeriodicExam: boolean;
    lastExamDate?: string | null;
    examCycle?: number | null;
    nextExamDate?: string | null;
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

interface EditForm {
    jobTitle: string;
    departmentId: string;
    departmentName: string;
    isActive: boolean;
    hazardFactors: string;
    requirePeriodicExam: boolean;
    lastExamDate: string;
    examCycle: number;
}

interface OrgNode {
    id: string;
    name: string;
    parentId: string | null;
    children?: OrgNode[];
}

interface PersonnelDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    personnelId: string;
}

export default function PersonnelDetailModal({ isOpen, onClose, personnelId }: PersonnelDetailModalProps) {
    const { user } = useAuth();
    const toast = useToast();
    const [personnel, setPersonnel] = React.useState<Personnel | null>(null);
    const [healthRecord, setHealthRecord] = React.useState<HealthRecord | null>(null);
    const [files, setFiles] = React.useState<ArchiveFile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showUploadModal, setShowUploadModal] = React.useState(false);
    const [showEditModal, setShowEditModal] = React.useState(false);
    const [editingFile, setEditingFile] = React.useState<ArchiveFile | null>(null);
    const [fileTypes, setFileTypes] = React.useState<string[]>([]);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [pdfViewerOpen, setPdfViewerOpen] = React.useState(false);
    const [pdfFile, setPdfFile] = React.useState<ArchiveFile | null>(null);

    // 编辑模式
    const [isEditing, setIsEditing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [editForm, setEditForm] = React.useState<EditForm>({
        jobTitle: '',
        departmentId: '',
        departmentName: '',
        isActive: true,
        hazardFactors: '',
        requirePeriodicExam: false,
        lastExamDate: '',
        examCycle: 1,
    });
    const [showDeptSelector, setShowDeptSelector] = React.useState(false);

    // 权限检查
    const canUpload = PermissionManager.hasPermission(user, 'archives', 'personnel_upload');
    const canDelete = PermissionManager.hasPermission(user, 'archives', 'personnel_delete');

    // 自动计算下次体检日期
    // dayjs.utc() 直接解析 YYYY-MM-DD 为 UTC 00:00，避免本地时区偏移
    // .add(N, 'year') 内部已处理闰年：Feb 29 → Feb 28，不溢出到 Mar 1
    const computedNextExamDate = React.useMemo(() => {
        if (editForm.lastExamDate && editForm.examCycle) {
            return dayjs.utc(editForm.lastExamDate).add(Number(editForm.examCycle), 'year').format('YYYY-MM-DD');
        }
        return '';
    }, [editForm.lastExamDate, editForm.examCycle]);

    React.useEffect(() => {
        if (isOpen && personnelId) {
            loadData();
            loadConfig();
        }
        // 关闭时重置编辑状态
        if (!isOpen) {
            setIsEditing(false);
        }
    }, [isOpen, personnelId, page]);

    React.useEffect(() => {
        if (showUploadModal) {
            loadConfig();
        }
    }, [showUploadModal]);

    const loadConfig = async () => {
        try {
            const res = await apiFetch('/api/archives/config');
            const config = await res.json();
            setFileTypes(config.personnel_types || []);
        } catch (e) {
            console.error('加载配置失败', e);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/api/archives/personnel/${personnelId}/files?page=${page}&limit=12`);
            const data = await res.json();
            setPersonnel(data.user || null);
            setHealthRecord(data.healthRecord || null);
            setFiles(data.data || []);
            setTotalPages(data.meta?.totalPages || 1);
        } catch (e) {
            console.error('加载人员信息失败', e);
        } finally {
            setLoading(false);
        }
    };

    const handleEditStart = () => {
        if (!personnel) return;
        setEditForm({
            jobTitle: personnel.jobTitle || '',
            departmentId: personnel.departmentId || '',
            departmentName: personnel.department || '',
            isActive: personnel.isActive !== false,
            hazardFactors: healthRecord?.hazardFactors ?? '',
            requirePeriodicExam: healthRecord?.requirePeriodicExam ?? false,
            lastExamDate: healthRecord?.lastExamDate
                ? dayjs.utc(healthRecord?.lastExamDate).format('YYYY-MM-DD')
                : '',
            examCycle: healthRecord?.examCycle ?? 1,
        });
        setIsEditing(true);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
    };

    const handleSave = async () => {
        if (!personnel) return;
        setSaving(true);
        try {
            const res = await apiFetch(`/api/archives/personnel/${personnelId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobTitle: editForm.jobTitle,
                    departmentId: editForm.departmentId || null,
                    isActive: editForm.isActive,
                    hazardFactors: editForm.hazardFactors,
                    requirePeriodicExam: editForm.requirePeriodicExam,
                    // 幽灵数据防护：切回"否"时三个字段必须显式置 null，不能依赖隐藏来屏蔽
                    lastExamDate: editForm.requirePeriodicExam ? (editForm.lastExamDate || null) : null,
                    examCycle: editForm.requirePeriodicExam ? editForm.examCycle : null,
                    nextExamDate: editForm.requirePeriodicExam ? computedNextExamDate || null : null,
                })
            });
            if (res.ok) {
                const result = await res.json();
                if (result.user) {
                    setPersonnel(result.user);
                }
                // 重新加载所有数据
                await loadData();
                setIsEditing(false);
                toast.success('保存成功');
            } else {
                const err = await res.json();
                toast.error('保存失败', err.error || '请稍后重试');
            }
        } catch (e) {
            console.error('保存失败', e);
            toast.error('系统拥挤，保存失败', '请稍后重试');
        } finally {
            setSaving(false);
        }
    };

    const handleDeptSelect = (result: unknown[]) => {
        const depts = result as OrgNode[];
        if (depts.length > 0) {
            setEditForm(prev => ({
                ...prev,
                departmentId: depts[0].id,
                departmentName: depts[0].name,
            }));
        }
        setShowDeptSelector(false);
    };

    const handleUpload = async (formData: FormData) => {
        try {
            const res = await apiFetch(`/api/archives/personnel/${personnelId}/files`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                await loadData();
                setShowUploadModal(false);
            } else {
                const error = await res.json();
                toast.error('上传失败', error.error || '请稍后重试');
            }
        } catch (e) {
            console.error('上传失败', e);
            toast.error('上传失败，请重试');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await apiFetch(`/api/archives/files/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                await loadData();
            } else {
                toast.error('删除失败，请重试');
            }
        } catch (e) {
            console.error('删除失败', e);
            toast.error('删除失败，请重试');
        }
    };

    const handleEdit = (file: ArchiveFile) => {
        setEditingFile(file);
        setShowEditModal(true);
    };

    const handleEditSuccess = async () => {
        await loadData();
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

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '—';
        return dayjs.utc(dateStr).format('YYYY-MM-DD');
    };

    if (!isOpen || !personnel) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    {/* 顶部标题栏 */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                                personnel.isActive !== false
                                    ? 'bg-green-50'
                                    : 'bg-slate-100'
                            }`}>
                                {personnel.avatar ? (
                                    <img
                                        src={personnel.avatar}
                                        alt={personnel.name}
                                        className={`w-10 h-10 rounded-full object-cover ${
                                            personnel.isActive === false
                                                ? 'grayscale opacity-60'
                                                : ''
                                        }`}
                                    />
                                ) : (
                                    <User
                                        size={24}
                                        className={
                                            personnel.isActive !== false
                                                ? 'text-green-600'
                                                : 'text-slate-400'
                                        }
                                    />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-slate-900">{personnel.name}</h2>
                                    {personnel.isActive === false && (
                                        <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-600 rounded-full">
                                            离职
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">{personnel.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {user?.role === 'admin' && !isEditing && (
                                <button
                                    onClick={handleEditStart}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <Pencil size={14} />
                                    修改
                                </button>
                            )}
                            {isEditing && (
                                <>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                    >
                                        <Save size={14} />
                                        {saving ? '保存中...' : '保存'}
                                    </button>
                                    <button
                                        onClick={handleEditCancel}
                                        disabled={saving}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                                    >
                                        <XCircle size={14} />
                                        取消
                                    </button>
                                </>
                            )}
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
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
                                {/* 职位 */}
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500">职位:</span>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editForm.jobTitle}
                                            onChange={e => setEditForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                                            placeholder="请输入职位"
                                            className="ml-1 flex-1 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <span className="ml-2 text-slate-900">{personnel.jobTitle || '—'}</span>
                                    )}
                                </div>
                                {/* 部门 */}
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500 shrink-0">部门:</span>
                                    {isEditing ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowDeptSelector(true)}
                                            className="ml-1 flex-1 px-2 py-1 text-sm border border-slate-300 rounded-md text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
                                        >
                                            {editForm.departmentName || <span className="text-slate-400">点击选择部门</span>}
                                        </button>
                                    ) : (
                                        <span className="ml-2 text-slate-900">{personnel.department}</span>
                                    )}
                                </div>
                                {/* 在职状态 */}
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500">在职状态:</span>
                                    {isEditing ? (
                                        <select
                                            value={editForm.isActive ? 'true' : 'false'}
                                            onChange={e => setEditForm(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
                                            className="ml-1 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="true">在职</option>
                                            <option value="false">离职</option>
                                        </select>
                                    ) : (
                                        <span className={`ml-2 font-medium ${
                                            personnel.isActive !== false
                                                ? 'text-green-600'
                                                : 'text-slate-500'
                                        }`}>
                                            {personnel.isActive !== false ? '在职' : '离职'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 职业健康信息 */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                            <h3 className="font-semibold text-slate-900 mb-3">职业健康信息</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {/* 危险有害因素 */}
                                <div className="col-span-2 flex items-start gap-2">
                                    <span className="text-slate-500 shrink-0 mt-1">危险有害因素:</span>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editForm.hazardFactors}
                                            onChange={e => setEditForm(prev => ({ ...prev, hazardFactors: e.target.value }))}
                                            placeholder="请输入涉及的危险有害因素"
                                            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <span className="text-slate-900">{healthRecord?.hazardFactors || '—'}</span>
                                    )}
                                </div>

                                {/* 是否需要定期职业健康体检 */}
                                <div className="col-span-2 flex items-center gap-2">
                                    <span className="text-slate-500 shrink-0">是否需要定期职业健康体检:</span>
                                    {isEditing ? (
                                        <select
                                            value={editForm.requirePeriodicExam ? 'true' : 'false'}
                                            onChange={e => setEditForm(prev => ({
                                                ...prev,
                                                requirePeriodicExam: e.target.value === 'true'
                                            }))}
                                            className="px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="false">否</option>
                                            <option value="true">是</option>
                                        </select>
                                    ) : (
                                        <span className={`font-medium ${healthRecord?.requirePeriodicExam ? 'text-blue-600' : 'text-slate-500'}`}>
                                            {healthRecord?.requirePeriodicExam ? '是' : '否'}
                                        </span>
                                    )}
                                </div>

                                {/* 以下字段仅在"需要体检"时显示 */}
                                {(isEditing ? editForm.requirePeriodicExam : healthRecord?.requirePeriodicExam) && (
                                    <>
                                        {/* 上次职业健康体检时间 */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 shrink-0">上次体检时间:</span>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={editForm.lastExamDate}
                                                    onChange={e => setEditForm(prev => ({ ...prev, lastExamDate: e.target.value }))}
                                                    className="px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            ) : (
                                                <span className="text-slate-900">{formatDate(healthRecord?.lastExamDate)}</span>
                                            )}
                                        </div>

                                        {/* 职业健康体检周期 */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 shrink-0">体检周期:</span>
                                            {isEditing ? (
                                                <select
                                                    value={editForm.examCycle}
                                                    onChange={e => setEditForm(prev => ({ ...prev, examCycle: Number(e.target.value) }))}
                                                    className="px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value={1}>1年</option>
                                                    <option value={2}>2年</option>
                                                    <option value={3}>3年</option>
                                                </select>
                                            ) : (
                                                <span className="text-slate-900">
                                                    {healthRecord?.examCycle ? `${healthRecord?.examCycle}年` : '—'}
                                                </span>
                                            )}
                                        </div>

                                        {/* 下次职业健康体检日期（自动生成） */}
                                        <div className="col-span-2 flex items-center gap-2">
                                            <span className="text-slate-500 shrink-0">下次体检日期:</span>
                                            {isEditing ? (
                                                <span className={`px-2 py-1 text-sm rounded-md ${
                                                    computedNextExamDate
                                                        ? 'bg-white border border-slate-200 text-slate-900'
                                                        : 'text-slate-400'
                                                }`}>
                                                    {computedNextExamDate || '请先填写上次体检时间和体检周期'}
                                                </span>
                                            ) : (
                                                <span className={`font-medium ${
                                                    healthRecord?.nextExamDate ? 'text-blue-700' : 'text-slate-400'
                                                }`}>
                                                    {formatDate(healthRecord?.nextExamDate)}
                                                </span>
                                            )}
                                            {isEditing && computedNextExamDate && (
                                                <span className="text-xs text-slate-400">（自动计算）</span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 档案文件 */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-900">档案文件 ({files.length})</h3>
                            {canUpload && (
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                                >
                                    <Plus size={16} />
                                    <span>上传文件</span>
                                </button>
                            )}
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
                                        onDelete={canDelete ? handleDelete : undefined}
                                        onPreview={handlePreview}
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

            {/* 部门选择器 */}
            <PeopleSelector
                isOpen={showDeptSelector}
                onClose={() => setShowDeptSelector(false)}
                onConfirm={handleDeptSelect}
                mode={'dept' as SelectorMode}
                multiSelect={false}
                title="选择部门"
            />

            <FileUploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onUpload={handleUpload}
                fileTypes={fileTypes}
                title="上传人员档案文件"
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
                title="编辑人员档案文件"
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
        </>
    );
}
