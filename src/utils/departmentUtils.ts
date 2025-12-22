// 🟢 新建此文件，将递归逻辑放这里
export const findDeptRecursive = (depts: any[], targetId: string): any => {
  if (!depts || !Array.isArray(depts)) return null;
  for (const dept of depts) {
    if (String(dept.id) === String(targetId)) return dept;
    if (dept.children && dept.children.length > 0) {
      const found = findDeptRecursive(dept.children, targetId);
      if (found) return found;
    }
  }
  return null;
};

// 将树形部门扁平化，生成包含路径的索引
export const flattenDepartments = (nodes: any[]): Array<{ id: string; name: string; path: string }> => {
  const list: Array<{ id: string; name: string; path: string }> = [];
  const walk = (node: any, parentPath: string) => {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;
    list.push({ id: String(node.id), name: String(node.name), path });
    if (node.children && node.children.length) {
      node.children.forEach((child: any) => walk(child, path));
    }
  };
  (nodes || []).forEach((n: any) => walk(n, ''));
  return list;
};

// 归一化字符串用于比较（移除空白与符号，转小写）
export const normalize = (s: string): string => (s || '').replace(/[\s\-_,]/g, '').toLowerCase();

// 基于路径或名称进行匹配（优先路径精确，其次名称精确，最后模糊）
export const matchDepartment = (
  flat: Array<{ id: string; name: string; path: string }>,
  input: string
): { id?: string; name?: string; path?: string; suggestions?: Array<{ name: string; path: string }> } => {
  const value = (input || '').trim();
  if (!value) return {};
  const nVal = normalize(value);

  // 1) 路径精确（忽略空白/符号）
  const exactPath = flat.find(d => normalize(d.path) === nVal);
  if (exactPath) return { id: exactPath.id, name: exactPath.name, path: exactPath.path };

  // 2) 名称精确
  const exactName = flat.find(d => normalize(d.name) === nVal);
  if (exactName) return { id: exactName.id, name: exactName.name, path: exactName.path };

  // 3) 简单模糊：路径或名称包含输入片段
  const candidates = flat.filter(d => normalize(d.path).includes(nVal) || normalize(d.name).includes(nVal));
  if (candidates.length === 1) {
    const c = candidates[0];
    return { id: c.id, name: c.name, path: c.path };
  }
  if (candidates.length > 1) {
    return { suggestions: candidates.slice(0, 5).map(c => ({ name: c.name, path: c.path })) };
  }

  return {};
};