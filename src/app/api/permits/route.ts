import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withPermission, logApiOperation } from '@/middleware/auth';
import { mapJsonToColumns, inferWorkTypeFromTemplate } from '@/utils/dataMapper';
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
export const PATCH = withPermission('work_permit', 'create_permit', async (req: Request, context, user) => {
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
    // 🟢 处理 timenow 字段：如果更新了 dataJson，自动填充 timenow 字段
    if (dataJson !== undefined) {
      const processedDataJson = typeof dataJson === 'string' ? JSON.parse(dataJson) : { ...dataJson };
      
      // 获取模板的 parsedFields
      const record = await prisma.workPermitRecord.findUnique({
        where: { id },
        select: { templateId: true, template: { select: { type: true, parsedFields: true } } }
      });
      
      if (record?.templateId) {
        const template = record.template;
        
        if (template?.parsedFields) {
          try {
            const parsedFields = JSON.parse(template.parsedFields as string);
            const now = new Date();
            const timeString = now.toLocaleString('zh-CN', { 
              year: 'numeric', 
              month: '2-digit', 
              day: '2-digit', 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit',
              hour12: false
            });
            
            parsedFields.forEach((field: any) => {
              if (field.fieldType === 'timenow' && field.cellKey) {
                // 如果该字段还没有值，则自动填充当前时间
                if (!processedDataJson[field.cellKey] || processedDataJson[field.cellKey] === '') {
                  processedDataJson[field.cellKey] = timeString;
                }
              }
            });
          } catch (e) {
            console.warn('解析 parsedFields 失败，跳过 timenow 自动填充:', e);
          }
        }
        
        // 🟢 数据映射：更新关键字段
        const finalDataJson = JSON.stringify(processedDataJson);
        const parsedFields = template?.parsedFields ? JSON.parse(template.parsedFields as string) : [];
        const mappedFields = mapJsonToColumns(finalDataJson, parsedFields);
        
        // 如果未从表单中提取到 workType，从模板类型推断
        if (!mappedFields.workType && template?.type) {
          mappedFields.workType = inferWorkTypeFromTemplate(template.type);
        }
        
        updateData.dataJson = finalDataJson;
        // 合并映射字段到更新数据
        Object.assign(updateData, mappedFields);
      } else {
        updateData.dataJson = JSON.stringify(processedDataJson);
      }
    }

    const updatedRecord = await prisma.workPermitRecord.update({
      where: { id },
      data: updateData,
    });

    // 记录权限系统审计日志（合并系统日志和权限审计日志）
    await logApiOperation(
      user,
      'work_permit',
      'update_permit',
      { 
        permitId: id,
        details: '更新作业票记录'
      }
    );

    return NextResponse.json(updatedRecord);
  } catch (error) {
    console.error("Update Permit Error:", error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
});
// GET: 获取作业票记录 或 预生成编号
export const GET = withAuth(async (req: Request, context, user) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const projectId = searchParams.get('projectId');
  const action = searchParams.get('action');
  const templateType = searchParams.get('templateType');
  const q = searchParams.get('q'); // Search by project name
  const filterType = searchParams.get('type');
  const date = searchParams.get('date');

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = (page - 1) * limit;
  const isPaginated = searchParams.has('page');

  try {
    // 🟢 新增：通过 id 获取单个记录
    if (id) {
      const record = await prisma.workPermitRecord.findUnique({
        where: { id },
        include: {
          template: true,
          project: true
        }
      });
      if (!record) {
        return NextResponse.json({ error: '记录不存在' }, { status: 404 });
      }
      return NextResponse.json(record);
    }

    // 🟢 新增：预生成编号功能
    if (action === 'generate-code' && projectId && templateType) {
      const code = await generatePermitCode(projectId, templateType);
      return NextResponse.json({ code });
    }

    // 原有功能：获取作业票记录
    const whereCondition: any = {};

    if (projectId) {
        whereCondition.projectId = projectId;
    }

    if (q) {
        // Search by project name (relation)
        whereCondition.project = {
            name: { contains: q }
        };
    }

    if (filterType) {
        whereCondition.template = {
            type: filterType
        };
    }

    if (date) {
        const targetDate = new Date(date);
        if (!isNaN(targetDate.getTime())) {
            // 开始时间设置为当天的 00:00:00，结束时间设置为当天的 23:59:59.999
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);
            whereCondition.createdAt = {
                gte: startOfDay,
                lte: endOfDay
            };
        }
    }

    const queryOptions: any = {
      where: whereCondition,
      include: { 
        template: true, // 关联模板信息
        project: true   // ✅ 关联项目信息 (查所有记录时需要知道是哪个项目的)
      },
      orderBy: { createdAt: 'desc' }
    };

    if (isPaginated) {
        queryOptions.skip = skip;
        queryOptions.take = limit;
    }

    const [records, total] = await Promise.all([
        prisma.workPermitRecord.findMany(queryOptions),
        prisma.workPermitRecord.count({ where: whereCondition })
    ]);

    if (isPaginated) {
        return NextResponse.json({
            data: records,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: '获取记录失败' }, { status: 500 });
  }
});

// POST: 提交作业票
export const POST = withPermission('work_permit', 'create_permit', async (req: Request, context, user) => {
  try {
    const body = await req.json();
    // ✅ 新增：解构 attachments 和 proposedCode
    const { projectId, templateId, dataJson, attachments, proposedCode, userId, userName } = body;
    if (!projectId || !templateId || !dataJson) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }
    
    // 🟢 获取模板信息以生成编号和解析字段
    const template = await prisma.workPermitTemplate.findUnique({
      where: { id: templateId },
      select: { type: true, parsedFields: true }
    });
    
    const templateType = template?.type || '其他';
    
    // 🟢 处理 timenow 字段：自动填充当前时间
    const processedDataJson = typeof dataJson === 'string' ? JSON.parse(dataJson) : { ...dataJson };
    if (template?.parsedFields) {
      try {
        const parsedFields = JSON.parse(template.parsedFields as string);
        const now = new Date();
        const timeString = now.toLocaleString('zh-CN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: false
        });
        
        parsedFields.forEach((field: any) => {
          if (field.fieldType === 'timenow' && field.cellKey) {
            // 如果该字段还没有值，则自动填充当前时间
            if (!processedDataJson[field.cellKey] || processedDataJson[field.cellKey] === '') {
              processedDataJson[field.cellKey] = timeString;
            }
          }
        });
      } catch (e) {
        console.warn('解析 parsedFields 失败，跳过 timenow 自动填充:', e);
      }
    }
    
    // 🟢 生成作业单编号（如果有建议编号，会检查冲突并自动顺延）
    console.log('📝 [提交] 开始生成编号，建议编号:', proposedCode);
    const permitCode = await generatePermitCode(projectId, templateType, proposedCode);
    console.log('✅ [提交] 最终使用编号:', permitCode);
    
    // 🟢 数据映射：从 JSON 中提取关键字段
    const finalDataJson = JSON.stringify(processedDataJson);
    const parsedFields = template?.parsedFields ? JSON.parse(template.parsedFields) : [];
    const mappedFields = mapJsonToColumns(finalDataJson, parsedFields);
    
    // 如果未从表单中提取到 workType，从模板类型推断
    if (!mappedFields.workType) {
      mappedFields.workType = inferWorkTypeFromTemplate(templateType);
    }
    
    console.log('📊 [数据映射] 提取的关键字段:', mappedFields);
    
    const newRecord = await prisma.workPermitRecord.create({
      data: {
        code: permitCode, // 🟢 新增：保存生成的编号
        projectId,
        templateId,
        dataJson: finalDataJson,
        // 使用 draft 作为初始状态
        status: 'draft',
        // ✅ 新增：保存附件数据 (存为 JSON 字符串)
        attachments: attachments ? JSON.stringify(attachments) : null,
        // 🟢 数据映射字段
        ...mappedFields,
      }
    });

    // 记录权限系统审计日志（合并系统日志和权限审计日志）
    await logApiOperation(
      user,
      'work_permit',
      'create_permit',
      { 
        permitId: newRecord.id,
        permitCode, 
        projectId, 
        templateId,
        details: `创建作业票记录 - 作业类别: ${templateType}，作业单编号: ${permitCode}`
      }
    );

    return NextResponse.json(newRecord);
  } catch (error) {
    console.error("Create Permit Error:", error);
    return NextResponse.json({ error: '提交失败' }, { status: 500 });
  }
});

// ✅ DELETE: 删除作业票记录 (新增)
export const DELETE = withPermission('work_permit', 'delete_permit', async (req: Request, context, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    if (!id) return NextResponse.json({ error: '缺少 ID' }, { status: 400 });

    await prisma.workPermitRecord.delete({ where: { id } });

    // 记录权限系统审计日志（合并系统日志和权限审计日志）
    await logApiOperation(
      user,
      'work_permit',
      'delete_permit',
      { 
        permitId: id,
        details: '删除作业票记录'
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
});
