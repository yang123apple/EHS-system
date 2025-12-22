import { NextResponse } from 'next/server';
// 🟢 修正：引用持久化 DB，而不是 mockDb
import { db } from '@/lib/db';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> } 
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = db.updateDepartment(id, body); // 注意：db.ts 里的方法如果是同步的，这里 await 也没关系，如果是异步则必须 await

    if (!updated) {
      return NextResponse.json({ error: '部门不存在' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const allDepts = db.getDepartments();
    const hasChildren = allDepts.some(d => d.parentId === id);

    if (hasChildren) {
      return NextResponse.json({ error: '无法删除：该部门下包含子部门' }, { status: 400 });
    }

    // 检查部门下是否有直属成员
    const allUsers = db.getUsers();
    const hasMembers = allUsers.some(u => u.departmentId === id);
    if (hasMembers) {
         // 可选：阻止删除
         // return NextResponse.json({ error: '该部门下仍有成员，请先移除成员' }, { status: 400 });
    }

    db.deleteDepartment(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}