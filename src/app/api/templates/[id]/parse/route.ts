import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseTemplateFields } from '@/utils/templateParser';
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

    // 解析字段
    const parsedFields = parseTemplateFields(template.structureJson || '');

    // 保存解析结果
    await prisma.workPermitTemplate.update({
      where: { id },
      data: {
        parsedFields: JSON.stringify(parsedFields),
      },
    });

    return NextResponse.json({
      success: true,
      fields: parsedFields,
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
