/**
 * 日期范围选择 Hook
 * 自动处理开始日期和结束日期的关联逻辑
 * 当开始日期改变时，自动调整结束日期的最小可选日期
 */

import { useState, useCallback } from 'react';
import { toDateString } from '@/utils/dateUtils';

interface UseDateRangeOptions {
  /** 初始开始日期 */
  initialStartDate?: string;
  /** 初始结束日期 */
  initialEndDate?: string;
  /** 是否允许开始日期和结束日期相同（默认false，结束日期必须晚于开始日期） */
  allowSameDate?: boolean;
  /** 开始日期改变时的回调 */
  onStartDateChange?: (date: string) => void;
  /** 结束日期改变时的回调 */
  onEndDateChange?: (date: string) => void;
}

interface UseDateRangeReturn {
  /** 开始日期值 */
  startDate: string;
  /** 结束日期值 */
  endDate: string;
  /** 设置开始日期 */
  setStartDate: (date: string) => void;
  /** 设置结束日期 */
  setEndDate: (date: string) => void;
  /** 结束日期的最小可选日期（用于 input min 属性） */
  endDateMin: string;
  /** 开始日期的最大可选日期（用于 input max 属性，可选） */
  startDateMax?: string;
  /** 重置日期范围 */
  reset: () => void;
  /** 验证日期范围是否有效 */
  isValid: boolean;
}

/**
 * 日期范围选择 Hook
 * 
 * @example
 * ```tsx
 * const { startDate, endDate, setStartDate, setEndDate, endDateMin, isValid } = useDateRange({
 *   initialStartDate: '2024-01-01',
 *   initialEndDate: '2024-01-31'
 * });
 * 
 * <input 
 *   type="date" 
 *   value={startDate} 
 *   onChange={e => setStartDate(e.target.value)}
 * />
 * <input 
 *   type="date" 
 *   value={endDate} 
 *   onChange={e => setEndDate(e.target.value)}
 *   min={endDateMin}
 * />
 * ```
 */
export function useDateRange(options: UseDateRangeOptions = {}): UseDateRangeReturn {
  const {
    initialStartDate = '',
    initialEndDate = '',
    allowSameDate = false,
    onStartDateChange,
    onEndDateChange,
  } = options;

  const [startDate, setStartDateState] = useState(initialStartDate);
  const [endDate, setEndDateState] = useState(initialEndDate);

  // 计算结束日期的最小可选日期
  // 如果允许相同日期，最小日期就是开始日期；否则是开始日期的下一天
  const endDateMin = startDate 
    ? (allowSameDate 
        ? startDate 
        : (() => {
            const nextDay = new Date(startDate);
            nextDay.setDate(nextDay.getDate() + 1);
            return toDateString(nextDay);
          })())
    : '';

  // 设置开始日期
  const setStartDate = useCallback((date: string) => {
    setStartDateState(date);
    
    // 如果结束日期已设置且早于（或等于，如果不允许相同日期）新的开始日期，自动清空结束日期
    if (endDate && date) {
      const end = new Date(endDate);
      const start = new Date(date);
      
      if (allowSameDate) {
        // 允许相同日期：结束日期必须 >= 开始日期
        if (end < start) {
          setEndDateState('');
          onEndDateChange?.('');
        }
      } else {
        // 不允许相同日期：结束日期必须 > 开始日期
        if (end <= start) {
          setEndDateState('');
          onEndDateChange?.('');
        }
      }
    }
    
    onStartDateChange?.(date);
  }, [endDate, allowSameDate, onStartDateChange, onEndDateChange]);

  // 设置结束日期
  const setEndDate = useCallback((date: string) => {
    // 验证结束日期是否有效
    if (date && startDate) {
      const end = new Date(date);
      const start = new Date(startDate);
      
      if (allowSameDate) {
        // 允许相同日期：结束日期必须 >= 开始日期
        if (end < start) {
          // 无效日期，不更新
          return;
        }
      } else {
        // 不允许相同日期：结束日期必须 > 开始日期
        if (end <= start) {
          // 无效日期，不更新
          return;
        }
      }
    }
    
    setEndDateState(date);
    onEndDateChange?.(date);
  }, [startDate, allowSameDate, onEndDateChange]);

  // 重置日期范围
  const reset = useCallback(() => {
    setStartDateState(initialStartDate);
    setEndDateState(initialEndDate);
  }, [initialStartDate, initialEndDate]);

  // 验证日期范围是否有效
  const isValid = !startDate || !endDate || (() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return allowSameDate ? end >= start : end > start;
  })();

  return {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    endDateMin,
    reset,
    isValid,
  };
}

