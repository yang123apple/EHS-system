'use client';

import React from 'react';
import { FileText, Download, Trash2, Eye, Clock, User } from 'lucide-react';
import { format } from 'date-fns';

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

interface ArchiveFileCardProps {
    file: ArchiveFile;
    onDelete?: (id: string) => void;
    onPreview?: (file: ArchiveFile) => void;
}

export default function ArchiveFileCard({ file, onDelete, onPreview }: ArchiveFileCardProps) {
    const getFileIcon = () => {
        if (file.mimeType.includes('pdf')) return <FileText size={32} className="text-red-500" />;
        if (file.mimeType.includes('word')) return <FileText size={32} className="text-blue-500" />;
        if (file.mimeType.includes('sheet') || file.mimeType.includes('excel')) return <FileText size={32} className="text-green-500" />;
        if (file.mimeType.includes('image')) return <FileText size={32} className="text-purple-500" />;
        return <FileText size={32} className="text-slate-400" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    };

    const handleDownload = () => {
        if (file.accessUrl) {
            window.open(file.accessUrl, '_blank');
        }
    };

    const handlePreview = () => {
        if (onPreview) {
            onPreview(file);
        } else if (file.accessUrl) {
            window.open(file.accessUrl, '_blank');
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow group">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-lg shrink-0">
                    {getFileIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-900 truncate" title={file.name}>
                        {file.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                            {file.fileType}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${file.isDynamic ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                            {file.isDynamic ? '动态' : '静态'}
                        </span>
                    </div>
                    {file.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{file.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {format(new Date(file.createdAt), 'yyyy-MM-dd')}
                        </span>
                        {file.uploaderName && (
                            <span className="flex items-center gap-1">
                                <User size={12} />
                                {file.uploaderName}
                            </span>
                        )}
                        <span>{formatFileSize(file.fileSize)}</span>
                    </div>
                </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={handlePreview}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600"
                    title="预览"
                >
                    <Eye size={16} />
                </button>
                <button
                    onClick={handleDownload}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-green-600"
                    title="下载"
                >
                    <Download size={16} />
                </button>
                {onDelete && (
                    <button
                        onClick={() => {
                            if (confirm('确定删除此文件？')) {
                                onDelete(file.id);
                            }
                        }}
                        className="p-2 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600"
                        title="删除"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}
