// src/lib/db.ts
import { prisma } from '@/lib/prisma';
import { User, DepartmentNode, HazardRecord, HazardConfig } from '@/types/database';
import { todayString, parseDateForDB } from '@/utils/dateUtils';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

// Prisma 类型定义
type PrismaUserWithDepartment = Prisma.UserGetPayload<{ include: { department: true } }>;
type PrismaDepartment = Prisma.DepartmentGetPayload<{}>;
type PrismaHazardRecord = Prisma.HazardRecordGetPayload<{}>;

// 转换 Prisma User 到前端 User 类型
function mapUser(pUser: PrismaUserWithDepartment): User {
  return {
    id: pUser.id,
    username: pUser.username,
    name: pUser.name,
    password: pUser.password,
    avatar: pUser.avatar,
    role: pUser.role as User['role'], // 显式转换为 UserRole 类型
    department: pUser.department?.name || '',
    departmentId: pUser.departmentId ?? undefined,
    jobTitle: pUser.jobTitle ?? undefined,
    directManagerId: pUser.directManagerId ?? undefined,
    permissions: pUser.permissions ? JSON.parse(pUser.permissions) : {},
    isActive: pUser.isActive ?? true, // 默认在职
  };
}

// 转换 Prisma Department 到前端 DepartmentNode 类型
function mapDept(pDept: PrismaDepartment): DepartmentNode {
  return {
    ...pDept,
    children: [] // 树状结构需要在 getOrgTree 中处理
  };
}

// 转换 Prisma HazardRecord 到前端 HazardRecord 类型
function mapHazard(pHazard: PrismaHazardRecord): HazardRecord {
  return {
    ...pHazard,
    photos: pHazard.photos ? JSON.parse(pHazard.photos) : [],
    rectifyPhotos: pHazard.rectifyPhotos ? JSON.parse(pHazard.rectifyPhotos) : [],
    logs: pHazard.logs ? JSON.parse(pHazard.logs) : [],
    ccDepts: pHazard.ccDepts ? JSON.parse(pHazard.ccDepts) : [],
    ccUsers: pHazard.ccUsers ? JSON.parse(pHazard.ccUsers) : [],
    old_personal_ID: pHazard.old_personal_ID ? JSON.parse(pHazard.old_personal_ID) : [],
    reportTime: pHazard.reportTime?.toISOString() || new Date().toISOString(),
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
    const userData: Prisma.UserCreateInput = { ...rest, permissions: JSON.stringify(permissions) } as Prisma.UserCreateInput;
    if (id && id.length > 10) (userData as Prisma.UserCreateInput & { id?: string }).id = id;

    // 对密码进行哈希加密（如果密码未加密）
    let hashedPassword = user.password;
    if (user.password && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(user.password, salt);
    }

    // 如果 rest 中还有其他不在 schema 中的字段，Prisma 会报错，所以最好是只取已知字段
    // 这里为了简洁，假设 TS 类型约束了 user 字段。如果有额外字段，Prisma client 会过滤还是报错取决于配置。
    // 安全起见，手动 pick 核心字段
    const safeData = {
      username: user.username,
      name: user.name,
      password: hashedPassword,
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
    const updateData: Prisma.UserUpdateInput = { ...rest };
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

  deleteUser: async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 使用事务处理所有相关数据的清理和用户删除
      await prisma.$transaction(async (tx) => {
        // 1. 清除该用户上报的隐患记录中的关联（设置为null而非删除记录）
        await tx.hazardRecord.updateMany({
          where: { reporterId: id },
          data: { reporterId: 'DELETED_USER' } // 保留记录但标记用户已删除
        });

        // 2. 清除该用户作为整改责任人的隐患记录
        await tx.hazardRecord.updateMany({
          where: { responsibleId: id },
          data: { responsibleId: null, responsibleName: null }
        });

        // 3. 删除培训分配记录
        await tx.trainingAssignment.deleteMany({
          where: { userId: id }
        });

        // 4. 删除学习记录
        await tx.materialLearnedRecord.deleteMany({
          where: { userId: id }
        });

        // 5. 清除上传的培训资料关联
        await tx.trainingMaterial.updateMany({
          where: { uploaderId: id },
          data: { uploaderId: 'DELETED_USER' }
        });

        // 6. 清除发布的培训任务关联
        await tx.trainingTask.updateMany({
          where: { publisherId: id },
          data: { publisherId: 'DELETED_USER' }
        });

        // 7. 清除文件上传者关联
        await tx.fileMetadata.updateMany({
          where: { uploaderId: id },
          data: { uploaderId: null }
        });

        // 8. 最后删除用户
        await tx.user.delete({ where: { id } });
      });

      return { success: true };
    } catch (e: any) {
      console.error('deleteUser error:', e);
      return {
        success: false,
        error: e?.message || '删除用户时发生未知错误'
      };
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

  createHazard: async (data: Partial<HazardRecord> & { type: string; location: string; desc: string; reporterId: string; reporterName: string }) => {
    // 🔒 生成隐患编号（与API路由保持一致）
    // 格式：Hazard + YYYYMMDD + 序号（3位）
    let code = data.code;
    if (!code || code.trim() === '') {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const prefix = `Hazard${dateStr}`;

      // 查询当天已存在的最大编号
      const todayStart = new Date(year, now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const existingRecords = await prisma.hazardRecord.findMany({
        where: {
          code: { startsWith: prefix },
          createdAt: { gte: todayStart, lt: todayEnd }
        },
        select: { code: true },
        orderBy: { code: 'desc' }
      });

      let maxSeq = 0;
      for (const record of existingRecords) {
        if (record.code) {
          const seqStr = record.code.slice(-3);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }

      const newSeq = String(maxSeq + 1).padStart(3, '0');
      code = `${prefix}${newSeq}`;

      // 双重检查：确保编号唯一
      const existing = await prisma.hazardRecord.findUnique({
        where: { code }
      });

      if (existing) {
        // 如果编号已存在，继续递增查找可用编号
        let seq = maxSeq + 1;
        while (seq < 999) {
          seq++;
          const testCode = `${prefix}${String(seq).padStart(3, '0')}`;
          const testExisting = await prisma.hazardRecord.findUnique({
            where: { code: testCode }
          });
          if (!testExisting) {
            code = testCode;
            break;
          }
        }
      }
    }

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
        deadline: deadline ? parseDateForDB(deadline, true) : null,
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

    const updateData: Prisma.HazardRecordUpdateInput = { ...rest };

    if (photos) updateData.photos = JSON.stringify(photos);
    if (rectifyPhotos) updateData.rectifyPhotos = JSON.stringify(rectifyPhotos);
    if (logs) updateData.logs = JSON.stringify(logs);
    if (ccDepts) updateData.ccDepts = JSON.stringify(ccDepts);
    if (ccUsers) updateData.ccUsers = JSON.stringify(ccUsers);
    if (old_personal_ID) updateData.old_personal_ID = JSON.stringify(old_personal_ID);

    if (deadline) updateData.deadline = parseDateForDB(deadline, true);
    if (rectifyTime) updateData.rectifyTime = parseDateForDB(rectifyTime);
    if (verifyTime) updateData.verifyTime = parseDateForDB(verifyTime);

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
