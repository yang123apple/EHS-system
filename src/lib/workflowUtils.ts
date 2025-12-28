// src/lib/workflowUtils.ts
import { db, User, DepartmentNode } from './mockDb';
import { WorkflowStep, ParsedField } from '@/types/work-permit';

/**
 * 核心：审批人解析器 (Resolver)
 * 🟢 支持新配置格式：
 * - approverStrategy: 'fixed' | 'current_dept_manager' | 'specific_dept_manager' | 'role' | 'direct_manager'
 * - strategyConfig: { targetDeptId?: string; roleName?: string }
 * - approvers: { userId: string }[]
 */
export async function resolveApprovers(
  applicantDept: string,
  config: WorkflowStep | any,
  formData: Record<string, any> = {},
  parsedFields: ParsedField[] = []
): Promise<User[]> {
  const { approverStrategy, strategyConfig, approvers } = config;

  // 1. 指定固定人员
  if (approverStrategy === 'fixed' && approvers?.length) {
    const userIds = approvers.map((a: any) => a.userId).filter(Boolean);
    const users = await db.getUsers();
    return users.filter(u => userIds.includes(u.id));
  }

  // 2. 当前部门负责人
  if (approverStrategy === 'current_dept_manager') {
    console.log('🔍 [resolveApprovers] 策略: current_dept_manager');
    console.log('🔍 [resolveApprovers] applicantDept:', applicantDept);
    
    // 🟢 直接从组织架构数据中查找该部门的 managerId
    const departments = await db.getDepartments();
    console.log('🔍 [resolveApprovers] 部门总数:', departments.length);
    
    const targetDept = departments.find(d => d.id === applicantDept || d.name === applicantDept);
    console.log('🔍 [resolveApprovers] 找到的部门:', targetDept ? `${targetDept.name} (${targetDept.id})` : '未找到');
    
    if (targetDept?.managerId) {
      console.log('🔍 [resolveApprovers] 部门经理ID:', targetDept.managerId);
      const manager = await db.getUserById(targetDept.managerId);
      console.log('🔍 [resolveApprovers] 查找到的部门经理:', manager ? `${manager.name} (${manager.id})` : '未找到');
      return manager ? [manager] : [];
    }
    
    console.log('⚠️ [resolveApprovers] 未找到部门或部门没有设置经理');
    return [];
  }

  // 3. 指定部门的负责人
  if (approverStrategy === 'specific_dept_manager' && strategyConfig?.targetDeptId) {
    const deptId = strategyConfig.targetDeptId;
    // 🟢 直接从组织架构数据中查找该部门的 managerId
    const managers = await findDeptManager(deptId);
    return managers;
  }

  // 4. 指定角色 (如EHS经理)
  if (approverStrategy === 'role' && strategyConfig?.roleName) {
    const users = await db.getUsers();
    return users.filter(u => u.role === strategyConfig.roleName);
  }

  // 5. 从模板内容匹配：按解析字段找到部门名 -> 部门负责人
  if (approverStrategy === 'template_field_manager' && parsedFields?.length) {
    const targetFieldName: string | undefined = strategyConfig?.fieldName;
    const expectedType: string | undefined = strategyConfig?.expectedType || 'department';

    // 选择目标解析字段（优先按 fieldName，其次按 label 包含）
    const candidate = parsedFields.find((f) => {
      const typeOk = expectedType ? f.fieldType === expectedType : true;
      const nameOk = targetFieldName
        ? (f.fieldName === targetFieldName || f.label.includes(targetFieldName))
        : false;
      return typeOk && nameOk;
    });

    if (candidate) {
      // 将 cellKey "R7C3" 映射到 formData 的键 "6-2" (0-based)
      const m = candidate.cellKey.match(/^R(\d+)C(\d+)$/);
      if (m) {
        const r0 = Number(m[1]) - 1;
        const c0 = Number(m[2]) - 1;
        const key = `${r0}-${c0}`;
        const deptName = String(formData[key] || '').trim();
        if (deptName) {
          const managerList = await findDeptManagerByName(deptName);
          if (managerList.length) return managerList;
        }
      }
    }

    return [];
  }

  // 🟢 6. 从模板内容匹配（文本匹配）：根据指定文本字段的内容，路由到对应部门负责人
  if (approverStrategy === 'template_text_match' && parsedFields?.length && strategyConfig?.textMatches?.length) {
    const textMatches = strategyConfig.textMatches as Array<{
      fieldName: string;
      containsText: string;
      targetDeptId: string;
      targetDeptName: string;
    }>;

    for (const match of textMatches) {
      // 找到对应的文本字段
      const field = parsedFields.find(
        f => f.fieldType === 'text' && (f.fieldName === match.fieldName || f.label.includes(match.fieldName))
      );

      if (field) {
        const m = field.cellKey.match(/^R(\d+)C(\d+)$/);
        if (m) {
          const r0 = Number(m[1]) - 1;
          const c0 = Number(m[2]) - 1;
          const key = `${r0}-${c0}`;
          const fieldValue = String(formData[key] || '').trim();
          
          // 如果字段值包含指定的文本，则返回对应部门的负责人
          if (fieldValue.includes(match.containsText)) {
            const managers = await findDeptManager(match.targetDeptId);
            if (managers.length > 0) {
              return managers;
            }
          }
        }
      }
    }

    return [];
  }

  // 🟢 7. 从模板内容匹配（选项匹配）：根据选项字段的勾选状态，分别对应具体人员或部门负责人
  if (approverStrategy === 'template_option_match' && parsedFields?.length && strategyConfig?.optionMatches?.length) {
    const optionMatches = strategyConfig.optionMatches as Array<{
      fieldName: string;
      checkedValue: string;
      approverType: 'person' | 'dept_manager';
      approverUserId?: string;
      approverUserName?: string;
      targetDeptId?: string;
      targetDeptName?: string;
    }>;

    const allUsers = await db.getUsers();
    const result: User[] = [];

    for (const match of optionMatches) {
      // 找到对应的选项字段
      const field = parsedFields.find(
        f => f.fieldType === 'option' && (f.fieldName === match.fieldName || f.label.includes(match.fieldName))
      );

      if (field) {
        const m = field.cellKey.match(/^R(\d+)C(\d+)$/);
        if (m) {
          const r0 = Number(m[1]) - 1;
          const c0 = Number(m[2]) - 1;
          const key = `${r0}-${c0}`;
          const rawCell = formData[key];
          const rawValue = String(rawCell || '');
          const fieldValue = rawValue.trim();
          const normalized = fieldValue.replace(/\s+/g, '');

          const hasCheckMark = /[√☑✔✅]/.test(normalized);
          const matchValue = (match.checkedValue || '').trim();
          const valueHit = matchValue
            ? fieldValue.includes(matchValue) || normalized.includes(matchValue.replace(/\s+/g, ''))
            : normalized.length > 0; // 未配置值时，任意非空视为勾选
          const booleanHit = rawCell === true || normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === '是';
          const isChecked = hasCheckMark || valueHit || booleanHit;

          if (isChecked) {
            if (match.approverType === 'person' && match.approverUserId) {
              // 直接指定的人员
              const user = allUsers.find(u => u.id === match.approverUserId);
              if (user) result.push(user);
            } else if (match.approverType === 'dept_manager' && match.targetDeptId) {
              // 部门负责人
              const managers = await findDeptManager(match.targetDeptId);
              result.push(...managers);
            }
          }
        }
      }
    }

    // 去重并返回
    const uniqueUsers = Array.from(new Map(result.map(u => [u.id, u])).values());
    return uniqueUsers.length > 0 ? uniqueUsers : [];
  }

  // 默认返回空
  return [];
}

// --- 以下为复用的原核心逻辑函数 ---

/**
 * 查找直属上级（Point-to-Point + 部门树兜底）
 */
export async function findSupervisor(userId: string): Promise<User | null> {
  const user = await db.getUserById(userId);
  if (!user) return null;

  // 1. 直属上级优先
  if (user.directManagerId) {
    const directManager = await db.getUserById(user.directManagerId);
    if (directManager) return directManager;
  }

  // 2. 部门架构兜底
  if (!user.departmentId) return null;
  const depts = await db.getDepartments();
  let currentDeptId: string | null = user.departmentId;

  while (currentDeptId) {
    const currentDept = depts.find(d => d.id === currentDeptId);
    if (!currentDept) break;

    if (currentDept.managerId && currentDept.managerId !== userId) {
      const manager = await db.getUserById(currentDept.managerId);
      if (manager) return manager;
    }

    currentDeptId = currentDept.parentId;
  }

  return null;
}

/**
 * 按角色向上查找审批人（原逻辑保留，但 resolveApprovers 中未直接使用）
 * 可用于 future 扩展，如 approverStrategy === 'role_upward'
 */
export async function findApproverByRole(
  applicantId: string,
  targetRoleName: string
): Promise<User | null> {
  const applicant = await db.getUserById(applicantId);
  if (!applicant || !applicant.departmentId) return null;

  const allUsers = await db.getUsers();
  const depts = await db.getDepartments();
  let currentDeptId: string | null = applicant.departmentId;

  while (currentDeptId) {
    const approver = allUsers.find(
      (u) =>
        u.departmentId === currentDeptId &&
        u.id !== applicantId &&
        u.jobTitle?.includes(targetRoleName)
    );

    if (approver) return approver;

    const currentDept = depts.find(d => d.id === currentDeptId);
    if (!currentDept?.parentId) break;
    currentDeptId = currentDept.parentId;
  }

  return null;
}

/**
 * 辅助函数：根据部门 ID 获取部门负责人（单人）
 */
async function findDeptManager(deptId: string): Promise<User[]> {
  const depts = await db.getDepartments();
  const dept = depts.find(d => d.id === deptId);
  if (dept?.managerId) {
    const manager = await db.getUserById(dept.managerId);
    return manager ? [manager] : [];
  }
  return [];
}

/**
 * 根据部门名称查找负责人（封装 name -> id -> manager 流程）
 */
async function findDeptManagerByName(deptName: string): Promise<User[]> {
  const depts = await db.getDepartments();
  const queue: DepartmentNode[] = [...depts];
  while (queue.length) {
    const d = queue.shift()!;
    if (d.name === deptName) {
      return findDeptManager(d.id);
    }
    if (Array.isArray(d.children)) queue.push(...d.children as DepartmentNode[]);
  }
  return [];
}
