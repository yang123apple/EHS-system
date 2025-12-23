import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLog } from '@/lib/logger';
export const dynamic = 'force-dynamic';

// 🟢 生成作业单编号（格式：项目日期-项目序号-类型-作业日期-顺序号）
async function generatePermitCode(projectId: string, templateType: string, proposedCode?: string): Promise<string> {
  // 1. 获取项目编号（已经包含日期和序号）
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { code: true }
  });
  
  const projectCode = project?.code || 'UNKNOWN';
  
  // 2. 类型映射表
  const typeMap: Record<string, string> = {
    '动火': 'DH',
    '高处': 'GC',
    '受限空间': 'SX',
    '吊装': 'DZ',
    '冷作': 'LZ',
    '热作': 'RZ',
    '其他': 'QT'
  };
  
  // 查找匹配的类型（支持模糊匹配）
  let typeCode = 'QT'; // 默认为其他
  for (const [key, value] of Object.entries(typeMap)) {
    if (templateType.includes(key)) {
      typeCode = value;
      break;
    }
  }
  
  // 3. 生成作业日期部分 YYMMDD
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const workDateStr = `${year}${month}${day}`;
  
  // 4. 如果提供了建议编号，先检查是否已存在
  if (proposedCode) {
    console.log('🔍 [编号生成] 收到建议编号:', proposedCode);
    const existing = await prisma.workPermitRecord.findUnique({
      where: { code: proposedCode },
      select: { code: true }
    });
    
    // 如果建议编号不存在，直接使用
    if (!existing) {
      console.log('✅ [编号生成] 建议编号可用，直接使用:', proposedCode);
      return proposedCode;
    }
    
    console.log('⚠️ [编号生成] 建议编号已存在，开始顺延...');
    // 如果存在冲突，从建议编号中提取序号并开始顺延
    const parts = proposedCode.split('-');
    // 标准格式：项目日期-项目序号-类型-作业日期-顺序号 (5部分)
    if (parts.length === 5) {
      const baseSeq = parseInt(parts[4], 10);
      if (!isNaN(baseSeq)) {
        // 从建议序号+1开始查找下一个可用编号
        let seq = baseSeq;
        while (seq < 999) {
          seq++;
          const testCode = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${String(seq).padStart(3, '0')}`;
          const testExisting = await prisma.workPermitRecord.findUnique({
            where: { code: testCode }
          });
          if (!testExisting) {
            console.log('✅ [编号生成] 顺延成功，新编号:', testCode);
            return testCode;
          }
        }
      }
    } else {
      console.log('⚠️ [编号生成] 建议编号格式不正确(期望5部分)，将使用标准逻辑重新生成');
      // 格式不对，继续执行标准生成逻辑
    }
  }
  
  // 5. 查询当天同类型的最大顺序号（没有建议编号或顺延失败时）
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  
  const existingRecords = await prisma.workPermitRecord.findMany({
    where: {
      code: {
        contains: `${typeCode}-${workDateStr}`
      },
      createdAt: {
        gte: todayStart,
        lt: todayEnd
      }
    },
    select: { code: true },
    orderBy: { createdAt: 'desc' }
  });
  
  // 6. 计算新的顺序号
  let maxSeq = 0;
  for (const record of existingRecords) {
    if (record.code) {
      const parts = record.code.split('-');
      // 编号格式：项目日期-项目序号-类型-作业日期-顺序号 (5部分)
      if (parts.length === 5) {
        const seq = parseInt(parts[4], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }
  
  const newSeq = String(maxSeq + 1).padStart(3, '0');
  
  // 7. 组装编号：项目编号-类型-作业日期-顺序号
  return `${projectCode}-${typeCode}-${workDateStr}-${newSeq}`;
}

// ✅ 新增：PATCH 方法，用于更新部分字段（如追加评论回复、更新附件等）
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, approvalLogs, attachments, dataJson, userId, userName } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少记录 ID' }, { status: 400 });
    }

    // 构造更新对象，只更新传过来的字段
    const updateData: any = {};
    if (approvalLogs !== undefined) updateData.approvalLogs = approvalLogs;
    if (attachments !== undefined) updateData.attachments = attachments;
    if (dataJson !== undefined) updateData.dataJson = dataJson; // 以备不时之需

    const updatedRecord = await prisma.workPermitRecord.update({
      where: { id },
      data: updateData,
    });

    // 🟢 插入日志
    if (userId && userName) {
      createLog(
        userId,
        userName,
        'UPDATE_PERMIT',
        id,
        '更新作业票记录'
      );
    }

    return NextResponse.json(updatedRecord);
  } catch (error) {
    console.error("Update Permit Error:", error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}
// GET: 获取作业票记录 或 预生成编号
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const action = searchParams.get('action');
  const templateType = searchParams.get('templateType');

  try {
    // 🟢 新增：预生成编号功能
    if (action === 'generate-code' && projectId && templateType) {
      const code = await generatePermitCode(projectId, templateType);
      return NextResponse.json({ code });
    }

    // 原有功能：获取作业票记录
    const whereCondition = projectId ? { projectId } : {}; // 如果没传 projectId，就查所有

    const records = await prisma.workPermitRecord.findMany({
      where: whereCondition,
      include: { 
        template: true, // 关联模板信息
        project: true   // ✅ 关联项目信息 (查所有记录时需要知道是哪个项目的)
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: '获取记录失败' }, { status: 500 });
  }
}

// POST: 提交作业票
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // ✅ 新增：解构 attachments 和 proposedCode
    const { projectId, templateId, dataJson, attachments, proposedCode, userId, userName } = body;
    if (!projectId || !templateId || !dataJson) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }
    
    // 🟢 获取模板信息以生成编号
    const template = await prisma.workPermitTemplate.findUnique({
      where: { id: templateId },
      select: { type: true }
    });
    
    const templateType = template?.type || '其他';
    
    // 🟢 生成作业单编号（如果有建议编号，会检查冲突并自动顺延）
    console.log('📝 [提交] 开始生成编号，建议编号:', proposedCode);
    const permitCode = await generatePermitCode(projectId, templateType, proposedCode);
    console.log('✅ [提交] 最终使用编号:', permitCode);
    
    const newRecord = await prisma.workPermitRecord.create({
      data: {
        code: permitCode, // 🟢 新增：保存生成的编号
        projectId,
        templateId,
        dataJson: JSON.stringify(dataJson),
        // 使用 draft 作为初始状态
        status: 'draft',
        // ✅ 新增：保存附件数据 (存为 JSON 字符串)
        // 注意：如果你没有在 schema.prisma 里加这个字段，请先去添加：attachments String?
        attachments: attachments ? JSON.stringify(attachments) : null,
      }
    });

    // 🟢 插入日志
    if (userId && userName) {
      createLog(
        userId,
        userName,
        'CREATE_PERMIT',
        newRecord.id,
        `创建作业票记录 - 项目ID: ${projectId}`
      );
    }

    return NextResponse.json(newRecord);
  } catch (error) {
    console.error("Create Permit Error:", error);
    return NextResponse.json({ error: '提交失败' }, { status: 500 });
  }
}

// ✅ DELETE: 删除作业票记录 (新增)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    if (!id) return NextResponse.json({ error: '缺少 ID' }, { status: 400 });

    await prisma.workPermitRecord.delete({ where: { id } });

    // 🟢 插入日志
    if (userId && userName) {
      createLog(
        userId,
        userName,
        'DELETE_PERMIT',
        id,
        '删除作业票记录'
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}