'use client';

import React from 'react';
import { X, Save } from 'lucide-react';
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

interface FileEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    file: ArchiveFile | null;
    fileTypes: string[];
    onSuccess: () => void;
    title?: string;
}

export default function FileEditModal({ 
    isOpen, 
    onClose, 
    file, 
    fileTypes, 
    onSuccess,
    title = '编辑文件信息'
}: FileEditModalProps) {
    const [fileName, setFileName] = React.useState('');
    const [fileType, setFileType] = React.useState('');
    const [isDynamic, setIsDynamic] = React.useState(false);
    const [description, setDescription] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (isOpen && file) {
            setFileName(file.name);
            setFileType(file.fileType);
            setIsDynamic(file.isDynamic);
            setDescription(file.description || '');
        }
    }, [isOpen, file]);

    const handleSubmit = async () => {
        if (!file || !fileName.trim() || !fileType) {
            alert('请填写完整信息');
            return;
        }

        setSaving(true);
        try {
            const res = await apiFetch(`/api/archives/files/${file.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: fileName.trim(),
                    fileType,
                    isDynamic,
                    description: description.trim()
                })
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                const error = await res.json();
                alert(error.error || '保存失败');
            }
        } catch (e) {
            console.error('保存失败', e);
            alert('保存失败，请重试');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !file) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* 原始文件名（只读） */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">原始文件名</label>
                        <input
                            type="text"
                            value={file.originalName}
                            disabled
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
                        />
                    </div>

                    {/* 文件名编辑 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            文件名 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            placeholder="输入文件名（不含扩展名）"
                        />
                    </div>

                    {/* 文件类型选择 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">文件类型</label>
                        <select
                            value={fileType}
                            onChange={(e) => setFileType(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        >
                            {fileTypes.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {/* 静态/动态选择 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">资料性质</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={!isDynamic}
                                    onChange={() => setIsDynamic(false)}
                                    className="text-blue-600"
                                />
                                <span className="text-sm">静态资料</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={isDynamic}
                                    onChange={() => setIsDynamic(true)}
                                    className="text-blue-600"
                                />
                                <span className="text-sm">动态资料</span>
                            </label>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">静态资料一般不需要更新，动态资料需要定期更新</p>
                    </div>

                    {/* 描述 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">文件描述</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                            rows={2}
                            placeholder="可选，简要描述文件内容..."
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !fileName.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
                    >
                        {saving ? '保存中...' : <><Save size={14} /> 保存</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

