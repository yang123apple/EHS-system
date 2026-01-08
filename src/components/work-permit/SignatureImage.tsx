'use client';

import { useState, useEffect } from 'react';
import { getAspectRatio } from '@/utils/signatureCrop';

interface SignatureImageProps {
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
export default function SignatureImage({
  base64,
  maxWidth = 200,
  maxHeight = 100,
  className = '',
  style = {}
}: SignatureImageProps) {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!base64) {
      setImageSize(null);
      setImageLoaded(false);
      return;
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
    };
    img.onerror = () => {
      setImageSize(null);
      setImageLoaded(false);
    };
    img.src = `data:image/png;base64,${base64}`;
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
      src={`data:image/png;base64,${base64}`}
      alt="签名"
      className={className}
      style={{
        width: `${imageSize.width}px`,
        height: `${imageSize.height}px`,
        maxWidth: `${maxWidth}px`,
        maxHeight: `${maxHeight}px`,
        objectFit: 'contain',
        display: 'block', // 确保图片作为块级元素，避免底部空白
        ...style
      }}
    />
  );
}

