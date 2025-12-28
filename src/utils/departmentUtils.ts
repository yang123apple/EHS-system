/**
 * 部门相关通用工具函数
 * 
 * 这些函数被多个系统模块复用，包括：
 * - 隐患管理系统的工作流引擎
 * - 作业许可系统
 * - 其他需要部门组织架构信息的模块
 */

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  managerId?: string;  // 部门负责人的用户ID
  children?: Department[];
}

export interface SimpleUser {
  id: string;
  name: string;
  department?: string;
  departmentId?: string;
  jobTitle?: string;
  [key: string]: any;
}

/**
 * 根据部门ID查找部门负责人
 * 
 * @param deptId - 部门ID
 * @param departments - 部门数组（扁平化的组织架构）
 * @param allUsers - 所有用户数组
 * @returns 部门负责人用户对象，如果未找到则返回null
 * 
 * @example
 * const manager = getDepartmentManager(
 *   'dept_1766209208687_512',
 *   departments,
 *   allUsers
 * );
 * console.log(manager?.name); // "杨光"
 */
export function getDepartmentManager(
  deptId: string,
  departments: Department[],
  allUsers: SimpleUser[]
): SimpleUser | null {
  if (!deptId || !departments?.length || !allUsers?.length) {
    console.warn('[getDepartmentManager] 参数缺失:', { 
      hasDeptId: !!deptId, 
      hasDepartments: !!departments?.length, 
      hasUsers: !!allUsers?.length 
    });
    return null;
  }

  // 1. 从departments数组中找到对应部门
  // 优先尝试递归查找（支持树形结构），然后尝试扁平数组
  let dept: Department | null | undefined = findDeptRecursive(departments, deptId);
  
  // 如果递归查找失败，尝试扁平数组直接查找
  if (!dept) {
    dept = departments.find(d => d.id === deptId);
  }
  
  if (!dept) {
    console.warn('[getDepartmentManager] 未找到部门:', { 
      deptIdOrName: deptId, 
      foundDept: dept 
    });
    return null;
  }

  if (!dept.managerId) {
    console.warn('[getDepartmentManager] 部门未配置负责人:', {
      deptId: dept.id,
      deptName: dept.name
    });
    return null;
  }

  // 2. 根据managerId在allUsers中查找用户
  const manager = allUsers.find(u => u.id === dept.managerId);
  
  if (!manager) {
    console.warn('[getDepartmentManager] 未找到部门负责人用户:', {
      managerId: dept.managerId,
      deptName: dept.name
    });
    return null;
  }

  console.log('[getDepartmentManager] 成功找到部门负责人:', {
    deptName: dept.name,
    managerName: manager.name,
    managerId: manager.id
  });
  return manager;
}

/**
 * 查找用户的主管（处理用户本身是主管的情况）
 * 
 * 逻辑：
 * 1. 先找到用户所在部门
 * 2. 如果用户ID等于部门的managerId（即用户本身是主管），则查找上级部门的主管
 * 3. 否则返回当前部门的主管
 * 
 * @param userId - 用户ID
 * @param departments - 部门数组
 * @param allUsers - 所有用户数组
 * @returns 用户的主管对象，如果未找到则返回null
 * 
 * @example
 * // 假设用户A是部门B的主管，部门B的上级是部门C（主管是用户D）
 * const supervisor = getUserSupervisor(userA.id, departments, allUsers);
 * console.log(supervisor?.name); // "用户D"（部门C的主管）
 */
export function getUserSupervisor(
  userId: string,
  departments: Department[],
  allUsers: SimpleUser[]
): SimpleUser | null {
  if (!userId || !departments?.length || !allUsers?.length) {
    console.warn('[getUserSupervisor] 参数缺失');
    return null;
  }

  // 1. 找到用户对象
  const user = allUsers.find(u => u.id === userId);
  if (!user) {
    console.warn('[getUserSupervisor] 未找到用户:', userId);
    return null;
  }

  // 2. 找到用户所在部门
  const userDeptId = user.departmentId || user.department;
  if (!userDeptId) {
    console.warn('[getUserSupervisor] 用户未关联部门:', user.name);
    return null;
  }

  let userDept: Department | null | undefined = findDeptRecursive(departments, userDeptId);
  if (!userDept) {
    userDept = departments.find(d => d.id === userDeptId);
  }

  if (!userDept) {
    console.warn('[getUserSupervisor] 未找到用户部门:', userDeptId);
    return null;
  }

  // 3. 检查用户是否是当前部门的主管
  if (userDept.managerId === userId) {
    console.log('[getUserSupervisor] 用户是部门主管，查找上级部门主管:', {
      userName: user.name,
      deptName: userDept.name
    });

    // 用户是主管，查找上级部门的主管
    if (!userDept.parentId) {
      console.warn('[getUserSupervisor] 已是顶级部门主管，无上级主管');
      return null;
    }

    // 查找父部门
    let parentDept: Department | null | undefined = findDeptRecursive(departments, userDept.parentId);
    if (!parentDept) {
      parentDept = departments.find(d => d.id === userDept.parentId);
    }

    if (!parentDept) {
      console.warn('[getUserSupervisor] 未找到上级部门:', userDept.parentId);
      return null;
    }

    if (!parentDept.managerId) {
      console.warn('[getUserSupervisor] 上级部门未配置主管:', parentDept.name);
      return null;
    }

    // 返回上级部门的主管
    const parentManager = allUsers.find(u => u.id === parentDept.managerId);
    if (parentManager) {
      console.log('[getUserSupervisor] 找到上级部门主管:', {
        userName: user.name,
        userDept: userDept.name,
        parentDept: parentDept.name,
        supervisorName: parentManager.name
      });
    }
    return parentManager || null;
  }

  // 4. 用户不是主管，返回当前部门主管
  const deptManager = getDepartmentManager(userDeptId, departments, allUsers);
  if (deptManager) {
    console.log('[getUserSupervisor] 找到部门主管:', {
      userName: user.name,
      deptName: userDept.name,
      managerName: deptManager.name
    });
  }
  return deptManager;
}

/**
 * 根据部门ID查找部门对象
 * 
 * @param deptId - 部门ID
 * @param departments - 部门数组
 * @returns 部门对象，如果未找到则返回null
 */
export function getDepartmentById(
  deptId: string,
  departments: Department[]
): Department | null {
  if (!deptId || !departments?.length) {
    return null;
  }

  return departments.find(d => d.id === deptId) || null;
}

/**
 * 根据部门名称查找部门对象
 * 
 * @param deptName - 部门名称
 * @param departments - 部门数组
 * @returns 部门对象，如果未找到则返回null
 */
export function getDepartmentByName(
  deptName: string,
  departments: Department[]
): Department | null {
  if (!deptName || !departments?.length) {
    return null;
  }

  return departments.find(d => d.name === deptName) || null;
}

/**
 * 递归查找部门（支持树形结构）
 * 
 * 用于在树形的部门数组中查找指定ID的部门。
 * 与 getDepartmentById 不同，此函数支持递归查找嵌套的 children 节点。
 * 
 * @param departments - 部门数组（可以是树形结构）
 * @param targetId - 要查找的部门ID
 * @returns 部门对象，如果未找到则返回null
 * 
 * @example
 * const dept = findDeptRecursive(departmentTree, 'dept_123');
 * console.log(dept?.name); // "EHS工程组"
 */
export function findDeptRecursive(
  departments: Department[],
  targetId: string
): Department | null {
  if (!departments?.length || !targetId) {
    return null;
  }

  for (const dept of departments) {
    // 检查当前部门
    if (dept.id === targetId) {
      return dept;
    }

    // 递归检查子部门
    if (dept.children?.length) {
      const found = findDeptRecursive(dept.children, targetId);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * 获取部门的所有下属部门（递归查找）
 * 
 * @param deptId - 父部门ID
 * @param departments - 部门数组
 * @returns 下属部门ID数组
 */
export function getSubDepartments(
  deptId: string,
  departments: Department[]
): string[] {
  if (!deptId || !departments?.length) {
    return [];
  }

  const result: string[] = [];
  
  function findChildren(parentId: string) {
    const children = departments.filter(d => d.parentId === parentId);
    children.forEach(child => {
      result.push(child.id);
      findChildren(child.id);  // 递归查找子部门
    });
  }

  findChildren(deptId);
  return result;
}

/**
 * 获取部门的所有上级部门（从当前部门到根部门的路径）
 * 
 * @param deptId - 部门ID
 * @param departments - 部门数组
 * @returns 上级部门ID数组（不包含当前部门，从近到远排序）
 */
export function getParentDepartments(
  deptId: string,
  departments: Department[]
): string[] {
  if (!deptId || !departments?.length) {
    return [];
  }

  const result: string[] = [];
  let currentDept = getDepartmentById(deptId, departments);

  while (currentDept?.parentId) {
    result.push(currentDept.parentId);
    currentDept = getDepartmentById(currentDept.parentId, departments);
  }

  return result;
}

/**
 * 获取部门的完整路径名称（从根到当前部门）
 * 
 * @param deptId - 部门ID
 * @param departments - 部门数组
 * @param separator - 路径分隔符，默认为 " > "
 * @returns 完整路径字符串，如 "公司 > 部门A > 小组B"
 */
export function getDepartmentFullPath(
  deptId: string,
  departments: Department[],
  separator: string = ' > '
): string {
  if (!deptId || !departments?.length) {
    return '';
  }

  const dept = getDepartmentById(deptId, departments);
  if (!dept) return '';

  const path: string[] = [dept.name];
  const parents = getParentDepartments(deptId, departments);
  
  parents.reverse().forEach(parentId => {
    const parent = getDepartmentById(parentId, departments);
    if (parent) {
      path.unshift(parent.name);
    }
  });

  return path.join(separator);
}

/**
 * 获取某个部门下的所有用户（包括子部门）
 * 
 * @param deptId - 部门ID
 * @param departments - 部门数组
 * @param allUsers - 所有用户数组
 * @param includeSubDepts - 是否包含子部门的用户，默认true
 * @returns 用户数组
 */
export function getDepartmentUsers(
  deptId: string,
  departments: Department[],
  allUsers: SimpleUser[],
  includeSubDepts: boolean = true
): SimpleUser[] {
  if (!deptId || !departments?.length || !allUsers?.length) {
    return [];
  }

  const targetDeptIds = [deptId];
  
  if (includeSubDepts) {
    targetDeptIds.push(...getSubDepartments(deptId, departments));
  }

  return allUsers.filter(user => 
    user.departmentId && targetDeptIds.includes(user.departmentId)
  );
}

/**
 * 将扁平化的部门数组转换为树形结构
 * 
 * @param departments - 扁平化的部门数组
 * @param rootId - 根节点ID，默认为null
 * @returns 树形结构的部门数组
 */
export function buildDepartmentTree(
  departments: Department[],
  rootId: string | null = null
): Department[] {
  if (!departments?.length) {
    return [];
  }

  const tree: Department[] = [];
  const map = new Map<string, Department>();

  // 创建映射
  departments.forEach(dept => {
    map.set(dept.id, { ...dept, children: [] });
  });

  // 构建树
  map.forEach(dept => {
    if (dept.parentId === rootId) {
      tree.push(dept);
    } else if (dept.parentId) {
      const parent = map.get(dept.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(dept);
      }
    }
  });

  return tree;
}

/**
 * 扁平化部门树（将树形结构转换为扁平数组）
 * 
 * @param tree - 树形结构的部门数组
 * @returns 扁平化的部门数组
 */
export function flattenDepartmentTree(tree: Department[]): Department[] {
  if (!tree?.length) {
    return [];
  }

  const result: Department[] = [];

  function traverse(nodes: Department[]) {
    nodes.forEach(node => {
      const { children, ...dept } = node;
      result.push(dept as Department);
      if (children?.length) {
        traverse(children);
      }
    });
  }

  traverse(tree);
  return result;
}

/**
 * Excel导入专用：扁平化部门并包含完整路径信息
 * 
 * 将树形或扁平的部门数组转换为包含完整路径的扁平数组，
 * 用于Excel导入时的部门名称匹配
 * 
 * @param departments - 部门数组（树形或扁平）
 * @returns 包含完整路径的部门对象数组
 * 
 * @example
 * const flat = flattenDepartments(departments);
 * // [
 * //   { id: 'dept_1', name: 'EHS部', path: '公司 > EHS部', level: 1 },
 * //   { id: 'dept_2', name: 'EHS工程组', path: '公司 > EHS部 > EHS工程组', level: 2 }
 * // ]
 */
export function flattenDepartments(
  departments: Department[]
): Array<{ id: string; name: string; path: string; level: number }> {
  if (!departments?.length) {
    return [];
  }

  const result: Array<{ id: string; name: string; path: string; level: number }> = [];

  // 如果是树形结构，先扁平化
  const flatDepts = departments[0]?.children !== undefined
    ? flattenDepartmentTree(departments)
    : departments;

  // 为每个部门计算完整路径
  flatDepts.forEach(dept => {
    const path = getDepartmentFullPath(dept.id, flatDepts);
    result.push({
      id: dept.id,
      name: dept.name,
      path: path || dept.name,
      level: dept.level
    });
  });

  return result;
}

/**
 * Excel导入专用：智能匹配部门名称
 * 
 * 支持以下匹配方式：
 * 1. 完整路径匹配（如 "公司 > EHS部 > EHS工程组"）
 * 2. 部分路径匹配（如 "EHS部 > EHS工程组"）
 * 3. 单独名称精确匹配
 * 4. 模糊搜索（相似度匹配）
 * 
 * @param flatDepts - 扁平化后的部门数组（包含path字段）
 * @param searchText - 搜索文本（部门名称或路径）
 * @returns 匹配结果对象
 * 
 * @example
 * const result = matchDepartment(flatDepts, "EHS部 > EHS工程组");
 * if (result.id) {
 *   console.log(`匹配成功: ${result.name}`);
 * } else {
 *   console.log(`未找到，建议: ${result.suggestions.map(s => s.path).join(', ')}`);
 * }
 */
export function matchDepartment(
  flatDepts: Array<{ id: string; name: string; path: string; level: number }>,
  searchText: string
): {
  id?: string;
  name?: string;
  path?: string;
  suggestions: Array<{ id: string; name: string; path: string; similarity: number }>;
} {
  if (!flatDepts?.length || !searchText) {
    return { suggestions: [] };
  }

  const normalizedSearch = searchText.trim().replace(/\s+/g, ' ');

  // 1. 完整路径精确匹配
  const exactPathMatch = flatDepts.find(d => d.path === normalizedSearch);
  if (exactPathMatch) {
    return {
      id: exactPathMatch.id,
      name: exactPathMatch.name,
      path: exactPathMatch.path,
      suggestions: []
    };
  }

  // 2. 部门名称精确匹配
  const exactNameMatch = flatDepts.find(d => d.name === normalizedSearch);
  if (exactNameMatch) {
    return {
      id: exactNameMatch.id,
      name: exactNameMatch.name,
      path: exactNameMatch.path,
      suggestions: []
    };
  }

  // 3. 部分路径匹配（搜索文本是路径的一部分）
  const partialMatches = flatDepts.filter(d => 
    d.path.includes(normalizedSearch) || normalizedSearch.includes(d.name)
  );

  if (partialMatches.length === 1) {
    return {
      id: partialMatches[0].id,
      name: partialMatches[0].name,
      path: partialMatches[0].path,
      suggestions: []
    };
  }

  // 4. 模糊匹配 - 计算相似度
  const similarities = flatDepts.map(dept => {
    const nameSimilarity = calculateSimilarity(normalizedSearch, dept.name);
    const pathSimilarity = calculateSimilarity(normalizedSearch, dept.path);
    const similarity = Math.max(nameSimilarity, pathSimilarity);
    
    return {
      id: dept.id,
      name: dept.name,
      path: dept.path,
      similarity
    };
  });

  // 按相似度排序
  similarities.sort((a, b) => b.similarity - a.similarity);

  // 如果最高相似度 >= 0.8，认为是明确匹配
  if (similarities[0].similarity >= 0.8) {
    return {
      id: similarities[0].id,
      name: similarities[0].name,
      path: similarities[0].path,
      suggestions: []
    };
  }

  // 返回前5个最相似的建议
  const suggestions = similarities
    .filter(s => s.similarity >= 0.3)
    .slice(0, 5);

  return { suggestions };
}

/**
 * 计算两个字符串的相似度（0-1之间）
 * 使用 Levenshtein 距离算法的简化版本
 * 
 * @param str1 - 字符串1
 * @param str2 - 字符串2
 * @returns 相似度分数（0-1）
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  // 检查是否包含
  if (longer.includes(shorter)) {
    return 0.7 + (0.3 * shorter.length / longer.length);
  }

  // 简化的编辑距离计算
  const distance = levenshteinDistance(str1, str2);
  return (longer.length - distance) / longer.length;
}

/**
 * 计算 Levenshtein 编辑距离
 * 
 * @param str1 - 字符串1
 * @param str2 - 字符串2
 * @returns 编辑距离
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,  // 替换
          matrix[i][j - 1] + 1,      // 插入
          matrix[i - 1][j] + 1       // 删除
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
