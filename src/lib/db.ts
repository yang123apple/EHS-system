// src/lib/db.ts
import fs from 'fs';
import path from 'path';
import { User, DepartmentNode, HazardRecord, HazardConfig } from '@/types/database';

// 确保数据目录存在
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 文件路径
const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  org: path.join(DATA_DIR, 'org.json'),
  hazards: path.join(DATA_DIR, 'hazards.json'),
  hazardConfig: path.join(DATA_DIR, 'hazard_config.json'),
};

// 默认数据（仅当文件不存在时使用）
const DEFAULTS = {
  users: [
    {
      id: '88888888',
      username: 'admin',
      name: '超级管理员',
      password: 'admin',
      avatar: '/image/default_avatar.jpg',
      role: 'admin',
      department: 'EHS部',
      departmentId: 'dept_ehs',
      permissions: { all: ['all'] }
    }
  ] as User[],
  org: [
    { id: 'dept_root', name: 'XX新能源科技有限公司', parentId: null, managerId: '88888888', level: 1 },
    { id: 'dept_ehs', name: 'EHS部', parentId: 'dept_root', managerId: '88888888', level: 2 },
  ] as DepartmentNode[],
  hazards: [] as HazardRecord[],
  hazardConfig: { types: ['用电安全'], areas: ['一号车间'] } as HazardConfig
};

// --- 通用读写助手 ---
function read<T>(filePath: string, defaultData: T): T {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return defaultData;
  }
}

function write(filePath: string, data: any) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ==========================================
// 数据库操作导出
// ==========================================

export const db = {
  // === 用户 ===
  getUsers: () => read<User[]>(FILES.users, DEFAULTS.users),
  
  saveUser: (user: User) => {
    const list = read<User[]>(FILES.users, DEFAULTS.users);
    list.push(user);
    write(FILES.users, list);
    return user;
  },

  updateUser: (id: string, data: Partial<User>) => {
    const list = read<User[]>(FILES.users, DEFAULTS.users);
    const idx = list.findIndex(u => u.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
      write(FILES.users, list);
      return list[idx];
    }
    return null;
  },

  getUserById: (id: string) => {
    const list = read<User[]>(FILES.users, DEFAULTS.users);
    return list.find(u => u.id === id);
  },

  deleteUser: (id: string) => {
    let list = read<User[]>(FILES.users, DEFAULTS.users);
    list = list.filter(u => u.id !== id);
    write(FILES.users, list);
    return true;
  },

  // === 组织架构 ===
  getDepartments: () => read<DepartmentNode[]>(FILES.org, DEFAULTS.org),

  getOrgTree: () => {
    const list = read<DepartmentNode[]>(FILES.org, DEFAULTS.org);
    // 转换为树状结构
    const map: Record<string, DepartmentNode> = {};
    const tree: DepartmentNode[] = [];
    const nodes = JSON.parse(JSON.stringify(list)); // 深拷贝
    
    nodes.forEach((node: DepartmentNode) => { map[node.id] = { ...node, children: [] }; });
    nodes.forEach((node: DepartmentNode) => {
      if (node.parentId && map[node.parentId]) {
        map[node.parentId].children?.push(map[node.id]);
      } else {
        tree.push(map[node.id]);
      }
    });
    return tree;
  },

  createDepartment: (data: { name: string, parentId: string | null, managerId?: string, level: number }) => {
    const list = read<DepartmentNode[]>(FILES.org, DEFAULTS.org);
    const newDept: DepartmentNode = {
      id: `dept_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      name: data.name,
      parentId: data.parentId,
      managerId: data.managerId,
      level: data.level
    };
    list.push(newDept);
    write(FILES.org, list);
    return newDept;
  },

  updateDepartment: (id: string, data: Partial<DepartmentNode>) => {
    const list = read<DepartmentNode[]>(FILES.org, DEFAULTS.org);
    const idx = list.findIndex(d => d.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
      write(FILES.org, list);
      return list[idx];
    }
    return null;
  },

  deleteDepartment: (id: string) => {
    let list = read<DepartmentNode[]>(FILES.org, DEFAULTS.org);
    list = list.filter(d => d.id !== id);
    write(FILES.org, list);
    return true;
  },

  // === 隐患 ===
  getHazards: () => read<HazardRecord[]>(FILES.hazards, DEFAULTS.hazards),
  // ... 其他隐患方法类似实现，使用 read/write 即可
};