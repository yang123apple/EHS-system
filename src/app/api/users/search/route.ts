import { NextRequest, NextResponse } from 'next/server';
import { PeopleFinder } from '@/lib/peopleFinder';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req, context, user) => {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const deptId = searchParams.get('deptId') || undefined;
  const activeOnly = searchParams.get('activeOnly') === 'true'; // 🟢 新增：是否只查询在职用户

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const users = await PeopleFinder.searchUsers(query, deptId);
    
    // 🟢 新增：如果 activeOnly 为 true，过滤掉离职用户
    const filteredUsers = activeOnly 
      ? users.filter(u => u.isActive !== false) // 过滤掉 isActive 为 false 的用户
      : users;
    
    return NextResponse.json(filteredUsers.map(u => ({
        id: u.id,
        name: u.name,
        jobTitle: u.jobTitle,
        departmentId: u.departmentId,
        isActive: u.isActive // 🟢 返回在职状态
    })));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
});
