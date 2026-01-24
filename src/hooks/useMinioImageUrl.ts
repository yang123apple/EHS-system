/**
 * MinIO 图片 URL Hook
 * 用于将 MinIO objectName 转换为可访问的预签名 URL
 */

import { useState, useEffect } from 'react';

interface UseMinioImageUrlOptions {
  enabled?: boolean; // 是否启用自动加载
  expiresIn?: number; // 过期时间（秒）
}

export function useMinioImageUrl(
  objectName: string | null | undefined,
  options: UseMinioImageUrlOptions = {}
) {
  const { enabled = true, expiresIn = 3600 } = options;
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!objectName || !enabled) {
      setUrl('');
      return;
    }

    // 如果已经是完整 URL（base64 或 http），直接使用
    if (objectName.startsWith('data:') || objectName.startsWith('http')) {
      setUrl(objectName);
      return;
    }

    // 获取预签名 URL
    const fetchUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/storage/file-url?objectName=${encodeURIComponent(objectName)}&expiresIn=${expiresIn}`
        );

        if (!response.ok) {
          throw new Error('获取图片 URL 失败');
        }

        const data = await response.json();
        setUrl(data.url);
      } catch (err: any) {
        console.error('获取图片 URL 失败:', err);
        setError(err.message || '获取图片 URL 失败');
        setUrl(''); // 失败时清空 URL
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();
  }, [objectName, enabled, expiresIn]);

  return { url, loading, error };
}

/**
 * 批量获取图片 URL
 */
export function useMinioImageUrls(
  objectNames: (string | null | undefined)[],
  options: UseMinioImageUrlOptions = {}
) {
  const { enabled = true, expiresIn = 3600 } = options;
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 🐛 调试日志
    console.log('[useMinioImageUrls] Hook 调用:', {
      enabled,
      objectNames长度: objectNames.length,
      objectNames类型: typeof objectNames,
      objectNames是数组: Array.isArray(objectNames),
      objectNames内容: objectNames,
      第一个元素: objectNames[0],
      第一个元素类型: typeof objectNames[0]
    });

    if (!enabled || objectNames.length === 0) {
      console.log('[useMinioImageUrls] 跳过加载:', { enabled, length: objectNames.length });
      setUrls([]);
      return;
    }

    const fetchUrls = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('[useMinioImageUrls] 开始获取URLs，数量:', objectNames.length);
        
        const urlPromises = objectNames.map(async (objectName, index) => {
          if (!objectName) {
            console.log(`[useMinioImageUrls] 跳过空路径 [${index}]`);
            return '';
          }

          // 如果已经是完整 URL，直接使用
          if (objectName.startsWith('data:') || objectName.startsWith('http')) {
            console.log(`[useMinioImageUrls] 使用完整URL [${index}]:`, objectName.substring(0, 50));
            return objectName;
          }

          // 获取预签名 URL
          console.log(`[useMinioImageUrls] 请求预签名URL [${index}]:`, objectName);
          try {
            const response = await fetch(
              `/api/storage/file-url?objectName=${encodeURIComponent(objectName)}&expiresIn=${expiresIn}`
            );

            if (!response.ok) {
              // 尝试获取错误信息
              let errorMessage = '';
              let errorDetails: any = null;
              
              try {
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                  const jsonData = await response.json();
                  errorDetails = jsonData;
                  // 提取错误消息
                  if (typeof jsonData === 'string') {
                    errorMessage = jsonData;
                  } else if (jsonData.error) {
                    errorMessage = typeof jsonData.error === 'string' ? jsonData.error : JSON.stringify(jsonData.error);
                  } else if (jsonData.message) {
                    errorMessage = jsonData.message;
                  } else {
                    errorMessage = JSON.stringify(jsonData);
                  }
                } else {
                  const errorText = await response.text();
                  errorMessage = errorText || '';
                  errorDetails = errorText ? { raw: errorText } : null;
                }
              } catch (parseError: any) {
                // 如果解析失败，记录解析错误
                errorMessage = `无法解析错误响应: ${parseError?.message || String(parseError)}`;
                errorDetails = { parseError: parseError?.message || String(parseError) };
              }
              
              // 构建完整的错误日志对象（确保所有字段都有值）
              const errorLog = {
                index,
                objectName: objectName || '(空)',
                status: response.status || 0,
                statusText: response.statusText || 'Unknown',
                error: errorMessage || `HTTP ${response.status || 0} 错误（无响应体）`,
                ...(errorDetails && { details: errorDetails })
              };
              
              // 使用 JSON.stringify 确保错误信息可见（即使控制台不展开对象）
              console.error(`[useMinioImageUrls] API失败 [${index}]:`, JSON.stringify(errorLog, null, 2));
              // 同时也输出对象形式（方便调试）
              console.error(`[useMinioImageUrls] API失败详情 [${index}]:`, errorLog);
              return '';
            }

            const data = await response.json();
            console.log(`[useMinioImageUrls] 成功获取URL [${index}]:`, data.url?.substring(0, 50));
            return data.url;
          } catch (fetchError: any) {
            // 网络错误或其他异常
            const errorLog = {
              index,
              objectName: objectName || '(空)',
              error: fetchError?.message || String(fetchError) || '网络请求失败',
              errorType: fetchError?.name || 'FetchError',
              ...(fetchError?.stack && { stack: fetchError.stack })
            };
            // 使用 JSON.stringify 确保错误信息可见
            console.error(`[useMinioImageUrls] 请求异常 [${index}]:`, JSON.stringify(errorLog, null, 2));
            console.error(`[useMinioImageUrls] 请求异常详情 [${index}]:`, errorLog);
            return '';
          }
        });

        const resolvedUrls = await Promise.all(urlPromises);
        console.log('[useMinioImageUrls] 全部完成:', {
          总数: resolvedUrls.length,
          成功: resolvedUrls.filter(u => u).length,
          失败: resolvedUrls.filter(u => !u).length,
          URLs: resolvedUrls.map(u => u ? u.substring(0, 50) : '(空)')
        });
        
        setUrls(resolvedUrls);
      } catch (err: any) {
        console.error('[useMinioImageUrls] 批量获取失败:', err);
        setError(err.message || '批量获取图片 URL 失败');
        setUrls([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUrls();
  }, [JSON.stringify(objectNames), enabled, expiresIn]);

  return { urls, loading, error };
}
