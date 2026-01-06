import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: 获取所有部门列表 (扁平结构)
// 用于前端根据 deptId 查找部门名称
export async function GET() {
  try {
    // 获取扁平化的部门列表 (mockDb.ts 中已定义 getDepartments)
    const departments = await db.getDepartments();
    
    // 如果需要由树状结构转扁平，也可以在这里处理
    // 但 db.getDepartments() 本身就是读取 org.json 的扁平数组
    
    return NextResponse.json(departments);
  } catch (error) {
    console.error("Fetch structure failed", error);
    return NextResponse.json({ error: 'Failed to fetch structure' }, { status: 500 });
  }
}