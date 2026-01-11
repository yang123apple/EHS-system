'use client';

import React from 'react';
import { X, Upload, FileText, Image, File } from 'lucide-react';

interface FileUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (data: FormData) => Promise<void>;
    fileTypes: string[];
    title?: string;
}

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg'];
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
];

export default function FileUploadModal({ isOpen, onClose, onUpload, fileTypes, title = '上传档案文件' }: FileUploadModalProps) {
    const [file, setFile] = React.useState<File | null>(null);
    const [fileType, setFileType] = React.useState('');
    const [isDynamic, setIsDynamic] = React.useState(false);
    const [description, setDescription] = React.useState('');
    const [uploading, setUploading] = React.useState(false);
    const [dragOver, setDragOver] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isOpen && fileTypes.length > 0) {
            setFileType(fileTypes[0]);
        }
    }, [isOpen, fileTypes]);

    const handleFileSelect = (selectedFile: File) => {
        const ext = selectedFile.name.split('.').pop()?.toLowerCase();
        if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
            alert(`不支持的文件类型。支持：${ALLOWED_EXTENSIONS.join(', ')}`);
            return;
        }
        setFile(selectedFile);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFileSelect(droppedFile);
    };

    const handleSubmit = async () => {
        if (!file || !fileType) {
            alert('请选择文件和文件类型');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileType', fileType);
            formData.append('isDynamic', isDynamic.toString());
            formData.append('description', description);

            await onUpload(formData);

            // 重置表单
            setFile(null);
            setFileType(fileTypes[0] || '');
            setIsDynamic(false);
            setDescription('');
            onClose();
        } catch (e) {
            console.error('上传失败', e);
            alert('上传失败，请重试');
        } finally {
            setUploading(false);
        }
    };

    const getFileIcon = () => {
        if (!file) return <Upload size={40} className="text-slate-300" />;
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') return <FileText size={40} className="text-red-500" />;
        if (['png', 'jpg', 'jpeg'].includes(ext || '')) return <Image size={40} className="text-green-500" />;
        return <File size={40} className="text-blue-500" />;
    };

    if (!isOpen) return null;

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
                    {/* 文件选择区 */}
                    <div
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                            }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept={ALLOWED_MIME_TYPES.join(',')}
                            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                        />
                        <div className="flex flex-col items-center gap-2">
                            {getFileIcon()}
                            {file ? (
                                <div>
                                    <p className="font-medium text-slate-900">{file.name}</p>
                                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-slate-600">点击或拖拽文件到此处</p>
                                    <p className="text-xs text-slate-400 mt-1">支持 PDF、Word、Excel、PNG、JPG</p>
                                </div>
                            )}
                        </div>
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
                        disabled={!file || uploading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
                    >
                        {uploading ? '上传中...' : <><Upload size={14} /> 上传</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
