/**
 * Presigned URL 文件上传组件
 * 用于大文件直传 MinIO，避免流经 Node.js 服务器
 * 
 * 使用场景：
 * - 视频文件（>10MB）
 * - 大文档（>10MB）
 * - 任何需要高性能上传的文件
 */

'use client';

import { useState, useRef } from 'react';

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

interface UploadProgress {
  stage: 'idle' | 'requesting' | 'uploading' | 'success' | 'error';
  progress: number; // 0-100
  message?: string;
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
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'idle',
    progress: 0,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 步骤 1: 请求 Presigned URL
   */
  const requestPresignedUrl = async (file: File): Promise<{
    uploadUrl: string;
    objectName: string;
    dbRecord: string;
  }> => {
    setUploadProgress({ stage: 'requesting', progress: 0, message: '请求上传地址...' });

    const response = await fetch('/api/storage/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        bucket,
        category,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '获取上传地址失败');
    }

    const { data } = await response.json();
    return {
      uploadUrl: data.uploadUrl,
      objectName: data.objectName,
      dbRecord: data.dbRecord,
    };
  };

  /**
   * 步骤 2: 直接上传文件到 MinIO
   */
  const uploadToMinIO = async (
    file: File,
    uploadUrl: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      setUploadProgress({ stage: 'uploading', progress: 0, message: '上传中...' });

      const xhr = new XMLHttpRequest();

      // 监听上传进度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress({
            stage: 'uploading',
            progress,
            message: `上传中... ${progress}%`,
          });
        }
      });

      // 监听完成
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress({
            stage: 'success',
            progress: 100,
            message: '上传成功',
          });
          resolve();
        } else {
          reject(new Error(`上传失败: HTTP ${xhr.status}`));
        }
      });

      // 监听错误
      xhr.addEventListener('error', () => {
        reject(new Error('上传过程中发生网络错误'));
      });

      // 监听中断
      xhr.addEventListener('abort', () => {
        reject(new Error('上传已取消'));
      });

      // 开始上传
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
  };

  /**
   * 处理文件选择
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件大小
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0);
      const error = `文件大小超过限制（最大 ${maxSizeMB}MB）`;
      setUploadProgress({ stage: 'error', progress: 0, message: error });
      onUploadError?.(error);
      return;
    }

    setSelectedFile(file);

    try {
      // 步骤 1: 获取 Presigned URL
      const { uploadUrl, objectName, dbRecord } = await requestPresignedUrl(file);

      // 步骤 2: 直接上传到 MinIO
      await uploadToMinIO(file, uploadUrl);

      // 步骤 3: 通知父组件
      onUploadSuccess?.({
        objectName,
        dbRecord,
        url: dbRecord, // 使用 dbRecord 作为 URL
      });

      // 重置
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      const errorMessage = error.message || '上传失败';
      setUploadProgress({ stage: 'error', progress: 0, message: errorMessage });
      onUploadError?.(errorMessage);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled || uploadProgress.stage === 'uploading'}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100
          disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* 上传进度 */}
      {uploadProgress.stage !== 'idle' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{uploadProgress.message}</span>
            {uploadProgress.stage === 'uploading' && (
              <span className="text-gray-500">{uploadProgress.progress}%</span>
            )}
          </div>
          {uploadProgress.stage === 'uploading' && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
          )}
          {uploadProgress.stage === 'success' && (
            <div className="text-green-600 text-sm">✓ 上传成功</div>
          )}
          {uploadProgress.stage === 'error' && (
            <div className="text-red-600 text-sm">✗ {uploadProgress.message}</div>
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

