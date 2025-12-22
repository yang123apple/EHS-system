// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { getUsers } from '@/lib/userDb';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    const users = getUsers();
    
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      // 登录成功，返回用户信息 (为了安全，通常不返回密码，但在本演示中暂且保留以便逻辑简单)
      return NextResponse.json({ success: true, user });
    } else {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}