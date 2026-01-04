'use client';

import { Plus, X } from 'lucide-react';
import SignatureImage from './SignatureImage';

interface MultiSignatureDisplayProps {
  signatures: string | string[]; // base64 签名数组或字符串（兼容旧数据）
  onAddSignature: () => void; // 添加签名回调
  onRemoveSignature?: (index: number) => void; // 删除签名回调（可选）
  maxWidth?: number;
  maxHeight?: number;
  readonly?: boolean; // 是否只读
  className?: string;
}

/**
 * 多人签名显示组件
 * 显示多个签名，每个签名后面有"+"按钮可以添加新签名
 */
export default function MultiSignatureDisplay({
  signatures = [],
  onAddSignature,
  onRemoveSignature,
  maxWidth = 200,
  maxHeight = 100,
  readonly = false,
  className = ''
}: MultiSignatureDisplayProps) {
  // 兼容旧数据：如果是字符串，转换为数组
  const signatureArray = Array.isArray(signatures) 
    ? signatures 
    : (signatures && typeof signatures === 'string' && signatures.length > 0 ? [signatures] : []);

  // 如果没有签名且是只读模式，显示提示
  if (readonly && signatureArray.length === 0) {
    return <span className="text-slate-300 text-sm">未签名</span>;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {signatureArray.map((sig, index) => (
        <div key={index} className="relative group">
          <SignatureImage
            base64={sig}
            maxWidth={maxWidth}
            maxHeight={maxHeight}
            className="object-contain border border-slate-200 rounded"
          />
          {!readonly && onRemoveSignature && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveSignature(index);
              }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              title="删除签名"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      {!readonly && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddSignature();
          }}
          className="flex items-center justify-center w-12 h-12 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors shadow-sm"
          title="添加签名"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

