// src/utils/checkTypeMapping.ts
// 检查类型映射工具函数

interface CheckType {
  id: string;
  name: string;
  value: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

// 缓存检查类型数据
let checkTypesCache: CheckType[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取检查类型列表（带缓存）
 */
export async function getCheckTypes(): Promise<CheckType[]> {
  const now = Date.now();
  
  // 如果缓存有效，直接返回
  if (checkTypesCache && now - cacheTime < CACHE_DURATION) {
    return checkTypesCache;
  }

  try {
    const response = await fetch('/api/check-types');
    if (response.ok) {
      const data = await response.json();
      checkTypesCache = data;
      cacheTime = now;
      return data;
    }
  } catch (error) {
    console.error('获取检查类型失败:', error);
  }

  // 如果获取失败但有旧缓存，返回旧缓存
  if (checkTypesCache) {
    return checkTypesCache;
  }

  // 返回默认值
  return getDefaultCheckTypes();
}

/**
 * 根据 value 获取检查类型名称
 */
export async function getCheckTypeName(value: string): Promise<string> {
  const checkTypes = await getCheckTypes();
  const checkType = checkTypes.find(ct => ct.value === value);
  return checkType?.name || value;
}

/**
 * 根据 value 同步获取检查类型名称（使用缓存）
 */
export function getCheckTypeNameSync(value: string): string {
  if (!checkTypesCache) {
    // 如果没有缓存，返回默认映射
    return getDefaultCheckTypeName(value);
  }
  
  const checkType = checkTypesCache.find(ct => ct.value === value);
  return checkType?.name || value;
}

/**
 * 清除缓存
 */
export function clearCheckTypeCache(): void {
  checkTypesCache = null;
  cacheTime = 0;
}

/**
 * 预加载检查类型数据
 */
export async function preloadCheckTypes(): Promise<void> {
  await getCheckTypes();
}

/**
 * 获取默认检查类型列表（后备方案）
 */
function getDefaultCheckTypes(): CheckType[] {
  return [
    { id: 'ckt_daily', name: '日常检查', value: 'daily', sortOrder: 1, isActive: true },
    { id: 'ckt_special', name: '专项检查', value: 'special', sortOrder: 2, isActive: true },
    { id: 'ckt_monthly', name: '月度检查', value: 'monthly', sortOrder: 3, isActive: true },
    { id: 'ckt_preholiday', name: '节前检查', value: 'pre-holiday', sortOrder: 4, isActive: true },
    { id: 'ckt_self', name: '员工自查', value: 'self', sortOrder: 5, isActive: true },
    { id: 'ckt_other', name: '其他检查', value: 'other', sortOrder: 6, isActive: true },
  ];
}

/**
 * 获取默认检查类型名称（后备方案）
 */
function getDefaultCheckTypeName(value: string): string {
  const mapping: Record<string, string> = {
    'daily': '日常检查',
    'special': '专项检查',
    'monthly': '月度检查',
    'pre-holiday': '节前检查',
    'self': '员工自查',
    'other': '其他检查',
  };
  return mapping[value] || value;
}
