import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { foldStructureForDynamicAdd, parseTemplateFields } from '@/utils/templateParser';
import { ParsedField } from '@/types/work-permit';

/**
 * POST /api/templates/[id]/parse
 * 解析模板中的字段需求
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 获取模板
    const template = await prisma.workPermitTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // 解析字段（动态记录二级模板：同时写入"可追加行"标记，方便旧模板一键修复）
    const foldDuplicateRows = !!template.isDynamicLog && String(template.level || 'primary') === 'secondary';
    
    // 🟢 第一步：先折叠重复行（如果没有marker的话）
    let processedStructureJson = foldDuplicateRows
      ? foldStructureForDynamicAdd(template.structureJson || '', { templateId: id })
      : (template.structureJson || '');
    
    // 🟢 第二步：解析字段
    // 注意：如果已经折叠过，就不应该再次折叠，所以传入 foldDuplicateRows: false
    // 但实际上，parseTemplateFields 中的 foldDuplicateRows 逻辑会检查是否已经折叠，所以传入 true 也没问题
    // 但为了明确，我们传入 false（因为我们已经折叠过了）
    const parsedFields = parseTemplateFields(processedStructureJson, { foldDuplicateRows: false });
    
    // 🟢 第三步：如果有折叠行，重新调用 foldStructureForDynamicAdd 以更新 marker 的字段类型信息
    if (foldDuplicateRows) {
      processedStructureJson = foldStructureForDynamicAdd(processedStructureJson, {
        templateId: id,
        parsedFields
      });
    }

    // 保存解析结果
    await prisma.workPermitTemplate.update({
      where: { id },
      data: {
        structureJson: processedStructureJson,
        parsedFields: JSON.stringify(parsedFields),
      },
    });

    return NextResponse.json({
      success: true,
      fields: parsedFields,
      structureJson: processedStructureJson,
    });
  } catch (error) {
    console.error('Template parsing error:', error);
    return NextResponse.json(
      { error: 'Failed to parse template' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/templates/[id]/parse
 * 获取已解析的字段信息
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = await prisma.workPermitTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const parsedFields: ParsedField[] = template.parsedFields 
      ? JSON.parse(template.parsedFields) 
      : [];

    return NextResponse.json({
      id: template.id,
      name: template.name,
      fields: parsedFields,
    });
  } catch (error) {
    console.error('Failed to get parsed fields:', error);
    return NextResponse.json(
      { error: 'Failed to get parsed fields' },
      { status: 500 }
    );
  }
}
