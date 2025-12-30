import { NextRequest, NextResponse } from 'next/server';
import { PeopleFinder } from '@/lib/peopleFinder';
import { withAuth } from '@/middleware/auth';

export const GET = withAuth(async (req, context, user) => {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const deptId = searchParams.get('deptId') || undefined;

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const users = await PeopleFinder.searchUsers(query, deptId);
    return NextResponse.json(users.map(u => ({
        id: u.id,
        name: u.name,
        jobTitle: u.jobTitle,
        departmentId: u.departmentId
    })));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
});
