// src/app/api/hazards/workflow/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const WORKFLOW_FILE = path.join(process.cwd(), 'data', 'hazard-workflow.json');

// 确保目录存在
function ensureDir() {
  const dir = path.dirname(WORKFLOW_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 默认配置
const DEFAULT_WORKFLOW = {
  ccRules: [] as Array<{
    id: string;
    name: string;
    riskLevels: string[]; // 触发风险等级 ['high', 'major']
    ccDepts: string[]; // 抄送部门ID列表
    ccUsers: string[]; // 抄送人员ID列表
    enabled: boolean;
  }>,
  emergencyPlanRules: [] as Array<{
    id: string;
    riskLevels: string[]; // 需要应急预案的风险等级
    deadlineDays: number; // 要求提交预案的天数
    enabled: boolean;
  }>
};

export async function GET() {
  ensureDir();
  
  if (!fs.existsSync(WORKFLOW_FILE)) {
    fs.writeFileSync(WORKFLOW_FILE, JSON.stringify(DEFAULT_WORKFLOW, null, 2));
    return NextResponse.json(DEFAULT_WORKFLOW);
  }
  
  const data = JSON.parse(fs.readFileSync(WORKFLOW_FILE, 'utf-8'));
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  ensureDir();
  const body = await request.json();
  fs.writeFileSync(WORKFLOW_FILE, JSON.stringify(body, null, 2));
  return NextResponse.json({ success: true });
}
