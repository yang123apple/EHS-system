import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { prisma } from '@/lib/prisma';

// GET: 获取所有用户
export async function GET() {
  const users = await db.getUsers();
  
  // 过滤敏感信息 (密码)，只返回前端需要的字段
  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    department: u.department, // 这里的 department 字段如果是关联对象，需要处理；如果是 string 则直接用
    // 兼容之前的 departmentId 字段 (schema 中有 departmentId)
    departmentId: u.departmentId,
    role: u.role,
    avatar: u.avatar,
    jobTitle: u.jobTitle || '',
    permissions: u.permissions
  }));

  // 由于我们在 db.getUsers 中返回的是 mapUser 后的对象（permissions 已是对象），
  // 但我们注意到 User schema 中 department 变成了 relation。
  // 我们需要确保 db.getUsers() 获取到了 departmentName 或者前端通过 departmentId 再去查
  // 之前的 JSON 数据中 department 是个字符串(部门名)，departmentId 是 ID
  // 我们来优化一下 db.getUsers 的查询，include department

  const rawUsers = await prisma.user.findMany({
    include: { department: true }
  });

  const finalUsers = rawUsers.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    // 如果有关联部门，优先用部门名，否则为空
    department: u.department?.name || '',
    departmentId: u.departmentId,
    role: u.role,
    avatar: u.avatar,
    jobTitle: u.jobTitle || '',
    permissions: u.permissions ? JSON.parse(u.permissions) : {}
  }));

  return NextResponse.json(finalUsers);
}

// POST: 创建新用户 (Admin)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 查重
    const existing = await prisma.user.findUnique({ where: { username: body.username } });
    if (existing) {
      return NextResponse.json({ error: '账号已存在' }, { status: 400 });
    }

    // 创建
    const newUser = await prisma.user.create({
      data: {
        username: body.username,
        name: body.name,
        password: body.password || '123456', // 默认密码
        role: 'user',
        avatar: '/image/default_avatar.jpg',
        permissions: '{}', // 默认空权限
        departmentId: body.departmentId,
        jobTitle: body.jobTitle,
        // 如果前端传了 department (string名称)，我们这里可能没法存，因为 schema 里只有 departmentId
        // 所以我们假设前端传了正确的 departmentId
      }
    });

    // 为了返回完整对象，可能需要 reload department
    return NextResponse.json({ success: true, user: newUser });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
