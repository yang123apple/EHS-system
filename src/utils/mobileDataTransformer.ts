import { ParsedField } from '@/types/work-permit';

/**
 * 移动端数据转换器
 * 统一使用 cellKey (格式: "R1C1") 作为全系统唯一数据标识
 */

export interface MobileFieldData {
  value: any;
  fieldInfo: ParsedField;
}

/**
 * 将 ExcelGrid 的原始数据转换为移动端格式的对象
 * @param formData - 表单数据 {"R1C1": "内容"}
 * @param parsedFields - 解析的字段信息
 * @returns 移动端格式的数据对象
 */
export const transformToMobileData = (
  formData: Record<string, any>,
  parsedFields: ParsedField[]
): Record<string, MobileFieldData> => {
  const mobileData: Record<string, MobileFieldData> = {};

  parsedFields.forEach(field => {
    // 🟢 统一使用 cellKey (如 R5C2) 作为读取 Key
    const key = field.cellKey;
    if (!key) return;
    
    // 存储数据，同时保留 field 信息用于渲染
    mobileData[field.fieldName] = {
      value: formData[key] || '',
      fieldInfo: field
    };

    // 如果有内联输入框数据 (保持 R1C1 风格)
    const inlinesKey = `${key}-inlines`;
    if (formData[inlinesKey]) {
      mobileData[`${field.fieldName}_inlines`] = {
        value: formData[inlinesKey],
        fieldInfo: field
      };
    }
  });

  return mobileData;
};

/**
 * 将移动端修改后的数据反向写回 formData
 * @param mobileFieldName - 移动端字段名
 * @param newValue - 新值
 * @param parsedFields - 解析的字段信息
 * @param currentFormData - 当前的表单数据
 * @returns 更新后的表单数据
 */
export const syncToExcelData = (
  mobileFieldName: string,
  newValue: any,
  parsedFields: ParsedField[],
  currentFormData: Record<string, any>
): Record<string, any> => {
  const field = parsedFields.find(f => f.fieldName === mobileFieldName);
  if (!field) return currentFormData;

  // 🟢 统一写回 cellKey (如 R5C2)
  if (field.cellKey) {
    return { ...currentFormData, [field.cellKey]: newValue };
  }
  
  return currentFormData;
};

/**
 * 根据 parsedFields 进行智能分组
 * @param parsedFields - 解析的字段信息
 * @returns 分组后的字段数组
 */
export const groupParsedFields = (parsedFields: ParsedField[]) => {
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
  
  const options = cellValue
    .split(/[□☑]/)
    .filter(Boolean)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return options;
};
