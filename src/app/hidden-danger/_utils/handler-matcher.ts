/**
 * 处理人匹配工具
 * 根据工作流配置的策略匹配合适的处理人
 */

import { 
  getDepartmentManager, 
  getUserSupervisor,
  getDepartmentById,
  getDepartmentUsers,
  type SimpleUser,
  type Department
} from '@/utils/departmentUtils';

/**
 * 包装函数：用于工作流预览等场景
 * 接受单个参数对象并返回结构化结果
 */
export async function matchHandler(params: {
  hazard: any;
  step: any;
  allUsers: SimpleUser[];
  departments: Department[];
}): Promise<{
  success: boolean;
  userNames: string[];
  matchedBy?: string;
  error?: string;
}> {
  const { hazard, step, allUsers, departments } = params;
  
  if (!step?.handlerStrategy) {
    return {
      success: false,
      userNames: [],
      error: '步骤缺少处理人策略配置'
    };
  }

  const strategy = step.handlerStrategy.type;
  // 将整个 handlerStrategy 传递下去，包括 description、fixedUsers 等
  const config = step.handlerStrategy;

  try {
    const handlers = matchHandlerInternal(strategy, hazard, allUsers, departments, config);
    
    if (!handlers || handlers.length === 0) {
      return {
        success: false,
        userNames: [],
        error: `未找到符合策略"${strategy}"的处理人`
      };
    }

    return {
      success: true,
      userNames: handlers.map(h => h.name),
      matchedBy: strategy
    };
  } catch (error) {
    console.error('[handler-matcher] 匹配处理人失败:', error);
    return {
      success: false,
      userNames: [],
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 内部函数：根据策略匹配处理人
 */
function matchHandlerInternal(
  strategy: string,
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[],
  config?: any
): SimpleUser[] {
  console.log('[handler-matcher] 开始匹配处理人:', {
    strategy,
    hazardId: hazard.id,
    reporterDepartmentId: hazard.reporterDepartmentId,
    assignedDepartmentId: hazard.assignedDepartmentId,
    configUserId: config?.userId,
  });

  switch (strategy) {
    case 'fixed':
      return matchFixed(hazard, allUsers, departments, config);
    case 'reporter':
      return matchReporter(hazard, allUsers);
    case 'reporter_manager':
      return matchReporterManager(hazard, allUsers, departments);
    case 'department_manager':
      return matchDepartmentManager(hazard, allUsers, departments);
    case 'assigned_department_manager':
      return matchAssignedDepartmentManager(hazard, allUsers, departments);
    case 'responsible':
      return matchResponsible(hazard, allUsers);
    case 'responsible_manager':
      return matchResponsibleManager(hazard, allUsers, departments);
    case 'dept_manager':
      return matchDeptManager(hazard, allUsers, departments, config);
    case 'role':
      return matchRole(hazard, allUsers, departments, config);
    case 'location_match':
      return matchLocation(hazard, allUsers, departments, config);
    case 'type_match':
      return matchType(hazard, allUsers, departments, config);
    case 'risk_match':
      return matchRisk(hazard, allUsers, departments, config);
    default:
      console.warn(`[handler-matcher] 未知的处理人策略: ${strategy}`);
      return [];
  }
}

/**
 * 固定处理人策略
 * 支持：
 * 1. fixedUsers 数组（新版配置格式）
 * 2. userId 单个用户（向后兼容）
 * 3. 自动匹配上报人和责任人
 */
function matchFixed(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[],
  config?: any
): SimpleUser[] {
  // 1. 优先使用 fixedUsers 数组（新版配置格式）
  if (config?.fixedUsers && Array.isArray(config.fixedUsers) && config.fixedUsers.length > 0) {
    const users = config.fixedUsers
      .map((fu: any) => allUsers.find(u => u.id === fu.userId))
      .filter(Boolean) as SimpleUser[];
    
    if (users.length > 0) {
      console.log('[handler-matcher] 使用配置的固定处理人列表:', users.map(u => u.name).join('、'));
      return users;
    }
  }

  // 2. 如果配置了固定用户ID（向后兼容）
  if (config?.userId) {
    const user = allUsers.find(u => u.id === config.userId);
    if (user) {
      console.log('[handler-matcher] 使用配置的固定处理人:', user.name);
      return [user];
    }
  }

  // 3. 自动匹配：如果是"上报人"，返回上报人
  if (config?.userId === 'auto_reporter' && hazard.reporterId) {
    const reporter = allUsers.find(u => u.id === hazard.reporterId);
    if (reporter) {
      console.log('[handler-matcher] 自动匹配上报人:', reporter.name);
      return [reporter];
    }
  }

  // 4. 自动匹配：如果是"责任人"，返回责任人
  if (config?.userId === 'auto_assigned' && hazard.assignedTo) {
    const assigned = allUsers.find(u => u.id === hazard.assignedTo);
    if (assigned) {
      console.log('[handler-matcher] 自动匹配责任人:', assigned.name);
      return [assigned];
    }
  }

  // 5. 如果没有配置任何固定用户，根据步骤语义自动推断
  // 如果步骤名称包含"上报"或 id 为 "report"，自动匹配上报人
  // 如果步骤名称包含"整改"或 id 为 "rectify"，自动匹配责任人
  // 这样即使配置为空，也能在预览时正确显示
  const stepContext = (config as any)?._stepContext;
  if (stepContext) {
    if ((stepContext.id === 'report' || stepContext.name?.includes('上报')) && hazard.reporterId) {
      const reporter = allUsers.find(u => u.id === hazard.reporterId);
      if (reporter) {
        console.log('[handler-matcher] 根据步骤语义自动匹配上报人:', reporter.name);
        return [reporter];
      }
    }
    
    if ((stepContext.id === 'rectify' || stepContext.name?.includes('整改')) && hazard.responsibleId) {
      const responsible = allUsers.find(u => u.id === hazard.responsibleId);
      if (responsible) {
        console.log('[handler-matcher] 根据步骤语义自动匹配责任人:', responsible.name);
        return [responsible];
      }
    }
  }

  // 6. 【关键修复】如果配置为空且没有步骤上下文，根据步骤描述自动推断
  // 检查配置中的描述信息来判断应该匹配谁
  if (config?.description) {
    // 如果描述中提到"上报人"或"发起人"
    if ((config.description.includes('上报人') || config.description.includes('发起人')) && hazard.reporterId) {
      const reporter = allUsers.find(u => u.id === hazard.reporterId);
      if (reporter) {
        console.log('[handler-matcher] 根据描述自动匹配上报人:', reporter.name);
        return [reporter];
      }
    }
    
    // 如果描述中提到"责任人"或"整改"
    if ((config.description.includes('责任人') || config.description.includes('整改')) && hazard.responsibleId) {
      const responsible = allUsers.find(u => u.id === hazard.responsibleId);
      if (responsible) {
        console.log('[handler-matcher] 根据描述自动匹配责任人:', responsible.name);
        return [responsible];
      }
    }
  }

  console.warn('[handler-matcher] 固定策略未能匹配到处理人');
  return [];
}

/**
 * 上报人策略
 */
function matchReporter(hazard: any, allUsers: SimpleUser[]): SimpleUser[] {
  if (!hazard.reporterId) {
    console.warn('[handler-matcher] 隐患缺少上报人ID');
    return [];
  }

  const reporter = allUsers.find(u => u.id === hazard.reporterId);
  if (!reporter) {
    console.warn('[handler-matcher] 未找到上报人:', hazard.reporterId);
    return [];
  }

  console.log('[handler-matcher] 匹配到上报人:', reporter.name);
  return [reporter];
}

/**
 * 上报人部门主管策略（reporter_manager）
 * 使用 getUserSupervisor 处理上报人本身是主管的情况
 */
function matchReporterManager(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[]
): SimpleUser[] {
  console.log('[handler-matcher] 开始匹配上报人主管');
  
  if (!hazard.reporterId) {
    console.warn('[handler-matcher] 隐患缺少上报人ID');
    return [];
  }

  // 使用 getUserSupervisor 自动处理上报人本身是主管的情况
  const supervisor = getUserSupervisor(
    hazard.reporterId,
    departments,
    allUsers
  );

  if (!supervisor) {
    console.warn('[handler-matcher] 未找到上报人主管');
    return [];
  }

  console.log('[handler-matcher] 匹配到上报人主管:', supervisor.name);
  return [supervisor];
}

/**
 * 上报人部门主管策略（department_manager，向后兼容）
 * 使用通用工具函数 getDepartmentManager
 */
function matchDepartmentManager(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[]
): SimpleUser[] {
  // 复用 reporter_manager 逻辑
  return matchReporterManager(hazard, allUsers, departments);
}

/**
 * 责任部门主管策略
 * 使用通用工具函数 getDepartmentManager
 */
function matchAssignedDepartmentManager(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[]
): SimpleUser[] {
  console.log('[handler-matcher] 开始匹配责任部门主管');
  
  if (!hazard.assignedDepartmentId) {
    console.warn('[handler-matcher] 隐患缺少责任部门ID');
    return [];
  }

  // 使用通用工具函数查找部门负责人
  const manager = getDepartmentManager(
    hazard.assignedDepartmentId,
    departments,
    allUsers
  );

  if (!manager) {
    console.warn('[handler-matcher] 未找到责任部门主管');
    return [];
  }

  console.log('[handler-matcher] 匹配到责任部门主管:', manager.name);
  return [manager];
}

/**
 * 责任人策略
 * 直接返回隐患的责任人
 */
function matchResponsible(hazard: any, allUsers: SimpleUser[]): SimpleUser[] {
  console.log('[handler-matcher] 开始匹配责任人');
  
  if (!hazard.responsibleId) {
    console.warn('[handler-matcher] 隐患缺少责任人ID');
    return [];
  }

  const responsible = allUsers.find(u => u.id === hazard.responsibleId);
  if (!responsible) {
    console.warn('[handler-matcher] 未找到责任人:', hazard.responsibleId);
    return [];
  }

  console.log('[handler-matcher] 匹配到责任人:', responsible.name);
  return [responsible];
}

/**
 * 责任人主管策略
 * 使用 getUserSupervisor 处理责任人本身是主管的情况
 */
function matchResponsibleManager(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[]
): SimpleUser[] {
  console.log('[handler-matcher] 开始匹配责任人主管');
  
  if (!hazard.responsibleId) {
    console.warn('[handler-matcher] 隐患缺少责任人ID');
    return [];
  }

  // 使用 getUserSupervisor 自动处理责任人本身是主管的情况
  const supervisor = getUserSupervisor(
    hazard.responsibleId,
    departments,
    allUsers
  );

  if (!supervisor) {
    console.warn('[handler-matcher] 未找到责任人主管');
    return [];
  }

  console.log('[handler-matcher] 匹配到责任人主管:', supervisor.name);
  return [supervisor];
}

/**
 * 指定部门主管策略
 * 返回配置中指定部门的主管
 */
function matchDeptManager(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[],
  config?: any
): SimpleUser[] {
  console.log('[handler-matcher] 开始匹配指定部门主管');
  
  if (!config?.targetDeptId) {
    console.warn('[handler-matcher] 配置缺少目标部门ID');
    return [];
  }

  const manager = getDepartmentManager(
    config.targetDeptId,
    departments,
    allUsers
  );

  if (!manager) {
    console.warn('[handler-matcher] 未找到指定部门主管');
    return [];
  }

  console.log('[handler-matcher] 匹配到指定部门主管:', manager.name);
  return [manager];
}

/**
 * 职位匹配策略
 * 返回指定部门中职位包含关键词的人员
 */
function matchRole(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[],
  config?: any
): SimpleUser[] {
  console.log('[handler-matcher] 开始职位匹配');
  
  if (!config?.targetDeptId || !config?.roleName) {
    console.warn('[handler-matcher] 配置缺少目标部门或职位关键词');
    return [];
  }

  // 获取部门下的所有用户
  const deptUsers = getDepartmentUsers(config.targetDeptId, departments, allUsers);
  
  // 筛选出职位包含关键词的用户
  const matchedUsers = deptUsers.filter(u => 
    u.role && u.role.includes(config.roleName)
  );

  if (matchedUsers.length === 0) {
    console.warn('[handler-matcher] 未找到符合职位要求的人员');
    return [];
  }

  console.log('[handler-matcher] 匹配到职位人员:', matchedUsers.map(u => u.name).join('、'));
  return matchedUsers;
}

/**
 * 区域匹配策略
 * 根据隐患区域匹配对应部门的主管
 */
function matchLocation(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[],
  config?: any
): SimpleUser[] {
  console.log('[handler-matcher] 开始区域匹配');
  
  if (!config?.rules || config.rules.length === 0) {
    console.warn('[handler-matcher] 配置缺少区域匹配规则');
    return [];
  }

  if (!hazard.location) {
    console.warn('[handler-matcher] 隐患缺少位置信息');
    return [];
  }

  // 查找匹配的区域规则
  const matchedRule = config.rules.find((rule: any) => 
    hazard.location.includes(rule.location)
  );

  if (!matchedRule) {
    console.warn('[handler-matcher] 未找到匹配的区域规则');
    return [];
  }

  if (!matchedRule.deptId) {
    console.warn('[handler-matcher] 匹配的规则缺少部门ID');
    return [];
  }

  // 获取该部门的主管
  const manager = getDepartmentManager(
    matchedRule.deptId,
    departments,
    allUsers
  );

  if (!manager) {
    console.warn('[handler-matcher] 未找到区域对应部门的主管');
    return [];
  }

  console.log('[handler-matcher] 区域匹配成功，路由到:', manager.name);
  return [manager];
}

/**
 * 类型匹配策略
 * 根据隐患类型匹配对应部门的主管
 */
function matchType(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[],
  config?: any
): SimpleUser[] {
  console.log('[handler-matcher] 开始类型匹配');
  
  if (!config?.rules || config.rules.length === 0) {
    console.warn('[handler-matcher] 配置缺少类型匹配规则');
    return [];
  }

  if (!hazard.type) {
    console.warn('[handler-matcher] 隐患缺少类型信息');
    return [];
  }

  // 查找匹配的类型规则
  const matchedRule = config.rules.find((rule: any) => 
    hazard.type === rule.type || hazard.type.includes(rule.type)
  );

  if (!matchedRule) {
    console.warn('[handler-matcher] 未找到匹配的类型规则');
    return [];
  }

  if (!matchedRule.deptId) {
    console.warn('[handler-matcher] 匹配的规则缺少部门ID');
    return [];
  }

  // 获取该部门的主管
  const manager = getDepartmentManager(
    matchedRule.deptId,
    departments,
    allUsers
  );

  if (!manager) {
    console.warn('[handler-matcher] 未找到类型对应部门的主管');
    return [];
  }

  console.log('[handler-matcher] 类型匹配成功，路由到:', manager.name);
  return [manager];
}

/**
 * 风险等级匹配策略
 * 根据隐患风险等级匹配对应部门的主管
 */
function matchRisk(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[],
  config?: any
): SimpleUser[] {
  console.log('[handler-matcher] 开始风险等级匹配');
  
  if (!config?.rules || config.rules.length === 0) {
    console.warn('[handler-matcher] 配置缺少风险等级匹配规则');
    return [];
  }

  if (!hazard.riskLevel) {
    console.warn('[handler-matcher] 隐患缺少风险等级信息');
    return [];
  }

  // 查找匹配的风险等级规则
  const matchedRule = config.rules.find((rule: any) => 
    hazard.riskLevel === rule.riskLevel
  );

  if (!matchedRule) {
    console.warn('[handler-matcher] 未找到匹配的风险等级规则');
    return [];
  }

  if (!matchedRule.deptId) {
    console.warn('[handler-matcher] 匹配的规则缺少部门ID');
    return [];
  }

  // 获取该部门的主管
  const manager = getDepartmentManager(
    matchedRule.deptId,
    departments,
    allUsers
  );

  if (!manager) {
    console.warn('[handler-matcher] 未找到风险等级对应部门的主管');
    return [];
  }

  console.log('[handler-matcher] 风险等级匹配成功，路由到:', manager.name);
  return [manager];
}
