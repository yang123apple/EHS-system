import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, logApiOperation } from '@/middleware/auth';

type AppendPayload = {
  recordId: string;
  cellKey: string; // e.g. "R5C3"
  data: Record<string, any>; // 本次追加的单行数据（建议 key 使用子模板的 cellKey，如 "R2C1"）
};

type SectionLogEntry = {
  id: string;
  timestamp: string; // ISO string
  operatorId?: string;
  operatorName?: string;
  data: Record<string, any>;
};

function formatZhDateTime(input: string | Date) {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function parseCellKey(cellKey: string): { r1: number; c1: number } | null {
  const m = cellKey.match(/^R(\d+)C(\d+)$/i);
  if (!m) return null;
  const r1 = parseInt(m[1], 10);
  const c1 = parseInt(m[2], 10);
  if (!Number.isFinite(r1) || !Number.isFinite(c1) || r1 <= 0 || c1 <= 0) return null;
  return { r1, c1 };
}

function safeJsonParse<T>(val: any, fallback: T): T {
  try {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return JSON.parse(val) as T;
    return val as T;
  } catch {
    return fallback;
  }
}

function applyLogsToSectionData(params: {
  existingData: Record<string, any>;
  parsedFields: any[];
  logs: SectionLogEntry[];
}) {
  const { existingData, parsedFields, logs } = params;
  const base: Record<string, any> = { ...(existingData || {}) };

  const fields = (parsedFields || [])
    .filter((f: any) => f && typeof f.cellKey === 'string' && f.fieldType !== 'section')
    .map((f: any) => {
      const pos = parseCellKey(f.cellKey);
      if (!pos) return null;
      return { ...f, _pos: pos };
    })
    .filter(Boolean) as Array<any & { _pos: { r1: number; c1: number } }>;

  if (fields.length === 0) {
    return base;
  }

  const minR1 = Math.min(...fields.map(f => f._pos.r1));
  const minR0 = minR1 - 1;
  const usedCols0 = new Set<number>(fields.map(f => f._pos.c1 - 1));

  // 清理“动态区”旧值：同列、从最小行开始，清理一个足够大的窗口
  const clearRows = Math.max(50, logs.length + 10);
  for (const k of Object.keys(base)) {
    const m = k.match(/^(\d+)-(\d+)$/);
    if (!m) continue;
    const r0 = parseInt(m[1], 10);
    const c0 = parseInt(m[2], 10);
    if (!Number.isFinite(r0) || !Number.isFinite(c0)) continue;
    if (r0 >= minR0 && r0 < minR0 + clearRows && usedCols0.has(c0)) {
      delete base[k];
    }
  }

  // 逐条日志写入：将“模板中的记录行”按 i 向下平移
  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    for (const f of fields) {
      const r0 = (f._pos.r1 - 1) + i;
      const c0 = f._pos.c1 - 1;
      const key = `${r0}-${c0}`;

      let v: any = '';
      if (f.fieldType === 'timenow') {
        v = formatZhDateTime(entry.timestamp);
      } else {
        v =
          entry.data?.[f.cellKey] ??
          entry.data?.[f.fieldName] ??
          entry.data?.[f.label] ??
          '';
      }

      base[key] = v;
    }
  }

  return base;
}

export const POST = withPermission('work_permit', 'edit', async (req: Request, context, user) => {
  try {
    const body = (await req.json()) as Partial<AppendPayload>;
    const recordId = body.recordId;
    const cellKey = body.cellKey;
    const data = body.data || {};

    if (!recordId || !cellKey) {
      return NextResponse.json({ error: '缺少 recordId 或 cellKey' }, { status: 400 });
    }

    const record = await prisma.workPermitRecord.findUnique({
      where: { id: recordId },
      select: { id: true, status: true, dataJson: true },
    });

    if (!record) {
      return NextResponse.json({ error: '作业票不存在' }, { status: 404 });
    }

    // 许可属性：仅允许在审批通过后追加“过程记录”
    if (record.status !== 'approved') {
      return NextResponse.json({ error: '作业票尚未审批通过，无法追加记录' }, { status: 403 });
    }

    const root = safeJsonParse<Record<string, any>>(record.dataJson, {});
    const sectionKey = `SECTION_${cellKey}`;
    const section = root?.[sectionKey];

    if (!section || !section.templateId) {
      return NextResponse.json({ error: '未找到对应的二级表单（Section）' }, { status: 404 });
    }

    const tpl = await prisma.workPermitTemplate.findUnique({
      where: { id: section.templateId },
      select: { id: true, name: true, isDynamicLog: true, parsedFields: true },
    });

    if (!tpl) {
      return NextResponse.json({ error: '二级模板不存在' }, { status: 404 });
    }

    if (!tpl.isDynamicLog) {
      return NextResponse.json({ error: '该二级表单不支持“追加记录”模式' }, { status: 400 });
    }

    const logs = safeJsonParse<SectionLogEntry[]>(section.logs, []);
    const entry: SectionLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString(),
      operatorId: user?.id,
      operatorName: user?.name,
      data: data || {},
    };
    const newLogs = [...logs, entry];

    const parsedFields = safeJsonParse<any[]>(tpl.parsedFields, []);
    const existingData = safeJsonParse<Record<string, any>>(section.data, {});
    const nextData = applyLogsToSectionData({
      existingData,
      parsedFields,
      logs: newLogs,
    });

    root[sectionKey] = {
      ...section,
      logs: newLogs,
      data: nextData,
    };

    await prisma.workPermitRecord.update({
      where: { id: recordId },
      data: { dataJson: JSON.stringify(root) },
    });

    await logApiOperation(user, 'work_permit', 'append_section_log', {
      permitId: recordId,
      cellKey,
      templateId: tpl.id,
      templateName: tpl.name,
      details: `追加二级表单记录（Append-Only）: ${tpl.name} @ ${cellKey}`,
    });

    return NextResponse.json({
      success: true,
      section: root[sectionKey],
    });
  } catch (error) {
    console.error('Append Section Log Error:', error);
    return NextResponse.json({ error: '追加记录失败' }, { status: 500 });
  }
});


