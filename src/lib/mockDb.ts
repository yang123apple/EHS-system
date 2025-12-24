// src/lib/mockDb.ts
// 🟢 纯内存 Mock DB - 适用于 Next.js（无 fs/path）
import * as userDb from './userDb';
import * as orgDb from './orgDb';

// ==========================================
// 1. 系统模块与权限定义
// ==========================================
export const SYSTEM_MODULES = [
  {
    key: 'work_permit',
    name: '作业许可系统',
    permissions: [
      { key: 'create_project', name: '新建工程' },
      { key: 'delete_project', name: '删除工程' },
      { key: 'adjust_schedule', name: '工期调整' },
      { key: 'create_permit', name: '新建关联表单' },
      { key: 'delete_permit', name: '删除关联表单' },
      { key: 'upload_template', name: '上传模板' },
      { key: 'edit_template', name: '编辑模板' },
      { key: 'lock_template', name: '锁定模板' },
      { key: 'delete_template', name: '删除模板' },
      { key: 'approve_permit', name: '审批作业票' },
    ],
  },
  {
    key: 'hidden_danger',
    name: '隐患排查治理系统',
    permissions: [
      { key: 'report', name: '隐患上报' },
      { key: 'handle', name: '整改/验收隐患' },
      { key: 'assign', name: '指派责任人 (管理)' },
      { key: 'view_stats', name: '查看统计报表' },
      { key: 'manage_config', name: '配置基础数据 (Admin)' },
      { key: 'delete', name: '删除隐患记录 (Admin)' },
    ],
  },
  {
    key: 'doc_sys',
    name: 'EHS文档管理系统',
    permissions: [
      { key: 'upload', name: '上传文件 (DOCX/PDF)' },
      { key: 'down_docx_l123', name: '下载 DOCX (1-3级体系文件)' },
      { key: 'down_docx_l4', name: '下载 DOCX (4级记录表格)' },
      { key: 'down_pdf', name: '下载 PDF 源文件' },
      { key: 'delete', name: '删除文件' },
      { key: 'edit', name: '编辑文件信息' },
    ],
  },
];

// ==========================================
// 2. 接口定义
// ==========================================

export interface DepartmentNode {
  id: string;
  name: string;
  parentId: string | null;
  managerId?: string;
  level: number; // 🟢 部门层级
  children?: DepartmentNode[];
}

export type UserRole = 'admin' | 'user';
export interface UserPermissions {
  [moduleKey: string]: string[];
}

export interface User {
  id: string;
  username: string;
  name: string;
  password: string;
  avatar: string;
  role: UserRole;
  department: string;
  departmentId?: string;
  jobTitle?: string;
  directManagerId?: string;
  permissions: UserPermissions;
}

export interface HazardLog {
  operatorId: string;
  operatorName: string;
  action: string;
  time: string;
  changes?: string;
}

export interface HazardRecord {
  id: string;
  status: 'reported' | 'assigned' | 'rectifying' | 'verified' | 'closed';
  riskLevel: 'low' | 'medium' | 'high' | 'major';
  type: string;
  location: string;
  desc: string;
  photos: string[];
  reporterId: string;
  reporterName: string;
  reportTime: string;
  
  // 🟢 新增：整改要求方式
  rectifyRequirement?: string;
  
  responsibleDept?: string;
  responsibleId?: string;
  responsibleName?: string;
  deadline?: string;
  
  // 🟢 新增：应急预案要求
  requireEmergencyPlan?: boolean;
  emergencyPlanDeadline?: string;
  emergencyPlanContent?: string;
  emergencyPlanSubmitTime?: string;
  
  // 🟢 新增：抄送信息
  ccDepts?: string[]; // 抄送部门ID列表
  ccUsers?: string[]; // 抄送人员ID列表
  
  isExtensionRequested?: boolean;
  extensionReason?: string;
  rectifyDesc?: string;
  rectifyPhotos?: string[];
  rectifyTime?: string;
  verifierId?: string;
  verifierName?: string;
  verifyTime?: string;
  logs: HazardLog[];
}

export interface HazardConfig {
  types: string[];
  areas: string[];
}

// ==========================================
// 3. 内存数据初始化
// ==========================================

let departments: DepartmentNode[] = [
  { id: 'dept_root', name: 'XX新能源科技有限公司', parentId: null, managerId: '88888888', level: 1 },
  { id: 'dept_ehs', name: 'EHS部', parentId: 'dept_root', managerId: '88888888', level: 2 },
  { id: 'dept_prod', name: '生产部', parentId: 'dept_root', managerId: '', level: 2 },
  { id: 'dept_ws1', name: '一号车间', parentId: 'dept_prod', managerId: '', level: 3 },
];

let users: User[] = [
  {
    id: '88888888',
    username: 'admin',
    name: '超级管理员',
    password: 'admin',
    avatar: '/image/default_avatar.jpg',
    role: 'admin',
    department: 'EHS部',
    departmentId: 'dept_ehs',
    jobTitle: 'EHS总监',
    directManagerId: '',
    permissions: { all: ['all'] },
  },
];

let hazardRecords: HazardRecord[] = [
  {
    id: 'H-20231218-001',
    status: 'assigned',
    riskLevel: 'medium',
    type: '用电安全',
    location: '一号车间',
    desc: '配电箱门未关闭，且缺少警示标识',
    photos: [],
    reporterId: '88888888',
    reporterName: '超级管理员',
    reportTime: new Date().toISOString(),
    responsibleDept: '设备部',
    responsibleId: '88888888',
    responsibleName: '超级管理员',
    deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
    logs: [
      {
        operatorId: '88888888',
        operatorName: '超级管理员',
        action: '上报隐患',
        time: new Date().toISOString(),
        changes: '创建记录',
      },
      {
        operatorId: '88888888',
        operatorName: '超级管理员',
        action: '指派责任人',
        time: new Date().toISOString(),
        changes: '指派给: 超级管理员',
      },
    ],
  },
];

let hazardConfig: HazardConfig = {
  types: ['用电安全', '消防设施', '机械伤害', '化学品管理', '劳保穿戴', '现场5S'],
  areas: ['一号车间', '二号车间', '仓库区', '办公楼', '实验室', '厂区道路'],
};

// ==========================================
// 4. 数据库操作对象 (纯内存)
// ==========================================

export const db = {
  // === 用户相关 ===
  getUsers: async () => userDb.getUsers(), // 🟢 从 userDb 加载实际数据
  getUserByUsername: async (username: string) => userDb.getUsers().find((u) => u.username === username),
  getUserById: async (id: string) => userDb.getUsers().find((u) => u.id === id),

  updateUser: async (id: string, data: Partial<User>) => {
    const allUsers = userDb.getUsers();
    const idx = allUsers.findIndex((u) => u.id === id);
    if (idx !== -1) {
      allUsers[idx] = { ...allUsers[idx], ...data };
      userDb.saveUsers(allUsers);
      return allUsers[idx];
    }
    return null;
  },

  createUser: async (data: Omit<User, 'id' | 'permissions' | 'avatar'>) => {
    const allUsers = userDb.getUsers();
    if (allUsers.some((u) => u.username === data.username)) {
      throw new Error('登录账号已存在');
    }
    const newUser: User = {
      ...data,
      id: Math.floor(10000000 + Math.random() * 90000000).toString(),
      avatar: '/image/default_avatar.jpg',
      permissions: {},
      directManagerId: data.directManagerId || '',
    };
    allUsers.push(newUser);
    userDb.saveUsers(allUsers);
    return newUser;
  },

  deleteUser: async (id: string) => {
    users = users.filter((u) => u.id !== id);
    return true;
  },

  // === 组织架构相关 ===
  getDepartments: async () => orgDb.getDepartments(), // 🟢 从 orgDb 加载实际数据

  getOrgTree: async () => {
    const list = orgDb.getDepartments();
    const map: Record<string, DepartmentNode> = {};
    const tree: DepartmentNode[] = [];
    list.forEach((node: DepartmentNode) => {
      map[node.id] = { ...node, children: [] };
    });
    list.forEach((node: DepartmentNode) => {
      if (node.parentId && map[node.parentId]) {
        map[node.parentId].children?.push(map[node.id]);
      } else {
        tree.push(map[node.id]);
      }
    });
    return tree;
  },

  createDepartment: async (data: { name: string; parentId: string | null; managerId?: string; level: number }) => {
    const newDept: DepartmentNode = {
      id: `dept_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: data.name,
      parentId: data.parentId,
      managerId: data.managerId,
      level: data.level,
    };
    departments.push(newDept);
    return newDept;
  },

  updateDepartment: async (id: string, data: Partial<DepartmentNode>) => {
    const idx = departments.findIndex((d) => d.id === id);
    if (idx !== -1) {
      departments[idx] = { ...departments[idx], ...data };
      return departments[idx];
    }
    return null;
  },

  deleteDepartment: async (id: string) => {
    departments = departments.filter((d) => d.id !== id);
    return true;
  },

  // === 隐患相关 ===
  getHazards: async () => [...hazardRecords],

  createHazard: async (data: Omit<HazardRecord, 'id' | 'status' | 'logs'>) => {
    const newHazard: HazardRecord = {
      ...data,
      id: `H-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`,
      status: 'reported',
      logs: [
        {
          operatorId: data.reporterId,
          operatorName: data.reporterName,
          action: '上报隐患',
          time: new Date().toISOString(),
          changes: '创建记录',
        },
      ],
    };
    hazardRecords.unshift(newHazard);
    return newHazard;
  },

  updateHazard: async (id: string, data: Partial<HazardRecord>) => {
    const idx = hazardRecords.findIndex((h) => h.id === id);
    if (idx !== -1) {
      hazardRecords[idx] = { ...hazardRecords[idx], ...data };
      return hazardRecords[idx];
    }
    return null;
  },

  deleteHazard: async (id: string) => {
    hazardRecords = hazardRecords.filter((h) => h.id !== id);
    return true;
  },

  getHazardConfig: async () => ({ ...hazardConfig }),

  updateHazardConfig: async (data: Partial<HazardConfig>) => {
    hazardConfig = { ...hazardConfig, ...data };
    return hazardConfig;
  },
};

// ==========================================
// 5. 辅助函数（供 API Routes 使用）
// ==========================================

export const getUsers = () => [...users];
export const saveUsers = (newUsers: User[]) => {
  users = newUsers;
};
export const generateUniqueId = () => Math.floor(10000000 + Math.random() * 90000000).toString();
