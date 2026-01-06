// src/app/hidden-danger/_utils/cc-matcher.ts
/**
 * 抄送人匹配引擎
 * 根据配置的抄送规则和隐患信息，智能匹配抄送人
 */

import { 
  HazardCCRule, 
  HazardRecord, 
  SimpleUser,
  CCRuleType 
} from '@/types/hidden-danger';

import { getUserSupervisor, type Department } from '@/utils/departmentUtils';

interface CCMatchResult {
  success: boolean;
  userIds: string[];
  userNames: string[];
  error?: string;
  matchedBy?: string;
}

interface CCMatchContext {
  hazard: HazardRecord;
  ccRule: HazardCCRule;
  allUsers: SimpleUser[];
  departments: any[];
  reporter?: SimpleUser;
  handler?: SimpleUser;  // 当前处理人
}

/**
 * 主匹配函数 - 匹配单条抄送规则
 */
export async function matchCCUsers(context: CCMatchContext): Promise<CCMatchResult> {
  const { ccRule } = context;

  switch (ccRule.type) {
    case 'fixed_users':
      return matchFixedUsers(context);
    
    case 'reporter_manager':
      return matchReporterManager(context);
    
    case 'responsible_manager':
      return matchResponsibleManager(context);
    
    case 'handler_manager':
      return matchHandlerManager(context);
    
    case 'dept_by_location':
      return matchDeptByLocation(context);
    
    case 'dept_by_type':
      return matchDeptByType(context);
    
    case 'role_match':
      return matchByRole(context);
    
    case 'responsible':
      return matchResponsible(context);
    
    case 'reporter':
      return matchReporter(context);
    
    default:
      return {
        success: false,
        userIds: [],
        userNames: [],
        error: `未知的抄送规则类型: ${ccRule.type}`,
      };
  }
}

/**
 * 批量匹配多条抄送规则
 */
export async function matchAllCCRules(
  hazard: HazardRecord,
  ccRules: HazardCCRule[],
  allUsers: SimpleUser[],
  departments: any[],
  reporter?: SimpleUser,
  handler?: SimpleUser
): Promise<{ userIds: string[]; userNames: string[]; details: any[] }> {
  const allUserIds = new Set<string>();
  const allUserNames = new Set<string>();
  const details: any[] = [];

  for (const ccRule of ccRules) {
    const context: CCMatchContext = {
      hazard,
      ccRule,
      allUsers,
      departments,
      reporter,
      handler,
    };

    const result = await matchCCUsers(context);
    
    if (result.success && result.userIds.length > 0) {
      result.userIds.forEach(id => allUserIds.add(id));
      result.userNames.forEach(name => allUserNames.add(name));
      
      details.push({
        ruleId: ccRule.id,
        ruleDescription: ccRule.description,
        matchedBy: result.matchedBy,
        users: result.userNames,
      });
    }
  }

  return {
    userIds: Array.from(allUserIds),
    userNames: Array.from(allUserNames),
    details,
  };
}

/**
 * 类型1: 固定人员
 */
function matchFixedUsers(context: CCMatchContext): CCMatchResult {
  const { ccRule, allUsers } = context;
  const configUserIds = ccRule.config?.userIds || [];
  const configUserNames = ccRule.config?.userNames || [];

  if (configUserIds.length === 0) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '未配置固定抄送人员',
    };
  }

  // 如果配置中有 userNames，直接使用
  if (configUserNames.length > 0 && configUserNames.length === configUserIds.length) {
    return {
      success: true,
      userIds: configUserIds,
      userNames: configUserNames,
      matchedBy: '固定人员配置',
    };
  }

  // 如果配置中没有 userNames，从 allUsers 中查找
  const matchedUsers: { id: string; name: string }[] = [];
  
  for (const userId of configUserIds) {
    const user = allUsers.find(u => u.id === userId || u.id === String(userId));
    if (user) {
      matchedUsers.push({ id: user.id, name: user.name });
    }
  }

  if (matchedUsers.length === 0) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: `未找到配置的用户 (ID: ${configUserIds.join(', ')})`,
    };
  }

  return {
    success: true,
    userIds: matchedUsers.map(u => u.id),
    userNames: matchedUsers.map(u => u.name),
    matchedBy: '固定人员配置',
  };
}

/**
 * 类型2: 上报人主管
 */
function matchReporterManager(context: CCMatchContext): CCMatchResult {
  const { hazard, allUsers, departments } = context;
  
  console.log('🔍 [matchReporterManager] 开始匹配上报人主管:', {
    reporterId: hazard.reporterId,
    reporterName: hazard.reporterName,
    allUsersCount: allUsers.length,
  });
  
  if (!hazard.reporterId) {
    console.warn('⚠️ [matchReporterManager] 无法获取上报人ID');
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '无法获取上报人信息',
    };
  }

  // 使用 getUserSupervisor 统一处理主管查找逻辑
  const supervisor = getUserSupervisor(
    hazard.reporterId,
    departments as Department[],
    allUsers
  );

  if (!supervisor) {
    console.warn('⚠️ [matchReporterManager] 未找到上报人主管');
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '未找到上报人主管',
    };
  }

  console.log('✅ [matchReporterManager] 找到上报人主管:', {
    id: supervisor.id,
    name: supervisor.name,
    role: supervisor.role,
  });

  return {
    success: true,
    userIds: [supervisor.id],
    userNames: [supervisor.name],
    matchedBy: `上报人主管`,
  };
}

/**
 * 类型3: 责任人主管
 */
function matchResponsibleManager(context: CCMatchContext): CCMatchResult {
  const { hazard, allUsers, departments } = context;
  
  console.log('🔍 [matchResponsibleManager] 开始匹配责任人主管:', {
    responsibleId: hazard.responsibleId,
    responsibleName: hazard.responsibleName,
    allUsersCount: allUsers.length,
  });
  
  if (!hazard.responsibleId || !hazard.responsibleName) {
    console.warn('⚠️ [matchResponsibleManager] 隐患未指定责任人');
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '隐患未指定责任人',
    };
  }

  // 使用 getUserSupervisor 统一处理主管查找逻辑
  const supervisor = getUserSupervisor(
    hazard.responsibleId,
    departments as Department[],
    allUsers
  );

  if (!supervisor) {
    console.warn('⚠️ [matchResponsibleManager] 未找到责任人主管');
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '未找到责任人主管',
    };
  }

  console.log('✅ [matchResponsibleManager] 找到责任人主管:', {
    id: supervisor.id,
    name: supervisor.name,
    role: supervisor.role,
  });

  return {
    success: true,
    userIds: [supervisor.id],
    userNames: [supervisor.name],
    matchedBy: `责任人主管`,
  };
}

/**
 * 类型4: 处理人主管
 */
function matchHandlerManager(context: CCMatchContext): CCMatchResult {
  const { handler, allUsers, departments } = context;
  
  if (!handler) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '无法获取处理人信息',
    };
  }

  // 使用 getUserSupervisor 统一处理主管查找逻辑
  const supervisor = getUserSupervisor(
    handler.id,
    departments as Department[],
    allUsers
  );

  if (!supervisor) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '未找到处理人主管',
    };
  }

  return {
    success: true,
    userIds: [supervisor.id],
    userNames: [supervisor.name],
    matchedBy: `处理人主管`,
  };
}

/**
 * 类型5: 按区域匹配部门
 */
function matchDeptByLocation(context: CCMatchContext): CCMatchResult {
  const { hazard, ccRule, allUsers } = context;
  const locationMatch = ccRule.config?.locationMatch;
  const deptId = ccRule.config?.deptId;
  const deptName = ccRule.config?.deptName;

  if (!locationMatch || !deptId) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '未配置区域匹配规则',
    };
  }

  // 检查隐患区域是否匹配
  if (!hazard.location.includes(locationMatch)) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: `隐患区域 "${hazard.location}" 不匹配 "${locationMatch}"`,
    };
  }

  // 获取该部门的所有人员
  const deptUsers = allUsers.filter(u => 
    u.department === deptId || u.department === deptName
  );

  if (deptUsers.length === 0) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: `${deptName || deptId} 没有人员`,
    };
  }

  return {
    success: true,
    userIds: deptUsers.map(u => u.id),
    userNames: deptUsers.map(u => u.name),
    matchedBy: `区域匹配部门 (${locationMatch} → ${deptName})`,
  };
}

/**
 * 类型6: 按类型匹配部门
 */
function matchDeptByType(context: CCMatchContext): CCMatchResult {
  const { hazard, ccRule, allUsers } = context;
  const typeMatch = ccRule.config?.typeMatch;
  const deptId = ccRule.config?.deptId;
  const deptName = ccRule.config?.deptName;

  if (!typeMatch || !deptId) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '未配置类型匹配规则',
    };
  }

  // 检查隐患类型是否匹配
  if (hazard.type !== typeMatch) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: `隐患类型 "${hazard.type}" 不匹配 "${typeMatch}"`,
    };
  }

  // 获取该部门的所有人员
  const deptUsers = allUsers.filter(u => 
    u.department === deptId || u.department === deptName
  );

  if (deptUsers.length === 0) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: `${deptName || deptId} 没有人员`,
    };
  }

  return {
    success: true,
    userIds: deptUsers.map(u => u.id),
    userNames: deptUsers.map(u => u.name),
    matchedBy: `类型匹配部门 (${typeMatch} → ${deptName})`,
  };
}

/**
 * 类型7: 角色匹配
 */
function matchByRole(context: CCMatchContext): CCMatchResult {
  const { ccRule, allUsers } = context;
  const deptId = ccRule.config?.deptId;
  const deptName = ccRule.config?.deptName;
  const roleName = ccRule.config?.roleName;

  if (!deptId || !roleName) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '未配置部门或职位',
    };
  }

  // 在指定部门中查找包含特定职位的人员
  const matchedUsers = allUsers.filter(user => {
    const deptMatch = user.department === deptName || user.department === deptId;
    const roleMatch = user.role && user.role.includes(roleName);
    return deptMatch && roleMatch;
  });

  if (matchedUsers.length === 0) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: `未找到 ${deptName || deptId} 中职位包含 "${roleName}" 的人员`,
    };
  }

  return {
    success: true,
    userIds: matchedUsers.map(u => u.id),
    userNames: matchedUsers.map(u => u.name),
    matchedBy: `角色匹配 (${deptName}/${roleName})`,
  };
}

/**
 * 类型8: 责任人
 */
function matchResponsible(context: CCMatchContext): CCMatchResult {
  const { hazard, allUsers } = context;

  if (!hazard.responsibleId || !hazard.responsibleName) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '隐患未指定责任人',
    };
  }

  // 验证责任人是否存在
  const responsible = allUsers.find(u => u.id === hazard.responsibleId);
  if (!responsible) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: `未找到责任人 (${hazard.responsibleName})`,
    };
  }

  return {
    success: true,
    userIds: [hazard.responsibleId],
    userNames: [hazard.responsibleName],
    matchedBy: '隐患责任人',
  };
}

/**
 * 类型9: 上报人
 */
function matchReporter(context: CCMatchContext): CCMatchResult {
  const { hazard, allUsers } = context;

  if (!hazard.reporterId || !hazard.reporterName) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '隐患未指定上报人',
    };
  }

  // 验证上报人是否存在
  const reporter = allUsers.find(u => u.id === hazard.reporterId);
  if (!reporter) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: `未找到上报人 (${hazard.reporterName})`,
    };
  }

  return {
    success: true,
    userIds: [hazard.reporterId],
    userNames: [hazard.reporterName],
    matchedBy: '隐患上报人',
  };
}

/**
 * 辅助函数：查找部门负责人
 * 优先从 org.json 中的 managerId 字段获取部门负责人
 */
function findDepartmentManager(
  deptIdOrName: string, 
  allUsers: SimpleUser[], 
  departments: any[]
): SimpleUser | null {
  console.log('🔍 [findDepartmentManager] 查找部门负责人:', {
    deptIdOrName,
    deptIdOrNameType: typeof deptIdOrName,
    departmentsCount: departments.length,
    allUsersCount: allUsers.length,
  });
  
  // 调试：打印前5个部门的详细信息
  console.log('📂 [findDepartmentManager] departments 数组样本 (前5个):', 
    departments.slice(0, 5).map(d => ({
      id: d.id,
      idType: typeof d.id,
      name: d.name,
      managerId: d.managerId,
      managerIdType: typeof d.managerId
    }))
  );
  
  // 策略1: 优先从 org.json 中通过 managerId 查找
  // 调试：尝试不同的匹配方式
  let dept = departments.find(d => d.id === deptIdOrName);
  console.log('  尝试通过 ID 严格匹配 (===):', dept ? '找到' : '未找到');
  
  if (!dept) {
    dept = departments.find(d => d.id == deptIdOrName); // 使用宽松比较
    console.log('  尝试通过 ID 宽松匹配 (==):', dept ? '找到' : '未找到');
  }
  
  if (!dept) {
    dept = departments.find(d => d.name === deptIdOrName);
    console.log('  尝试通过 name 匹配:', dept ? '找到' : '未找到');
  }
  
  if (!dept) {
    dept = departments.find(d => String(d.id) === String(deptIdOrName));
    console.log('  尝试通过 String(id) 匹配:', dept ? '找到' : '未找到');
  }

  if (dept && dept.managerId) {
    console.log('  📂 找到部门配置:', {
      id: dept.id,
      name: dept.name,
      managerId: dept.managerId,
    });

    // 通过 managerId 查找用户
    const manager = allUsers.find(u => 
      u.id === dept.managerId || u.id === String(dept.managerId)
    );

    if (manager) {
      console.log('✅ [findDepartmentManager] 通过 org.json 的 managerId 找到负责人:', {
        id: manager.id,
        name: manager.name,
        department: manager.department,
      });
      return manager;
    } else {
      console.warn('⚠️ [findDepartmentManager] org.json 中配置的负责人不在用户列表中:', {
        managerId: dept.managerId,
      });
    }
  } else {
    console.warn('⚠️ [findDepartmentManager] 部门未配置 managerId:', {
      deptIdOrName,
      foundDept: dept ? { id: dept.id, name: dept.name } : null,
    });
  }

  // 策略2: 备选方案 - 通过 role/jobTitle 关键词匹配（保留原有逻辑作为后备）
  const keywords = ['负责人', '经理', '主管', 'manager', 'director', '部长', '科长'];
  
  const deptUsers = allUsers.filter(user => {
    return user.department === deptIdOrName || (user as any).departmentId === deptIdOrName;
  });

  console.log(`  📊 部门用户数量: ${deptUsers.length}，尝试关键词匹配...`);
  
  // 先尝试 role 字段
  let manager = deptUsers.find(user => {
    return user.role && keywords.some(kw => 
      user.role!.toLowerCase().includes(kw.toLowerCase())
    );
  });

  if (manager) {
    console.log('✅ [findDepartmentManager] 通过 role 关键词找到负责人:', {
      id: manager.id,
      name: manager.name,
      role: manager.role,
    });
    return manager;
  }

  // 再尝试 jobTitle 字段
  manager = deptUsers.find(user => {
    const jobTitle = (user as any).jobTitle;
    return jobTitle && keywords.some(kw => 
      jobTitle.toLowerCase().includes(kw.toLowerCase())
    );
  });

  if (manager) {
    console.log('✅ [findDepartmentManager] 通过 jobTitle 关键词找到负责人:', {
      id: manager.id,
      name: manager.name,
      jobTitle: (manager as any).jobTitle,
    });
    return manager;
  }

  console.warn('⚠️ [findDepartmentManager] 所有策略均未找到负责人');
  return null;
}

/**
 * 导出用于测试的辅助函数
 */
export const testHelpers = {
  findDepartmentManager,
};
