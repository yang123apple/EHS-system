// src/services/workPermitService.ts
import { Project, Template, PermitRecord, Department, DeptUser } from '@/types/work-permit';
import { apiFetch } from '@/lib/apiClient';

// === 基础请求封装 ===
const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(`${API_BASE}${url}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText || response.statusText}`);
  }
  // 对于 DELETE 等可能没有返回内容的请求，做特殊处理
  if (response.status === 204) {
    return {} as T;
  }
  return response.json();
}

function attachUserContext(payload: any = {}) {
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ehs_user') : null;
    if (!stored) return payload;
    const user = JSON.parse(stored);
    return { ...payload, userId: user?.id, userName: user?.name };
  } catch (_) {
    return payload;
  }
}

// ==========================================
// 1. 工程项目 (Projects)
// ==========================================
export const ProjectService = {
  /** 获取所有项目列表 */
  getAll: async (): Promise<Project[]> => {
    return request<Project[]>('/projects');
  },
  /** 创建新项目 */
  create: async (data: Partial<Project>): Promise<Project> => {
    return request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 更新项目 (用于工期调整等) */
  update: async (id: string, data: Partial<Project>): Promise<Project> => {
    return request<Project>('/projects', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...data }),
    });
  },
  /** 删除项目 */
  delete: async (id: string): Promise<void> => {
    return request<void>(`/projects?id=${id}`, {
      method: 'DELETE',
    });
  },
};

// ==========================================
// 2. 模板管理 (Templates)
// ==========================================
export const TemplateService = {
  /** 获取所有模板 */
  getAll: async (): Promise<Template[]> => {
    return request<Template[]>('/templates');
  },
  /** 创建模板 (通常在 Excel 解析后调用) */
  create: async (data: Partial<Template>): Promise<Template> => {
    const body = attachUserContext(data);
    return request<Template>('/templates', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  /**
   * 更新模板
   * 涵盖: 锁定/解锁, 保存流程配置, 编辑模板结构, 重命名等
   */
  update: async (id: string, data: Partial<Template>): Promise<Template> => {
    const body = attachUserContext({ id, ...data });
    return request<Template>('/templates', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  /** 删除模板 */
  delete: async (id: string): Promise<void> => {
    const { userId, userName } = attachUserContext();
    const query = new URLSearchParams({ id });
    if (userId) query.set('userId', userId);
    if (userName) query.set('userName', userName);
    return request<void>(`/templates?${query.toString()}`, {
      method: 'DELETE',
    });
  },
};

// ==========================================
// 3. 作业单记录 (Permit Records)
// ==========================================
export const PermitService = {
  /** 获取所有作业记录 */
  getAll: async (): Promise<PermitRecord[]> => {
    return request<PermitRecord[]>('/permits');
  },
  /** 获取特定项目的作业记录 */
  getByProject: async (projectId: string): Promise<PermitRecord[]> => {
    return request<PermitRecord[]>(`/permits?projectId=${projectId}`);
  },
  /**
   * 创建作业单
   * @param payload 包含 projectId, templateId, dataJson, attachments, proposedCode 等
   */
  create: async (payload: {
    projectId: string;
    templateId: string;
    dataJson: Record<string, any> | string;
    attachments?: any[];
    proposedCode?: string; // 🟢 新增：预览编号
  }): Promise<PermitRecord> => {
    // 确保 dataJson 是字符串，如果传了对象则转换
    const body = {
      ...payload,
      dataJson: typeof payload.dataJson === 'string' ? payload.dataJson : JSON.stringify(payload.dataJson),
    };
    return request<PermitRecord>('/permits', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  /**
   * 通用更新作业单
   * 用于: 回复评论(更新 approvalLogs), 修改状态等非审批动作
   */
  update: async (id: string, data: Partial<PermitRecord>): Promise<PermitRecord> => {
    return request<PermitRecord>('/permits', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...data }),
    });
  },
  /**
   * 执行审批动作
   * 后端通常会处理状态流转、日志追加等逻辑
   */
  approve: async (payload: {
    recordId: string;
    opinion: string;
    action: 'pass' | 'reject';
    userName: string;
    userId?: string; // 🟢 添加 userId 用于识别发起人
    nextStepApprovers?: any[]; // 🟢 下一步审批人列表（用于创建通知）
  }): Promise<void> => {
    return request<void>('/permits/approve', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  /** 删除作业单 */
  delete: async (id: string): Promise<void> => {
    return request<void>(`/permits?id=${id}`, {
      method: 'DELETE',
    });
  },
};

// ==========================================
// 4. 用户服务 (Users)
// ==========================================
export const UserService = {
  getAll: async (): Promise<DeptUser[]> => {
    // 假设后端有一个 /api/users 接口返回所有用户
    // 对应 mockDb.ts 中的 db.getUsers()
    return request<DeptUser[]>('/users');
  },
};

// ==========================================
// 5. 基础数据 (Structure)
// ==========================================
export const StructureService = {
  /** 获取组织架构 (部门和人员) */
  getDepartments: async (): Promise<Department[]> => {
    return request<Department[]>('/structure');
  },
};
