// src/components/common/Watermark.tsx
import React from 'react';

export default function Watermark({ text }: { text: string }) {
    if (!text) return null;
    
    // 生成重复的水印平铺背景
    const pattern = Array(20).fill(text);

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden select-none flex flex-wrap content-start opacity-[0.08]">
            {pattern.map((t, i) => (
                <div key={i} className="w-[300px] h-[300px] flex items-center justify-center transform -rotate-45 text-slate-900 text-2xl font-black whitespace-nowrap">
                    {t}
                </div>
            ))}
        </div>
    );
}
