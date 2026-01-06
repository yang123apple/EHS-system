/**
 * 日期时间工具函数库
 * 统一处理系统中所有日期时间相关的操作
 */

/**
 * 将日期字符串转换为当天的开始时间（00:00:00.000）
 * @param dateString - 日期字符串，格式可以是 YYYY-MM-DD 或完整的 ISO 日期时间字符串
 * @returns Date 对象，设置为当天的 00:00:00.000
 */
export function setStartOfDay(dateString: string | Date): Date {
  const date = typeof dateString === 'string' ? new Date(dateString) : new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * 将日期字符串转换为当天的结束时间（23:59:59.999）
 * @param dateString - 日期字符串，格式可以是 YYYY-MM-DD 或完整的 ISO 日期时间字符串
 * @returns Date 对象，设置为当天的 23:59:59.999
 */
export function setEndOfDay(dateString: string | Date): Date {
  const date = typeof dateString === 'string' ? new Date(dateString) : new Date(dateString);
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * 处理截止时间（deadline），通常设置为当天的结束时间
 * @param dateString - 日期字符串
 * @returns Date 对象，设置为当天的 23:59:59.999
 */
export function setDeadline(dateString: string | Date): Date {
  return setEndOfDay(dateString);
}

/**
 * 处理日期字符串，如果是 YYYY-MM-DD 格式，则提取日期部分
 * @param dateString - 日期字符串
 * @returns 日期部分（YYYY-MM-DD）
 */
export function extractDatePart(dateString: string | Date): string {
  if (typeof dateString === 'string') {
    // 如果是 YYYY-MM-DD 格式（来自 date input），直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    // 如果已经是完整的日期时间字符串，提取日期部分
    return dateString.split('T')[0];
  }
  // 如果是 Date 对象，转换为 YYYY-MM-DD
  return dateString.toISOString().split('T')[0];
}

/**
 * 将 Date 对象转换为 ISO 字符串
 * @param date - Date 对象或日期字符串
 * @returns ISO 格式的日期时间字符串
 */
export function toISOString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return date instanceof Date ? date.toISOString() : null;
}

/**
 * 将 Date 对象转换为本地日期字符串（YYYY-MM-DD）
 * @param date - Date 对象或日期字符串
 * @param locale - 语言环境，默认为 'zh-CN'
 * @param options - Intl.DateTimeFormat 选项
 * @returns 格式化后的日期字符串
 */
export function toLocaleDateString(
  date: Date | string | number | null | undefined,
  locale: string = 'zh-CN',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  };
  
  return d.toLocaleDateString(locale, defaultOptions);
}

/**
 * 将 Date 对象转换为 YYYY-MM-DD 格式字符串
 * @param date - Date 对象或日期字符串
 * @returns YYYY-MM-DD 格式的日期字符串
 */
export function toDateString(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * 安全地创建 Date 对象
 * @param date - 日期字符串、时间戳或 Date 对象
 * @returns Date 对象，如果无效则返回 null
 */
export function safeDate(date: Date | string | number | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 检查日期是否为有效的 Date 对象
 * @param date - 要检查的值
 * @returns 是否为有效的 Date 对象
 */
export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * 检查是否为日期字符串或 Date 对象
 * @param date - 要检查的值
 * @returns 是否为日期类型
 */
export function isDateLike(date: any): boolean {
  if (date instanceof Date) return true;
  if (typeof date === 'string') {
    const d = new Date(date);
    return !isNaN(d.getTime());
  }
  return false;
}

/**
 * 统一处理日期字段：将 Date 对象转换为 ISO 字符串，保持字符串不变
 * @param date - Date 对象或日期字符串
 * @returns ISO 格式字符串或原始字符串
 */
export function normalizeDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') return date;
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

/**
 * 处理日期字段用于数据库存储：将字符串转换为 Date 对象
 * @param dateString - 日期字符串
 * @param setToEndOfDay - 是否设置为当天的结束时间（用于截止日期等）
 * @returns Date 对象或 null
 */
export function parseDateForDB(
  dateString: string | Date | null | undefined,
  setToEndOfDay: boolean = false
): Date | null {
  if (!dateString) return null;
  
  if (dateString instanceof Date) {
    return setToEndOfDay ? setEndOfDay(dateString) : dateString;
  }
  
  const date = safeDate(dateString);
  if (!date) return null;
  
  return setToEndOfDay ? setEndOfDay(date) : date;
}

/**
 * 计算日期加上指定天数后的日期
 * @param date - 基准日期
 * @param days - 要添加的天数（可以为负数）
 * @param setToEndOfDay - 是否设置为当天的结束时间
 * @returns 计算后的 Date 对象
 */
export function addDays(
  date: Date | string,
  days: number,
  setToEndOfDay: boolean = false
): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return setToEndOfDay ? setEndOfDay(d) : d;
}

/**
 * 比较两个日期
 * @param date1 - 第一个日期
 * @param date2 - 第二个日期
 * @returns 比较结果：-1 表示 date1 < date2，0 表示相等，1 表示 date1 > date2
 */
export function compareDates(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  if (d1.getTime() < d2.getTime()) return -1;
  if (d1.getTime() > d2.getTime()) return 1;
  return 0;
}

/**
 * 检查日期是否在指定范围内
 * @param date - 要检查的日期
 * @param startDate - 开始日期
 * @param endDate - 结束日期
 * @returns 是否在范围内
 */
export function isDateInRange(
  date: Date | string,
  startDate: Date | string,
  endDate: Date | string
): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const start = typeof startDate === 'string' ? setStartOfDay(startDate) : setStartOfDay(startDate);
  const end = typeof endDate === 'string' ? setEndOfDay(endDate) : setEndOfDay(endDate);
  
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

/**
 * 获取当前时间的 ISO 字符串
 * @returns 当前时间的 ISO 字符串
 */
export function nowISOString(): string {
  return new Date().toISOString();
}

/**
 * 获取当前日期字符串（YYYY-MM-DD）
 * @returns 当前日期的 YYYY-MM-DD 格式字符串
 */
export function todayString(): string {
  return toDateString(new Date());
}

/**
 * 格式化日期时间用于显示
 * @param date - 日期对象或字符串
 * @param format - 格式类型：'date' | 'datetime' | 'time' | 'full'
 * @param locale - 语言环境，默认为 'zh-CN'
 * @returns 格式化后的字符串
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  format: 'date' | 'datetime' | 'time' | 'full' = 'date',
  locale: string = 'zh-CN'
): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  
  const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
    date: { year: 'numeric', month: '2-digit', day: '2-digit' },
    datetime: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
    time: { hour: '2-digit', minute: '2-digit' },
    full: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }
  };
  
  return d.toLocaleString(locale, formatOptions[format]);
}
