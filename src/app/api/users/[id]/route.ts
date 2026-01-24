import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
// 🟢 关键修改：引用持久化 DB
import { db } from '@/lib/db';
import { prisma } from '@/lib/prisma';
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

  // 🟢 使用 db 方法删除（已更新为事务处理）
  const result = await db.deleteUser(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error || '删除用户失败' }, { status: 500 });
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
      // 🟢 在职状态支持
      if (formData.has('isActive')) {
        const isActiveValue = formData.get('isActive');
        updateData.isActive = isActiveValue === 'true';
      }

      // 如果前端传了 permissions 字符串，尝试解析
      if (formData.has('permissions')) {
        try {
          updateData.permissions = JSON.parse(formData.get('permissions') as string);
        } catch (e) { }
      }

      // 头像处理 (保持原有逻辑，文件系统操作是允许的)
      const avatarFile = formData.get('avatarFile') as File;
      if (avatarFile && avatarFile.size > 0) {
        const buffer = Buffer.from(await avatarFile.arrayBuffer());
        const ext = path.extname(avatarFile.name) || '.jpg';
        // 使用时间戳防止缓存
        const safeFileName = `AVATAR-${id}-${Date.now()}${ext}`;
        const filePath = path.join(AVATAR_DIR, safeFileName);
        const relativePath = `/uploads/avatars/${safeFileName}`;
        let fileWritten = false;

        try {
          fs.writeFileSync(filePath, buffer);
          fileWritten = true;
          updateData.avatar = relativePath;

          // 同步到FileMetadata表（用于备份索引）
          try {
            const crypto = await import('crypto');
            const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');
            await prisma.fileMetadata.upsert({
              where: { filePath: relativePath },
              update: {
                fileName: avatarFile.name,
                fileType: ext.replace('.', '') || 'jpg',
                fileSize: avatarFile.size,
                md5Hash,
                category: 'avatars',
                uploaderId: id,
                uploadedAt: new Date()
              },
              create: {
                filePath: relativePath,
                fileName: avatarFile.name,
                fileType: ext.replace('.', '') || 'jpg',
                fileSize: avatarFile.size,
                md5Hash,
                category: 'avatars',
                uploaderId: id,
                uploadedAt: new Date()
              }
            });
          } catch (metaError) {
            // FileMetadata保存失败不影响主流程，只记录日志
            console.warn('保存FileMetadata失败（不影响主流程）:', metaError);
          }
        } catch (ioError) {
          // 如果文件写入失败，清理可能已写入的文件
          if (fileWritten && fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (cleanupError) {
              console.error('清理文件失败:', cleanupError);
            }
          }
          throw ioError;
        }
      }
    }
    // 分支2: 纯 JSON 更新 (例如只改权限或状态)
    else {
      updateData = await req.json();
    }

    // 🆕 检查用户是否从在职变为离职（isActive: true -> false）
    const wasActive = existingUser.isActive !== false; // 默认为 true
    const willBeActive = updateData.isActive !== false; // 如果未提供，默认为 true
    
    // 🟢 使用 db 方法更新
    const updatedUser = await db.updateUser(id, updateData);

    if (!updatedUser) {
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    // 🆕 如果用户从在职变为离职，自动驳回该用户作为执行人的隐患
    if (wasActive && !willBeActive) {
      try {
        const { autoRejectHazardsByExecutor } = await import('@/services/hazardAutoReject.service');
        const rejectResult = await autoRejectHazardsByExecutor(
          id,
          '执行人已离职'
        );
        console.log(`[用户更新] 用户 ${id} 离职，自动驳回隐患结果: 成功 ${rejectResult.rejectedCount} 条，失败 ${rejectResult.errors.length} 条`);
        if (rejectResult.errors.length > 0) {
          console.warn('[用户更新] 部分隐患驳回失败:', rejectResult.errors);
        }
      } catch (rejectError) {
        console.error('[用户更新] 自动驳回隐患失败（不影响用户更新）:', rejectError);
        // 不阻断用户更新流程，只记录错误
      }
    }

    // 触发调岗（job change）事件：若职位发生变化则入队，由 worker 处理
    try {
      if (existingUser.jobTitle !== updatedUser.jobTitle) {
        try {
          const { enqueueAutoAssign } = await import('@/services/queue.service');
          await enqueueAutoAssign('job_changed', { userId: id, oldJob: existingUser.jobTitle, newJob: updatedUser.jobTitle });
        } catch (e) {
          // 入队失败则回退为直接异步触发
          import('@/services/autoAssign.service').then(mod => {
            mod.processEvent('job_changed', { userId: id, oldJob: existingUser.jobTitle, newJob: updatedUser.jobTitle })
              .then(res => console.log('autoAssign job_changed fallback result', res))
              .catch(err => console.error('autoAssign job_changed fallback error', err));
          }).catch(err => console.error('load autoAssign.service failed', err));
        }
      }
    } catch (e) {
      console.error('检测/触发 job_changed 失败', e);
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
});
