import { ParsedField } from '@/types/work-permit';

/**
 * 移动端数据转换器
 * 确保桌面端 ExcelGrid 的 formData (格式: {"4-1": "内容"}) 与移动端标准 JSON 格式互通
 */

export interface MobileFieldData {
  value: any;
  fieldInfo: ParsedField;
}

/**
 * 将 ExcelGrid 的原始数据 (r-c 格式) 转换为移动端易读的对象格式
 * @param formData - 桌面端表单数据 {"4-1": "内容", "4-1-inlines": {...}}
 * @param parsedFields - 解析的字段信息
 * @returns 移动端格式的数据对象
 */
export const transformToMobileData = (
  formData: Record<string, any>,
  parsedFields: ParsedField[]
): Record<string, MobileFieldData> => {
  const mobileData: Record<string, MobileFieldData> = {};

  parsedFields.forEach(field => {
    // 根据 cellKey (如 R5C2) 转换回坐标 4-1
    const match = field.cellKey.match(/R(\d+)C(\d+)/);
    if (match) {
      const r = parseInt(match[1]) - 1;
      const c = parseInt(match[2]) - 1;
      const key = `${r}-${c}`;
      
      // 存储数据，同时保留 field 信息用于渲染
      mobileData[field.fieldName] = {
        value: formData[key] || '',
        fieldInfo: field
      };

      // 如果有内联输入框数据，也一并转换
      const inlinesKey = `${r}-${c}-inlines`;
      if (formData[inlinesKey]) {
        mobileData[`${field.fieldName}_inlines`] = {
          value: formData[inlinesKey],
          fieldInfo: field
        };
      }
    }
  });

  return mobileData;
};

/**
 * 将移动端修改后的数据反向写回桌面端 formData
 * @param mobileFieldName - 移动端字段名
 * @param newValue - 新值
 * @param parsedFields - 解析的字段信息
 * @param currentFormData - 当前的桌面端表单数据
 * @returns 更新后的桌面端表单数据
 */
export const syncToExcelData = (
  mobileFieldName: string,
  newValue: any,
  parsedFields: ParsedField[],
  currentFormData: Record<string, any>
): Record<string, any> => {
  const field = parsedFields.find(f => f.fieldName === mobileFieldName);
  if (!field) return currentFormData;

  const match = field.cellKey.match(/R(\d+)C(\d+)/);
  if (match) {
    const r = parseInt(match[1]) - 1;
    const c = parseInt(match[2]) - 1;
    return { ...currentFormData, [`${r}-${c}`]: newValue };
  }
  return currentFormData;
};

/**
 * 根据 parsedFields 进行智能分组
 * @param parsedFields - 解析的字段信息
 * @returns 分组后的字段数组
 */
export const groupParsedFields = (parsedFields: ParsedField[]) => {
  // 如果字段本身有 group 属性，使用该属性分组
  const hasGroupInfo = parsedFields.some(f => f.group);
  
  if (hasGroupInfo) {
    const groups = new Map<string, ParsedField[]>();
    parsedFields.forEach(field => {
      const groupName = field.group || '其他信息';
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(field);
    });
    return Array.from(groups.entries()).map(([title, fields]) => ({ title, fields }));
  }

  // 否则，按字段类型自动分组
  const groups: { title: string; fields: ParsedField[] }[] = [];
  const signatureFields: ParsedField[] = [];
  const regularFields: ParsedField[] = [];
  const safetyFields: ParsedField[] = [];

  parsedFields.forEach(field => {
    if (field.fieldType === 'signature') {
      signatureFields.push(field);
    } else if (field.isSafetyMeasure) {
      safetyFields.push(field);
    } else {
      regularFields.push(field);
    }
  });

  if (regularFields.length > 0) {
    groups.push({ title: '基础信息', fields: regularFields });
  }
  if (safetyFields.length > 0) {
    groups.push({ title: '安全措施', fields: safetyFields });
  }
  if (signatureFields.length > 0) {
    groups.push({ title: '审批意见', fields: signatureFields });
  }

  return groups;
};

/**
 * 从单元格值中提取选项
 * @param cellValue - 单元格值，如 "□是 □否"
 * @returns 选项数组
 */
export const extractOptionsFromCell = (cellValue: string): string[] => {
  if (!cellValue || typeof cellValue !== 'string') return [];
  
  // 移除勾选标记，提取纯文本选项
  const options = cellValue
    .split(/[□☑]/)
    .filter(Boolean)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return options;
};
