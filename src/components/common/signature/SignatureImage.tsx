'use client';

import { useState, useEffect } from 'react';
import { getAspectRatio } from '@/utils/signatureCrop';

export interface SignatureImageProps {
  base64: string; // base64 图片数据（不含前缀）
  maxWidth?: number; // 最大宽度
  maxHeight?: number; // 最大高度
  className?: string; // 额外的 CSS 类名
  style?: React.CSSProperties; // 额外的样式
}

/**
 * 签名图片组件
 * 根据图片的宽高比自动调整显示大小，保持原始比例，避免拉伸变形
 */
export function SignatureImage({
  base64,
  maxWidth = 200,
  maxHeight = 100,
  className = '',
  style = {}
}: SignatureImageProps) {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [normalizedBase64, setNormalizedBase64] = useState<string>('');

  useEffect(() => {
    if (!base64) {
      setImageSize(null);
      setImageLoaded(false);
      setNormalizedBase64('');
      return;
    }

    // 🟢 规范化base64数据：确保不包含data:image前缀
    let normalized = base64;
    if (typeof normalized === 'string') {
      // 如果包含data:image前缀，提取base64部分
      if (normalized.startsWith('data:image')) {
        normalized = normalized.split(',')[1] || normalized;
      }
      // 移除可能的空白字符
      normalized = normalized.trim();
    } else {
      normalized = String(normalized);
    }
    
    setNormalizedBase64(normalized);

    // 调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [SignatureImage] 加载图片:', {
        originalLength: base64?.length,
        normalizedLength: normalized?.length,
        startsWithDataImage: typeof base64 === 'string' ? base64.startsWith('data:image') : false,
        preview: typeof normalized === 'string' ? normalized.substring(0, 50) : normalized
      });
    }

    const img = new Image();
    img.onload = () => {
      const ratio = getAspectRatio(img.width, img.height);
      
      // 根据宽高比和最大尺寸计算显示尺寸，保持原始比例
      let displayWidth = img.width;
      let displayHeight = img.height;

      // 计算缩放比例（取宽度和高度的缩放比例中的较小值，确保图片完全显示）
      const scaleWidth = maxWidth / displayWidth;
      const scaleHeight = maxHeight / displayHeight;
      const scale = Math.min(scaleWidth, scaleHeight, 1); // 不超过原始大小

      displayWidth = displayWidth * scale;
      displayHeight = displayHeight * scale;

      setImageSize({ width: displayWidth, height: displayHeight });
      setImageLoaded(true);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ [SignatureImage] 图片加载成功:', {
          originalSize: { width: img.width, height: img.height },
          displaySize: { width: displayWidth, height: displayHeight },
          scale
        });
      }
    };
    img.onerror = (error) => {
      setImageSize(null);
      setImageLoaded(false);
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [SignatureImage] 图片加载失败:', {
          error,
          base64Length: normalized?.length,
          preview: typeof normalized === 'string' ? normalized.substring(0, 100) : normalized
        });
      }
    };
    img.src = `data:image/png;base64,${normalized}`;
  }, [base64, maxWidth, maxHeight]);

  if (!base64) {
    return null;
  }

  // 如果图片还未加载完成，显示占位符
  if (!imageLoaded || !imageSize) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ width: `${maxWidth}px`, height: `${maxHeight}px`, ...style }}
      >
        <span className="text-slate-300 text-xs">加载中...</span>
      </div>
    );
  }

  return (
    <img
      src={`data:image/png;base64,${normalizedBase64}`}
      alt="签名"
      className={className}
      style={{
        width: `${imageSize.width}px`,
        height: `${imageSize.height}px`,
        maxWidth: `${maxWidth}px`,
        maxHeight: `${maxHeight}px`,
        minWidth: '20px', // 🟢 确保最小宽度，避免图片太小看不见
        minHeight: '20px', // 🟢 确保最小高度，避免图片太小看不见
        objectFit: 'contain',
        display: 'block', // 确保图片作为块级元素，避免底部空白
        visibility: 'visible', // 🟢 确保图片可见
        opacity: 1, // 🟢 确保图片不透明
        ...style
      }}
      onError={(e) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ [SignatureImage] img标签加载失败:', {
            src: e.currentTarget.src.substring(0, 100),
            base64Length: normalizedBase64?.length
          });
        }
      }}
      onLoad={() => {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ [SignatureImage] img标签加载成功');
        }
      }}
    />
  );
}
