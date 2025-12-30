// src/lib/apiClient.ts
/**
 * API 客户端封装
 * 自动处理认证、权限和错误
 */

/**
 * 获取当前用户信息（从localStorage）
 */
function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('ehs_user');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[API Client] 获取用户信息失败:', error);
  }
  
  return null;
}

/**
 * 增强的 fetch 函数，自动添加认证头
 * 所有前端API请求都应该使用此函数而不是原生fetch
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const user = getCurrentUser();
  
  // 合并headers
  const headers = new Headers(options.headers || {});
  
  // 添加用户ID到请求头（临时方案）
  if (user?.id) {
    headers.set('x-user-id', user.id);
  }
  
  // 如果body是对象，自动转换为JSON
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  
  // 发送请求
  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });
  
  // 处理认证失败
  if (response.status === 401) {
    console.warn('[API Client] 未授权访问，可能需要重新登录');
    // TODO: 触发登录流程
    // window.location.href = '/login';
  }
  
  // 处理权限不足
  if (response.status === 403) {
    const error = await response.json().catch(() => ({ error: '权限不足' }));
    console.error('[API Client] 权限不足:', error);
  }
  
  return response;
}

/**
 * API 客户端类
 * 提供统一的API调用接口
 */
export class ApiClient {
  /**
   * GET 请求
   */
  static async get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
    // 构建查询字符串
    const queryString = params 
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    
    const response = await apiFetch(url + queryString, {
      method: 'GET',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new ApiError(error.error || 'Request failed', response.status, error);
    }
    
    return response.json();
  }

  /**
   * POST 请求
   */
  static async post<T = any>(url: string, data?: any): Promise<T> {
    const response = await apiFetch(url, {
      method: 'POST',
      body: data,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new ApiError(error.error || 'Request failed', response.status, error);
    }
    
    return response.json();
  }

  /**
   * PUT 请求
   */
  static async put<T = any>(url: string, data?: any): Promise<T> {
    const response = await apiFetch(url, {
      method: 'PUT',
      body: data,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new ApiError(error.error || 'Request failed', response.status, error);
    }
    
    return response.json();
  }

  /**
   * PATCH 请求
   */
  static async patch<T = any>(url: string, data?: any): Promise<T> {
    const response = await apiFetch(url, {
      method: 'PATCH',
      body: data,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new ApiError(error.error || 'Request failed', response.status, error);
    }
    
    return response.json();
  }

  /**
   * DELETE 请求
   */
  static async delete<T = any>(url: string, params?: Record<string, any>): Promise<T> {
    const queryString = params 
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    
    const response = await apiFetch(url + queryString, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new ApiError(error.error || 'Request failed', response.status, error);
    }
    
    return response.json();
  }

  /**
   * 上传文件
   */
  static async upload<T = any>(url: string, formData: FormData): Promise<T> {
    const response = await apiFetch(url, {
      method: 'POST',
      body: formData,
      // 不设置 Content-Type，让浏览器自动设置（包含boundary）
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new ApiError(error.error || 'Upload failed', response.status, error);
    }
    
    return response.json();
  }
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  status: number;
  data: any;
  
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
  
  /**
   * 判断是否是权限错误
   */
  isPermissionError(): boolean {
    return this.status === 403;
  }
  
  /**
   * 判断是否是认证错误
   */
  isAuthError(): boolean {
    return this.status === 401;
  }
}

/**
 * 导出便捷方法
 */
export const api = ApiClient;
