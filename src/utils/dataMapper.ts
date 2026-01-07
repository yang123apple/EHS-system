/**
 * 数据映射工具：从 JSON 结构中提取关键业务字段到数据库列
 * 
 * 用途：
 * 1. 解决数据孤岛问题：使关键字段可用于 SQL 统计查询
 * 2. 提升查询性能：避免全表扫描 dataJson
 * 3. 支持报表统计：如"统计某部门本月动火作业次数"
 */

import type { ParsedField } from '@/types/work-permit';

export interface MappedFields {
  riskLevel?: string;
  workType?: string;
  location?: string;
  applicantId?: string;
  applicantName?: string;
  applicantDept?: string;
  workDate?: Date | null;
  workStartTime?: Date | null;
  workEndTime?: Date | null;
  supervisorId?: string;
  supervisorName?: string;
}

/**
 * 从 dataJson 中提取关键字段值
 * 
 * @param dataJson - 表单数据 JSON（字符串或对象）
 * @param parsedFields - 模板解析字段配置（用于字段映射）
 * @returns 映射后的字段对象
 */
export function mapJsonToColumns(
  dataJson: string | Record<string, any>,
  parsedFields: ParsedField[] = []
): MappedFields {
  const result: MappedFields = {};
  
  // 解析 dataJson
  let data: any = {};
  try {
    if (typeof dataJson === 'string') {
      data = JSON.parse(dataJson);
    } else {
      data = dataJson;
    }
    
    // 处理数组格式（Excel grid 格式）
    if (Array.isArray(data) && data.length > 0) {
      // 如果是数组，尝试从第一个 sheet 的 celldata 中提取
      const sheet = data[0];
      if (sheet?.celldata) {
        const cellMap: Record<string, any> = {};
        sheet.celldata.forEach((cell: any) => {
          if (cell.r !== undefined && cell.c !== undefined) {
            const key = `R${cell.r}C${cell.c}`;
            cellMap[key] = cell.v?.v || cell.v?.m || cell.v || '';
          }
        });
        data = cellMap;
      } else {
        // 如果不是标准格式，尝试从 parsedFields 重建对象
        const obj: Record<string, any> = {};
        parsedFields.forEach((field, idx) => {
          if (field.cellKey && data[idx] !== undefined) {
            obj[field.cellKey] = data[idx];
          }
        });
        data = obj;
      }
    }
  } catch (e) {
    console.warn('[数据映射] 解析 dataJson 失败:', e);
    return result;
  }

  // 🟢 统一成对象形态，后续按 cellKey 索引
  const dataObj: Record<string, any> = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
  
  // 构建字段映射表（基于 parsedFields 的 fieldName）
  const fieldMap: Record<string, ParsedField> = {};
  parsedFields.forEach(field => {
    if (field.cellKey && field.fieldName) {
      fieldMap[field.fieldName] = field;
    }
  });
  
  // 提取关键字段
  // 1. 风险等级
  const riskLevelFields = ['riskLevel', 'risk_level', '风险等级', '危险等级'];
  for (const fieldName of riskLevelFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      result.riskLevel = String(dataObj[field.cellKey]).trim();
      break;
    }
  }
  
  // 2. 作业类型（通常从模板的 type 字段获取，但也可以从表单中提取）
  const workTypeFields = ['workType', 'work_type', '作业类型', '作业类别'];
  for (const fieldName of workTypeFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      result.workType = String(dataObj[field.cellKey]).trim();
      break;
    }
  }
  
  // 3. 作业地点
  const locationFields = ['location', 'workLocation', 'work_location', '作业地点', '施工地点'];
  for (const fieldName of locationFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      result.location = String(dataObj[field.cellKey]).trim();
      break;
    }
  }
  
  // 4. 申请人信息
  const applicantIdFields = ['applicantId', 'applicant_id', '申请人ID', '申请人编号'];
  const applicantNameFields = ['applicantName', 'applicant_name', '申请人', '申请人姓名'];
  const applicantDeptFields = ['applicantDept', 'applicant_dept', '申请部门', '申请人部门'];
  
  for (const fieldName of applicantIdFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      result.applicantId = String(dataObj[field.cellKey]).trim();
      break;
    }
  }
  
  for (const fieldName of applicantNameFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      result.applicantName = String(dataObj[field.cellKey]).trim();
      break;
    }
  }
  
  for (const fieldName of applicantDeptFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      result.applicantDept = String(dataObj[field.cellKey]).trim();
      break;
    }
  }
  
  // 5. 作业日期和时间
  const workDateFields = ['workDate', 'work_date', '作业日期', '施工日期'];
  const workStartTimeFields = ['workStartTime', 'work_start_time', '开始时间', '作业开始时间'];
  const workEndTimeFields = ['workEndTime', 'work_end_time', '结束时间', '作业结束时间'];
  
  for (const fieldName of workDateFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      const dateStr = String(dataObj[field.cellKey]).trim();
      if (dateStr) {
        const date = parseDate(dateStr);
        if (date) result.workDate = date;
      }
      break;
    }
  }
  
  for (const fieldName of workStartTimeFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      const timeStr = String(dataObj[field.cellKey]).trim();
      if (timeStr) {
        const date = parseDateTime(timeStr);
        if (date) result.workStartTime = date;
      }
      break;
    }
  }
  
  for (const fieldName of workEndTimeFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      const timeStr = String(dataObj[field.cellKey]).trim();
      if (timeStr) {
        const date = parseDateTime(timeStr);
        if (date) result.workEndTime = date;
      }
      break;
    }
  }
  
  // 6. 监护人信息
  const supervisorIdFields = ['supervisorId', 'supervisor_id', '监护人ID', '监护人编号'];
  const supervisorNameFields = ['supervisorName', 'supervisor_name', '监护人', '监护人姓名'];
  
  for (const fieldName of supervisorIdFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      result.supervisorId = String(dataObj[field.cellKey]).trim();
      break;
    }
  }
  
  for (const fieldName of supervisorNameFields) {
    const field = fieldMap[fieldName];
    if (field?.cellKey && dataObj[field.cellKey]) {
      result.supervisorName = String(dataObj[field.cellKey]).trim();
      break;
    }
  }
  
  return result;
}

/**
 * 解析日期字符串
 */
function parseDate(dateStr: string): Date | null {
  try {
    // 尝试多种日期格式
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /^(\d{4})\/(\d{2})\/(\d{2})/, // YYYY/MM/DD
      /^(\d{4})\.(\d{2})\.(\d{2})/, // YYYY.MM.DD
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        return new Date(year, month, day);
      }
    }
    
    // 尝试直接解析
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {
    // 忽略解析错误
  }
  
  return null;
}

/**
 * 解析日期时间字符串
 */
function parseDateTime(dateTimeStr: string): Date | null {
  try {
    // 尝试多种日期时间格式
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/, // YYYY-MM-DD HH:mm:ss
      /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/, // YYYY/MM/DD HH:mm:ss
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/, // ISO 8601
    ];
    
    for (const format of formats) {
      const match = dateTimeStr.match(format);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const hour = parseInt(match[4] || '0', 10);
        const minute = parseInt(match[5] || '0', 10);
        const second = parseInt(match[6] || '0', 10);
        return new Date(year, month, day, hour, minute, second);
      }
    }
    
    // 尝试直接解析
    const date = new Date(dateTimeStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {
    // 忽略解析错误
  }
  
  return null;
}

/**
 * 从模板类型推断作业类型（备用方案）
 */
export function inferWorkTypeFromTemplate(templateType: string): string | undefined {
  const typeMap: Record<string, string> = {
    '动火': '动火作业',
    '高处': '高处作业',
    '受限空间': '受限空间作业',
    '吊装': '吊装作业',
    '冷作': '冷作作业',
    '热作': '热作作业',
  };
  
  for (const [key, value] of Object.entries(typeMap)) {
    if (templateType.includes(key)) {
      return value;
    }
  }
  
  return templateType || undefined;
}

