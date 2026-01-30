"use client";
import { useState, useEffect, useRef } from 'react';
import { Network, ChevronRight, ChevronDown, Plus, Trash2, Edit2, User as UserIcon, Briefcase, BadgeCheck, UserPlus, X, GripVertical, LogOut, FileSpreadsheet, Download, Upload, HelpCircle, FolderTree, Settings, Eye } from 'lucide-react';
import jschardet from 'jschardet';
import { parseTableFile, pick } from '@/utils/fileImport';
import * as XLSX from 'xlsx';
import PeopleSelector from '@/components/common/PeopleSelector';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';

// 定义接口
interface OrgNode {
  id: string;
  name: string;
  managerId?: string;
  parentId: string | null;
  sortOrder?: number;
  children?: OrgNode[];
}

interface UserSimple {
  id: string;
  name: string;
  username: string;
  departmentId?: string;
  department: string;
  jobTitle?: string;
  avatar?: string;
  isActive?: boolean;
}

export default function OrgStructurePage() {
  const { user: currentUser } = useAuth();
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [users, setUsers] = useState<UserSimple[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- 状态管理 ---
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [parentIdToAdd, setParentIdToAdd] = useState<string | null>(null);
  const [deptFormData, setDeptFormData] = useState({ name: '', managerId: '' });

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [targetDeptForMember, setTargetDeptForMember] = useState<OrgNode | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  
  // 🟢 新增：员工部门调整弹窗状态
  const [showUserDeptModal, setShowUserDeptModal] = useState(false);
  const [adjustingUser, setAdjustingUser] = useState<UserSimple | null>(null);
  
  // 🟢 新增：员工编辑弹窗状态
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSimple | null>(null);
  
  // 🟢 导入功能
  const importFileRef = useRef<HTMLInputElement>(null);
    const [showImportGuide, setShowImportGuide] = useState(false);

  // 🟢 离职人员显示开关
  const [showDepartedEmployees, setShowDepartedEmployees] = useState(false);

  // 🟢 部门拖拽状态
  const [draggingDeptId, setDraggingDeptId] = useState<string | null>(null);
  const [dragOverDeptId, setDragOverDeptId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  // 🟢 部门展开状态（集中管理，避免拖动时重置）
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) return;
    fetchData();
  }, [currentUser]);

  // 🟢 初始化展开状态：默认展开所有部门
  useEffect(() => {
    if (tree.length > 0) {
      const allDeptIds = new Set<string>();
      const collectIds = (nodes: OrgNode[]) => {
        nodes.forEach(node => {
          allDeptIds.add(node.id);
          if (node.children) {
            collectIds(node.children);
          }
        });
      };
      collectIds(tree);
      setExpandedDepts(allDeptIds);
    }
  }, [tree.length]); // 只在树结构变化时初始化

  const toggleExpanded = (deptId: string) => {
    setExpandedDepts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deptId)) {
        newSet.delete(deptId);
      } else {
        newSet.add(deptId);
      }
      return newSet;
    });
  };

  const fetchData = async () => {
    if (!currentUser) return;
    
    try {
      const [treeRes, usersRes] = await Promise.all([
        apiFetch('/api/org'),
        apiFetch('/api/users')
      ]);
      
      // 检查响应状态
      if (!treeRes.ok || !usersRes.ok) {
        console.error("API响应错误", { tree: treeRes.status, users: usersRes.status });
        setTree([]);
        setUsers([]);
        return;
      }
      
      const treeData = await treeRes.json();
      const usersData = await usersRes.json();
      
      // 确保 tree 是数组
      setTree(Array.isArray(treeData) ? treeData : []);
      // 确保 users 是数组
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (e) {
      console.error("加载失败", e);
      setTree([]);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ========================
  // 1. 部门增删改逻辑
  // ========================
  const handleOpenAddDept = (parentId: string | null) => {
    setEditingNode(null);
    setParentIdToAdd(parentId);
    setDeptFormData({ name: '', managerId: '' });
    setShowDeptModal(true);
  };

  const handleOpenEditDept = (node: OrgNode) => {
    setEditingNode(node);
    setParentIdToAdd(null);
    setDeptFormData({ name: node.name, managerId: node.managerId || '' });
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingNode;
    const url = isEdit ? `/api/org/${editingNode.id}` : '/api/org';
    const method = isEdit ? 'PUT' : 'POST';
    
    const payload = {
        name: deptFormData.name,
        managerId: deptFormData.managerId || undefined,
        parentId: isEdit ? editingNode.parentId : parentIdToAdd
    };

    await apiFetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    setShowDeptModal(false);
    fetchData(); 
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('确定删除该部门吗？(请确保该部门下无子部门)')) return;
    await apiFetch(`/api/org/${id}`, { method: 'DELETE' });
    fetchData();
  };

  // 🟢 部门排序处理
  const handleDepartmentReorder = async (draggedId: string, targetId: string, position: 'before' | 'after') => {
    // Find all siblings of the dragged department
    const draggedNode = findNodeById(tree, draggedId);
    const targetNode = findNodeById(tree, targetId);

    if (!draggedNode || !targetNode) return;
    if (draggedNode.id === targetNode.id) return; // Prevent self-drop
    if (draggedNode.parentId !== targetNode.parentId) {
      alert('只能在同级部门之间调整顺序');
      return;
    }

    // Get all siblings
    const siblings = getSiblings(tree, draggedId);
    if (siblings.length <= 1) return; // No reordering needed

    // Remove dragged node from siblings
    const filteredSiblings = siblings.filter(s => s.id !== draggedId);

    // Find target index
    const targetIndex = filteredSiblings.findIndex(s => s.id === targetId);
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;

    // Insert dragged node at new position
    filteredSiblings.splice(insertIndex, 0, draggedNode);

    // Assign new sortOrder values
    const updates = filteredSiblings.map((node, index) => ({
      id: node.id,
      sortOrder: index
    }));

    // Send to backend
    try {
      const res = await apiFetch('/api/org/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      if (res.ok) {
        fetchData(); // Refresh tree
      } else {
        alert('排序失败');
      }
    } catch (e) {
      alert('网络错误');
    }
  };

  // Helper: Find node by ID in tree
  const findNodeById = (nodes: OrgNode[], id: string): OrgNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper: Get all siblings of a node
  const getSiblings = (nodes: OrgNode[], nodeId: string): OrgNode[] => {
    const node = findNodeById(nodes, nodeId);
    if (!node) return [];

    if (!node.parentId) {
      // Root level siblings
      return nodes;
    } else {
      // Find parent and return its children
      const parent = findNodeById(nodes, node.parentId);
      return parent?.children || [];
    }
  };

  // ========================
  // 🟢 新增：批量导入导出功能
  // ========================
  
  // 导出组织架构为 XLSX
  const handleExportOrg = () => {
    const rows: any[][] = [];
    
    // 递归遍历树，生成路径格式
    const traverse = (node: OrgNode, parentPath: string) => {
      const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      const manager = users.find(u => u.id === node.managerId);
      
      rows.push([
        fullPath,
        manager ? manager.username : '',
        manager ? manager.name : ''
      ]);
      
      if (node.children) {
        node.children.forEach(child => traverse(child, fullPath));
      }
    };
    
    tree.forEach(root => traverse(root, ''));
    
    // 创建工作簿
    const ws = XLSX.utils.aoa_to_sheet([['部门路径', '负责人账号', '负责人姓名'], ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '组织架构');
    
    // 下载文件
    XLSX.writeFile(wb, `组织架构_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
  };

  // 导入组织架构
  const handleImportOrg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const parsed = await parseTableFile(file);
      const rows = parsed.objects;
      if (!rows || rows.length === 0) {
        alert('❌ 文件中没有可用数据');
        return;
      }
      
      const deptPaths: Array<{path: string, managerUsername: string}> = [];
      const parseErrors: string[] = [];
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const path = pick(row, ['部门路径','部门','路径','部门路径/名称']);
        const managerUsername = pick(row, ['负责人账号','负责人','负责人用户名','主管账号']);
        if (!path) {
          parseErrors.push(`第 ${i + 2} 行：缺少部门路径`);
          continue;
        }
        deptPaths.push({ path, managerUsername });
      }
        
      if (parseErrors.length > 0) {
        alert(`⚠️ 解析时发现 ${parseErrors.length} 个问题：\n\n${parseErrors.slice(0, 5).join('\n')}${parseErrors.length > 5 ? '\n...' : ''}`);
      }
        
      if (deptPaths.length === 0) {
        alert('❌ 没有可导入的有效数据');
        return;
      }
        
      // 🟢 检查已存在的部门并自动去重
      const existingDepts = new Set<string>();
      const flattenTree = (nodes: OrgNode[], parentPath: string = '') => {
        nodes.forEach(node => {
          const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
          existingDepts.add(fullPath);
          if (node.children) {
            flattenTree(node.children, fullPath);
          }
        });
      };
      flattenTree(tree);
      
      // 过滤掉已存在的部门
      const newDeptPaths = deptPaths.filter(({path}) => !existingDepts.has(path));
      const duplicateCount = deptPaths.length - newDeptPaths.length;
      
      if (newDeptPaths.length === 0) {
        alert(`⚠️ 所有 ${deptPaths.length} 个部门都已存在，无需导入`);
        return;
      }
      
      const message = duplicateCount > 0 
        ? `✅ 共解析出 ${deptPaths.length} 个部门路径\n📌 其中 ${duplicateCount} 个已存在（已自动去除）\n➕ 将导入 ${newDeptPaths.length} 个新部门\n\n是否继续导入？`
        : `✅ 共解析出 ${deptPaths.length} 个部门路径\n\n是否继续导入？`;
      
      if (!confirm(message)) {
        return;
      }
        
        // 🟢 核心：构建部门树并批量创建
        const createdDepts = new Map<string, string>(); // path -> id
        
        // 先将已存在的部门路径添加到映射中
        const mapExistingDepts = (nodes: OrgNode[], parentPath: string = '') => {
          nodes.forEach(node => {
            const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
            createdDepts.set(fullPath, node.id);
            if (node.children) {
              mapExistingDepts(node.children, fullPath);
            }
          });
        };
        mapExistingDepts(tree);
        
        let successCount = 0;
        const failedItems: Array<{path: string, reason: string}> = [];
        
        // 按路径深度排序，先创建父级部门
        newDeptPaths.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
        
        for (const {path, managerUsername} of newDeptPaths) {
          try {
            const parts = path.split('/').map(p => p.trim()).filter(p => p);
            if (parts.length === 0) continue;
            
            const deptName = parts[parts.length - 1];
            const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
            const parentId = parentPath ? createdDepts.get(parentPath) : null;
            
            // 查找负责人ID
            let managerId = undefined;
            if (managerUsername) {
              const manager = users.find(u => u.username === managerUsername);
              if (manager) {
                managerId = manager.id;
              } else {
                console.warn(`部门 "${deptName}" 的负责人 "${managerUsername}" 不存在`);
              }
            }
            
            // 创建部门
            const res = await apiFetch('/api/org', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                name: deptName,
                parentId: parentId,
                managerId: managerId
              })
            });
            
            if (res.ok) {
              const newDept = await res.json();
              createdDepts.set(path, newDept.id);
              successCount++;
            } else {
              const errorData = await res.json();
              failedItems.push({ path, reason: errorData.error || '创建失败' });
            }
          } catch (error) {
            failedItems.push({ path, reason: '网络错误' });
          }
        }
        
        // 生成报告
        let reportMessage = `📊 导入完成！\n\n✅ 成功创建: ${successCount}\n❌ 失败: ${failedItems.length}`;
        if (duplicateCount > 0) {
          reportMessage += `\n🔄 已存在(跳过): ${duplicateCount}`;
        }
        
        if (failedItems.length > 0) {
          reportMessage += '\n\n失败详情：\n';
          failedItems.slice(0, 5).forEach(({path, reason}) => {
            reportMessage += `• ${path}: ${reason}\n`;
          });
          if (failedItems.length > 5) {
            reportMessage += `... 还有 ${failedItems.length - 5} 条失败记录`;
          }
        }
        
      alert(reportMessage);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('❌ 文件解析失败\n\n建议：使用UTF-8编码保存CSV或使用Excel的 XLSX 格式');
    }
    e.target.value = '';
  };

  // ========================
  // 2. 成员管理逻辑 (添加 / 移动 / 移除)
  // ========================
  const handleOpenAddMember = (node: OrgNode) => {
    setTargetDeptForMember(node);
    setSelectedUserId("");
    setShowMemberModal(true);
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !targetDeptForMember) return;
    await updateUserDepartment(selectedUserId, targetDeptForMember.id, targetDeptForMember.name);
    setShowMemberModal(false);
  };

  const handleRemoveMember = async (user: UserSimple) => {
    if (!confirm(`确定将 ${user.name} 从该部门移除吗？\n(用户账号不会被删除，只是变成无部门状态)`)) return;
    await updateUserDepartment(user.id, null, ""); 
  };

  const updateUserDepartment = async (userId: string, deptId: string | null, deptName: string) => {
    try {
        const res = await apiFetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                departmentId: deptId || "", 
                department: deptName
            })
        });

        if (res.ok) {
            fetchData(); 
        } else {
            alert("操作失败");
        }
    } catch (e) {
        alert("网络错误");
    }
  };

  // 🟢 新增：打开员工部门调整弹窗
  const handleOpenUserDeptAdjust = (user: UserSimple) => {
    setAdjustingUser(user);
    setShowUserDeptModal(true);
  };

  // 🟢 新增：处理员工部门调整
  const handleUserDeptSelect = async (deptId: string, deptName: string) => {
    if (!adjustingUser) return;
    await updateUserDepartment(adjustingUser.id, deptId, deptName);
    setShowUserDeptModal(false);
    setAdjustingUser(null);
  };

  // 🟢 新增：打开员工编辑弹窗
  const handleOpenEditUser = (user: UserSimple) => {
    setEditingUser(user);
    setShowEditUserModal(true);
  };

  // 🟢 新增：保存员工编辑
  const handleSaveEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    
    const formData = new FormData(e.currentTarget);
    const payload: any = {};
    formData.forEach((value, key) => {
      payload[key] = value;
    });

    try {
      const res = await apiFetch(`/api/users/${editingUser.id}`, { 
        method: 'PUT', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      
      if (res.ok) { 
        alert('修改成功'); 
        setShowEditUserModal(false);
        setEditingUser(null);
        fetchData(); 
      } else { 
        alert('修改失败'); 
      }
    } catch (err) { 
      alert('网络错误'); 
    }
  };

  // 🟢 新增：删除员工
  const handleDeleteUser = async (user: UserSimple) => {
    if (confirm(`确定删除用户 ${user.name} (${user.username}) 吗？\n\n此操作不可恢复！`)) {
      try {
        const res = await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
        if (res.ok) {
          alert('删除成功');
          fetchData();
        } else {
          alert('删除失败');
        }
      } catch (err) {
        alert('网络错误');
      }
    }
  };

  const handleDrop = async (e: React.DragEvent, targetNode: OrgNode) => {
    e.preventDefault();
    e.stopPropagation();
    const userId = e.dataTransfer.getData("userId");
    
    if (!userId) return;
    
    const user = users.find(u => u.id === userId);
    if (user && user.departmentId !== targetNode.id) {
        await updateUserDepartment(userId, targetNode.id, targetNode.name);
    }
  };

  // ========================
  // 3. 递归树节点组件
  // ========================
  const TreeNode = ({ node, level }: { node: OrgNode, level: number }) => {
    const expanded = expandedDepts.has(node.id);
    const [isDragOver, setIsDragOver] = useState(false);
    const [localDropPosition, setLocalDropPosition] = useState<'before' | 'after' | null>(null);

    // 1. 找出归属于该部门的 直属 成员
    const directUsers = users.filter(u => {
        const belongsToDept = u.departmentId === node.id || (!u.departmentId && u.department === node.name);
        const isActiveUser = showDepartedEmployees ? true : (u.isActive !== false);
        return belongsToDept && isActiveUser;
    });

    // 2. 找出负责人信息
    const manager = users.find(u => u.id === node.managerId);

    // 3. 🟢 核心修改：递归计算总人数 (本部门 + 所有子部门)
    const getTotalUserCount = (n: OrgNode): number => {
        // 当前节点的直属人数
        const direct = users.filter(u => {
            const belongsToDept = u.departmentId === n.id || (!u.departmentId && u.department === n.name);
            const isActiveUser = showDepartedEmployees ? true : (u.isActive !== false);
            return belongsToDept && isActiveUser;
        }).length;
        // 子节点的总人数
        const childrenSum = n.children ? n.children.reduce((acc, child) => acc + getTotalUserCount(child), 0) : 0;
        return direct + childrenSum;
    };

    const totalCount = getTotalUserCount(node);

    // 是否显示折叠箭头：有子部门 或者 有直属员工
    const hasChildren = (node.children && node.children.length > 0) || directUsers.length > 0;

    // 🟢 NEW: Department drag handlers
    const handleDeptDragStart = (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.setData("deptId", node.id);
        e.dataTransfer.effectAllowed = "move";
        setDraggingDeptId(node.id);
    };

    const handleDeptDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Check if this is a department drag or user drag
        const types = Array.from(e.dataTransfer.types);
        const isDeptDrag = types.includes('text/plain') && e.dataTransfer.effectAllowed === 'move';

        // Try to get deptId (won't work during dragOver in some browsers, so we check types)
        if (draggingDeptId) {
            // This is a department drag
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const position = e.clientY < midpoint ? 'before' : 'after';

            setDragOverDeptId(node.id);
            setLocalDropPosition(position);
        } else {
            // This is a user drag, use existing logic
            setIsDragOver(true);
        }
    };

    const handleDeptDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        setDragOverDeptId(null);
        setLocalDropPosition(null);
    };

    const handleDeptDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const deptId = e.dataTransfer.getData("deptId");
        const userId = e.dataTransfer.getData("userId");

        if (userId) {
            // User drop - existing logic
            setIsDragOver(false);
            handleDrop(e, node);
        } else if (deptId && localDropPosition) {
            // Department drop - new logic
            setDragOverDeptId(null);
            setLocalDropPosition(null);
            setDraggingDeptId(null);
            handleDepartmentReorder(deptId, node.id, localDropPosition);
        }
    };

    const handleDeptDragEnd = () => {
        setDraggingDeptId(null);
        setDragOverDeptId(null);
        setLocalDropPosition(null);
    };

    // Determine if this node is being dragged or is a drop target
    const isDragging = draggingDeptId === node.id;
    const isDropTarget = dragOverDeptId === node.id;

    return (
      <div className="select-none transition-all">
        {/* Drop indicator BEFORE */}
        {isDropTarget && localDropPosition === 'before' && (
          <div className="h-1 bg-blue-500 rounded-full mx-2 mb-1 animate-pulse" />
        )}

        {/* 部门行 (Drop Zone) */}
        <div
            draggable
            onDragStart={handleDeptDragStart}
            onDragOver={handleDeptDragOver}
            onDragLeave={handleDeptDragLeave}
            onDrop={handleDeptDrop}
            onDragEnd={handleDeptDragEnd}
            className={`flex items-center justify-between p-2 md:p-3 my-1 rounded-lg border transition-all duration-200 group cursor-move
                ${level === 0 ? 'bg-blue-50/80 border-blue-200 shadow-sm' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm'}
                ${isDragOver ? 'ring-2 ring-green-400 bg-green-50 scale-[1.01]' : ''}
                ${isDragging ? 'opacity-50 scale-95' : ''}
                ${isDropTarget ? 'ring-2 ring-blue-400' : ''}
            `}
            style={{ marginLeft: `${level * 20}px` }}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <button
                onClick={(e) => { e.stopPropagation(); toggleExpanded(node.id); }}
                className={`w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 transition-colors shrink-0 ${!hasChildren && 'invisible'}`}
            >
               {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            
            <div className="flex flex-col">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-1 md:gap-2">
                        <Briefcase size={14} className={level === 0 ? "text-hytzer-blue md:hidden" : "text-slate-500 md:hidden"} />
                        <Briefcase size={16} className={level === 0 ? "text-hytzer-blue hidden md:block" : "text-slate-500 hidden md:block"} />
                        <span className="font-bold text-slate-800 text-xs md:text-sm truncate max-w-[120px] sm:max-w-xs">{node.name}</span>
                    </div>

                    {/* 负责人徽章 */}
                    {manager && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 border border-amber-100 rounded-full animate-fade-in">
                            <div className="w-4 h-4 rounded-full bg-amber-200 overflow-hidden flex items-center justify-center text-[8px] text-amber-700">
                                {manager.avatar ? <img src={manager.avatar} className="w-full h-full object-cover"/> : manager.name[0]}
                            </div>
                            <span className="text-xs font-bold text-amber-700">{manager.name}</span>
                            <span className="text-[10px] text-amber-500 hidden sm:inline">{manager.jobTitle}</span>
                        </div>
                    )}

                    {/* 🟢 人数统计：显示总人数 */}
                    <span className="text-xs text-slate-500 font-normal bg-slate-100 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                        <strong>{totalCount}</strong> 人
                        {/* 如果总人数 != 直属人数，说明有下级部门，额外提示直属人数 */}
                        {totalCount !== directUsers.length && (
                            <span className="text-slate-400 scale-90 ml-1 border-l border-slate-300 pl-1">
                                直属: {directUsers.length}
                            </span>
                        )}
                    </span>
                </div>
            </div>
          </div>

          {/* 操作按钮组 */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2 shrink-0">
            <button
                onClick={() => handleOpenAddMember(node)}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded flex items-center gap-1 bg-white border border-transparent hover:border-green-100 shadow-sm"
                title="添加成员"
            >
                <UserPlus size={14} />
            </button>
            <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
            <button onClick={() => handleOpenAddDept(node.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Plus size={16} /></button>
            <button onClick={() => handleOpenEditDept(node)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"><Edit2 size={16} /></button>
            <button onClick={() => handleDeleteDept(node.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
          </div>
        </div>

        {/* Drop indicator AFTER */}
        {isDropTarget && localDropPosition === 'after' && (
          <div className="h-1 bg-blue-500 rounded-full mx-2 mt-1 animate-pulse" />
        )}

        {/* 展开区域：成员 + 子部门 */}
        {expanded && hasChildren && (
          <div className="border-l-2 border-slate-100 ml-[1.6rem] pl-1">
             <div className="flex flex-col gap-1 mt-1 mb-2">
                {directUsers.map(user => (
                    <div
                        key={user.id}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData("userId", user.id);
                            e.dataTransfer.effectAllowed = "move";
                        }}
                        className={`flex items-center gap-3 p-2 ml-8 rounded border border-dashed transition-all group/user cursor-move ${
                            user.isActive === false
                                ? 'border-slate-300 bg-slate-100/50 opacity-60'
                                : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 hover:shadow-sm'
                        }`}
                    >
                        <GripVertical size={14} className="text-slate-300 group-hover/user:text-slate-400" />
                        <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden shrink-0 select-none">
                            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : <UserIcon size={14}/>}
                        </div>
                        <div className="flex items-center gap-2 text-sm flex-1 select-none">
                            <span className="text-slate-700 font-medium">{user.name}</span>
                            {user.jobTitle ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">{user.jobTitle}</span>
                            ) : <span className="text-xs text-slate-300">-</span>}

                            {node.managerId === user.id && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                    <BadgeCheck size={10} /> 负责人
                                </span>
                            )}

                            {user.isActive === false && (
                                <span className="flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300">
                                    离职
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/user:opacity-100 transition-opacity">
                            {/* 🟢 配置权限按钮 */}
                            <Link 
                                href={`/admin/account/${user.id}`}
                                className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                                title="配置权限"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Settings size={14} />
                            </Link>
                            {/* 🟢 编辑信息按钮 */}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditUser(user);
                                }}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                title="编辑信息"
                            >
                                <Edit2 size={14} />
                            </button>
                            {/* 🟢 删除按钮 */}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteUser(user);
                                }}
                                className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                                title="删除用户"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
             </div>
             {node.children && node.children.map(child => <TreeNode key={child.id} node={child} level={level + 1} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 px-3 md:px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 md:mb-8 gap-3">
            <div>
                <h1 className="text-xl md:text-3xl font-bold text-slate-900 flex items-center gap-2 md:gap-3">
                    <Network className="text-hytzer-blue w-6 h-6 md:w-8 md:h-8" />
                    组织架构图谱
                </h1>
                <p className="text-slate-500 mt-2 text-xs md:text-sm">
                    支持拖拽调整人员归属。部门人数包含所有下级子部门人数。
                </p>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              {/* 🟢 批量导入导出 & 导入指南 按钮（始终显示） */}
              <button
                onClick={() => setShowDepartedEmployees(!showDepartedEmployees)}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 border rounded-lg font-medium text-xs md:text-sm transition-colors ${
                  showDepartedEmployees
                    ? 'border-orange-200 text-orange-700 bg-orange-50'
                    : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                }`}
                title={showDepartedEmployees ? '点击隐藏离职人员' : '点击显示离职人员'}
              >
                <Eye size={14} className="md:hidden" />
                <Eye size={16} className="hidden md:block" />
                <span className="hidden sm:inline">{showDepartedEmployees ? '隐藏离职' : '显示离职'}</span>
              </button>
              <button
                onClick={handleExportOrg}
                disabled={tree.length === 0}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 border rounded-lg font-medium text-xs md:text-sm transition-colors ${tree.length === 0 ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed' : 'border-blue-200 text-blue-700 bg-white hover:bg-blue-50'}`}
                title={tree.length === 0 ? '当前暂无架构，导出不可用' : '导出当前组织架构为CSV'}
              >
                <Download size={14} className="md:hidden" /><Download size={16} className="hidden md:block" /> <span className="hidden sm:inline">导出架构</span>
              </button>
              <label className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 border border-green-200 text-green-700 bg-white hover:bg-green-50 rounded-lg font-medium text-xs md:text-sm transition-colors cursor-pointer">
                <Upload size={14} className="md:hidden" /><Upload size={16} className="hidden md:block" /> <span className="hidden sm:inline">批量导入</span>
                <input 
                  type="file" 
                  ref={importFileRef}
                  accept=".csv,.xlsx" 
                  className="hidden" 
                  onChange={handleImportOrg} 
                />
              </label>
              <button
                onClick={() => setShowImportGuide(true)}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 border border-purple-200 text-purple-700 bg-white hover:bg-purple-50 rounded-lg font-medium text-xs md:text-sm transition-colors"
                title="查看导入指南"
              >
                <HelpCircle size={14} className="md:hidden" /><HelpCircle size={16} className="hidden md:block" /> <span className="hidden sm:inline">导入指南</span>
              </button>

              {/* 保留初始化根节点提示 */}
              {tree.length === 0 && !isLoading && (
                 <button onClick={() => handleOpenAddDept(null)} className="bg-hytzer-blue text-white px-4 py-2 rounded">初始化根节点</button>
              )}
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-8 min-h-[400px] md:min-h-[600px]">
            {isLoading ? (
                <div className="text-center py-20 text-slate-400">正在加载...</div>
            ) : tree.length === 0 ? (
                <div className="text-center py-20 text-slate-500">暂无数据</div>
            ) : (
                <div className="space-y-1">
                    {tree.map(root => <TreeNode key={root.id} node={root} level={0} />)}
                </div>
            )}
        </div>
        
        {/* Modal: 部门编辑 (保持不变) */}
        {showDeptModal && (
           <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm p-3 md:p-0">
                <div className="bg-white rounded-xl p-4 md:p-6 w-full max-w-md shadow-2xl max-h-[95vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl text-slate-800">{editingNode ? '编辑部门' : '新增子部门'}</h3>
                        <button onClick={() => setShowDeptModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleSaveDept} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">部门名称</label>
                            <input value={deptFormData.name} onChange={e => setDeptFormData({...deptFormData, name: e.target.value})} className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-hytzer-blue" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">部门负责人 (Manager)</label>
                            <select value={deptFormData.managerId} onChange={e => setDeptFormData({...deptFormData, managerId: e.target.value})} className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-hytzer-blue">
                                <option value="">-- 选择负责人 --</option>
                                {users
                                  .filter(u => editingNode ? (u.departmentId === editingNode.id || (!u.departmentId && u.department === editingNode.name)) : true)
                                  .map(u => <option key={u.id} value={u.id}>{u.name} ({u.jobTitle || '无职位'})</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button type="button" onClick={() => setShowDeptModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">取消</button>
                            <button type="submit" className="px-4 py-2 bg-hytzer-blue text-white rounded hover:bg-blue-600">保存</button>
                        </div>
                    </form>
                </div>
           </div>
        )}

        {/* Modal: 添加成员 (保持不变) */}
        {showMemberModal && targetDeptForMember && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm animate-fade-in p-3 md:p-0">
                <div className="bg-white rounded-xl p-4 md:p-6 w-full max-w-md shadow-2xl max-h-[95vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-xl text-slate-800">添加成员</h3>
                            <p className="text-sm text-slate-500">添加到：<span className="font-bold text-hytzer-blue">{targetDeptForMember.name}</span></p>
                        </div>
                        <button onClick={() => setShowMemberModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700">选择用户</label>
                        <div className="border rounded-lg max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {users
                                .filter(u => u.departmentId !== targetDeptForMember.id)
                                .map(u => (
                                    <div 
                                        key={u.id}
                                        onClick={() => setSelectedUserId(u.id)}
                                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                                            selectedUserId === u.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                                        }`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 overflow-hidden shrink-0">
                                            {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : u.name[0]}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">{u.name}</div>
                                            <div className="text-xs text-slate-400">
                                                {u.department || '未分配'} · {u.jobTitle || '无职位'}
                                            </div>
                                        </div>
                                        {selectedUserId === u.id && <BadgeCheck className="ml-auto text-hytzer-blue" size={18}/>}
                                    </div>
                                ))
                            }
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                            <button onClick={() => setShowMemberModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">取消</button>
                            <button onClick={handleAddMember} disabled={!selectedUserId} className={`px-4 py-2 rounded text-white ${selectedUserId ? 'bg-green-600' : 'bg-slate-300'}`}>确认添加</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

            {/* 🟢 员工部门调整弹窗 */}
            {showUserDeptModal && adjustingUser && (
                <PeopleSelector
                    isOpen={showUserDeptModal}
                    onClose={() => {
                        setShowUserDeptModal(false);
                        setAdjustingUser(null);
                    }}
                    mode="dept"
                    onConfirm={(selection) => {
                        if (Array.isArray(selection) && selection.length > 0) {
                            // @ts-ignore
                            handleUserDeptSelect(selection[0].id, selection[0].name);
                        }
                        setShowUserDeptModal(false);
                    }}
                    title="选择目标部门"
                />
            )}

            {/* 🟢 员工信息编辑弹窗 */}
            {showEditUserModal && editingUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-3 md:p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-4 md:p-6 shadow-2xl animate-fade-in max-h-[95vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-6 text-slate-900 flex items-center gap-2">
                            <Edit2 size={20} className="text-hytzer-blue"/> 
                            编辑用户: {editingUser.name}
                        </h3>
                        <form onSubmit={handleSaveEditUser} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                                    <input name="name" type="text" required defaultValue={editingUser.name} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">登录账号</label>
                                    <input name="username" type="text" required defaultValue={editingUser.username} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue transition-all" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">部门</label>
                                <input name="department" type="text" required defaultValue={editingUser.department} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue transition-all" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                                    <Briefcase size={14} className="text-slate-400"/> 职务
                                </label>
                                <input name="jobTitle" type="text" defaultValue={editingUser.jobTitle || ''} placeholder="例如：EHS工程师" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue transition-all" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">头像 URL (可选)</label>
                                <input name="avatar" type="text" defaultValue={editingUser.avatar || ''} placeholder="https://..." className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue transition-all" />
                            </div>
                            
                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => { setShowEditUserModal(false); setEditingUser(null); }} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">取消</button>
                                <button type="submit" className="px-5 py-2 bg-hytzer-blue text-white rounded-lg hover:bg-blue-600 shadow-lg shadow-blue-500/30 font-medium transition-colors">保存修改</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 🟢 导入指南模态框 */}
            {showImportGuide && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-2 md:p-4">
                <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl">
                  <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <HelpCircle className="text-purple-600" size={24} />
                      <h2 className="text-2xl font-bold text-slate-900">组织架构批量导入指南</h2>
                    </div>
                    <button onClick={() => setShowImportGuide(false)} className="p-2 hover:bg-slate-100 rounded-full">
                      <X size={20} />
                    </button>
                  </div>
            
                  <div className="p-6 space-y-6 text-slate-700">
                    {/* 格式说明 */}
                    <section>
                      <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <FileSpreadsheet size={20} className="text-blue-600" />
                        CSV格式说明
                      </h3>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p className="font-mono text-sm mb-2 text-slate-600">标题行（必须）：</p>
                        <code className="block bg-white p-2 rounded border text-sm">
                          部门路径,负责人账号,负责人姓名
                        </code>
                      </div>
                    </section>

                    {/* 示例 */}
                    <section>
                      <h3 className="text-lg font-bold text-slate-900 mb-3">� 示例数据</h3>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 overflow-x-auto">
                        <pre className="text-sm font-mono whitespace-pre">
      {`XX新能源科技有限公司,admin,超级管理员
      XX新能源科技有限公司/EHS部,,,
      XX新能源科技有限公司/EHS部/安全组,,,
      XX新能源科技有限公司/EHS部/环保组,,,
      XX新能源科技有限公司/生产部,,,
      XX新能源科技有限公司/生产部/生产一车间,,,
      XX新能源科技有限公司/生产部/生产二车间,,,`}
                        </pre>
                      </div>
                    </section>

                    {/* 字段说明 */}
                    <section>
                      <h3 className="text-lg font-bold text-slate-900 mb-3">�🔍 字段说明</h3>
                      <div className="space-y-3">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                          <h4 className="font-bold text-blue-900 mb-2">1. 部门路径（必填）</h4>
                          <ul className="text-sm space-y-1 text-blue-800">
                            <li>• 使用 <code className="bg-white px-1 rounded">/</code> 分隔各层级</li>
                            <li>• 必须从根部门开始的完整路径</li>
                            <li>• 示例：<code className="bg-white px-1 rounded">华泰科技/生产部/生产一车间</code></li>
                          </ul>
                        </div>
                  
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                          <h4 className="font-bold text-green-900 mb-2">2. 负责人账号（可选）</h4>
                          <ul className="text-sm space-y-1 text-green-800">
                            <li>• 用户的登录账号</li>
                            <li>• 必须是已存在的用户</li>
                            <li>• 留空表示暂不设置负责人</li>
                          </ul>
                        </div>
                  
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                          <h4 className="font-bold text-purple-900 mb-2">3. 负责人姓名（可选）</h4>
                          <ul className="text-sm space-y-1 text-purple-800">
                            <li>• 仅作参考显示</li>
                            <li>• 实际以账号为准</li>
                          </ul>
                        </div>
                      </div>
                    </section>

                    {/* 使用步骤 */}
                    <section>
                      <h3 className="text-lg font-bold text-slate-900 mb-3">🚀 使用步骤</h3>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                          <p>准备CSV文件（使用Excel或文本编辑器）</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                          <p>编辑组织架构，使用路径格式表达层级关系</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                          <p>保存为 UTF-8 编码的 CSV 文件</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                          <p>点击 <span className="font-bold text-green-700">【批量导入】</span> 按钮上传</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
                          <p>系统自动解析并创建，查看导入报告</p>
                        </div>
                      </div>
                    </section>

                    {/* 导入规则 */}
                    <section>
                      <h3 className="text-lg font-bold text-slate-900 mb-3">✅ 导入规则</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 p-3 rounded border border-green-200">
                          <p className="text-sm text-green-800">✅ 自动创建层级</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded border border-green-200">
                          <p className="text-sm text-green-800">✅ 智能排序（父部门优先）</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded border border-green-200">
                          <p className="text-sm text-green-800">✅ 去重处理</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded border border-green-200">
                          <p className="text-sm text-green-800">✅ 支持增量导入</p>
                        </div>
                      </div>
                    </section>

                    {/* 注意事项 */}
                    <section>
                      <h3 className="text-lg font-bold text-slate-900 mb-3">⚠️ 注意事项</h3>
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 space-y-2">
                        <p className="text-sm text-amber-900"><strong>编码：</strong>必须使用 UTF-8 编码，否则中文会乱码</p>
                        <p className="text-sm text-amber-900"><strong>路径：</strong>必须从根部门开始的完整路径</p>
                        <p className="text-sm text-amber-900"><strong>负责人：</strong>账号必须已存在，否则跳过但继续创建部门</p>
                        <p className="text-sm text-amber-900"><strong>备份：</strong>导入前建议先【导出架构】备份</p>
                      </div>
                    </section>

                    {/* 示例效果 */}
                    <section>
                      <h3 className="text-lg font-bold text-slate-900 mb-3">🌳 导入效果预览</h3>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-600 mb-2">导入上述示例后将生成：</p>
                        <pre className="text-sm font-mono text-slate-700">
      {`XX新能源科技有限公司
      ├── EHS部
      │   ├── 安全组
      │   └── 环保组
      └── 生产部
          ├── 生产一车间
          └── 生产二车间`}
                        </pre>
                      </div>
                    </section>

                    {/* 快速操作 */}
                    <section className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-3">💡 快速操作</h3>
                      <div className="space-y-2 text-sm">
                        <p>• <strong>获取模板：</strong>点击【导出架构】查看现有格式</p>
                        <p>• <strong>Excel编辑：</strong>在Excel中编辑更方便</p>
                        <p>• <strong>分批导入：</strong>可多次导入补充完善</p>
                      </div>
                    </section>
                  </div>

                  <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-4 flex justify-end">
                    <button 
                      onClick={() => setShowImportGuide(false)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                      我知道了
                    </button>
                  </div>
                </div>
              </div>
            )}
    </div>
  );
}
