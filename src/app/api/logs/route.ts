// src/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = (page - 1) * limit;
  const isPaginated = searchParams.has('page');

  try {
    const queryOptions: any = {
      orderBy: { createdAt: 'desc' }
    };

    if (isPaginated) {
      queryOptions.skip = skip;
      queryOptions.take = limit;
    } else {
      queryOptions.take = 100; // Default limit if no pagination
    }

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany(queryOptions),
      prisma.systemLog.count()
    ]);

    if (isPaginated) {
        return NextResponse.json({
            data: logs,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: '获取日志失败' }, { status: 500 });
  }
}