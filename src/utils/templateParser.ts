import { ParsedField } from '@/types/work-permit';
import { calculateStringWidth, calculateA4ColumnWidths } from '@/utils/a4-column-width';

/**
 * 从结构数据中提取二维表格
 * 兼容多种格式：LuckySheet的sheets[0].data、celldata、直接的grid/data等
 * 对于celldata格式，会自动处理合并单元格的填充
 */
function extractGrid(structure: any): any[][] {
  if (!structure) return [];

  if (Array.isArray(structure?.sheets?.[0]?.data)) {
    return structure.sheets[0].data as any[][];
  }

  const celldata = structure?.sheets?.[0]?.celldata;
  const merges = structure?.sheets?.[0]?.merges || [];
  if (Array.isArray(celldata) && celldata.length > 0) {
    const maxR = Math.max(...celldata.map((c: any) => Number(c.r) || 0));
    const maxC = Math.max(...celldata.map((c: any) => Number(c.c) || 0));
    const grid: any[][] = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(''));

    celldata.forEach((cell: any) => {
      if (cell && typeof cell.r === 'number' && typeof cell.c === 'number') {
        const val = cell.v?.m ?? cell.v?.v ?? cell.v ?? '';
        if (grid[cell.r]) {
          grid[cell.r][cell.c] = val;
        }
      }
    });

    if (Array.isArray(merges)) {
      merges.forEach((merge: any) => {
        const startR = merge.s?.r ?? merge.r;
        const startC = merge.s?.c ?? merge.c;
        const endR = merge.e?.r ?? (startR + (merge.rs || merge.rowspan || 1) - 1);
        const endC = merge.e?.c ?? (startC + (merge.cs || merge.colspan || 1) - 1);

        if (startR !== undefined && startC !== undefined && endR !== undefined && endC !== undefined) {
          const startVal = grid[startR]?.[startC] ?? '';
          for (let r = startR; r <= endR && r < grid.length; r++) {
            for (let c = startC; c <= endC && c < grid[r].length; c++) {
              if (!(r === startR && c === startC)) {
                grid[r][c] = startVal;
              }
            }
          }
        }
      });
    }

    return grid;
  }

  if (Array.isArray(structure?.grid)) return structure.grid as any[][];
  if (Array.isArray(structure?.data)) return structure.data as any[][];
  return [];
}

/**
 * 判断单元格值是否为空
 * 包括null、undefined、空字符串以及常见的占位符（如"点击填写"等）
 */
function isEmptyCellValue(cell: any): boolean {
  if (cell === null || cell === undefined) return true;
  const str = String(cell).trim();
  if (!str) return true;
  const placeholders = [
    '点击填写', '/', '-', '—',
    '请选择日期', '请选择时间', '选择日期', '选择时间',
    'yyyy-mm-dd', 'YYYY-MM-DD'
  ];
  return placeholders.includes(str.toLowerCase());
}

/**
 * 从指定单元格向左查找最近的非空标签
 * 用于识别"标签在左，空白输入框在右"的布局
 * 搜索范围无限制（最多往前200列），可处理多个空白列的情况
 */
function findLeftLabel(data: any[][], row: number, col: number): string | null {
  // 只检查紧邻左侧一格，防止穿透多个空白导致误绑定整行
  if (col <= 0) return null;
  const candidate = data[row]?.[col - 1];
  if (!isEmptyCellValue(candidate)) {
    return String(candidate).trim();
  }
  return null;
}

/**
 * 从指定单元格向上查找最近的非空标签
 * 用于识别"标签在上，大块空白输入框在下"的布局（如意见栏）
 * 搜索范围最多15行，防止跨越过多行导致的不相关标签识别
 */
function findTopLabel(data: any[][], row: number, col: number): string | null {
  for (let r = row - 1; r >= 0 && r >= row - 15; r--) {
    const candidate = data[r]?.[col];
    if (!isEmptyCellValue(candidate)) {
      return String(candidate).trim();
    }
  }
  return null;
}

/**
 * 顶层：判断标签是否可忽略（选项词/大标题等）
 * 供空白格与日期占位格的左侧标签扫描复用
 */
function isIgnorableLabel(str: string): boolean {
  if (!str) return true;
  const clean = String(str).replace(/[£□☑\s,，\/\\.]/g, '').trim();
  // 选项黑名单
  const optionBlacklist = ['是', '否', '是否', '有', '无', '有无', 'Yes', 'No', 'N/A'];
  // 大标题黑名单
  if (clean.endsWith('单') || clean.endsWith('表') || clean.endsWith('书')) {
    if (clean.includes('申请') || clean.includes('审批') || clean.includes('作业') || clean.includes('记录')) {
      return true;
    }
  }
  // 选项或其重复组合
  if (optionBlacklist.includes(clean) || /^(是|否|有|无)+$/.test(clean)) return true;
  return false;
}

/**
 * 智能向左查找有效标签：最多跨越5格，跳过空白；遇到已识别输入格则停止
 * 🟢 兼容选项标记（如"£其他"）：自动strip后作为标签
 */
function findSmartLeftLabel(
  data: any[][],
  row: number,
  col: number,
  processedCells: Set<string>,
  maxScan: number = 5
): string | null {
  for (let offset = 1; offset <= maxScan; offset++) {
    const leftCol = col - offset;
    if (leftCol < 0) break;
    const leftKey = `R${row + 1}C${leftCol + 1}`;
    if (processedCells.has(leftKey)) break; // 左侧已有输入框，停止认领
    const candidate = data[row]?.[leftCol];
    if (isEmptyCellValue(candidate)) continue; // 跳过排版空白
    const cleanCandidate = stripOptionMarkers(String(candidate)).trim();
    if (cleanCandidate && !isIgnorableLabel(cleanCandidate)) {
      return String(candidate).trim();
    }
  }
  return null;
}

/**
 * 为option类型字段向左查找标签：跳过左侧的option类型单元格，直到找到非option的有值单元格
 * 🟢 新规则：对于option字段，字段名取左侧第一个非option类型的单元格值
 */
function findLabelForOption(
  data: any[][],
  row: number,
  col: number
): string | null {
  // 从当前列的左侧开始查找
  for (let leftCol = col - 1; leftCol >= 0; leftCol--) {
    const candidate = data[row]?.[leftCol];
    
    // 如果遇到空白单元格，继续向左查找
    if (isEmptyCellValue(candidate)) {
      continue;
    }
    
    const candidateStr = String(candidate).trim();
    
    // 如果左侧单元格也是option类型（包含选项标记），继续向左查找
    if (hasOptionMarker(candidateStr)) {
      continue;
    }
    
    // 找到第一个非option的有值单元格，返回其值（去除标记符号后）
    const cleanLabel = stripOptionMarkers(candidateStr).trim();
    if (cleanLabel && !isIgnorableLabel(cleanLabel)) {
      return cleanLabel;
    }
  }
  
  // 如果整行左侧都没有找到合适的标签，返回null
  return null;
}

/**
 * 查找指定单元格所在的合并区域
 * 如果单元格在某个合并区域内，返回该合并区域对象
 * 如果不在任何合并区域内，返回 null
 */
function findMergeContainingCell(row: number, col: number, merges: any[]): any {
  return merges.find(merge => {
    const startR = merge.s.r;
    const endR = merge.e.r;
    const startC = merge.s.c;
    const endC = merge.e.c;
    return row >= startR && row <= endR && col >= startC && col <= endC;
  }) || null;
}


interface ParsedStructure {
  sheets?: Array<{
    data?: any[][];        // 二维数组格式的表格数据
    celldata?: any[];       // LuckySheet的单元格数据格式
    merges?: any[];         // 合并单元格信息
    name?: string;          // 工作表名称
  }>;
  grid?: any[][];
  data?: any[][];
}

/** 列宽自动计算配置 */
const COL_WIDTH_CONFIG = {
  minWidth: 60,
  charWidthPx: 7.2,        // 英文字符宽
  zhCharWidthPx: 14,       // 🟢 新增：中文字符宽 (约等于字号)
  paddingPx: 8,
  fontSizePx: 14
};

interface MergeRange {
  s: { r: number; c: number };  // 起始位置（行、列）
  e: { r: number; c: number };  // 结束位置（行、列）
}

/** 字段类型关键词映射表，用于推断单元格的字段类型 */
const FIELD_TYPE_KEYWORDS: Record<string, string[]> = {
  signature: ['签名', '签字', '意见'],                      // 签名/意见字段（最高优先级）
  department: ['部门', '需求部门', '申请部门'],              // 部门字段
  personnel: ['人员', '姓名', '名字', '操作人员', '人'],            // 人员字段
  location: ['地点', '位置', '场所'],                      // 地点字段
  // ⚠️ 避免“日期/结束/时间”触发日期类型，仅保留更明确的开始类关键词
  date: ['年', '月', '日', '时'],                            // 日期时间字段（严格匹配）
  option: [],                                              // 选项字段（通过符号检测）
  // ✅ 增加“电话/联系方式/身份证号”等识别为 number 类型
  number: ['数量', '数字', '个数', '电话', '联系方式', '联系电话', '身份证号', '证件号', '身份证'],
  text: []                                                 // 文本字段（默认）
};

/** 检测字符串中是否包含选项标记符（£、□、☑等） */
function hasOptionMarker(str: string): boolean {
  // Unicode选项标记符
  if (/[£□☑✓✔]/.test(str)) return true;
  
  // Wingdings/Wingdings2字体的选项标记字符
  // R = ☑ (Wingdings2), P = ☐ (Wingdings2), O = ☐ (Wingdings)
  const trimmed = str.trim();
  if (trimmed === 'R' || trimmed === 'P' || trimmed === 'O') return true;
  
  // 检测是否为纯符号（单字符且为特殊符号）
  if (trimmed.length === 1 && /[ROPQSTUVWXYZ]/.test(trimmed)) {
    // 这些字母在Wingdings系列字体中通常是复选框/单选框标记
    return true;
  }
  
  return false;
}

/** 移除字符串中的所有选项标记符 */
function stripOptionMarkers(str: string): string {
  // 移除Unicode标记符
  let result = str.replace(/[£□☑✓✔]/g, '').trim();
  
  // 移除Wingdings标记字符（单独出现时）
  if (/^[ROPQSTUVWXYZ]$/.test(result)) {
    return '';
  }
  
  return result;
}

/**
 * 解析Excel模板，提取所有字段定义
 * 
 * 核心逻辑分两个步骤：
 * STEP 1 - 解析所有有值的单元格
 *   - 包含时间关键词（年/月/日/时/分/截止）→ 类型为date，字段名从左边单元格读取
 *   - 包含选项符号（£）→ 类型为option，字段名从本单元格读取
 * 
 * STEP 2 - 解析所有空白单元格（包括合并单元格）
 *   - 读取左边的有值单元格作为字段名
 *   - 根据字段名推断类型（文本/签名/地点/部门等）
 * 
 * @param structureJson - JSON字符串格式的模板结构数据
 * @returns 解析后的字段数组
 */
export function parseTemplateFields(structureJson: string): ParsedField[] {
  if (!structureJson) return [];

  try {
    const structure = JSON.parse(structureJson) as ParsedStructure;
    const fields: ParsedField[] = [];
    const data = extractGrid(structure);
    if (!data || data.length === 0) return fields;
    
    const processedCells = new Set<string>();
    // 🟢 记录字段名出现次数，用于生成唯一字段名（避免“电话”“负责人”等被合并成一个）
    const fieldNameCounts = new Map<string, number>();
    const merges = extractMerges(structure);

    // 🟢 生成唯一字段名（第一次保留原名，重复时加行号后缀）
    const getUniqueFieldName = (baseName: string, rowIndex: number) => {
      const count = fieldNameCounts.get(baseName) || 0;
      fieldNameCounts.set(baseName, count + 1);
      return count === 0 ? baseName : `${baseName}_row${rowIndex + 1}`;
    };

    // 🟢 统一创建字段的辅助函数
    const createField = (
      cellKey: string, 
      label: string, 
      r: number, 
      c: number, 
      fixedType?: ParsedField['fieldType'],
      group?: string,
      isSafetyMeasure?: boolean
    ): ParsedField => {
      const cleanLabel = stripOptionMarkers(label).trim();
      const baseFieldName = inferFieldName(cleanLabel);
      const fieldName = getUniqueFieldName(baseFieldName, r);
      const fieldType = fixedType || inferFieldType(cleanLabel);
      const field: ParsedField = {
        cellKey,
        label: cleanLabel,
        fieldName,
        fieldType,
        hint: generateHint(cleanLabel, fieldType),
        rowIndex: r,
        colIndex: c
      };
      if (group) {
        field.group = group;
      }
      if (isSafetyMeasure !== undefined) {
        field.isSafetyMeasure = isSafetyMeasure;
      }
      return field;
    };

    // ===== STEP 1: 解析所有有值的单元格 =====
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;

      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (isEmptyCellValue(cell)) continue; // 跳过空白单元格
        
        const cellStr = String(cell).trim();
        const cellKey = `R${r + 1}C${c + 1}`;
        
        // 🟢 跳过已处理的单元格（避免重复处理被聚合的option单元格）
        if (processedCells.has(cellKey)) continue;
        
        // 检测是否为选项字段（包含£符号）
        const isOptionField = hasOptionMarker(cellStr);
        
        // 严格检测是否为时间/日期字段：仅当内容像"日期/时间格式"时识别
        // 例：年 月 日；年 月 日 时 分；月 日；月 日 时；YYYY-MM-DD 等占位符格式
        const chinesePlaceholder = /^[\s]*年[\s]*月[\s]*日(\s*时\s*分)?[\s]*$|^[\s]*月[\s]*日(\s*时)?[\s]*$|^[\s]*月[\s]*日[\s]*时[\s]*$/; // 年月日占位
        const numericPlaceholder = /(yyyy[-\/]mm[-\/]dd|YYYY[-\/]MM[-\/]DD|hh:mm|HH:MM|H:MM)/i; // 英文数字占位
        const isDateField = chinesePlaceholder.test(cellStr) || numericPlaceholder.test(cellStr);
        
        if (isDateField || isOptionField) {
          // 日期：优先用智能左查找的标签
          if (isDateField) {
            const leftLabel = findSmartLeftLabel(data, r, c, processedCells, 5);
            if (leftLabel) {
              fields.push(createField(cellKey, leftLabel, r, c, 'date'));
              processedCells.add(cellKey);
            }
            continue;
          }

          // 🟢 选项：字段名从左侧非option单元格获取，跳过左侧的option类型单元格
          let groupLabel = findLabelForOption(data, r, c);
          
          // 如果左侧找不到合适的标签，尝试向上查找
          if (!groupLabel) {
            const labelTop = findTopLabel(data, r, c);
            groupLabel = labelTop && !isIgnorableLabel(labelTop) ? labelTop : '';
          }
          
          // 如果还是找不到标签，使用本格内容（去除选项标记后）
          if (!groupLabel) {
            groupLabel = stripOptionMarkers(cellStr).trim();
          }

          // 聚合同一行的连续选项单元格
          const consumedCols: number[] = [];
          const gatheredOptions: string[] = [];
          const pushOptionsFromCell = (val: string) => {
            const parts = extractOptionsFromCell(val);
            for (const p of parts) {
              if (!gatheredOptions.includes(p)) gatheredOptions.push(p);
            }
          };

          // 从当前列开始，向右收集连续的选项格
          for (let cc = c; cc < row.length; cc++) {
            const candidate = row[cc];
            if (isEmptyCellValue(candidate)) break;
            const candStr = String(candidate).trim();
            if (!hasOptionMarker(candStr)) break; // 非选项符号则停止
            consumedCols.push(cc);
            pushOptionsFromCell(candStr);
          }

          // 若能确定分组标签，则创建单一字段；否则退化为当前格独立字段
          if (groupLabel) {
            const baseFieldName = inferFieldName(groupLabel);
            const fieldName = getUniqueFieldName(baseFieldName, r);
            fields.push({
              cellKey,
              label: stripOptionMarkers(groupLabel),
              fieldName,
              fieldType: 'option',
              hint: generateHint(groupLabel, 'option'),
              options: gatheredOptions
            });
            // 标记所有被聚合的格为已处理
            for (const cc of consumedCols) {
              processedCells.add(`R${r + 1}C${cc + 1}`);
            }
          } else {
            // 无可靠标签：将当前格作为独立选项字段（用于“焊接/切割”等行内单格情况）
            const labelFromCell = stripOptionMarkers(cellStr).trim();
            const options = extractOptionsFromCell(cellStr);
            const baseFieldName = inferFieldName(labelFromCell);
            const fieldName = getUniqueFieldName(baseFieldName, r);
            fields.push({
              cellKey,
              label: labelFromCell,
              fieldName,
              fieldType: 'option',
              hint: generateHint(labelFromCell, 'option'),
              options
            });
            processedCells.add(cellKey);
          }
        }
      }
    }

    // ===== STEP 2: 解析所有空白单元格（包括合并单元格）=====
    // 🟢 封装通用的空白单元格处理逻辑
    const processEmptyCell = (r: number, c: number, cellKey: string) => {
      if (processedCells.has(cellKey)) return;

      // 🟢 规则1：检查左侧单元格是否为"£其他"
      if (c > 0) {
        const leftCell = data[r]?.[c - 1];
        if (!isEmptyCellValue(leftCell)) {
          const leftCellStr = String(leftCell).trim();
          // 检查是否为"£其他"（支持多种选项标记符）
          if (/[£￡]其他/.test(leftCellStr) || leftCellStr === '其他') {
            fields.push(createField(cellKey, '其他', r, c, 'text'));
            processedCells.add(cellKey);
            return; // 已处理，直接返回
          }
        }
      }

      // 1. 尝试向左找标签（智能策略：允许跨越最多5个空白，遇到已识别输入框则停止）
      let finalLabel = '';
      let group: string | undefined;
      let isSafetyMeasure: boolean | undefined;

      // 🟢 规则2：检查上方是否有"安全措施"文本（识别到"安全措施"时，下方的类型默认为"安全措施"）
      // 向上查找最多15行，检查同一列是否有"安全措施"文本
      for (let upOffset = 1; upOffset <= 15 && r - upOffset >= 0; upOffset++) {
        const upRow = r - upOffset;
        const upCell = data[upRow]?.[c];
        if (!isEmptyCellValue(upCell)) {
          const upCellStr = String(upCell).trim();
          // 检查是否包含"安全措施"（精确匹配或包含）
          if (upCellStr === '安全措施' || upCellStr.includes('安全措施')) {
            group = '安全措施';
            isSafetyMeasure = true;
            break; // 找到后停止向上查找
          }
        }
      }

      // 使用顶层 isIgnorableLabel 过滤标签

      // 智能向左查找：跨越最多5个格子，跳过空白；若遇到已识别的输入框则停止
      const MAX_LEFT_SCAN = 5;
      for (let offset = 1; offset <= MAX_LEFT_SCAN; offset++) {
        const leftCol = c - offset;
        if (leftCol < 0) break;
        const leftKey = `R${r + 1}C${leftCol + 1}`;
        // 遇到左侧已被解析为输入框的单元格，则停止向左"认领"标签
        if (processedCells.has(leftKey)) break;

        const candidate = data[r]?.[leftCol];
        if (isEmptyCellValue(candidate)) {
          // 排版空白，允许继续跨越
          continue;
        }

        const cleanCandidate = stripOptionMarkers(String(candidate)).trim();
        if (cleanCandidate.length > 0 && !isIgnorableLabel(cleanCandidate)) {
          finalLabel = String(candidate).trim();
          break; // 找到有效左标签，停止
        }
        // 无效标签（选项或标题），继续向左尝试
      }

      // 2. 如果左边无效（没字，或者是"是/否"这种选项），尝试向上找
      // 这会让代码穿透上面的空行，一直找到表头的"确认人"
      if (!finalLabel) {
        const topLabel = findTopLabel(data, r, c);
        // 向上找的时候，只要不是纯选项符号就行
        if (topLabel && !hasOptionMarker(topLabel)) {
          finalLabel = topLabel;
        }
      }

      // 3. 创建字段
      if (finalLabel) {
        fields.push(createField(cellKey, finalLabel, r, c, undefined, group, isSafetyMeasure));
        processedCells.add(cellKey);
      }
    };

    // 遍历所有合并单元格
    merges.forEach((merge) => {
      const startR = merge.s.r;
      const startC = merge.s.c;
      const cellKey = `R${startR + 1}C${startC + 1}`;
      const cellValue = data[startR]?.[startC];
      
      if (isEmptyCellValue(cellValue)) {
        processEmptyCell(startR, startC, cellKey);
      }
    });
    
    // 遍历所有普通单元格
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;

      for (let c = 0; c < row.length; c++) {
        const cellKey = `R${r + 1}C${c + 1}`;
        // 跳过已处理 或 在合并区域内的
        const merge = findMergeContainingCell(r, c, merges);
        if (processedCells.has(cellKey) || merge) continue;
        
        const cell = row[c];
        if (isEmptyCellValue(cell)) {
          processEmptyCell(r, c, cellKey);
        }
      }
    }

    return fields;
  } catch (error) {
    console.error('Failed to parse template fields:', error);
    return [];
  }
}

/**
 * 从标签文本中提取完整的字段信息
 * 自动推断字段名称、类型，并生成用户提示文本
 * 
 * @param cellKey - 单元格坐标（如"R1C2"）
 * @param label - 原始标签文本
 * @param row - 行索引
 * @param col - 列索引
 * @returns 解析后的字段信息，若标签为空则返回null
 */
function extractFieldInfo(
  cellKey: string,
  label: string,
  row: number,
  col: number
): ParsedField | null {
  // 防守检查：确保标签非空
  if (!label || !label.trim()) return null;

  const fieldName = inferFieldName(label);
  const fieldType = inferFieldType(label);
  const hint = generateHint(label, fieldType);

  // 返回完整的字段定义
  return {
    cellKey,
    label: label.trim(),
    fieldName,
    fieldType,
    hint
  };
}

/**
 * 从标签推断字段名
 * 直接使用单元格的原始值作为字段名，不做任何英文转换
 * 
 * @param label - 原始标签文本
 * @returns 清理后的字段名称（保持中文原样）
 */
function inferFieldName(label: string): string {
  // 移除选项符号后直接返回
  const cleanLabel = stripOptionMarkers(label);
  return cleanLabel.trim();
}

/**
 * 推断字段类型（用于STEP 2：空白单元格根据标签名推断类型）
 * 通过检查标签中的特征关键词来判断字段类型
 * 优先级：签名 > 部门 > 地点 > 人员 > 日期时间 > 数值 > 默认text
 * 
 * @param label - 原始标签文本（从左边单元格读取）
 * @returns 字段类型
 */
function inferFieldType(label: string): ParsedField['fieldType'] {
  const str = label.trim().toLowerCase();

  // ✅ 优先：若标签中包含选项标记符，则直接判定为 option
  if (hasOptionMarker(label)) return 'option';

  // 逐一检查字段类型关键词（优先级从高到低）
  if (FIELD_TYPE_KEYWORDS.signature.some(kw => str.includes(kw))) return 'signature';
  if (FIELD_TYPE_KEYWORDS.department.some(kw => str.includes(kw))) return 'department';
  if (FIELD_TYPE_KEYWORDS.location.some(kw => str.includes(kw))) return 'text'; // 地点暂时映射为text
  if (FIELD_TYPE_KEYWORDS.personnel.some(kw => str.includes(kw))) return 'personnel';
  if (FIELD_TYPE_KEYWORDS.date.some(kw => str.includes(kw))) return 'date';
  if (FIELD_TYPE_KEYWORDS.number.some(kw => str.includes(kw))) return 'number';

  // 默认为文本字段
  return 'text';
}

/**
 * 为字段生成用户友好的提示文本
 * 根据字段类型提供不同的交互提示（如"请输入"、"请选择"等）
 * 
 * @param label - 原始标签文本
 * @param fieldType - 字段类型
 * @returns 格式化的提示文本
 */
function generateHint(label: string, fieldType: ParsedField['fieldType']): string {
  // 各字段类型的提示模板
  const hints: Record<ParsedField['fieldType'], string> = {
    text: `请输入${label}`,           // 文本：输入
    date: `请选择${label}`,           // 日期：选择
    department: `请选择${label}`,     // 部门：选择
    personnel: `请输入${label}`,      // 人员：输入
    signature: `请在此签名`,          // 签名：固定提示
    handwritten: `请手写签名`,        // 手写签名：固定提示
    option: `请选择${label}`,         // 选项：选择
    // ✅ number 类型统一为“请输入{label}”，兼容电话号码/身份证号
    number: `请输入${label}`,        // 数值：输入
    match: `请输入${label}编码`,     // 匹配：输入编码
    section: `点击填写${label}`,     // 🟣 V3.4 Section：点击填写
    other: `请填写${label}`          // 其他：填写
  };

  // 返回对应类型的提示，若无则使用默认
  return hints[fieldType] || `请填写${label}`;
}

/**
 * 从模板结构中提取所有合并单元格的范围信息
 * 支持两种合并单元格格式：{rs, cs}（行数、列数）和{rowspan, colspan}
 * 将其统一转换为{s: {r, c}, e: {r, c}}的标准格式
 * 
 * @param structure - 模板结构数据
 * @returns 合并单元格范围数组
 */
function extractMerges(structure: any): Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> {
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];

  // 从sheets[0].merges中读取合并单元格信息
  const sheetMerges = structure?.sheets?.[0]?.merges;
  if (Array.isArray(sheetMerges)) {
    sheetMerges.forEach((m: any) => {
      // 处理多种命名方式：rs/cs 或 rowspan/colspan
      const rowSpan = m.rs || m.rowspan || 1;
      const colSpan = m.cs || m.colspan || 1;
      
      // 转换为标准格式：{s: 起始, e: 结束}
      merges.push({
        s: { r: m.r, c: m.c },                                    // 起始位置
        e: { r: m.r + rowSpan - 1, c: m.c + colSpan - 1 }        // 结束位置
      });
    });
  }

  // 🟢 兼容 XLSX 模板：structure.merges 形如 { s: { r, c }, e: { r, c } }
  const xlsxMerges = structure?.merges;
  if (Array.isArray(xlsxMerges)) {
    xlsxMerges.forEach((m: any) => {
      if (m && m.s && m.e && typeof m.s.r === 'number' && typeof m.s.c === 'number' && typeof m.e.r === 'number' && typeof m.e.c === 'number') {
        merges.push({ s: { r: m.s.r, c: m.s.c }, e: { r: m.e.r, c: m.e.c } });
      } else if (typeof m.r === 'number' && typeof m.c === 'number') {
        const rowSpan = m.rs || m.rowspan || 1;
        const colSpan = m.cs || m.colspan || 1;
        merges.push({ s: { r: m.r, c: m.c }, e: { r: m.r + rowSpan - 1, c: m.c + colSpan - 1 } });
      }
    });
  }

  return merges;
}

/**
 * 从本单元格内容中解析选项列表
 * 支持符号：£、□、☑；分隔符：空格、逗号、顿号、斜杠、分号、竖线
 */
function extractOptionsFromCell(cellStr: string): string[] {
  if (!cellStr) return [];
  // 去除选项符号
  const cleaned = stripOptionMarkers(String(cellStr)).trim();
  if (!cleaned) return [];
  // 按常见分隔符拆分
  const parts = cleaned.split(/[、,，;；\/\|\s]+/).map(s => s.trim()).filter(Boolean);
  // 去重并过滤过短项
  const uniq: string[] = [];
  for (const p of parts) {
    if (p.length === 0) continue;
    if (!uniq.includes(p)) uniq.push(p);
  }
  return uniq;
}

/**
 * 辅助函数：计算单个单元格内容所需宽度
 * 使用 A4 列宽计算工具，支持 CJK 字符的精确宽度计算
 */
function getContentWidth(val: any): number {
  if (val === null || val === undefined || val === '') return COL_WIDTH_CONFIG.minWidth;
  const str = String(val).trim();
  if (!str) return COL_WIDTH_CONFIG.minWidth;
  
  // 使用新的 A4 列宽计算工具
  return calculateStringWidth(str);
}

/**
 * 自动计算各列的最优宽度（基于 A4 列宽计算工具）
 * 算法流程：
 * 1. 使用 A4 列宽计算工具计算基础列宽（智能加权分配）
 * 2. 处理合并单元格的特殊需求（补偿宽度）
 * 3. 应用约束和最终调整
 */
export function autoCalculateColumnWidths(structureJson: string): Array<{ wpx: number }> {
  if (!structureJson) return [];

  try {
    const structure = JSON.parse(structureJson);
    const data = extractGrid(structure);
    const merges = extractMerges(structure);
    if (!data || data.length === 0) return [];
    
    // 计算总列数
    const colCountFromData = data.length > 0 ? Math.max(...data.map(row => row ? row.length : 0)) : 0;
    const colCountFromMerge = merges.reduce((max, m) => Math.max(max, m.e.c + 1), 0);
    const colCount = Math.max(colCountFromData, colCountFromMerge);

    // ================================================================
    // 🟢 第一步：使用 A4 列宽计算工具获取基础列宽
    // 该工具会自动处理 CJK 字符宽度、加权分配等
    // ================================================================
    let colWidths: number[];
    
    try {
      // 使用 A4 列宽计算工具计算基础列宽
      colWidths = calculateA4ColumnWidths(data);
      
      // 如果返回的列数不够，补齐到实际列数
      while (colWidths.length < colCount) {
        colWidths.push(COL_WIDTH_CONFIG.minWidth);
      }
    } catch (error) {
      console.warn('A4 列宽计算失败，回退到最小宽度:', error);
      // 回退方案：使用最小宽度
      colWidths = new Array(colCount).fill(COL_WIDTH_CONFIG.minWidth);
    }

    // ================================================================
    // 🟢 第二步：处理【合并单元格】的特殊需求
    // 合并单元格可能需要更多空间，这是模板特有的需求
    // ================================================================
    merges.forEach(m => {
      const { s, e } = m;
      // 获取该合并单元格的内容
      const cellVal = data[s.r]?.[s.c];
      if (!cellVal) return;

      const neededTotalWidth = getContentWidth(cellVal);
      
      // 计算当前涉及的列的总宽度 (Column s.c 到 e.c)
      let currentTotalWidth = 0;
      for (let c = s.c; c <= e.c; c++) {
        currentTotalWidth += colWidths[c];
      }

      // 如果当前总宽度 < 所需宽度，说明合并格太挤了，需要撑大
      if (currentTotalWidth < neededTotalWidth) {
        const diff = neededTotalWidth - currentTotalWidth;
        const span = e.c - s.c + 1;
        const addPerCol = diff / span; // 平均分配给每一列

        for (let c = s.c; c <= e.c; c++) {
          colWidths[c] += addPerCol;
        }
      }
    });

    // ================================================================
    // 🟢 第三步：应用最终约束
    // 确保列宽在合理范围内，并适配打印需求
    // ================================================================
    const MIN_WIDTH = 40;  // 最小宽度：防止列崩溃
    const MAX_WIDTH = 500; // 最大宽度：防止极端情况（模板可能比 A4 更宽）
    
    return colWidths.map(w => ({
      wpx: Math.max(MIN_WIDTH, Math.min(Math.round(w), MAX_WIDTH))
    }));
  } catch (error) {
    console.error('Failed to calculate column widths:', error);
    return [];
  }
}

/**
 * 检测模板中所有包含换行符的单元格
 * 用于识别模板中可能需要特殊处理的大文本输入框（如意见栏）
 * 
 * @param structureJson - JSON字符串格式的模板结构数据
 * @returns 包含换行符的单元格数组，每项包含{r, c, cellKey}
 */
export function checkCellLineBreaks(structureJson: string): Array<{ r: number; c: number; cellKey: string }> {
  if (!structureJson) return [];

  try {
    const structure = JSON.parse(structureJson);
    const data = extractGrid(structure);
    if (!data || data.length === 0) return [];
    const cellsWithLineBreaks: Array<{ r: number; c: number; cellKey: string }> = [];

    // 遍历所有单元格，检测换行符
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;

      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        // 非空单元格且包含换行符（\n）
        if (cell !== null && cell !== undefined && cell !== '') {
          const cellStr = String(cell);
          if (cellStr.includes('\n')) {
            cellsWithLineBreaks.push({
              r,
              c,
              cellKey: `R${r + 1}C${c + 1}`
            });
          }
        }
      }
    }

    return cellsWithLineBreaks;
  } catch (error) {
    console.error('Failed to check cell line breaks:', error);
    return [];
  }
}
