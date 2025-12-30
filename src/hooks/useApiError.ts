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

    // 网络错误
    if (error?.message?.includes('网络') || error?.message?.includes('Network')) {
      toast.error('网络连接失败', '请检查您的网络连接后重试');
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
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '请求失败' }));
        throw error;
      }

      return await response.json();
    } catch (error) {
      handleError(error, context);
      throw error;
    }
  }, [handleError]);

  return {
    handleError,
    handleApiResponse
  };
}
