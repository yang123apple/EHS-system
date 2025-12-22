import { NextResponse } from 'next/server';
import { getUsers, saveUsers, generateUniqueId, User } from '@/lib/userDb';

// GET: 获取所有用户
export async function GET() {
  const users = getUsers();
  
  // 过滤敏感信息 (密码)，只返回前端需要的字段
  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    department: u.department, 
    // 🟢 关键修复：必须返回 departmentId，否则前端无法根据部门ID筛选人员
    departmentId: (u as any).departmentId, 
    role: u.role,
    avatar: u.avatar,
    jobTitle: (u as any).jobTitle || '', 
    permissions: u.permissions
  }));

  return NextResponse.json(safeUsers);
}

// POST: 创建新用户 (Admin)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const users = getUsers();

    // 查重
    if (users.find(u => u.username === body.username)) {
      return NextResponse.json({ error: '账号已存在' }, { status: 400 });
    }

    const newUser: User = {
      ...body,
      id: generateUniqueId(users),
      role: 'user',
      avatar: '/image/default_avatar.jpg',
      permissions: {},
    };

    users.push(newUser);
    saveUsers(users);

    return NextResponse.json({ success: true, user: newUser });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}