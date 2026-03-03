// src/app/api/webhooks/revalidate/route.ts
//
// 标准 Webhook：调用 revalidateTag 让 Next.js 自行清除带指定 tag 的
// ISR 静态缓存和内存数据，实现不中断主进程的无缝热更新。
//
// 调用示例（CI/CD deploy 步骤）：
//   curl -X POST /api/webhooks/revalidate \
//     -H "x-webhook-secret: $WEBHOOK_SECRET" \
//     -d '{"tags":["archive-status"]}'
//
// 环境变量：WEBHOOK_SECRET（必须设置，否则所有请求均拒绝）

import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

const ALLOWED_TAGS = new Set([
    'archive-status',
    'dashboard',
    'hazard-list',
    'training-list',
]);

export async function POST(request: NextRequest) {
    // ── 1. 鉴权 ────────────────────────────────────────────────
    const secret = request.headers.get('x-webhook-secret');
    const expected = process.env.WEBHOOK_SECRET;

    if (!expected) {
        // 环境变量未配置时拒绝，防止开放端点被滥用
        return NextResponse.json(
            { error: 'Webhook secret not configured on server' },
            { status: 503 }
        );
    }

    if (!secret || secret !== expected) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    // ── 2. 解析 tags ────────────────────────────────────────────
    let tags: string[] = ['archive-status']; // 默认刷新 archive-status
    try {
        const body = await request.json();
        if (Array.isArray(body?.tags) && body.tags.length > 0) {
            tags = body.tags;
        }
    } catch {
        // body 为空或非 JSON → 使用默认 tags
    }

    // ── 3. 白名单过滤（防止随意刷爆所有缓存）──────────────────
    const invalidTags = tags.filter(t => !ALLOWED_TAGS.has(t));
    if (invalidTags.length > 0) {
        return NextResponse.json(
            { error: `Unknown tags: ${invalidTags.join(', ')}` },
            { status: 400 }
        );
    }

    // ── 4. 执行热更新（不杀进程、不删文件）────────────────────
    const revalidated: string[] = [];
    for (const tag of tags) {
        revalidateTag(tag);
        revalidated.push(tag);
    }

    return NextResponse.json({
        revalidated: true,
        tags: revalidated,
        timestamp: new Date().toISOString(),
    });
}
