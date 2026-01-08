// src/lib/workflowUtils.ts
import { User } from '@prisma/client';
import { WorkflowStep, ParsedField } from '@/types/work-permit';
import { PeopleFinder } from './peopleFinder';
import { prisma } from '@/lib/prisma';

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
    // Use PeopleFinder to fetch users efficiently
    const users = await Promise.all(userIds.map((id: string) => PeopleFinder.findUserById(id)));
    return users.filter(Boolean) as User[];
  }

  // 2. 当前部门负责人
  if (approverStrategy === 'current_dept_manager') {
    // Attempt to resolve applicantDept (could be ID or Name)
    
    // Check if it looks like a CUID or if we need to lookup by name
    const dept = await prisma.department.findFirst({
       where: {
           OR: [
               { id: applicantDept },
               { name: applicantDept }
           ]
       }
    });

    if (dept) {
         const manager = await PeopleFinder.findDeptManager(dept.id);
         return manager ? [manager] : [];
    }
    
    return [];
  }

  // 3. 指定部门的负责人
  if (approverStrategy === 'specific_dept_manager' && strategyConfig?.targetDeptId) {
    const deptId = strategyConfig.targetDeptId;
    const manager = await PeopleFinder.findDeptManager(deptId);
    return manager ? [manager] : [];
  }

  // 4. 指定角色 (如EHS经理)
  if (approverStrategy === 'role' && strategyConfig?.roleName) {
    // Assuming roleName corresponds to jobTitle for now, or 'role' column
    // The previous implementation used u.role === strategyConfig.roleName
    const users = await prisma.user.findMany({
        where: { role: strategyConfig.roleName }
    });
    return users;
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

    if (candidate && candidate.cellKey) {
      // 🟢 修复：同时尝试 cellKey 格式和 "r-c" 格式
      const m = candidate.cellKey.match(/^R(\d+)C(\d+)$/);
      if (m) {
        const r0 = Number(m[1]) - 1;
        const c0 = Number(m[2]) - 1;
        const keyRC = `${r0}-${c0}`;
        
        // 尝试两种键格式
        const deptName = String(
          formData[candidate.cellKey] ||  // 优先使用 cellKey 格式 (R7C3)
          formData[keyRC] ||              // 备用：r-c 格式 (6-2)
          ''
        ).trim();
        
        console.log('🔍 [字段匹配] 查找部门:', {
          fieldName: targetFieldName,
          cellKey: candidate.cellKey,
          keyRC,
          deptName,
          formDataKeys: Object.keys(formData).slice(0, 10)
        });
        
        if (deptName) {
          const managerList = await PeopleFinder.findDeptManagerByName(deptName);
          console.log('🔍 [字段匹配] 找到的负责人:', managerList.map(m => m.name));
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
        f => (f.fieldType === 'text' || f.fieldType === 'match') && (f.fieldName === match.fieldName || f.label.includes(match.fieldName))
      );

      if (field && field.cellKey) {
        const m = field.cellKey.match(/^R(\d+)C(\d+)$/);
        if (m) {
          const r0 = Number(m[1]) - 1;
          const c0 = Number(m[2]) - 1;
          const keyRC = `${r0}-${c0}`;
          
          // 🟢 修复：同时尝试 cellKey 格式和 "r-c" 格式
          const fieldValue = String(
            formData[field.cellKey] ||  // 优先使用 cellKey 格式 (R7C3)
            formData[keyRC] ||          // 备用：r-c 格式 (6-2)
            ''
          ).trim();
          
          // 🟢 支持逗号分隔多个匹配值
          const matchValues = match.containsText
            .split(',')
            .map(v => v.trim())
            .filter(v => v.length > 0);
          
          // 检查字段值是否包含任一匹配文本
          const matchesAny = matchValues.length === 0 || matchValues.some(matchText => 
            fieldValue.includes(matchText)
          );
          
          if (matchesAny) {
            const manager = await PeopleFinder.findDeptManager(match.targetDeptId);
            if (manager) {
              return [manager];
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

    const result: User[] = [];

    for (const match of optionMatches) {
      // 找到对应的选项字段
      const field = parsedFields.find(
        f => f.fieldType === 'option' && (f.fieldName === match.fieldName || f.label.includes(match.fieldName))
      );

      if (field && field.cellKey) {
        const m = field.cellKey.match(/^R(\d+)C(\d+)$/);
        if (m) {
          const r0 = Number(m[1]) - 1;
          const c0 = Number(m[2]) - 1;
          const keyRC = `${r0}-${c0}`;
          
          // 🟢 修复：同时尝试 cellKey 格式和 "r-c" 格式
          const rawCell = formData[field.cellKey] || formData[keyRC];
          const rawValue = String(rawCell || '');
          const fieldValue = rawValue.trim();
          const normalized = fieldValue.replace(/\s+/g, '');

          const hasCheckMark = /[√☑✔✅]/.test(normalized);
          
          // 🟢 支持逗号分隔多个匹配值
          const matchValues = (match.checkedValue || '')
            .split(',')
            .map(v => v.trim())
            .filter(v => v.length > 0);
          
          const valueHit = matchValues.length > 0
            ? matchValues.some(matchValue => {
                const normalizedMatch = matchValue.replace(/\s+/g, '');
                return fieldValue.includes(matchValue) || normalized.includes(normalizedMatch);
              })
            : normalized.length > 0; // 未配置值时，任意非空视为勾选
          
          const booleanHit = rawCell === true || normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === '是';
          const isChecked = hasCheckMark || valueHit || booleanHit;

          if (isChecked) {
            if (match.approverType === 'person' && match.approverUserId) {
              // 直接指定的人员
              const user = await PeopleFinder.findUserById(match.approverUserId);
              if (user) result.push(user);
            } else if (match.approverType === 'dept_manager' && match.targetDeptId) {
              // 部门负责人
              const manager = await PeopleFinder.findDeptManager(match.targetDeptId);
              if (manager) result.push(manager);
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
  return PeopleFinder.findSupervisor(userId);
}

/**
 * 按角色向上查找审批人（原逻辑保留，但 resolveApprovers 中未直接使用）
 * 可用于 future 扩展，如 approverStrategy === 'role_upward'
 */
export async function findApproverByRole(
  applicantId: string,
  targetRoleName: string
): Promise<User | null> {
  const applicant = await PeopleFinder.findUserById(applicantId);
  if (!applicant || !applicant.departmentId) return null;

  // Optimized approach: Traverse up checking departments rather than fetching all users
  let currentDeptId: string | null = applicant.departmentId;

  while (currentDeptId) {
    const dept: any = await prisma.department.findUnique({ where: { id: currentDeptId } });
    if (!dept) break;

    // Check users in this department with the role
    const approvers = await PeopleFinder.findByJobTitle(currentDeptId, targetRoleName);
    const validApprover = approvers.find(u => u.id !== applicantId);

    if (validApprover) return validApprover;

    currentDeptId = dept.parentId;
  }

  return null;
}

// Helper functions (unused exports removed)
