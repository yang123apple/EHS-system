import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { assignOnboardingPlanToUser } from '@/services/onboardingService';
import { withAuth, withAdmin } from '@/middleware/auth';
import bcrypt from 'bcryptjs';
import { maskUserSensitiveFields } from '@/utils/dataMasking';
import { safeJsonParse } from '@/utils/jsonUtils';

// GET: 获取所有用户 (Support Pagination)
export const GET = withAuth(async (req, context, user) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50'); // Default 50 to avoid heavy load
  const skip = (page - 1) * limit;

  // If limit is -1, return all (use cautiously, maybe restrict to internal use)
  // Or if no pagination params provided, existing behavior was to return all, but we should probably cap it or check usage.
  // For backward compatibility if page is not provided, we might return all, but let's encourage pagination.
  // However, the frontend currently expects all users for client-side filtering.
  // We'll support both modes. If 'page' is present, paginate. Else return all (for now, until we fully refactor client).
  
  const isPaginated = searchParams.has('page');
  const q = searchParams.get('q');
  const dept = searchParams.get('dept'); // This might be department name or ID
  const activeOnly = searchParams.get('activeOnly') === 'true'; // 🟢 新增：是否只查询在职用户

  const whereCondition: any = {};

  if (q) {
      whereCondition.OR = [
          { name: { contains: q } },
          { username: { contains: q } }
      ];
  }

  if (dept) {
      // Assuming dept might be name based on legacy usage
      // Check if it's potentially an ID (CUIDs are usually 25 chars, alphanumeric)
      // Or just try to match name via relation or direct field
      // The schema has departmentId relations and 'department' field (which is relation)
      // We can search by relation name
      whereCondition.department = {
          name: { contains: dept }
      };
  }

  // 🟢 新增：如果 activeOnly 为 true，只返回在职用户
  if (activeOnly) {
      whereCondition.isActive = true;
  }

  const queryOptions: any = {
    where: whereCondition,
    include: { department: true },
    orderBy: { createdAt: 'desc' }
  };

  if (isPaginated) {
    queryOptions.skip = skip;
    queryOptions.take = limit;
  }

  const [rawUsers, total] = await Promise.all([
      prisma.user.findMany(queryOptions),
      prisma.user.count({ where: whereCondition })
  ]);

  // ✅ 修复问题8：按角色分级返回敏感信息
  const finalUsers = rawUsers.map((u: any) => {
    const userData = {
      id: u.id,
      username: u.username,
      name: u.name,
      department: u.department?.name || '',
      departmentId: u.departmentId,
      role: u.role,
      avatar: u.avatar,
      jobTitle: u.jobTitle || '',
      permissions: safeJsonParse(u.permissions, {}), // ✅ 修复问题9：使用 safeJsonParse
      directManagerId: u.directManagerId,
      isActive: u.isActive ?? true, // 🟢 添加在职状态，默认在职
      // 注意：如果用户表中有 phone、idCard、email 等字段，需要在这里包含
      phone: (u as any).phone,
      idCard: (u as any).idCard,
      email: (u as any).email,
    };
    
    // 对敏感字段进行脱敏处理
    return maskUserSensitiveFields(userData, user.role);
  });

  if (isPaginated) {
      return NextResponse.json({
          data: finalUsers,
          meta: {
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit)
          }
      });
  }

  return NextResponse.json(finalUsers);
});

// 生成8位数字ID（确保唯一）
async function generateUniqueUserId(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 100; // 防止无限循环
  
  while (attempts < maxAttempts) {
    // 生成8位数字ID（10000000-99999999）
    const userId = Math.floor(10000000 + Math.random() * 90000000).toString();
    
    // 检查ID是否已存在
    const existing = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { id: true }
    });
    
    if (!existing) {
      return userId;
    }
    
    attempts++;
  }
  
  // 如果100次尝试都失败，抛出错误
  throw new Error('无法生成唯一的8位数字ID，请稍后重试');
}

// POST: 创建新用户 (Admin)
export const POST = withAdmin(async (req, context, user) => {
  try {
    const body = await req.json();

    // 查重
    const existing = await prisma.user.findUnique({ where: { username: body.username } });
    if (existing) {
      return NextResponse.json({ error: '账号已存在' }, { status: 400 });
    }

    // 对密码进行哈希加密
    const plainPassword = body.password || '123456'; // 默认密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    // 生成8位数字ID
    const userId = await generateUniqueUserId();

    // 构建创建数据
    const createData: any = {
      id: userId, // 使用生成的8位数字ID
      username: body.username,
      name: body.name,
      password: hashedPassword,
      role: 'user',
      avatar: '/image/default_avatar.jpg',
      permissions: '{}', // 默认空权限
      jobTitle: body.jobTitle,
      isActive: body.isActive !== undefined ? body.isActive : true, // 🟢 默认在职
    };

    // 🟢 处理部门关联：如果提供了 departmentId，使用关系连接语法
    if (body.departmentId) {
      createData.department = {
        connect: { id: body.departmentId }
      };
    }

    // 创建
    const newUser = await prisma.user.create({
      data: createData
    });

    // 在用户创建成功后异步触发入职培训任务指派（非阻塞）
    // 选择非阻塞的原因是避免延长管理端创建用户的响应时延；如果需要保证同步完成，可以将下面的调用改为 `await`。
    assignOnboardingPlanToUser(newUser.id)
      .then((res) => {
        if (res?.created) console.log(`Assigned ${res.created} onboarding tasks to user ${newUser.id}`);
      })
      .catch((err) => {
        console.error('assignOnboardingPlanToUser failed for user', newUser.id, err);
      });

    // 为了返回完整对象，可能需要 reload department
    return NextResponse.json({ success: true, user: newUser });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
});
