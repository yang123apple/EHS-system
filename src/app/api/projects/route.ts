import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLog } from '@/lib/logger';
import { setStartOfDay, setEndOfDay, extractDatePart, nowISOString } from '@/utils/dateUtils';

// GET: 获取所有工程/项目列表
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Check if pagination is requested
    const isPaginated = searchParams.has('page');
    const q = searchParams.get('q');
    const status = searchParams.get('status'); // 'ongoing', 'upcoming', 'finished'
    const date = searchParams.get('date');

    const where: any = { deletedAt: null };

    if (q) {
        where.OR = [
            { name: { contains: q } },
            { code: { contains: q } },
            { location: { contains: q } },
            { supplierName: { contains: q } },
            { contractNo: { contains: q } }
        ];
    }

    if (date) {
        // Find projects active on this date
        // startDate <= date <= endDate
        // 开始时间设置为当天的 00:00:00，结束时间设置为当天的 23:59:59.999
        const startOfDay = setStartOfDay(extractDatePart(date));
        const endOfDay = setEndOfDay(extractDatePart(date));
        where.startDate = { lte: endOfDay };
        where.endDate = { gte: startOfDay };
    }

    if (status) {
        const now = new Date();
        // Since we can't easily do complex date comparison in SQLite via Prisma for "status" alias
        // we might have to handle this carefully or just map status to date ranges if possible.
        // 'ongoing': start <= now <= end
        // 'upcoming': start > now
        // 'finished': end < now
        if (status === 'ongoing') {
            where.startDate = { lte: now };
            where.endDate = { gte: now };
        } else if (status === 'upcoming') {
            where.startDate = { gt: now };
        } else if (status === 'finished') {
            where.endDate = { lt: now };
        }
    }

    // 🟢 修改：确保查出 deletedAt 为空的
    const queryOptions: any = {
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { permits: true } } }
    };

    if (isPaginated) {
        queryOptions.skip = skip;
        queryOptions.take = limit;
    }

    const [projects, total] = await Promise.all([
        prisma.project.findMany(queryOptions),
        prisma.project.count({ where })
    ]);

    if (isPaginated) {
        return NextResponse.json({
            data: projects,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }

    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: '获取项目失败' }, { status: 500 });
  }
}

// 辅助函数：生成项目编号
async function generateSequentialCode() {
    const now = new Date();
    const prefix = `${now.getFullYear().toString().slice(-2)}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
    const latest = await prisma.project.findFirst({ where: { code: { startsWith: `${prefix}-` } }, orderBy: { code: 'desc' }, select: { code: true } });
    let seq = 1;
    if (latest?.code) { const parts = latest.code.split('-'); if (parts.length===2) seq = parseInt(parts[1]) + 1; }
    return `${prefix}-${seq.toString().padStart(3, '0')}`;
}

// POST: 创建新项目
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // 🟢 1. 解构 attachments
    const { name, contractNo, location, startDate, endDate, requestDept, requestHead, requestContact, mgmtDept, mgmtHead, mgmtContact, supplierName, supplierHead, supplierContact, attachments, userId, userName } = body;
    if (!name || !location || !supplierName) return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    const autoCode = await generateSequentialCode();
    // 开始时间设置为当天的 00:00:00，结束时间设置为当天的 23:59:59.999
    const newProject = await prisma.project.create({
      data: {
        code: autoCode,
        name, contractNo, location,
        startDate: setStartOfDay(extractDatePart(startDate)), 
        endDate: setEndOfDay(extractDatePart(endDate)),
        requestDept, requestHead: requestHead||"", requestContact: requestContact||"",
        mgmtDept, mgmtHead, mgmtContact,
        supplierName, supplierHead: supplierHead||"", supplierContact: supplierContact||"",
        // 🟢 2. 保存附件 (转 JSON 字符串)
        attachments: attachments ? JSON.stringify(attachments) : null
      }
    });

    // 🟢 插入日志
    if (userId && userName) {
      createLog(
        userId,
        userName,
        'CREATE',
        newProject.id,
        `创建工程项目: ${name}`,
        'project',
        'WORK_PERMIT'
      );
    }

    return NextResponse.json(newProject);
  } catch (error) {
    console.error("Create Project Error:", error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

// ✅ PATCH: 更新项目信息 (用于工期调整)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, startDate, endDate, userId, userName } = body;

    if (!id) return NextResponse.json({ error: '缺少 ID' }, { status: 400 });

    const dataToUpdate: any = {};
    // 开始时间设置为当天的 00:00:00，结束时间设置为当天的 23:59:59.999
    if (startDate) dataToUpdate.startDate = setStartOfDay(extractDatePart(startDate));
    if (endDate) dataToUpdate.endDate = setEndOfDay(extractDatePart(endDate));

    const updatedProject = await prisma.project.update({
      where: { id },
      data: dataToUpdate,
    });

    // 🟢 插入日志
    if (userId && userName) {
      createLog(
        userId,
        userName,
        'UPDATE',
        id,
        '更新工程项目信息',
        'project',
        'WORK_PERMIT'
      );
    }

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Update Project Error:", error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE: 删除项目 (软删除)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    if (!id) return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
    
    // 🟢 软删除：更新 deletedAt 字段
    await prisma.project.update({ 
      where: { id },
      data: { deletedAt: new Date(nowISOString()) }
    });

    // 🟢 插入日志
    if (userId && userName) {
      createLog(
        userId,
        userName,
        'DELETE',
        id,
        '删除工程项目',
        'project',
        'WORK_PERMIT'
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Project Error:", error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}