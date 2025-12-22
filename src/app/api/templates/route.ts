import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLog } from '@/lib/logger';
import { parseTemplateFields, autoCalculateColumnWidths, checkCellLineBreaks } from '@/utils/templateParser';
export const dynamic = 'force-dynamic';
// GET: 获取所有作业票模板
export async function GET() {
  try {
    const templates = await prisma.workPermitTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json({ error: '获取模板失败' }, { status: 500 });
  }
}

// POST: 上传/保存一个新的作业票模板
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, type, structureJson, isLocked, workflowConfig, userId, userName, parsedFields: clientParsedFields } = body;
    if (!name || !type || !structureJson) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // 🟢 处理 structureJson 中的列宽和字段解析
    let processedStructureJson = structureJson;
    try {
      const structure = JSON.parse(structureJson);
      
      // 1️⃣ 自动计算列宽（仅当未提供 cols 时）
      const hasManualCols = Array.isArray(structure.cols) && structure.cols.length > 0;
      if (!hasManualCols) {
        const autoColWidths = autoCalculateColumnWidths(structureJson);
        if (autoColWidths.length > 0) {
          structure.cols = autoColWidths;
        }
      }

      // 2️⃣ 检查是否有换行符（仅作日志提示，不阻止保存）
      const lineBreakCells = checkCellLineBreaks(structureJson);
      if (lineBreakCells.length > 0) {
        console.warn(`⚠️  模板包含包含换行的单元格: ${lineBreakCells.map(c => c.cellKey).join(', ')}`);
      }

      processedStructureJson = JSON.stringify(structure);
    } catch (e) {
      // 如果处理失败，继续使用原始数据
      console.error('Failed to process structure JSON:', e);
    }

    // 🟢 自动解析模板字段（如客户端已传自定义解析则优先）
    const parsedFields = clientParsedFields
      ? (typeof clientParsedFields === 'string' ? JSON.parse(clientParsedFields) : clientParsedFields)
      : parseTemplateFields(processedStructureJson);

    const newTemplate = await prisma.workPermitTemplate.create({
      data: {
        name,
        type,
        structureJson: processedStructureJson, // 保存处理后的JSON
        isLocked: isLocked || false,
        workflowConfig: workflowConfig || null, // ✅ 支持创建时带流程
        parsedFields: JSON.stringify(parsedFields), // 🟢 保存解析结果
      },
    });

    // 🟢 插入日志
    if (userId && userName) {
      await createLog(
        userId,
        userName,
        'CREATE_TEMPLATE',
        newTemplate.id,
        `创建模板: ${name}`
      );
    }

    return NextResponse.json(newTemplate);
  } catch (error) {
    return NextResponse.json({ error: '创建模板失败' }, { status: 500 });
  }
}

// DELETE: 删除模板
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    if (!id) return NextResponse.json({ error: '缺少模板 ID' }, { status: 400 });

    // 🟢 检查是否有关联的作业票记录
    const relatedRecords = await prisma.workPermitRecord.count({
      where: { templateId: id }
    });

    if (relatedRecords > 0) {
      return NextResponse.json({ 
        error: `该模板已被 ${relatedRecords} 条作业票使用，无法删除` 
      }, { status: 400 });
    }

    await prisma.workPermitTemplate.delete({ where: { id } });

    // 🟢 插入日志
    if (userId && userName) {
      await createLog(
        userId,
        userName,
        'DELETE_TEMPLATE',
        id,
        '删除模板'
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json({ error: '删除模板失败' }, { status: 500 });
  }
}

// ✅ PATCH: 更新模板状态 (锁定/解锁) 或 内容 (在线编辑) 或 流程配置
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, isLocked, structureJson, name, type, workflowConfig, userId, userName, parsedFields: clientParsedFields, level, sectionBindings, watermarkSettings } = body; 

    if (!id) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

    // 动态构建更新数据
    const dataToUpdate: any = {};
    if (isLocked !== undefined) dataToUpdate.isLocked = isLocked;
    if (isLocked !== undefined) dataToUpdate.isLocked = isLocked;
    if (structureJson !== undefined) {
      // 🟢 处理 structureJson 中的列宽和字段解析
      let processedStructureJson = structureJson;
      try {
        const structure = JSON.parse(structureJson);
        
        // 1️⃣ 自动计算列宽（仅当未提供 cols 时）
        const hasManualCols = Array.isArray(structure.cols) && structure.cols.length > 0;
        if (!hasManualCols) {
          const autoColWidths = autoCalculateColumnWidths(structureJson);
          if (autoColWidths.length > 0) {
            structure.cols = autoColWidths;
          }
        }

        // 2️⃣ 检查是否有换行符（仅作日志提示，不阻止保存）
        const lineBreakCells = checkCellLineBreaks(structureJson);
        if (lineBreakCells.length > 0) {
          console.warn(`⚠️  模板包含换行的单元格: ${lineBreakCells.map(c => c.cellKey).join(', ')}`);
        }

        processedStructureJson = JSON.stringify(structure);
      } catch (e) {
        // 如果处理失败，继续使用原始数据
        console.error('Failed to process structure JSON:', e);
      }

      dataToUpdate.structureJson = processedStructureJson;
      // 🟢 当修改结构时，重新解析字段，除非客户端显式提供解析结果
      const parsedFields = clientParsedFields
        ? (typeof clientParsedFields === 'string' ? JSON.parse(clientParsedFields) : clientParsedFields)
        : parseTemplateFields(processedStructureJson);
      dataToUpdate.parsedFields = JSON.stringify(parsedFields);
    }
    // 🟢 允许在不改结构时直接更新解析结果
    if (clientParsedFields && structureJson === undefined) {
      dataToUpdate.parsedFields = typeof clientParsedFields === 'string'
        ? clientParsedFields
        : JSON.stringify(clientParsedFields);
    }
    if (name !== undefined) dataToUpdate.name = name;
    if (type !== undefined) dataToUpdate.type = type;
    // ✅ 新增：更新流程配置
    if (workflowConfig !== undefined) dataToUpdate.workflowConfig = workflowConfig;
    // 🟢 水印设置 - 暂时忽略（数据库没有此字段）
    // if (watermarkSettings !== undefined) dataToUpdate.watermarkSettings = watermarkSettings;
    // �🔵 V3.4 更新模板级别和section绑定
    if (level !== undefined) dataToUpdate.level = level;
    if (sectionBindings !== undefined) dataToUpdate.sectionBindings = sectionBindings;

    const updatedTemplate = await prisma.workPermitTemplate.update({
      where: { id },
      data: dataToUpdate,
    });

    // 🟢 插入日志
    if (userId && userName) {
      await createLog(
        userId,
        userName,
        'UPDATE_TEMPLATE',
        id,
        '更新模板'
      );
    }

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error("Update Template Error:", error);
    return NextResponse.json({ error: '更新模板失败' }, { status: 500 });
  }
}