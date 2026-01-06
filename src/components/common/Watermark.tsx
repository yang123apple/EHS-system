// src/components/common/Watermark.tsx
import React from 'react';

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
    const generateDynamicLine = (): string => {
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
    };

    const line2 = generateDynamicLine();
    
    // 如果两行都为空，则不显示水印
    if (!line1 && !line2) return null;
    
    // 生成重复的水印平铺背景
    const pattern = Array(20).fill({ line1, line2 });

    // 根据 relative 属性选择定位方式
    const positionClass = relative 
        ? 'absolute inset-0'  // 相对定位，相对于父容器
        : 'fixed inset-0';   // 固定定位，覆盖整个视口

    return (
        <div className={`${positionClass} z-[9999] pointer-events-none overflow-hidden select-none flex flex-wrap content-start opacity-[0.08]`}>
            {pattern.map((item, i) => (
                <div key={i} className="w-[300px] h-[300px] flex flex-col items-center justify-center transform -rotate-45 text-slate-900 text-2xl font-black gap-1">
                    {item.line1 && (
                        <div className="whitespace-nowrap leading-tight">{item.line1}</div>
                    )}
                    {item.line2 && (
                        <div className="whitespace-nowrap leading-tight text-[1.05rem]">{item.line2}</div>
                    )}
                </div>
            ))}
        </div>
    );
}
