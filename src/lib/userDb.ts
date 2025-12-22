// src/lib/userDb.ts
import fs from 'fs';
import path from 'path';

// 定义用户接口 (保持与之前一致)
export type UserRole = 'admin' | 'user';
export interface UserPermissions { [moduleKey: string]: string[]; }

export interface User {
  id: string;
  username: string;
  name: string;
  password: string;
  avatar: string;
  role: UserRole;
  department: string;
  permissions: UserPermissions;
}

const DB_PATH = path.join(process.cwd(), 'data', 'users.json');

// 确保数据目录存在
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// 读数据
export const getUsers = (): User[] => {
  if (!fs.existsSync(DB_PATH)) return [];
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

// 写数据
export const saveUsers = (users: User[]) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
};

// 辅助：生成 ID
export const generateUniqueId = (users: User[]): string => {
  let id = '';
  do {
    id = Math.floor(10000000 + Math.random() * 90000000).toString();
  } while (users.find(u => u.id === id));
  return id;
};