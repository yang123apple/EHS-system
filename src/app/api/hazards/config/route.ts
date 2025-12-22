import { NextResponse } from 'next/server';

export async function GET() {
  // 返回默认隐患配置
  const data = {
    types: ['火灾', '爆炸', '中毒', '窒息', '触电', '机械伤害'],
    areas: ['施工现场', '仓库', '办公室', '车间', '其他']
  };
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  // Body should contain { types: string[] } or { areas: string[] }
  // For now, just return the config as-is (no persistence)
  return NextResponse.json({
    success: true,
    ...body
  });
}