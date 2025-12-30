import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
// 🟢 关键修改：引用持久化 DB
import { db } from '@/lib/db';
import { withAuth, withAdmin } from '@/middleware/auth';

// 确保头像目录存在
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const AVATAR_DIR = path.join(PUBLIC_DIR, 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

// GET: 获取单个用户
export const GET = withAuth<{ params: Promise<{ id: string }> }>(async (req, context, currentUser) => {
  const { params } = context;
  const { id } = await params;
  
  // 🟢 使用 db 方法获取
  const targetUser = await db.getUserById(id);
  
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  
  return NextResponse.json(targetUser);
});

// DELETE: 删除用户
export const DELETE = withAdmin<{ params: Promise<{ id: string }> }>(async (req, context, currentUser) => {
  const { params } = context;
  const { id } = await params;
  
  const target = await db.getUserById(id);
  
  if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  if (target.username === 'admin') return NextResponse.json({ error: '无法删除超级管理员' }, { status: 403 });

  // 🟢 使用 db 方法删除
  if (typeof db.deleteUser === 'function') {
      await db.deleteUser(id);
  } else {
      return NextResponse.json({ error: 'Database method deleteUser not implemented' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});

// PUT: 更新用户 (支持 头像 + 信息 + 职务)
export const PUT = withAdmin<{ params: Promise<{ id: string }> }>(async (req, context, currentUser) => {
  const { params } = context;
  const { id } = await params;
  const contentType = req.headers.get('content-type') || '';
  
  // 检查用户是否存在
  const existingUser = await db.getUserById(id);
  if (!existingUser) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  let updateData: any = {};

  try {
    // 分支1: 包含文件的更新 (头像+信息) - 这里的 formData 对应前端编辑弹窗的提交
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      
      // 基础信息提取
      if (formData.has('name')) updateData.name = formData.get('name');
      if (formData.has('department')) updateData.department = formData.get('department');
      if (formData.has('jobTitle')) updateData.jobTitle = formData.get('jobTitle');
      // 🟢 新增字段支持
      if (formData.has('directManagerId')) updateData.directManagerId = formData.get('directManagerId');

      // 如果前端传了 permissions 字符串，尝试解析
      if (formData.has('permissions')) {
        try {
            updateData.permissions = JSON.parse(formData.get('permissions') as string);
        } catch(e) {}
      }

      // 头像处理 (保持原有逻辑，文件系统操作是允许的)
      const avatarFile = formData.get('avatarFile') as File;
      if (avatarFile && avatarFile.size > 0) {
         const buffer = Buffer.from(await avatarFile.arrayBuffer());
         const ext = path.extname(avatarFile.name) || '.jpg';
         // 使用时间戳防止缓存
         const safeFileName = `AVATAR-${id}-${Date.now()}${ext}`;
         
         fs.writeFileSync(path.join(AVATAR_DIR, safeFileName), buffer);
         updateData.avatar = `/uploads/avatars/${safeFileName}`;
      }
    } 
    // 分支2: 纯 JSON 更新 (例如只改权限或状态)
    else {
      updateData = await req.json();
    }

    // 🟢 使用 db 方法更新
    const updatedUser = await db.updateUser(id, updateData);

    if (!updatedUser) {
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
});
