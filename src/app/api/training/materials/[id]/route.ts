import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const material = await prisma.trainingMaterial.findUnique({
      where: { id },
      include: { questions: true }
    });
    if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(material);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch material' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.trainingMaterial.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
