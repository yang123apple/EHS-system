/**
 * 手写签名自动裁剪工具
 * 识别签名内容的最小边界框，裁剪掉四周多余的空白区域
 */

/**
 * 检查像素是否为空白（透明或白色）
 * 性能优化：快速判断，减少计算
 */
function isBlankPixel(r: number, g: number, b: number, a: number, threshold: number = 10): boolean {
  // 完全透明（alpha < 5）
  if (a < 5) return true;
  
  // 接近白色（RGB 值都接近 255）
  const whiteThreshold = 255 - threshold;
  return r > whiteThreshold && g > whiteThreshold && b > whiteThreshold;
}

/**
 * 自动裁剪 Canvas，移除四周的空白区域
 * @param canvas - 原始 Canvas 元素
 * @param blankThreshold - 空白像素阈值（0-255，默认 10）
 * @param sampleStep - 采样步长（用于性能优化，默认 2，即每 2 个像素采样一次）
 * @returns 裁剪后的 Canvas 元素，如果无法裁剪则返回原 Canvas
 */
export function cropSignatureCanvas(
  canvas: HTMLCanvasElement,
  blankThreshold: number = 10,
  sampleStep: number = 2
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  
  // 获取图像数据
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 性能优化：使用采样步长减少扫描次数
  // 先粗略扫描找到大致边界，再精确扫描
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  // 第一阶段：粗略扫描（使用较大步长快速定位边界）
  // 性能优化：根据画布大小动态调整步长
  const roughStep = width > 800 || height > 600 ? Math.max(sampleStep * 2, 8) : Math.max(sampleStep, 4);
  let foundContent = false;

  // 性能优化：使用采样步长减少扫描次数
  for (let y = 0; y < height; y += roughStep) {
    for (let x = 0; x < width; x += roughStep) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];

      if (!isBlankPixel(r, g, b, a, blankThreshold)) {
        foundContent = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // 如果没有找到内容，返回原 Canvas
  if (!foundContent) {
    return canvas;
  }

  // 第二阶段：精确扫描边界区域（使用较小步长）
  // 向上扩展边界
  for (let y = Math.max(0, minY - roughStep); y < minY; y++) {
    for (let x = Math.max(0, minX - roughStep); x < Math.min(width, maxX + roughStep); x += sampleStep) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];

      if (!isBlankPixel(r, g, b, a, blankThreshold)) {
        minY = Math.min(minY, y);
        minX = Math.min(minX, x);
        break;
      }
    }
  }

  // 向下扩展边界
  for (let y = maxY + 1; y < Math.min(height, maxY + roughStep); y++) {
    for (let x = Math.max(0, minX - roughStep); x < Math.min(width, maxX + roughStep); x += sampleStep) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];

      if (!isBlankPixel(r, g, b, a, blankThreshold)) {
        maxY = Math.max(maxY, y);
        maxX = Math.max(maxX, x);
        break;
      }
    }
  }

  // 向左扩展边界
  for (let x = Math.max(0, minX - roughStep); x < minX; x++) {
    for (let y = minY; y <= maxY; y += sampleStep) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];

      if (!isBlankPixel(r, g, b, a, blankThreshold)) {
        minX = Math.min(minX, x);
        break;
      }
    }
  }

  // 向右扩展边界
  for (let x = maxX + 1; x < Math.min(width, maxX + roughStep); x++) {
    for (let y = minY; y <= maxY; y += sampleStep) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];

      if (!isBlankPixel(r, g, b, a, blankThreshold)) {
        maxX = Math.max(maxX, x);
        break;
      }
    }
  }

  // 添加一些边距（可选，让签名看起来更自然）
  const padding = 10;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;

  // 如果裁剪后的尺寸太小或没有变化，返回原 Canvas
  if (cropWidth < 10 || cropHeight < 10 || (cropWidth === width && cropHeight === height)) {
    return canvas;
  }

  // 创建新的 Canvas 并绘制裁剪后的内容
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedCtx = croppedCanvas.getContext('2d');
  
  if (!croppedCtx) return canvas;

  // 设置白色背景（可选，如果需要）
  croppedCtx.fillStyle = '#FFFFFF';
  croppedCtx.fillRect(0, 0, cropWidth, cropHeight);

  // 绘制裁剪后的图像
  croppedCtx.drawImage(
    canvas,
    minX, minY, cropWidth, cropHeight,
    0, 0, cropWidth, cropHeight
  );

  return croppedCanvas;
}

/**
 * 将 Canvas 转换为 Base64 字符串
 * @param canvas - Canvas 元素
 * @param quality - 图片质量（0-1，默认 0.92）
 * @param format - 图片格式（默认 'image/png'）
 * @returns Base64 字符串（不包含 data URL 前缀）
 */
export function canvasToBase64(
  canvas: HTMLCanvasElement,
  quality: number = 0.92,
  format: string = 'image/png'
): string {
  const dataUrl = canvas.toDataURL(format, quality);
  // 移除 data URL 前缀，只返回 base64 字符串
  return dataUrl.split(',')[1];
}

/**
 * 将 Canvas 转换为 Blob
 * @param canvas - Canvas 元素
 * @param quality - 图片质量（0-1，默认 0.92）
 * @param format - 图片格式（默认 'image/png'）
 * @returns Promise<Blob>
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number = 0.92,
  format: string = 'image/png'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      format,
      quality
    );
  });
}

/**
 * 缩放 Canvas 到指定比例
 * @param canvas - 原始 Canvas 元素
 * @param scale - 缩放比例（0-1，例如 0.5 表示缩小到 50%）
 * @returns 缩放后的 Canvas 元素
 */
export function scaleCanvas(canvas: HTMLCanvasElement, scale: number = 0.5): HTMLCanvasElement {
  if (scale <= 0 || scale >= 1) {
    console.warn('缩放比例应在 0-1 之间，已使用默认值 0.5');
    scale = 0.5;
  }

  const scaledWidth = Math.round(canvas.width * scale);
  const scaledHeight = Math.round(canvas.height * scale);

  // 创建新的 Canvas
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = scaledWidth;
  scaledCanvas.height = scaledHeight;
  const scaledCtx = scaledCanvas.getContext('2d');
  
  if (!scaledCtx) return canvas;

  // 使用高质量缩放
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.imageSmoothingQuality = 'high';

  // 绘制缩放后的图像
  scaledCtx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);

  return scaledCanvas;
}

/**
 * 计算图片的宽高比
 * @param width - 图片宽度
 * @param height - 图片高度
 * @returns 宽高比（width / height）
 */
export function getAspectRatio(width: number, height: number): number {
  if (height === 0) return 1;
  return width / height;
}

