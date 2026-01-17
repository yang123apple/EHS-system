/**
 * JSON 解析工具函数
 * 提供安全的 JSON 解析功能，避免解析异常导致接口 500
 */

/**
 * 安全地解析 JSON 字符串
 * @param json JSON 字符串或已解析的对象
 * @param defaultValue 解析失败时的默认值
 * @returns 解析后的对象或默认值
 */
export function safeJsonParse<T = any>(
  json: string | null | undefined | any,
  defaultValue: T = [] as any
): T {
  // 如果已经是对象或数组，直接返回
  if (json === null || json === undefined) {
    return defaultValue;
  }

  if (typeof json !== 'string') {
    // 如果已经是对象，直接返回
    if (typeof json === 'object') {
      return json as T;
    }
    return defaultValue;
  }

  // 空字符串返回默认值
  if (json.trim() === '') {
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch (error) {
    // 记录警告但不抛出异常
    console.warn('[safeJsonParse] JSON 解析失败:', {
      error: error instanceof Error ? error.message : String(error),
      json: json.substring(0, 100), // 只记录前100个字符
    });
    return defaultValue;
  }
}

/**
 * 安全地解析 JSON 数组
 * @param json JSON 字符串
 * @returns 解析后的数组，失败返回空数组
 */
export function safeJsonParseArray<T = any>(json: string | null | undefined): T[] {
  const parsed = safeJsonParse<T[]>(json, []);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * 安全地解析 JSON 对象
 * @param json JSON 字符串
 * @returns 解析后的对象，失败返回空对象
 */
export function safeJsonParseObject<T = Record<string, any>>(
  json: string | null | undefined
): T {
  const parsed = safeJsonParse<T>(json, {} as T);
  return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : ({} as T);
}
