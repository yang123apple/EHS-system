// src/lib/db.ts
import { prisma } from '@/lib/prisma';
import { User, DepartmentNode, HazardRecord, HazardConfig } from '@/types/database';

// 转换 Prisma User 到前端 User 类型
function mapUser(pUser: any): User {
  return {
    ...pUser,
    // 确保 department 是 string 或 undefined，因为 pUser.department 可能是关联对象
    department: pUser.department?.name || '',
    permissions: pUser.permissions ? JSON.parse(pUser.permissions) : {},
  };
}

// 转换 Prisma Department 到前端 DepartmentNode 类型
function mapDept(pDept: any): DepartmentNode {
  return {
    ...pDept,
    children: [] // 树状结构需要在 getOrgTree 中处理
  };
}

// 转换 Prisma HazardRecord 到前端 HazardRecord 类型
function mapHazard(pHazard: any): HazardRecord {
  return {
    ...pHazard,
    photos: pHazard.photos ? JSON.parse(pHazard.photos) : [],
    rectifyPhotos: pHazard.rectifyPhotos ? JSON.parse(pHazard.rectifyPhotos) : [],
    logs: pHazard.logs ? JSON.parse(pHazard.logs) : [],
    ccDepts: pHazard.ccDepts ? JSON.parse(pHazard.ccDepts) : [],
    ccUsers: pHazard.ccUsers ? JSON.parse(pHazard.ccUsers) : [],
    old_personal_ID: pHazard.old_personal_ID ? JSON.parse(pHazard.old_personal_ID) : [],
    reportTime: pHazard.reportTime.toISOString(),
    rectifyTime: pHazard.rectifyTime?.toISOString(),
    verifyTime: pHazard.verifyTime?.toISOString(),
    deadline: pHazard.deadline?.toISOString(),
    emergencyPlanDeadline: pHazard.emergencyPlanDeadline?.toISOString(),
    emergencyPlanSubmitTime: pHazard.emergencyPlanSubmitTime?.toISOString(),
    createdAt: pHazard.createdAt.toISOString(),
    updatedAt: pHazard.updatedAt.toISOString(),
  };
}

export const db = {
  // === 用户 ===
  getUsers: async () => {
    // 必须 include department，否则 department 字段将丢失
    const users = await prisma.user.findMany({
      include: { department: true }
    });
    return users.map(mapUser);
  },
  
  saveUser: async (user: User) => {
    // 剔除前端多余的字段 (department 名称)
    // 假设 user.departmentId 已正确设置
    const { id, permissions, department, ...rest } = user;

    // 如果 id 是纯数字(mock数据)，则让 prisma 生成 cuid；如果是 cuid 则使用
    const userData: any = { ...rest, permissions: JSON.stringify(permissions) };
    if (id && id.length > 10) userData.id = id;

    // 如果 rest 中还有其他不在 schema 中的字段，Prisma 会报错，所以最好是只取已知字段
    // 这里为了简洁，假设 TS 类型约束了 user 字段。如果有额外字段，Prisma client 会过滤还是报错取决于配置。
    // 安全起见，手动 pick 核心字段
    const safeData = {
        username: user.username,
        name: user.name,
        password: user.password,
        avatar: user.avatar,
        role: user.role,
        departmentId: user.departmentId,
        jobTitle: user.jobTitle,
        directManagerId: user.directManagerId,
        permissions: JSON.stringify(permissions || {})
    };

    const newUser = await prisma.user.create({ data: safeData, include: { department: true } });
    return mapUser(newUser);
  },

  updateUser: async (id: string, data: Partial<User>) => {
    const { permissions, department, ...rest } = data; // 剔除 department (string)
    const updateData: any = { ...rest };
    if (permissions) updateData.permissions = JSON.stringify(permissions);

    try {
      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
        include: { department: true }
      });
      return mapUser(updated);
    } catch (e) {
      console.error("updateUser error", e);
      return null;
    }
  },

  getUserById: async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id }, include: { department: true } });
    return user ? mapUser(user) : undefined;
  },

  deleteUser: async (id: string) => {
    try {
      await prisma.user.delete({ where: { id } });
      return true;
    } catch (e) {
      return false;
    }
  },

  // === 组织架构 ===
  getDepartments: async () => {
    const depts = await prisma.department.findMany();
    return depts.map(mapDept);
  },

  getOrgTree: async () => {
    const list = await prisma.department.findMany();
    const map: Record<string, DepartmentNode> = {};
    const tree: DepartmentNode[] = [];
    
    const nodes = list.map(mapDept);

    nodes.forEach((node) => { map[node.id] = { ...node, children: [] }; });
    nodes.forEach((node) => {
      if (node.parentId && map[node.parentId]) {
        map[node.parentId].children?.push(map[node.id]);
      } else {
        tree.push(map[node.id]);
      }
    });
    return tree;
  },

  createDepartment: async (data: { name: string, parentId: string | null, managerId?: string, level: number }) => {
    const newDept = await prisma.department.create({
      data: {
        name: data.name,
        parentId: data.parentId,
        managerId: data.managerId,
        level: data.level
      }
    });
    return mapDept(newDept);
  },

  updateDepartment: async (id: string, data: Partial<DepartmentNode>) => {
    const { children, ...rest } = data; // 剔除 children
    try {
      const updated = await prisma.department.update({
        where: { id },
        data: rest
      });
      return mapDept(updated);
    } catch (e) {
      return null;
    }
  },

  deleteDepartment: async (id: string) => {
    try {
      await prisma.department.delete({ where: { id } });
      return true;
    } catch (e) {
      return false;
    }
  },

  // === 隐患 ===
  getHazards: async () => {
    const hazards = await prisma.hazardRecord.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return hazards.map(mapHazard);
  },

  createHazard: async (data: any) => {
      // 1. 生成 code (YYYYMMDDNNN)
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await prisma.hazardRecord.count({
        where: { code: { startsWith: todayStr } }
      });
      const code = `${todayStr}${(count + 1).toString().padStart(3, '0')}`;

      const {
        id, photos, logs, ccDepts, ccUsers, old_personal_ID,
        riskLevel, status, type, location, desc, reporterId, reporterName,
        responsibleId, responsibleName, responsibleDept, deadline
      } = data;

      const newHazard = await prisma.hazardRecord.create({
        data: {
          code,
          riskLevel: riskLevel || 'low',
          status: status || 'reported',
          type,
          location,
          desc,
          reporterId,
          reporterName,
          responsibleId,
          responsibleName,
          responsibleDept,
          deadline: deadline ? new Date(deadline) : null,
          photos: JSON.stringify(photos || []),
          logs: JSON.stringify(logs || []),
          ccDepts: JSON.stringify(ccDepts || []),
          ccUsers: JSON.stringify(ccUsers || []),
          old_personal_ID: JSON.stringify(old_personal_ID || [])
        }
      });
      return mapHazard(newHazard);
  },

  updateHazard: async (id: string, data: Partial<HazardRecord>) => {
    const {
      photos, rectifyPhotos, logs, ccDepts, ccUsers, old_personal_ID,
      reportTime, rectifyTime, verifyTime, deadline, emergencyPlanDeadline, emergencyPlanSubmitTime,
      createdAt, updatedAt,
      ...rest
    } = data;

    const updateData: any = { ...rest };

    if (photos) updateData.photos = JSON.stringify(photos);
    if (rectifyPhotos) updateData.rectifyPhotos = JSON.stringify(rectifyPhotos);
    if (logs) updateData.logs = JSON.stringify(logs);
    if (ccDepts) updateData.ccDepts = JSON.stringify(ccDepts);
    if (ccUsers) updateData.ccUsers = JSON.stringify(ccUsers);
    if (old_personal_ID) updateData.old_personal_ID = JSON.stringify(old_personal_ID);

    if (deadline) updateData.deadline = new Date(deadline);
    if (rectifyTime) updateData.rectifyTime = new Date(rectifyTime);
    if (verifyTime) updateData.verifyTime = new Date(verifyTime);

    try {
      const updated = await prisma.hazardRecord.update({
        where: { id },
        data: updateData
      });
      return mapHazard(updated);
    } catch (e) {
      return null;
    }
  },

  deleteHazard: async (id: string) => {
    try {
      await prisma.hazardRecord.delete({ where: { id } });
      return true;
    } catch (e) {
      return false;
    }
  },

  getHazardConfig: async () => {
    const types = await prisma.hazardConfig.findUnique({ where: { key: 'hazard_types' } });
    const areas = await prisma.hazardConfig.findUnique({ where: { key: 'hazard_areas' } });
    return {
      types: types ? JSON.parse(types.value) : ['用电安全'],
      areas: areas ? JSON.parse(areas.value) : ['一号车间']
    };
  },

  updateHazardConfig: async (data: Partial<HazardConfig>) => {
     if (data.types) {
       await prisma.hazardConfig.upsert({
         where: { key: 'hazard_types' },
         update: { value: JSON.stringify(data.types) },
         create: { key: 'hazard_types', value: JSON.stringify(data.types) }
       });
     }
     if (data.areas) {
       await prisma.hazardConfig.upsert({
         where: { key: 'hazard_areas' },
         update: { value: JSON.stringify(data.areas) },
         create: { key: 'hazard_areas', value: JSON.stringify(data.areas) }
       });
     }
     return data; // Return what was passed as a confirmation
  }
};
