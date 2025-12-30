'use client';

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import HandwrittenSignature from '../work-permit/HandwrittenSignature';
import MultiSignatureDisplay from '../work-permit/MultiSignatureDisplay';

/**
 * 签名数据类型
 * 支持单个签名（字符串）或多个签名（数组）
 */
export type SignatureValue = string | string[];

/**
 * 签名管理器组件 Props
 */
export interface SignatureManagerProps {
  /** 当前签名值（字符串或数组） */
  value?: SignatureValue;
  /** 签名变化回调 */
  onChange?: (value: SignatureValue) => void;
  /** 是否只读模式 */
  readonly?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 最大显示宽度 */
  maxWidth?: number;
  /** 最大显示高度 */
  maxHeight?: number;
  /** 签名画布宽度 */
  canvasWidth?: number;
  /** 签名画布高度 */
  canvasHeight?: number;
  /** 自定义类名 */
  className?: string;
  /** 是否支持多人签名 */
  allowMultiple?: boolean;
  /** 是否显示删除按钮 */
  showRemoveButton?: boolean;
}

/**
 * 公共签名管理器组件
 * 提供统一的签名输入、显示和管理功能
 * 
 * @example
 * ```tsx
 * // 单个签名
 * <SignatureManager
 *   value={signature}
 *   onChange={(value) => setSignature(value)}
 * />
 * 
 * // 多人签名
 * <SignatureManager
 *   value={signatures}
 *   onChange={(value) => setSignatures(value)}
 *   allowMultiple={true}
 * />
 * ```
 */
export default function SignatureManager({
  value,
  onChange,
  readonly = false,
  disabled = false,
  maxWidth = 200,
  maxHeight = 100,
  canvasWidth = 600,
  canvasHeight = 300,
  className = '',
  allowMultiple = true,
  showRemoveButton = true
}: SignatureManagerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // 规范化签名数据为数组格式
  const normalizeSignatures = useCallback((val: SignatureValue | undefined): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(s => s && typeof s === 'string' && s.length > 0);
    if (typeof val === 'string' && val.length > 0) return [val];
    return [];
  }, []);

  // 获取当前签名数组
  const signatureArray = normalizeSignatures(value);

  // 打开签名模态框
  const handleOpenModal = useCallback(() => {
    if (disabled || readonly) return;
    setModalOpen(true);
  }, [disabled, readonly]);

  // 添加新签名
  const handleAddSignature = useCallback((base64: string) => {
    if (!onChange || !base64) return;

    if (allowMultiple) {
      // 多人签名：添加到数组
      const newArray = [...signatureArray, base64];
      onChange(newArray);
    } else {
      // 单个签名：直接替换
      onChange(base64);
    }
    setModalOpen(false);
  }, [onChange, allowMultiple, signatureArray]);

  // 删除签名
  const handleRemoveSignature = useCallback((index: number) => {
    if (!onChange || disabled || readonly) return;

    const newArray = [...signatureArray];
    newArray.splice(index, 1);
    
    if (newArray.length > 0) {
      onChange(allowMultiple ? newArray : newArray[0]);
    } else {
      onChange(allowMultiple ? [] : '');
    }
  }, [onChange, disabled, readonly, signatureArray, allowMultiple]);

  // 关闭模态框
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  return (
    <>
      <MultiSignatureDisplay
        signatures={signatureArray}
        onAddSignature={handleOpenModal}
        onRemoveSignature={showRemoveButton && !readonly ? handleRemoveSignature : undefined}
        maxWidth={maxWidth}
        maxHeight={maxHeight}
        readonly={readonly}
        className={className}
      />

      {/* 签名输入模态框 */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseModal();
            }
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">手写签名</h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <HandwrittenSignature
              value={undefined} // 新签名，不传入已有值
              onChange={handleAddSignature}
              onClose={handleCloseModal}
              width={canvasWidth}
              height={canvasHeight}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </>
  );
}

