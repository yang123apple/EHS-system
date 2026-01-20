import { useCallback } from 'react';
import { useToast } from '@/components/common/Toast';

interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export function useApiError() {
  const toast = useToast();

  const handleError = useCallback((error: any, context?: string) => {
    console.error('API Error:', error);

    // 网络错误（优先检查）
    if (
      error?.isNetworkError ||
      error?.status === 0 ||
      error?.message?.includes('网络') ||
      error?.message?.includes('Network') ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('网络连接失败')
    ) {
      const details = error?.details || error?.originalError || '请检查您的网络连接或服务器是否运行';
      toast.error('网络连接失败', details);
      return;
    }

    // 权限错误
    if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('权限')) {
      toast.permissionDenied(context);
      return;
    }

    // 认证错误
    if (error?.code === 'UNAUTHORIZED' || error?.message?.includes('未登录')) {
      toast.error('请先登录', '您的登录可能已过期，请重新登录');
      return;
    }

    // 验证错误
    if (error?.code === 'VALIDATION_ERROR') {
      toast.warning('数据验证失败', error?.message || '请检查输入的数据');
      return;
    }

    // 通用错误
    const message = error?.message || '操作失败';
    const description = context ? `${context}时发生错误` : '请稍后重试';
    toast.error(message, description);
  }, [toast]);

  const handleApiResponse = useCallback(async <T>(
    promise: Promise<Response>,
    context?: string
  ): Promise<T> => {
    try {
      const response = await promise;
      
      // 处理网络错误（状态码为 0）
      if (response.status === 0) {
        let error: any;
        try {
          const text = await response.text();
          error = text ? JSON.parse(text) : { message: '网络连接失败', isNetworkError: true };
        } catch (e) {
          error = { message: '网络连接失败', isNetworkError: true, details: '无法连接到服务器' };
        }
        handleError(error, context);
        throw error;
      }
      
      if (!response.ok) {
        let error: any;
        try {
          error = await response.json();
        } catch (e) {
          error = { message: `HTTP ${response.status} 错误` };
        }
        handleError(error, context);
        throw error;
      }

      return await response.json();
    } catch (error) {
      // 如果错误还没有被处理，则处理它
      if (error && typeof error === 'object' && !(error as any).isNetworkError) {
        handleError(error, context);
      }
      throw error;
    }
  }, [handleError]);

  return {
    handleError,
    handleApiResponse
  };
}
