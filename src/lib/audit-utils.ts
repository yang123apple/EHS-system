/**
 * EHS 系统审计日志工具函数
 * 
 * 提供快照生成、差异比对、客户端信息提取等核心功能
 */

import { SENSITIVE_FIELDS, IGNORED_DIFF_FIELDS } from '@/constants/audit';
import type { DiffResult, ClientInfo } from '@/types/audit';

// ============ 快照生成 ============

/**
 * 生成数据快照
 * 
 * 清洗敏感字段（如密码），返回标准化的 JSON 对象用于审计存储
 * 
 * @param data 原始数据对象
 * @returns 清洗后的快照对象
 */
export function generateSnapshot(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  // 基本类型直接返回
  if (typeof data !== 'object') {
    return data;
  }

  // 处理数组
  if (Array.isArray(data)) {
    return data.map(item => generateSnapshot(item));
  }

  // 处理对象
  const snapshot: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // 跳过敏感字段
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      snapshot[key] = '***REDACTED***';
      continue;
    }

    // 递归处理嵌套对象
    if (value && typeof value === 'object') {
      snapshot[key] = generateSnapshot(value);
    } else {
      snapshot[key] = value;
    }
  }

  return snapshot;
}

// ============ 差异比对 ============

/**
 * 深度比较两个对象，返回差异
 * 
 * @param oldData 修改前的数据
 * @param newData 修改后的数据
 * @returns 差异对象，格式：{ fieldName: { old: value, new: value } }
 */
export function compareObjects(
  oldData: any,
  newData: any
): DiffResult | null {
  if (!oldData || !newData) {
    return null;
  }

  const diff: DiffResult = {};

  // 获取所有键（合并新旧数据的键）
  const allKeys = new Set([
    ...Object.keys(oldData),
    ...Object.keys(newData),
  ]);

  for (const key of allKeys) {
    // 跳过忽略字段
    if (IGNORED_DIFF_FIELDS.includes(key)) {
      continue;
    }

    // 跳过敏感字段
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      continue;
    }

    const oldValue = oldData[key];
    const newValue = newData[key];

    // 值相同，跳过
    if (isEqual(oldValue, newValue)) {
      continue;
    }

    // 记录差异
    diff[key] = {
      old: oldValue,
      new: newValue,
    };
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

/**
 * 深度比较两个值是否相等
 */
function isEqual(a: any, b: any): boolean {
  // 严格相等
  if (a === b) return true;

  // null 或 undefined
  if (a == null || b == null) {
    return a === b;
  }

  // 类型不同
  if (typeof a !== typeof b) {
    return false;
  }

  // Date 对象
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // 数组
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => isEqual(item, b[index]));
  }

  // 对象
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => isEqual(a[key], b[key]));
  }

  return false;
}

// ============ 客户端信息提取 ============

/**
 * 从 Request 对象提取客户端环境信息
 * 
 * @param request Next.js Request 对象
 * @returns ClientInfo 对象
 */
export function extractClientInfo(request?: Request): ClientInfo {
  if (!request) {
    return {};
  }

  const headers = request.headers;
  const userAgent = headers.get('user-agent') || '';
  const ip = extractIPAddress(request);

  return {
    ip,
    userAgent,
    device: detectDevice(userAgent),
    browser: detectBrowser(userAgent),
    os: detectOS(userAgent),
  };
}

/**
 * 提取 IP 地址（支持代理）
 */
function extractIPAddress(request: Request): string | undefined {
  const headers = request.headers;

  // 尝试从常见的代理头部获取真实 IP
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for 可能包含多个 IP，取第一个
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // 从 request URL 获取（适用于某些环境）
  // 注意：在 Next.js 中可能需要其他方式获取
  return undefined;
}

/**
 * 检测设备类型
 */
function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * 检测浏览器类型和版本
 */
function detectBrowser(userAgent: string): string {
  const ua = userAgent;

  if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return match ? `Chrome ${match[1]}` : 'Chrome';
  }
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/);
    return match ? `Edge ${match[1]}` : 'Edge';
  }
  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/);
    return match ? `Firefox ${match[1]}` : 'Firefox';
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    return match ? `Safari ${match[1]}` : 'Safari';
  }

  return 'Unknown';
}

/**
 * 检测操作系统
 */
function detectOS(userAgent: string): string {
  const ua = userAgent;

  if (ua.includes('Windows NT 10.0')) return 'Windows 10/11';
  if (ua.includes('Windows NT 6.3')) return 'Windows 8.1';
  if (ua.includes('Windows NT 6.2')) return 'Windows 8';
  if (ua.includes('Windows NT 6.1')) return 'Windows 7';
  if (ua.includes('Windows')) return 'Windows';

  if (ua.includes('Mac OS X')) {
    const match = ua.match(/Mac OS X ([\d_]+)/);
    return match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  }

  if (ua.includes('Android')) {
    const match = ua.match(/Android ([\d.]+)/);
    return match ? `Android ${match[1]}` : 'Android';
  }

  if (ua.includes('iPhone') || ua.includes('iPad')) {
    const match = ua.match(/OS ([\d_]+)/);
    return match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  }

  if (ua.includes('Linux')) return 'Linux';

  return 'Unknown';
}

// ============ 数据序列化辅助 ============

/**
 * 安全地序列化对象为 JSON 字符串
 * 
 * @param data 要序列化的数据
 * @returns JSON 字符串，失败返回 null
 */
export function safeStringify(data: any): string | null {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.error('JSON stringify error:', error);
    return null;
  }
}

/**
 * 安全地解析 JSON 字符串
 * 
 * @param json JSON 字符串
 * @returns 解析后的对象，失败返回 null
 */
export function safeParse<T = any>(json: string | null | undefined): T | null {
  if (!json) return null;
  
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('JSON parse error:', error);
    return null;
  }
}

// ============ 字段名中文化（可选） ============

/**
 * 常用字段的中文映射
 */
const FIELD_LABELS: Record<string, string> = {
  // 隐患相关
  'status': '状态',
  'riskLevel': '风险等级',
  'type': '类型',
  'location': '位置',
  'desc': '描述',
  'responsibleId': '整改人ID',
  'responsibleName': '整改人',
  'responsibleDept': '整改部门',
  'deadline': '整改期限',
  'rectifyDesc': '整改说明',
  'rectificationNotes': '整改说明',
  'rectifyTime': '整改时间',
  'rectificationTime': '整改时间',
  'rectifyRequirement': '整改措施要求',
  'rectificationRequirements': '整改措施要求',
  'verifierName': '验收人',
  'verifyTime': '验收时间',
  'verificationTime': '验收时间',
  'verifyDesc': '验收描述',
  'verificationNotes': '验收描述',
  'currentExecutorId': '当前执行人ID',
  'currentExecutorName': '当前执行人',
  'dopersonal_ID': '当前执行人ID',
  'dopersonal_Name': '当前执行人',
  'old_personal_ID': '历史经手人',
  'historicalHandlerIds': '历史经手人',
  
  // 作业许可
  'workType': '作业类型',
  'startTime': '开始时间',
  'endTime': '结束时间',
  'applicant': '申请人',
  'approver': '审批人',
  
  // 用户相关
  'username': '用户名',
  'name': '姓名',
  'role': '角色',
  'department': '部门',
  'jobTitle': '职位',
  'phone': '电话',
  'email': '邮箱',
  
  // 通用
  'title': '标题',
  'content': '内容',
  'createdAt': '创建时间',
  'updatedAt': '更新时间',
};

/**
 * 获取字段的中文名称
 */
export function getFieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] || fieldName;
}

/**
 * 格式化差异对比为人类可读的文本
 * 
 * @param diff 差异对象
 * @returns 格式化后的差异描述数组
 */
export function formatDiffForDisplay(diff: DiffResult): string[] {
  const changes: string[] = [];

  for (const [field, change] of Object.entries(diff)) {
    const fieldLabel = getFieldLabel(field);
    const oldValue = formatValue(change.old);
    const newValue = formatValue(change.new);

    changes.push(`${fieldLabel}: [${oldValue}] → [${newValue}]`);
  }

  return changes;
}

/**
 * 格式化值为可读字符串
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '空';
  }
  
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (value instanceof Date) {
    return value.toLocaleString('zh-CN');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}
