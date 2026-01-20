/**
 * Presigned URL 文件上传组件
 * 用于大文件直传 MinIO，避免流经 Node.js 服务器
 * 重构版本：使用 useMinioUpload Hook
 * 
 * 使用场景：
 * - 视频文件（>10MB）
 * - 大文档（>10MB）
 * - 任何需要高性能上传的文件
 */

'use client';

import { useState, useRef } from 'react';
import { useMinioUpload } from '@/hooks/useMinioUpload';

interface PresignedUploaderProps {
  onUploadSuccess?: (result: {
    objectName: string;
    dbRecord: string;
    url: string;
  }) => void;
  onUploadError?: (error: string) => void;
  bucket?: 'private' | 'public';
  category?: string;
  accept?: string;
  maxSize?: number; // 字节
  disabled?: boolean;
}

export function PresignedUploader({
  onUploadSuccess,
  onUploadError,
  bucket = 'public',
  category,
  accept,
  maxSize = 5 * 1024 * 1024 * 1024, // 默认 5GB
  disabled = false,
}: PresignedUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 使用统一的上传 Hook
  const { upload, state, isUploading } = useMinioUpload({
    bucket,
    category,
    maxSize,
    onSuccess: (result) => {
      // 兼容旧的接口格式
      onUploadSuccess?.({
        objectName: result.objectName,
        dbRecord: result.dbRecord || result.url || '',
        url: result.url || result.dbRecord || '',
      });
      // 上传成功后重置文件选择
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: onUploadError,
  });

  /**
   * 处理文件选择
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    try {
      await upload(file);
    } catch (error) {
      // 错误已在 Hook 中处理
    }
  };

  // 格式化状态消息
  const getStatusMessage = () => {
    switch (state.status) {
      case 'requesting':
        return '请求上传地址...';
      case 'uploading':
        return `上传中... ${state.progress}%`;
      case 'success':
        return '上传成功';
      case 'error':
        return state.error || '上传失败';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100
          disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* 上传进度 */}
      {state.status !== 'idle' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{getStatusMessage()}</span>
            {state.status === 'uploading' && (
              <span className="text-gray-500">{state.progress}%</span>
            )}
          </div>
          {state.status === 'uploading' && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          )}
          {state.status === 'success' && (
            <div className="text-green-600 text-sm">✓ 上传成功</div>
          )}
          {state.status === 'error' && (
            <div className="text-red-600 text-sm">✗ {state.error}</div>
          )}
        </div>
      )}

      {/* 文件信息 */}
      {selectedFile && (
        <div className="text-xs text-gray-500">
          文件: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
        </div>
      )}
    </div>
  );
}
