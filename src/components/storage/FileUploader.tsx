/**
 * 文件上传组件
 * 使用 Presigned URL 直接上传到 MinIO，不经过 Next.js 服务器
 */

'use client';

import { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  bucket: 'private' | 'public';
  onUploadSuccess?: (objectName: string, url?: string) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  maxSize?: number; // 最大文件大小（字节）
  prefix?: string; // 文件路径前缀
  multiple?: boolean;
  className?: string;
}

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  objectName?: string;
  url?: string;
}

export default function FileUploader({
  bucket,
  onUploadSuccess,
  onUploadError,
  accept,
  maxSize = 100 * 1024 * 1024, // 默认 100MB
  prefix,
  multiple = false,
  className = '',
}: FileUploaderProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 获取预签名 URL
   */
  const getPresignedUrl = async (file: File): Promise<{ presignedUrl: string; objectName: string }> => {
    const response = await fetch('/api/storage/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket,
        filename: file.name,
        contentType: file.type,
        prefix,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '获取上传链接失败');
    }

    const data = await response.json();
    return {
      presignedUrl: data.data.presignedUrl,
      objectName: data.data.objectName,
    };
  };

  /**
   * 上传文件到 MinIO
   */
  const uploadFile = async (file: File) => {
    // 检查文件大小
    if (file.size > maxSize) {
      const error = `文件大小超过限制 (${(maxSize / 1024 / 1024).toFixed(0)}MB)`;
      setUploads(prev => prev.map(u => 
        u.file === file ? { ...u, status: 'error', error } : u
      ));
      onUploadError?.(error);
      return;
    }

    // 添加到上传列表
    const upload: UploadProgress = {
      file,
      progress: 0,
      status: 'pending',
    };
    setUploads(prev => [...prev, upload]);

    try {
      // 1. 获取预签名 URL
      const { presignedUrl, objectName } = await getPresignedUrl(file);

      // 更新状态为上传中
      setUploads(prev => prev.map(u => 
        u.file === file ? { ...u, status: 'uploading', objectName } : u
      ));

      // 2. 直接 PUT 文件到 MinIO
      const xhr = new XMLHttpRequest();

      // 监听上传进度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploads(prev => prev.map(u => 
            u.file === file ? { ...u, progress } : u
          ));
        }
      });

      // 上传完成
      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 204) {
            const url = bucket === 'public' 
              ? `${presignedUrl.split('?')[0]}` // 公开文件直接使用 URL
              : undefined;
            
            setUploads(prev => prev.map(u => 
              u.file === file 
                ? { ...u, status: 'success', progress: 100, url } 
                : u
            ));
            
            onUploadSuccess?.(objectName, url);
            resolve();
          } else {
            reject(new Error(`上传失败: HTTP ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('网络错误'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('上传已取消'));
        });
      });

      // 开始上传
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);

      await uploadPromise;
    } catch (error: any) {
      const errorMessage = error.message || '上传失败';
      setUploads(prev => prev.map(u => 
        u.file === file ? { ...u, status: 'error', error: errorMessage } : u
      ));
      onUploadError?.(errorMessage);
    }
  };

  /**
   * 处理文件选择
   */
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    fileArray.forEach(file => uploadFile(file));
  };

  /**
   * 处理拖拽
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  /**
   * 移除上传项
   */
  const removeUpload = (file: File) => {
    setUploads(prev => prev.filter(u => u.file !== file));
  };

  /**
   * 格式化文件大小
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={className}>
      {/* 上传区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-2">
          拖拽文件到此处或{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            点击选择文件
          </button>
        </p>
        <p className="text-sm text-gray-500">
          最大文件大小: {formatFileSize(maxSize)}
        </p>
      </div>

      {/* 上传列表 */}
      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploads.map((upload, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {upload.file.name}
                  </span>
                  {upload.status === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                  {upload.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  {upload.status === 'uploading' && (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                  )}
                </div>
                
                {upload.status === 'uploading' && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}
                
                {upload.status === 'error' && (
                  <p className="text-sm text-red-600">{upload.error}</p>
                )}
                
                {upload.status === 'success' && (
                  <p className="text-xs text-gray-500">
                    {formatFileSize(upload.file.size)} • {upload.objectName}
                  </p>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => removeUpload(upload.file)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

