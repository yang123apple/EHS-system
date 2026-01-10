import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { assignOnboardingPlanToUser } from '@/services/onboardingService';
import { withAuth, withAdmin } from '@/middleware/auth';
import bcrypt from 'bcryptjs';

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

  const finalUsers = rawUsers.map((u: any) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    department: u.department?.name || '',
    departmentId: u.departmentId,
    role: u.role,
    avatar: u.avatar,
    jobTitle: u.jobTitle || '',
    permissions: u.permissions ? JSON.parse(u.permissions) : {},
    directManagerId: u.directManagerId
  }));

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

    // 创建
    const newUser = await prisma.user.create({
      data: {
        username: body.username,
        name: body.name,
        password: hashedPassword,
        role: 'user',
        avatar: '/image/default_avatar.jpg',
        permissions: '{}', // 默认空权限
        departmentId: body.departmentId,
        jobTitle: body.jobTitle,
        // 如果前端传了 department (string名称)，我们这里可能没法存，因为 schema 里只有 departmentId
        // 所以我们假设前端传了正确的 departmentId
      }
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
