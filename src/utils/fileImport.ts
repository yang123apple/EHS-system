import Papa from 'papaparse';
import jschardet from 'jschardet';
import * as XLSX from 'xlsx';

export type ParsedTable = {
  type: 'csv' | 'xlsx';
  headers: string[];
  rows: string[][]; // 与 headers 对齐的二维数组
  objects: Record<string, string>[]; // 以表头为键的对象行
  encoding?: string; // CSV 的检测编码
};

// 统一解析 CSV 或 XLSX 文件为表格结构
export async function parseTableFile(file: File): Promise<ParsedTable> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    const headers = (data[0] || []).map(String);
    const rows = (data.slice(1) || []).map(r => headers.map((_, i) => String(r[i] ?? '').trim()));
    const objects = rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
    return { type: 'xlsx', headers, rows, objects };
  }

  // 默认按 CSV 处理
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  // 将 ArrayBuffer 直接转换为 Buffer，避免类型推断问题
  const detected = jschardet.detect(Buffer.from(buffer));
  let encoding = (detected?.encoding || 'utf-8').toLowerCase();
  if (encoding === 'gb2312' || encoding === 'gb18030') encoding = 'gbk';
  let text = '';
  try {
    text = new TextDecoder(encoding).decode(uint8);
  } catch {
    text = new TextDecoder('utf-8').decode(uint8);
    encoding = 'utf-8';
  }
  // 处理 BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const objects: Record<string, string>[] = (parsed.data as any[]).map(row => {
    const obj: Record<string, string> = {};
    Object.keys(row || {}).forEach(k => { obj[String(k)] = String(row[k] ?? '').trim(); });
    return obj;
  });
  const headers: string[] = (parsed.meta.fields || Object.keys(objects[0] || {})).map(String);
  const rows: string[][] = objects.map(obj => headers.map(h => obj[h] ?? ''));
  return { type: 'csv', headers, rows, objects, encoding };
}

// 从对象行中按多个候选键读取值
export function pick(row: Record<string, string>, candidates: string[], fallback = ''): string {
  for (const key of candidates) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return fallback;
}
