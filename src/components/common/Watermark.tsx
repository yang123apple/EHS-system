// src/components/common/Watermark.tsx
import React, { useMemo } from 'react';

interface WatermarkProps {
    text: string;
    /** 是否使用相对定位（相对于父容器），默认为 false（固定定位，覆盖整个视口） */
    relative?: boolean;
    /** 是否包含用户名和ID */
    includeUser?: boolean;
    /** 是否包含当前时间 */
    includeTime?: boolean;
    /** 用户信息（用于动态生成水印） */
    user?: {
        name?: string;
        id?: string;
        username?: string;
    } | null;
}

export default function Watermark({ 
    text, 
    relative = false, 
    includeUser = false, 
    includeTime = false,
    user = null 
}: WatermarkProps) {
    // 生成第一行：用户输入的水印文字
    const line1 = text || '';
    
    // 生成第二行：动态信息（用户名/ID + 时间）
    const line2 = useMemo(() => {
        const parts: string[] = [];
        
        // 用户名和ID
        if (includeUser && user) {
            const userInfo: string[] = [];
            if (user.name) userInfo.push(user.name);
            if (user.id) userInfo.push(`ID:${user.id}`);
            if (userInfo.length > 0) {
                parts.push(userInfo.join(' '));
            }
        }
        
        // 当前时间
        if (includeTime) {
            const now = new Date();
            const timeStr = now.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            parts.push(timeStr);
        }
        
        return parts.join(' · ');
    }, [includeUser, includeTime, user]);
    
    // 如果两行都为空，则不显示水印
    if (!line1 && !line2) return null;
    
    // 🎨 使用 CSS 背景图案方式生成水印 SVG
    // 优势：自动平铺覆盖任意长度文档，性能更好，无需渲染大量 DOM 元素
    const watermarkSvg = useMemo(() => {
        // SVG 尺寸（旋转后的正方形容器）
        const size = 300;
        const fontSize1 = 24; // 第一行字体大小
        const fontSize2 = 17; // 第二行字体大小（稍小）
        
        // 转义 XML 特殊字符
        const escapeXml = (str: string) => {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };
        
        const escapedLine1 = escapeXml(line1);
        const escapedLine2 = escapeXml(line2);
        
        // 计算文本位置（居中）
        const centerX = size / 2;
        const centerY = size / 2;
        const line1Y = line2 ? centerY - 15 : centerY; // 如果有两行，第一行上移
        const line2Y = centerY + 15; // 第二行下移
        
        // 生成 SVG
        const svg = `
            <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <g transform="rotate(-45 ${centerX} ${centerY})" opacity="0.08">
                    ${escapedLine1 ? `
                        <text 
                            x="${centerX}" 
                            y="${line1Y}" 
                            font-size="${fontSize1}" 
                            font-weight="900" 
                            fill="#0f172a" 
                            text-anchor="middle" 
                            dominant-baseline="middle"
                            font-family="system-ui, -apple-system, sans-serif"
                        >${escapedLine1}</text>
                    ` : ''}
                    ${escapedLine2 ? `
                        <text 
                            x="${centerX}" 
                            y="${line2Y}" 
                            font-size="${fontSize2}" 
                            font-weight="900" 
                            fill="#0f172a" 
                            text-anchor="middle" 
                            dominant-baseline="middle"
                            font-family="system-ui, -apple-system, sans-serif"
                        >${escapedLine2}</text>
                    ` : ''}
                </g>
            </svg>
        `;
        
        // 转换为 data URI
        const svgBase64 = btoa(unescape(encodeURIComponent(svg)));
        return `data:image/svg+xml;base64,${svgBase64}`;
    }, [line1, line2]);

    // 根据 relative 属性选择定位方式
    const positionClass = relative 
        ? 'absolute inset-0'  // 相对定位，相对于父容器
        : 'fixed inset-0';   // 固定定位，覆盖整个视口

    return (
        <div 
            className={`${positionClass} z-[9999] pointer-events-none select-none`}
            style={{
                backgroundImage: `url("${watermarkSvg}")`,
                backgroundRepeat: 'repeat',
                backgroundSize: '300px 300px',
                backgroundPosition: '0 0'
            }}
        />
    );
}
