import { NextResponse } from 'next/server';
// 🟢 引用新的持久化 db
import { db } from '@/lib/db'; 

export async function GET() {
  const tree = db.getOrgTree(); // 现在是同步读取文件，如果是异步也可以 await
  return NextResponse.json(tree);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, managerId, parentId } = body;

  // 计算层级
  let level = 1;
  if (parentId) {
    const allDepts = db.getDepartments();
    const parent = allDepts.find(d => d.id === parentId);
    if (parent) level = parent.level + 1;
  }

  const newDept = db.createDepartment({
    name,
    parentId: parentId || null,
    managerId,
    level
  });
  
  return NextResponse.json(newDept);
}