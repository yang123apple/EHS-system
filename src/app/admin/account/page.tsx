"use client";
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import jschardet from 'jschardet';
import { parseTableFile, pick } from '@/utils/fileImport';
import { flattenDepartments, matchDepartment } from '@/utils/departmentUtils';
import * as XLSX from 'xlsx';
// 引入 GitFork 图标用于表示汇报关系
import { Trash2, UserPlus, Settings, Search, Filter, Edit, UploadCloud, User as UserIcon, Briefcase, GitFork, FileSpreadsheet, Download, Shield } from 'lucide-react';
import Link from 'next/link';
import BatchPermissionModal from './_components/BatchPermissionModal';
import PeopleSelector from '@/components/common/PeopleSelector';
import { apiFetch } from '@/lib/apiClient';

interface User {
  id: string;
  username: string;
  name: string;
  department: string;
  jobTitle?: string;
  // 🟢 1. 新增：直属上级 ID (可选)
  directManagerId?: string;
  avatar?: string;
  permissions?: Record<string, string[]>;
  isActive?: boolean; // 在职状态：true=在职，false=离职
}

export default function AccountManagement() {
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0); // 🟢 在职人数统计
  const limit = 20;

  // 🟢 新增：部门列表用于匹配 departmentId
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptNameToId, setDeptNameToId] = useState<Map<string, string>>(new Map());

  // 新增用户状态
  const [newUser, setNewUser] = useState({ username: '', name: '', department: '', departmentId: '', jobTitle: '', password: '123' });

  // 筛选状态
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [allDepts, setAllDepts] = useState<string[]>([]);
  const [showDeptSelector, setShowDeptSelector] = useState(false);
  
  // 🟢 新增用户时的部门选择弹窗
  const [showNewUserDeptSelector, setShowNewUserDeptSelector] = useState(false);

  // 编辑弹窗状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // 批量权限管理状态
  const [showBatchPermissionModal, setShowBatchPermissionModal] = useState(false);
  const [allUsersForBatch, setAllUsersForBatch] = useState<User[]>([]);
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 权限检查
    if (!currentUser) {
      // 用户未登录，不执行加载
      return;
    }
    if (currentUser.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    loadUsers(currentPage);
  }, [currentUser, currentPage]);

  // 🟢 获取在职人数统计（排除离职人员和admin）
  const loadActiveUsersCount = async (filters: { term: string, dept: string } = { term: searchTerm, dept: deptFilter }) => {
    try {
      // 获取所有用户（不分页）用于统计
      const queryParams = new URLSearchParams({
        limit: '9999' // 获取所有用户
      });
      if (filters.term) {
        queryParams.append('q', filters.term);
      }
      if (filters.dept) {
        queryParams.append('dept', filters.dept);
      }

      const res = await apiFetch(`/api/users?${queryParams.toString()}`);
      if (!res.ok) return;

      const data = await res.json();
      let allUsers = [];
      
      if (Array.isArray(data)) {
        allUsers = data;
      } else if (data && Array.isArray(data.data)) {
        allUsers = data.data;
      }

      // 计算在职人数：排除admin和离职人员
      const activeCount = allUsers.filter((u: any) => 
        u.username !== 'admin' && (u.isActive !== false)
      ).length;
      
      setActiveUsersCount(activeCount);
    } catch (e) {
      console.error('获取在职人数统计失败:', e);
    }
  };

  const loadUsers = async (page: number, filters: { term: string, dept: string } = { term: searchTerm, dept: deptFilter }) => {
    // 如果用户未登录，不执行请求
    if (!currentUser) {
      return;
    }

    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        q: filters.term,
        dept: filters.dept
      });

      const [usersRes, deptsRes] = await Promise.all([
        apiFetch(`/api/users?${queryParams.toString()}`),
        apiFetch('/api/org')
      ]);

      // 检查响应状态
      if (!usersRes.ok) {
        const errorData = await usersRes.json().catch(() => ({ error: '请求失败' }));

        // 如果是 401 且用户已退出登录，静默处理
        if (usersRes.status === 401 && !currentUser) {
          console.debug('用户已退出登录，忽略加载用户请求');
          return;
        }

        console.error('加载用户失败:', errorData);
        alert(errorData.error || '加载用户列表失败');
        return;
      }

      const usersData = await usersRes.json();
      let validUsers = [];

      // 检查返回数据的格式
      if (Array.isArray(usersData)) {
        // 非分页模式：直接返回数组
        validUsers = usersData.filter((u: any) => u.username !== 'admin');
        setTotalPages(1);
        setTotalUsers(validUsers.length);
      } else if (usersData && Array.isArray(usersData.data)) {
        // 分页模式：返回 { data: [...], meta: {...} }
        validUsers = usersData.data.filter((u: any) => u.username !== 'admin');
        setTotalPages(usersData.meta?.totalPages || 1);
        setTotalUsers(usersData.meta?.total || validUsers.length);
      } else {
        // 未知格式或错误响应
        console.error('意外的API响应格式:', usersData);
        validUsers = [];
        setTotalPages(1);
        setTotalUsers(0);
      }

      setUsers(validUsers);

      // 🟢 计算在职人数（排除离职人员和admin）
      await loadActiveUsersCount(filters);

      // 🟢 加载部门列表
      if (!deptsRes.ok) {
        console.error('加载部门列表失败');
        setDepartments([]);
        setDeptNameToId(new Map());
        setAllDepts([]);
      } else {
        const deptsData = await deptsRes.json();

        // 确保 deptsData 是数组
        const departmentsArray = Array.isArray(deptsData) ? deptsData : [];
        setDepartments(departmentsArray);

        // 🟢 创建部门名称到ID的映射
        const mapping = new Map<string, string>();
        const flattenDepts = (nodes: any[]): void => {
          if (!Array.isArray(nodes)) return;
          nodes.forEach(node => {
            if (node && node.name && node.id) {
              mapping.set(node.name, node.id);
              if (node.children && Array.isArray(node.children) && node.children.length > 0) {
                flattenDepts(node.children);
              }
            }
          });
        };
        flattenDepts(departmentsArray);
        setDeptNameToId(mapping);

        // We might want to fetch all depts just for the filter dropdown,
        // but for now let's just use what's on the page + full org tree names if needed
        // Ideally we should have an API for "all unique department names" or just use the org tree
        const allDeptNames = Array.from(mapping.keys());
        setAllDepts(allDeptNames);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🟢 检查是否选择了部门
    if (!newUser.departmentId || !newUser.department) {
      alert('请选择部门');
      return;
    }

    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUser.username,
          name: newUser.name,
          jobTitle: newUser.jobTitle,
          password: newUser.password,
          departmentId: newUser.departmentId // 🟢 直接使用选择的部门ID
        })
      });

      if (res.ok) {
        alert('用户创建成功');
        setNewUser({ username: '', name: '', department: '', departmentId: '', jobTitle: '', password: '123' });
        loadUsers(currentPage);
      } else {
        const err = await res.json();
        alert(err.error || '创建失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('确定删除该用户？\\n\\n注意：用户的隐患上报记录、培训记录等将被清除或标记为已删除。')) {
      try {
        const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
          alert('用户删除成功');
          loadUsers(currentPage);
        } else {
          const data = await res.json();
          alert(`删除失败：${data.error || '未知错误'}`);
        }
      } catch (e) {
        alert('网络错误，请重试');
      }
    }
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    alert(`检测到 ${files.length} 个文件，此处需对接实际上传接口。`);
  };

  // 🟢 Excel导出功能（XLSX格式）- 导出所有用户
  const handleExportExcel = async () => {
    try {
      // 获取所有用户数据（不使用分页）
      const queryParams = new URLSearchParams({
        limit: '9999', // 设置一个足够大的limit以获取所有用户
        q: searchTerm, // 保留当前搜索条件
        dept: deptFilter // 保留当前部门筛选条件
      });

      const res = await apiFetch(`/api/users?${queryParams.toString()}`);
      if (!res.ok) {
        alert('获取用户数据失败，请重试');
        return;
      }

      const data = await res.json();
      let allUsers: User[] = [];
      
      if (Array.isArray(data)) {
        allUsers = data.filter((u: any) => u.username !== 'admin');
      } else if (data && Array.isArray(data.data)) {
        allUsers = data.data.filter((u: any) => u.username !== 'admin');
      }

      if (allUsers.length === 0) {
        alert('没有可导出的用户数据');
        return;
      }

      // 创建用户ID到姓名的映射，用于查找直属上级姓名
      const userIdToName = new Map<string, string>();
      allUsers.forEach(u => {
        userIdToName.set(u.id, u.name);
      });

      // 辅助函数：根据ID获取用户姓名（从所有用户中查找）
      const getUserNameFromAll = (id?: string) => {
        if (!id) return '-';
        return userIdToName.get(id) || '未知ID';
      };

      const headers = ['ID', '登录账号', '姓名', '部门', '职务', '直属上级', '在职状态'];
      const rows = allUsers.map(u => [
        u.id,
        u.username,
        u.name,
        u.department,
        u.jobTitle || '',
        getUserNameFromAll(u.directManagerId),
        u.isActive !== false ? '在职' : '离职'
      ]);

      // 创建工作簿
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '用户列表');

      // 下载文件
      XLSX.writeFile(wb, `用户列表_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    } catch (error) {
      console.error('导出Excel失败:', error);
      alert('导出失败，请重试');
    }
  };

  // 🟢 Excel导入功能
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseTableFile(file);
      const rows = parsed.objects;
      if (!rows || rows.length === 0) {
        alert('❌ 文件中没有可用数据');
        return;
      }

      // 🟢 获取所有部门信息以匹配 departmentId
      let departments: any[] = [];
      try {
        const deptRes = await apiFetch('/api/org');
        departments = await deptRes.json();
      } catch {
        console.warn('无法加载部门列表，将只使用部门名称');
      }

      // 🟢 创建部门名称到ID的映射
      const flat = flattenDepartments(departments);

      const importedUsers = [];
      const parseErrors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // 读取ID（如果存在，导入新用户时不会使用，但保留兼容性）
        const userId = pick(row, ['ID', 'id', '用户ID', '人员ID']);
        const username = pick(row, ['登录账号', '账号', '用户名', '工号']);
        const name = pick(row, ['姓名', '名称', '员工姓名']);
        const department = pick(row, ['部门路径', '部门', '部门名称', '所属部门']);
        const jobTitle = pick(row, ['职务', '职位', '岗位', '岗位名称']);
        const isActiveStr = pick(row, ['在职状态', '状态', '是否在职']);

        if (!username) { parseErrors.push(`第 ${i + 2} 行：缺少登录账号`); continue; }
        if (!name) { parseErrors.push(`第 ${i + 2} 行：缺少姓名`); continue; }
        if (!department) { parseErrors.push(`第 ${i + 2} 行：缺少部门`); continue; }
        
        // 🟢 解析在职状态：默认为在职（true）
        let isActive = true;
        if (isActiveStr) {
          const lowerStr = String(isActiveStr).toLowerCase().trim();
          isActive = !(lowerStr === '离职' || lowerStr === 'false' || lowerStr === '否' || lowerStr === '0');
        }

        // 🟢 层级路径/名称匹配 + 模糊搜索
        const matched = matchDepartment(flat, department);
        const departmentId = matched.id;
        if (!departmentId) {
          if (matched.suggestions && matched.suggestions.length > 0) {
            const tips = matched.suggestions.map(s => `${s.path}`).slice(0, 3).join('；');
            parseErrors.push(`第 ${i + 2} 行：未找到部门 "${department}"。可能是以下之一：${tips}`);
          } else {
            parseErrors.push(`第 ${i + 2} 行：部门 "${department}" 在组织架构中不存在`);
          }
        }

        importedUsers.push({
          username,
          name,
          department: matched.name || department,
          departmentId: departmentId || undefined, // 🟢 添加 departmentId
          jobTitle: jobTitle || '',
          password: '123',
          isActive: isActive // 🟢 添加在职状态
        });
      }

      if (parseErrors.length > 0) {
        const message = `⚠️ 解析时发现 ${parseErrors.length} 个问题：\n\n${parseErrors.slice(0, 5).join('\n')}${parseErrors.length > 5 ? `\n... 还有 ${parseErrors.length - 5} 个问题` : ''}\n\n${importedUsers.length > 0 ? '部分用户可继续导入，但未匹配部门的用户不会显示在组织架构中。' : ''}`;
        alert(message);
      }

      if (importedUsers.length === 0) {
        alert('❌ 没有可导入的有效数据\n\n请检查文件格式是否正确');
        return;
      }

      // 🟢 异步获取所有用户数据以检查重复（而非仅当前页）
      let allExistingUsers: User[] = [];
      try {
        const allUsersRes = await apiFetch('/api/users?limit=9999');
        if (allUsersRes.ok) {
          const allUsersData = await allUsersRes.json();
          if (Array.isArray(allUsersData)) {
            allExistingUsers = allUsersData.filter((u: any) => u.username !== 'admin');
          } else if (allUsersData && Array.isArray(allUsersData.data)) {
            allExistingUsers = allUsersData.data.filter((u: any) => u.username !== 'admin');
          }
        }
      } catch (error) {
        console.error('获取所有用户数据失败:', error);
        alert('⚠️ 无法检查已存在的用户，将跳过重复检测');
      }

      // 🟢 检查已存在的登录账号并自动去重（使用所有用户数据）
      const existingUsernames = new Set(allExistingUsers.map(u => u.username));
      const newUsers = importedUsers.filter(u => !existingUsernames.has(u.username));
      const duplicateUsers = importedUsers.filter(u => existingUsernames.has(u.username));
      const duplicateCount = duplicateUsers.length;

      if (newUsers.length === 0) {
        alert(`⚠️ 所有 ${importedUsers.length} 个用户的登录账号都已存在，无需导入\n\n已存在的用户：\n${duplicateUsers.slice(0, 5).map(u => `• ${u.username} (${u.name})`).join('\n')}${duplicateCount > 5 ? `\n... 还有 ${duplicateCount - 5} 个` : ''}`);
        return;
      }

      // 构建确认消息
      let confirmMessage = `✅ 共解析出 ${importedUsers.length} 个有效用户\n`;
      if (duplicateCount > 0) {
        confirmMessage += `📌 其中 ${duplicateCount} 个登录账号已存在（已自动去除）\n`;
        confirmMessage += `   已存在: ${duplicateUsers.slice(0, 3).map(u => u.username).join(', ')}${duplicateCount > 3 ? '...' : ''}\n`;
      }
      confirmMessage += `➕ 将导入 ${newUsers.length} 个新用户\n`;
      if (parseErrors.length > 0) {
        confirmMessage += `⚠️ 解析问题: ${parseErrors.length} 条\n`;
      }
      confirmMessage += `\n是否继续导入？`;

      // 批量创建用户
      if (confirm(confirmMessage)) {
        let successCount = 0;
        const failedUsers: Array<{ user: any, reason: string }> = [];

        for (const user of newUsers) {
          try {
            const res = await apiFetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(user)
            });

            if (res.ok) {
              successCount++;
            } else {
              const errorData = await res.json();
              failedUsers.push({
                user,
                reason: errorData.error || '未知错误'
              });
            }
          } catch (error) {
            failedUsers.push({
              user,
              reason: '网络错误'
            });
          }
        }

        // 生成详细报告
        let message = `📊 导入完成！\n\n✅ 成功创建: ${successCount}\n❌ 失败: ${failedUsers.length}`;
        if (duplicateCount > 0) {
          message += `\n🔄 已存在(跳过): ${duplicateCount}`;
        }

        if (failedUsers.length > 0) {
          message += '\n\n失败详情：\n';
          failedUsers.slice(0, 5).forEach(({ user, reason }) => {
            message += `• ${user.username} (${user.name}): ${reason}\n`;
          });
          if (failedUsers.length > 5) {
            message += `... 还有 ${failedUsers.length - 5} 条失败记录`;
          }
        }

        alert(message);
        loadUsers(currentPage);
      }
    } catch (error) {
      console.error(error);
      alert('❌ 文件解析失败\n\n建议：使用UTF-8编码的CSV或Excel的XLSX文件');
    }
    e.target.value = ''; // 重置输入
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;

    const formData = new FormData(e.currentTarget);

    // 将 FormData 转换为 JSON 对象以支持 PUT 请求
    const payload: any = {};
    formData.forEach((value, key) => {
      if (key !== 'avatarFile') {
        // 🟢 处理 isActive 字段：将字符串转换为布尔值
        if (key === 'isActive') {
          payload[key] = value === 'true';
        } else {
          payload[key] = value;
        }
      }
    });

    try {
      const res = await apiFetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('修改成功');
        setShowEditModal(false);
        loadUsers(currentPage);
      } else {
        alert('修改失败');
      }
    } catch (err) {
      alert('网络错误');
    }
  };

  // 🟢 重置密码函数
  const handleResetPassword = async (userId: string, userName: string) => {
    if (!confirm(`确定要重置 ${userName} 的密码吗？\n\n密码将被重置为默认密码: 123`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        alert(`${userName} 的密码已重置为: 123`);
      } else {
        const data = await res.json();
        alert(data.error || '重置密码失败');
      }
    } catch (err) {
      console.error(err);
      alert('网络错误');
    }
  };

  // 辅助函数：根据ID获取用户姓名
  const getUserName = (id?: string) => {
    if (!id) return '-';
    const u = users.find(x => x.id === id);
    return u ? u.name : '未知ID';
  };

  // No client-side filtering needed now, use 'users' directly
  const filteredUsers = users;

  // 加载所有用户用于批量权限管理
  const loadAllUsersForBatch = async () => {
    setIsLoadingAllUsers(true);
    try {
      // 不使用分页，获取所有用户
      const res = await apiFetch('/api/users?limit=9999');
      const data = await res.json();

      let allUsers = [];
      if (data.data) {
        allUsers = data.data.filter((u: any) => u.username !== 'admin');
      } else {
        allUsers = data.filter((u: any) => u.username !== 'admin');
      }

      setAllUsersForBatch(allUsers);
      setShowBatchPermissionModal(true);
    } catch (error) {
      console.error('加载全部用户失败:', error);
      alert('加载用户列表失败，请重试');
    } finally {
      setIsLoadingAllUsers(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      loadUsers(1, { term: searchTerm, dept: deptFilter });
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm, deptFilter]);

  if (isLoading) return <div className="p-8 text-center text-slate-500">加载中...</div>;

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto pb-10 px-3 md:px-0">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-slate-900">账户管理</h1>
          <p className="text-slate-500 mt-1 text-xs md:text-sm">新增用户、批量管理头像与权限配置</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
        {/* 左侧：新增表单 */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 h-fit space-y-4 md:space-y-6 lg:sticky lg:top-24">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <UserPlus className="text-hytzer-blue" size={20} />
              <h2 className="text-lg font-bold text-slate-800">新增账号</h2>
            </div>
            <form onSubmit={handleAddUser} className="space-y-3 md:space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">登录账号</label>
                <input type="text" required value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-hytzer-blue" placeholder="wang.xm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">姓名</label>
                <input type="text" required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-hytzer-blue" placeholder="真实姓名" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">部门</label>
                <button
                  type="button"
                  onClick={() => setShowNewUserDeptSelector(true)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm text-left outline-none focus:ring-2 focus:ring-hytzer-blue transition-colors ${
                    newUser.department 
                      ? 'bg-white border-slate-300 hover:border-hytzer-blue' 
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {newUser.department || '点击选择部门'}
                </button>
                {newUser.department && (
                  <button
                    type="button"
                    onClick={() => setNewUser({ ...newUser, department: '', departmentId: '' })}
                    className="mt-1 text-xs text-red-500 hover:text-red-700"
                  >
                    清除选择
                  </button>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                  <Briefcase size={12} className="text-slate-400" /> 职务
                </label>
                <input type="text" value={newUser.jobTitle} onChange={e => setNewUser({ ...newUser, jobTitle: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-hytzer-blue" placeholder="例如：EHS工程师" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">初始密码</label>
                <input type="text" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50" />
              </div>
              <button type="submit" className="w-full bg-hytzer-blue text-white py-2 rounded-lg hover:bg-blue-600 font-medium text-sm transition-colors shadow-lg shadow-blue-500/30">立即创建</button>
            </form>
          </div>

          {/* 批量上传 */}
          <div className="pt-4 md:pt-6 border-t border-slate-100 space-y-2 md:space-y-3">
            <button onClick={() => folderInputRef.current?.click()} className="w-full border border-purple-200 text-purple-700 bg-white hover:bg-purple-50 py-2 rounded-lg font-medium text-xs md:text-sm transition-colors flex items-center justify-center gap-2">
              <UploadCloud size={14} className="md:hidden" /><UploadCloud size={16} className="hidden md:block" /> 选择头像文件夹
            </button>
            <input type="file" ref={folderInputRef} className="hidden"
              // @ts-ignore
              webkitdirectory="" directory="" multiple onChange={handleBatchUpload} />
            <p className="text-xs text-slate-400 text-center">支持批量上传，文件名需包含用户ID</p>

            {/* 🟢 Excel导入导出 */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <label className="w-full border border-green-200 text-green-700 bg-white hover:bg-green-50 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <FileSpreadsheet size={16} /> 导入 Excel
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImportExcel} />
              </label>
              <button onClick={handleExportExcel} className="w-full border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2">
                <Download size={16} /> 导出 Excel
              </button>
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                格式：ID,登录账号,姓名,部门,职务,在职状态<br />
                在职状态：在职/离职（留空默认为在职）
              </p>
            </div>
          </div>
        </div>

        {/* 右侧：用户列表 */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px] md:min-h-[600px]">
          {/* 搜索栏 */}
          <div className="p-3 md:p-4 border-b border-slate-100 bg-slate-50/50 space-y-2 md:space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h2 className="text-base md:text-lg font-bold text-slate-800">
                  用户列表
                </h2>
                <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 text-xs md:text-sm font-medium">
                  {deptFilter 
                    ? `该部门在职人数${activeUsersCount}人` 
                    : `在职人数${activeUsersCount}人`}
                </div>
              </div>
              <button
                onClick={loadAllUsersForBatch}
                disabled={isLoadingAllUsers}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Shield size={16} />
                {isLoadingAllUsers ? '加载中...' : '批量管理权限'}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="text" placeholder="搜索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-7 md:pl-9 pr-3 md:pr-4 py-1.5 md:py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm outline-none focus:ring-2 focus:ring-hytzer-blue" />
              </div>
              <div className="relative w-full sm:w-40">
                <Filter className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" size={14} />
                <button
                  type="button"
                  onClick={() => setShowDeptSelector(true)}
                  className="w-full pl-7 md:pl-9 pr-3 md:pr-4 py-1.5 md:py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm outline-none cursor-pointer hover:bg-slate-50 text-left flex items-center justify-between"
                >
                  <span className="truncate">{deptFilter || '所有部门'}</span>
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm min-w-[640px]">
              <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-3 md:px-6 py-2 md:py-4 font-semibold">基本信息</th>
                  <th className="px-3 md:px-6 py-2 md:py-4 font-semibold">职务 & 汇报线</th>
                  <th className="px-3 md:px-6 py-2 md:py-4 font-semibold">在职状态</th>
                  <th className="px-3 md:px-6 py-2 md:py-4 font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-3 md:px-6 py-2 md:py-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-100 shrink-0">
                          {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><UserIcon size={20} /></div>}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-slate-500 text-xs flex items-center gap-1">
                            <span className="bg-slate-100 px-1 rounded">{u.username}</span>
                            <span>·</span>
                            <span>{u.department}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {/* 职务显示 */}
                        {u.jobTitle ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            <Briefcase size={10} /> {u.jobTitle}
                          </span>
                        ) : <span className="text-slate-300 text-xs italic">未设置职务</span>}

                        {/* 🟢 2. 直属上级显示 */}
                        {u.directManagerId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100" title="直属上级">
                            <GitFork size={10} /> 汇报给: {getUserName(u.directManagerId)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 pl-1">遵循部门汇报线</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {/* 🟢 在职状态显示 */}
                      {u.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span> 在职
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span> 离职
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Link href={`/admin/account/${u.id}`} className="p-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors" title="配置权限">
                          <Settings size={14} />
                        </Link>
                        <button onClick={() => { setEditingUser(u); setShowEditModal(true); }} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" title="编辑信息">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDeleteUser(u.id)} className="p-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors" title="删除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">未找到匹配用户</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-100 flex justify-center items-center gap-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50"
            >
              上一页
            </button>
            <span className="text-sm text-slate-600">第 {currentPage} 页 / 共 {totalPages} 页</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* Edit User Modal (单人编辑弹窗) */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-3 md:p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-4 md:p-6 shadow-2xl animate-fade-in max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6 text-slate-900 flex items-center gap-2">
              <Edit size={20} className="text-hytzer-blue" />
              编辑用户: {editingUser.name}
            </h3>
            <form onSubmit={handleSaveEdit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                  <input name="name" type="text" required defaultValue={editingUser.name} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">部门</label>
                  <input name="department" type="text" required defaultValue={editingUser.department} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Briefcase size={14} className="text-slate-400" /> 职务
                </label>
                <input name="jobTitle" type="text" defaultValue={editingUser.jobTitle || ''} placeholder="例如：EHS工程师" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue transition-all" />
              </div>

              {/* 🟢 3. 直属上级选择器 */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <GitFork size={14} className="text-green-600" /> 直属上级 (Direct Manager)
                </label>
                <select
                  name="directManagerId"
                  defaultValue={editingUser.directManagerId || ''}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue bg-white transition-all cursor-pointer"
                >
                  <option value="">-- 默认 (遵循部门架构) --</option>
                  {users
                    .filter(u => u.id !== editingUser.id) // 不能选自己
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} - {u.department} {u.jobTitle ? `(${u.jobTitle})` : ''}
                      </option>
                    ))
                  }
                </select>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  <span className="text-orange-500 font-bold">注意：</span>
                  设置后，审批流将优先汇报给此人。若留空，则自动按部门组织架构向上查找负责人。
                </p>
              </div>

              {/* 🟢 4. 在职状态选择 */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                  <UserIcon size={14} className="text-blue-600" /> 在职状态
                </label>
                <select
                  name="isActive"
                  defaultValue={editingUser.isActive !== false ? 'true' : 'false'}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue bg-white transition-all cursor-pointer"
                >
                  <option value="true">在职</option>
                  <option value="false">离职</option>
                </select>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  <span className="text-orange-500 font-bold">注意：</span>
                  离职状态的用户将无法登录系统。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">头像 (可选)</label>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                    {editingUser.avatar ? <img src={editingUser.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><UserIcon /></div>}
                  </div>
                  <input name="avatarFile" type="file" accept="image/*" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                </div>
              </div>

              {/* 🟢 重置密码按钮 */}
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                <label className="block text-sm font-medium text-orange-700 mb-2">重置密码</label>
                <button
                  type="button"
                  onClick={() => handleResetPassword(editingUser.id, editingUser.name)}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                >
                  重置密码为默认密码 (123)
                </button>
                <p className="text-xs text-orange-600 mt-2">
                  ⚠️ 此操作将立即生效，用户下次登录需使用密码 "123"
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">取消</button>
                <button type="submit" className="px-5 py-2 bg-hytzer-blue text-white rounded-lg hover:bg-blue-600 shadow-lg shadow-blue-500/30 font-medium transition-colors">保存修改</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 批量权限管理弹窗 */}
      <BatchPermissionModal
        isOpen={showBatchPermissionModal}
        onClose={() => setShowBatchPermissionModal(false)}
        allUsers={allUsersForBatch}
        onSuccess={() => {
          setShowBatchPermissionModal(false);
          loadUsers(currentPage);
        }}
      />

      {/* 部门选择弹窗（用于筛选） */}
      <PeopleSelector
        isOpen={showDeptSelector}
        onClose={() => setShowDeptSelector(false)}
        onConfirm={(selection) => {
          if (Array.isArray(selection) && selection.length > 0) {
            // @ts-ignore
            const dept = selection[0];
            setDeptFilter(dept.name);
          } else {
            setDeptFilter('');
          }
          setShowDeptSelector(false);
        }}
        mode="dept"
        multiSelect={false}
        title="选择部门"
      />

      {/* 🟢 新增用户时的部门选择弹窗 */}
      <PeopleSelector
        isOpen={showNewUserDeptSelector}
        onClose={() => setShowNewUserDeptSelector(false)}
        onConfirm={(selection) => {
          if (Array.isArray(selection) && selection.length > 0) {
            // @ts-ignore
            const dept = selection[0];
            setNewUser({ ...newUser, department: dept.name, departmentId: dept.id });
          }
          setShowNewUserDeptSelector(false);
        }}
        mode="dept"
        multiSelect={false}
        title="选择部门"
      />
    </div>
  );
}
