/**
 * MinIO 文件上传核心 Hook
 * 封装获取 Presigned URL、XHR 上传、进度计算和错误处理
 */

import { useState, useCallback, useRef } from 'react';

export interface MinioUploadOptions {
  bucket: 'private' | 'public';
  prefix?: string;
  category?: string;
  maxSize?: number; // 字节
  onProgress?: (progress: number) => void;
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: string) => void;
}

export interface UploadResult {
  objectName: string;
  url?: string;
  dbRecord?: string;
}

export interface UploadState {
  status: 'idle' | 'requesting' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  result?: UploadResult;
}

interface PresignedUrlResponse {
  presignedUrl?: string;
  uploadUrl?: string;
  objectName: string;
  dbRecord?: string;
}

export function useMinioUpload(options: MinioUploadOptions) {
  const {
    bucket,
    prefix,
    category,
    maxSize = 100 * 1024 * 1024, // 默认 100MB
    onProgress,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  });

  const xhrRef = useRef<XMLHttpRequest | null>(null);

  /**
   * 获取预签名 URL
   */
  const getPresignedUrl = useCallback(
    async (file: File): Promise<PresignedUrlResponse> => {
      const response = await fetch('/api/storage/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          prefix,
          category,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取上传链接失败');
      }

      const { data } = await response.json();
      return {
        presignedUrl: data.presignedUrl || data.uploadUrl,
        uploadUrl: data.uploadUrl,
        objectName: data.objectName,
        dbRecord: data.dbRecord,
      };
    },
    [bucket, prefix, category]
  );

  /**
   * 使用 XHR 上传文件到 MinIO
   */
  const uploadToMinio = useCallback(
    (file: File, presignedUrl: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        // 监听上传进度
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setState((prev) => ({ ...prev, progress }));
            onProgress?.(progress);
          }
        });

        // 上传完成
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`上传失败: HTTP ${xhr.status}`));
          }
        });

        // 网络错误
        xhr.addEventListener('error', () => {
          reject(new Error('网络错误'));
        });

        // 上传中止
        xhr.addEventListener('abort', () => {
          reject(new Error('上传已取消'));
        });

        // 开始上传
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      });
    },
    [onProgress]
  );

  /**
   * 主上传函数
   */
  const upload = useCallback(
    async (file: File): Promise<UploadResult> => {
      // 检查文件大小
      if (file.size > maxSize) {
        const error = `文件大小超过限制 (${(maxSize / 1024 / 1024).toFixed(0)}MB)`;
        setState({ status: 'error', progress: 0, error });
        onError?.(error);
        throw new Error(error);
      }

      try {
        // 步骤 1: 获取预签名 URL
        setState({ status: 'requesting', progress: 0 });
        const { presignedUrl, uploadUrl, objectName, dbRecord } = await getPresignedUrl(file);

        // 步骤 2: 上传到 MinIO
        setState({ status: 'uploading', progress: 0 });
        const finalUrl = presignedUrl || uploadUrl;
        if (!finalUrl) {
          throw new Error('未获取到有效的上传地址');
        }
        await uploadToMinio(file, finalUrl);

        // 步骤 3: 构建结果
        const url =
          bucket === 'public' && presignedUrl
            ? presignedUrl.split('?')[0] // 公开文件使用不带签名的 URL
            : dbRecord || undefined;

        const result: UploadResult = {
          objectName,
          url,
          dbRecord,
        };

        setState({ status: 'success', progress: 100, result });
        onSuccess?.(result);
        return result;
      } catch (error: any) {
        const errorMessage = error.message || '上传失败';
        setState({ status: 'error', progress: 0, error: errorMessage });
        onError?.(errorMessage);
        throw error;
      }
    },
    [maxSize, getPresignedUrl, uploadToMinio, bucket, onSuccess, onError]
  );

  /**
   * 取消上传
   */
  const cancel = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setState({ status: 'idle', progress: 0 });
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({ status: 'idle', progress: 0 });
  }, []);

  return {
    upload,
    cancel,
    reset,
    state,
    isUploading: state.status === 'uploading' || state.status === 'requesting',
  };
}
