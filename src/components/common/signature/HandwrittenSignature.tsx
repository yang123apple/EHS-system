'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { cropSignatureCanvas, canvasToBase64, scaleCanvas } from '@/utils/signatureCrop';

export interface HandwrittenSignatureProps {
  value?: string; // base64 图片数据
  onChange?: (base64: string) => void;
  onClose?: () => void;
  width?: number;
  height?: number;
  disabled?: boolean;
}

export function HandwrittenSignature({
  value,
  onChange,
  onClose,
  width = 600,
  height = 300,
  disabled = false
}: HandwrittenSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!value);

  // 初始化画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸
    canvas.width = width;
    canvas.height = height;

    // 设置绘制样式
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 如果有初始值，加载图片
    if (value && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
      };
      img.src = value;
    } else if (value) {
      // 如果是纯 base64，添加 data URL 前缀
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
      };
      img.src = `data:image/png;base64,${value}`;
    }
  }, [value, width, height]);

  // 手动添加非 passive 的触摸事件监听器，确保 preventDefault 可以正常工作
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 触摸开始
    const handleTouchStart = (e: TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      setIsDrawing(true);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const touch = e.touches[0];
      if (touch) {
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };

    // 触摸移动
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDrawing || disabled) return;
      e.preventDefault();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const touch = e.touches[0];
      if (touch) {
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    };

    // 触摸结束
    const handleTouchEnd = (e: TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();
      setIsDrawing(false);
      setHasSignature(true);
    };

    // 添加事件监听器，使用 { passive: false } 确保可以调用 preventDefault
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isDrawing, disabled]);

  // 获取画布坐标
  const getCanvasCoordinates = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      // 触摸事件
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      // 鼠标事件
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  }, []);

  // 开始绘制（鼠标事件）
  const startDrawingMouse = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  }, [disabled, getCanvasCoordinates]);

  // 开始绘制（触摸事件）
  const startDrawingTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  }, [disabled, getCanvasCoordinates]);

  // 绘制中（鼠标事件）
  const drawMouse = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e.nativeEvent);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  }, [isDrawing, disabled, getCanvasCoordinates]);

  // 绘制中（触摸事件）
  const drawTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e.nativeEvent);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  }, [isDrawing, disabled, getCanvasCoordinates]);

  // 结束绘制（鼠标事件）
  const stopDrawingMouse = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasSignature(true);
    
    // 自动保存（不裁剪，保持实时预览）
    // 裁剪操作在用户点击"保存签名"时执行
  }, [isDrawing]);

  // 结束绘制（触摸事件）
  const stopDrawingTouch = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasSignature(true);
    
    // 自动保存（不裁剪，保持实时预览）
    // 裁剪操作在用户点击"保存签名"时执行
  }, [isDrawing]);

  // 清除签名
  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    if (onChange) {
      onChange('');
    }
  }, [onChange]);

  // 保存签名（自动裁剪并缩放50%）
  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;

    try {
      // 第一步：自动裁剪空白区域
      const croppedCanvas = cropSignatureCanvas(canvas, 10, 2);
      
      // 第二步：缩放50%
      const scaledCanvas = scaleCanvas(croppedCanvas, 0.5);
      
      // 转换为 base64
      const base64String = canvasToBase64(scaledCanvas, 0.92, 'image/png');
      
      onChange(base64String);
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('保存签名失败:', error);
      // 如果处理失败，使用原始图片并缩放50%
      try {
        const scaledCanvas = scaleCanvas(canvas, 0.5);
        const base64String = canvasToBase64(scaledCanvas, 0.92, 'image/png');
        onChange(base64String);
      } catch (fallbackError) {
        console.error('缩放失败，使用原始图片:', fallbackError);
        const base64 = canvas.toDataURL('image/png');
        const base64String = base64.split(',')[1];
        onChange(base64String);
      }
      if (onClose) {
        onClose();
      }
    }
  }, [onChange, onClose]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative border-2 border-slate-300 rounded-lg bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawingMouse}
          onMouseMove={drawMouse}
          onMouseUp={stopDrawingMouse}
          onMouseLeave={stopDrawingMouse}
          className="cursor-crosshair"
          style={{ 
            width: `${width}px`, 
            height: `${height}px`,
            touchAction: 'none' // 防止触摸事件的默认行为（滚动、缩放等）
          }}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-slate-400 text-sm">请在此处签名</span>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={clearSignature}
          disabled={disabled || !hasSignature}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed text-slate-700 rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          清除
        </button>
        {onClose && (
          <button
            onClick={saveSignature}
            disabled={disabled || !hasSignature}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
          >
            保存签名
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm transition-colors"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}
