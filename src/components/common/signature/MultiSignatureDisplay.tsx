'use client';

import { Plus, X } from 'lucide-react';
import { SignatureImage } from './SignatureImage';

export interface MultiSignatureDisplayProps {
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
export function MultiSignatureDisplay({
  signatures = [],
  onAddSignature,
  onRemoveSignature,
  maxWidth = 200,
  maxHeight = 100,
  readonly = false,
  className = ''
}: MultiSignatureDisplayProps) {
  // 🟢 规范化手写签名数据格式
  const normalizeSignature = (sig: any): string => {
    if (!sig) return '';
    
    // 如果是字符串
    if (typeof sig === 'string') {
      // 检查是否是JSON字符串化的字符串
      if (sig.startsWith('"') && sig.endsWith('"')) {
        try {
          const parsed = JSON.parse(sig);
          return normalizeSignature(parsed);
        } catch (e) {
          // 解析失败，继续处理
        }
      }
      // 检查是否是完整的data URL，如果是则提取base64部分
      if (sig.startsWith('data:image')) {
        return sig.split(',')[1] || sig;
      }
      // 如果是纯base64字符串，直接返回
      return sig;
    }
    
    // 如果是其他类型，转换为字符串
    return String(sig);
  };
  
  // 兼容旧数据：如果是字符串，转换为数组
  let rawArray = Array.isArray(signatures) 
    ? signatures 
    : (signatures && typeof signatures === 'string' && signatures.length > 0 ? [signatures] : []);
  
  // 🟢 规范化数组中的每个签名
  const signatureArray = rawArray.map(normalizeSignature).filter(sig => sig && sig.length > 0);

  // 如果没有签名且是只读模式，显示提示
  if (readonly && signatureArray.length === 0) {
    return <span className="text-slate-300 text-sm">未签名</span>;
  }

  return (
    <div 
      className={`flex flex-wrap items-center gap-2 ${className}`}
      style={{
        minHeight: '30px', // 🟢 确保最小高度
        minWidth: '50px', // 🟢 确保最小宽度
      }}
    >
      {signatureArray.map((sig, index) => {
        // 🟢 调试日志
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔍 [MultiSignatureDisplay] 渲染签名[${index}]:`, {
            sigLength: sig?.length,
            sigPreview: typeof sig === 'string' ? sig.substring(0, 50) : sig,
            maxWidth,
            maxHeight
          });
        }
        
        return (
          <div 
            key={index} 
            className="relative group"
            style={{
              minWidth: '20px', // 🟢 确保容器最小宽度
              minHeight: '20px', // 🟢 确保容器最小高度
              display: 'inline-block', // 🟢 确保容器是块级元素
            }}
          >
            <SignatureImage
              base64={sig}
              maxWidth={Math.max(maxWidth, 60)} // 🟢 确保最小宽度60px
              maxHeight={Math.max(maxHeight, 40)} // 🟢 确保最小高度40px
              className="object-contain border border-slate-200 rounded"
              style={{
                display: 'block', // 🟢 确保图片是块级元素
                visibility: 'visible', // 🟢 确保图片可见
                opacity: 1, // 🟢 确保图片不透明
              }}
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
        );
      })}
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
