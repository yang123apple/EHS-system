// src/lib/apiClient.ts
/**
 * API 客户端封装
 * 自动处理认证、权限和错误
 */

// API 错误数据接口
interface ApiErrorData {
  error?: string;
  message?: string;
  details?: string;
  code?: string;
  isNetworkError?: boolean;
  originalError?: string;
  [key: string]: unknown;
}

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
 * 支持对象类型的 body，会自动转换为 JSON
 */
export async function apiFetch(
  url: string,
  options: Omit<RequestInit, 'body'> & { body?: RequestInit['body'] | Record<string, unknown> } = {}
): Promise<Response> {
  const user = getCurrentUser();

  // 如果是需要认证的请求（非登录接口）但用户不存在，直接返回 401 响应
  // 这样可以避免在退出登录后发起无意义的请求
  if (!url.includes('/api/auth/login') && !user) {
    // 创建一个模拟的 401 响应，但不会导致真正的网络请求
    // 注意：这个响应会被调用方处理，不应该直接抛出错误
    const errorResponse = new Response(JSON.stringify({ error: '未授权访问，请先登录' }), {
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'Content-Type': 'application/json' }
    });

    // 在客户端环境下，如果是 401 错误，可以选择静默处理或跳转到登录页
    if (typeof window !== 'undefined') {
      // 检查是否在登录页面，避免循环跳转
      const isLoginPage = window.location.pathname === '/login' || window.location.pathname.startsWith('/login');
      if (!isLoginPage) {
        // 延迟跳转，让调用方有机会处理错误
        setTimeout(() => {
          // 只有在确实没有用户信息时才跳转
          const currentUser = getCurrentUser();
          if (!currentUser) {
            console.warn('[API Client] 未授权访问，跳转到登录页');
            window.location.href = '/login';
          }
        }, 100);
      }
    }

    return errorResponse;
  }

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

  // Next.js 16: 默认不缓存 fetch 请求，需要明确指定缓存策略
  // 如果 options 中没有 cache 配置，默认使用 'no-store' 确保实时数据
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    body,
    // Next.js 16 缓存策略：如果没有指定，默认不缓存（适合实时数据）
    cache: options.cache ?? 'no-store',
  };

  // 发送请求，捕获网络错误
  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error: unknown) {
    // 捕获网络错误（Failed to fetch, CORS错误, 连接超时等）
    console.error('[API Client] 网络请求失败:', error);

    // 创建一个模拟的错误响应，包含网络错误信息
    const errorMessage = (error instanceof Error ? error.message : null) || '网络连接失败';
    const isNetworkError =
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('Network request failed') ||
      errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
      errorMessage.includes('ERR_CONNECTION_REFUSED') ||
      errorMessage.includes('ERR_CONNECTION_TIMED_OUT') ||
      errorMessage.includes('ERR_NAME_NOT_RESOLVED');

    // 返回一个模拟的 500 错误响应，包含网络错误信息
    return new Response(
      JSON.stringify({
        error: isNetworkError ? '网络连接失败' : '请求失败',
        details: errorMessage,
        isNetworkError: true,
        originalError: errorMessage
      }),
      {
        status: 0, // 使用 0 表示网络错误（fetch 无法完成）
        statusText: 'Network Error',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // 处理认证失败
  if (response.status === 401) {
    // 检查是否还有登录用户，如果没有则是正常的退出登录流程，不需要警告
    const currentUser = getCurrentUser();
    if (currentUser) {
      console.warn('[API Client] 未授权访问，可能需要重新登录');
      // TODO: 触发登录流程
      // window.location.href = '/login';
    }
  }

  // 处理权限不足 - 只记录日志，不读取响应体（让调用方处理）
  if (response.status === 403) {
    console.error('[API Client] 权限不足 (403)');
    // 不读取响应体，让调用方来处理
  }

  return response;
}

/**
 * API 客户端类
 * 提供统一的API调用接口
 */
export class ApiClient {
  /**
   * 处理响应错误的统一方法
   */
  private static async handleResponseError(response: Response): Promise<void> {
    // 处理网络错误（状态码为 0 表示 fetch 无法完成）
    if (response.status === 0) {
      let error: ApiErrorData;
      try {
        const text = await response.text();
        error = text ? JSON.parse(text) : { error: '网络连接失败' };
      } catch (e) {
        error = { error: '网络连接失败', details: '无法连接到服务器，请检查网络连接或服务器是否运行' };
      }

      const errorMessage = error.error || error.details || '网络连接失败';
      throw new ApiError(errorMessage, 0, { ...error, isNetworkError: true });
    }

    // 对于 401 错误，检查是否是退出登录导致的，如果是则静默处理
    if (response.status === 401) {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        // 用户已退出登录，静默返回，不抛出错误
        console.debug('[API Client] 用户已退出登录，静默处理 401 错误');
        return;
      }
    }

    // 尝试解析错误响应
    let error: ApiErrorData;
    const contentType = response.headers.get('content-type');

    // 先尝试读取响应文本（只能读取一次）
    try {
      const text = await response.text();

      // 如果是 JSON 类型，尝试解析
      if (contentType && contentType.includes('application/json')) {
        try {
          error = JSON.parse(text);
        } catch (e) {
          // JSON 解析失败，使用原始文本
          error = { error: '响应解析失败', details: text || '未知错误' };
        }
      } else {
        // 非 JSON 响应，直接使用文本
        error = { error: text || '请求失败' };
      }
    } catch (e) {
      // 读取响应失败
      error = { error: '无法读取错误响应', details: '未知错误' };
    }

    // 提取错误信息：优先使用 error.details（详细错误信息），其次是 error.error，再次是 error.message
    // ✅ 修复：优先显示 details 字段，因为它通常包含更具体的错误信息
    const errorMessage = error.details || error.error || error.message || (typeof error === 'string' ? error : '请求失败');

    // 保留完整的错误信息，包括 details 和 code（用于数据库错误等）
    throw new ApiError(errorMessage, response.status, error);
  }

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
      await ApiClient.handleResponseError(response);
      return null as T; // 如果是静默处理的 401，返回 null
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
      await ApiClient.handleResponseError(response);
      return null as T;
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
      await ApiClient.handleResponseError(response);
      return null as T;
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
      await ApiClient.handleResponseError(response);
      return null as T;
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
      await ApiClient.handleResponseError(response);
      return null as T;
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
      await ApiClient.handleResponseError(response);
      return null as T;
    }

    return response.json();
  }
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  status: number;
  data: ApiErrorData | undefined;

  constructor(message: string, status: number, data?: ApiErrorData) {
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
