import { useState, useCallback } from 'react';
import type { SignatureValue } from '@/components/common/SignatureManager';

/**
 * 签名管理 Hook
 * 提供签名状态管理和操作方法
 * 
 * @example
 * ```tsx
 * const { signatures, addSignature, removeSignature, clearSignatures } = useSignature();
 * 
 * // 单个签名
 * const { signatures, addSignature, clearSignatures } = useSignature(false);
 * ```
 */
export function useSignature(allowMultiple: boolean = true) {
  const [signatures, setSignatures] = useState<SignatureValue>(allowMultiple ? [] : '');

  // 规范化签名数据为数组格式
  const normalizeToArray = useCallback((val: SignatureValue): string[] => {
    if (Array.isArray(val)) return val.filter(s => s && typeof s === 'string' && s.length > 0);
    if (typeof val === 'string' && val.length > 0) return [val];
    return [];
  }, []);

  // 添加签名
  const addSignature = useCallback((base64: string) => {
    if (!base64) return;

    setSignatures(prev => {
      if (allowMultiple) {
        const currentArray = normalizeToArray(prev);
        return [...currentArray, base64];
      } else {
        return base64;
      }
    });
  }, [allowMultiple, normalizeToArray]);

  // 删除签名
  const removeSignature = useCallback((index: number) => {
    setSignatures(prev => {
      const currentArray = normalizeToArray(prev);
      if (currentArray.length === 0) return allowMultiple ? [] : '';
      
      const newArray = currentArray.filter((_, i) => i !== index);
      return allowMultiple ? newArray : (newArray.length > 0 ? newArray[0] : '');
    });
  }, [allowMultiple, normalizeToArray]);

  // 清空所有签名
  const clearSignatures = useCallback(() => {
    setSignatures(allowMultiple ? [] : '');
  }, [allowMultiple]);

  // 设置签名值
  const setSignaturesValue = useCallback((value: SignatureValue) => {
    setSignatures(value);
  }, []);

  // 获取签名数组
  const getSignatureArray = useCallback((): string[] => {
    return normalizeToArray(signatures);
  }, [signatures, normalizeToArray]);

  return {
    signatures,
    addSignature,
    removeSignature,
    clearSignatures,
    setSignaturesValue,
    getSignatureArray,
    hasSignatures: normalizeToArray(signatures).length > 0
  };
}






