// src/lib/orgDb.ts
import fs from 'fs';
import path from 'path';

// 定义部门接口
export interface DepartmentNode {
  id: string;
  name: string;
  parentId: string | null;
  managerId?: string;
  level: number;
  children?: DepartmentNode[];
}

const DB_PATH = path.join(process.cwd(), 'data', 'org.json');

// 确保数据目录存在
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// 读数据
export const getDepartments = (): DepartmentNode[] => {
  if (!fs.existsSync(DB_PATH)) return [];
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load org.json:', error);
    return [];
  }
};

// 写数据
export const saveDepartments = (departments: DepartmentNode[]) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(departments, null, 2));
};
