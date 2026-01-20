import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronDown, Briefcase, Check, Search, User as UserIcon, Building2, Users } from 'lucide-react';
import { User } from '@prisma/client';
import { apiFetch } from '@/lib/apiClient';

export type SelectorMode = 'user' | 'dept' | 'dept_then_user';
export type ViewMode = 'list' | 'grid'; // 🟢 新增：视图模式

interface OrgNode {
  id: string;
  name: string;
  parentId: string | null;
  children?: OrgNode[];
}

interface UserLite {
    id: string;
    name: string;
    jobTitle?: string | null;
    departmentId?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: UserLite[] | OrgNode[]) => void;
  mode: SelectorMode;
  multiSelect?: boolean;
  title?: string;
  activeUsersOnly?: boolean; // 是否只显示在职人员，默认为 true
  viewMode?: ViewMode; // 🟢 新增：视图模式 ('list' 或 'grid')
  showDeptTree?: boolean; // 🟢 新增：是否显示左侧部门树，默认 true
  initialDeptId?: string; // 🟢 新增：初始部门ID（用于网格视图）
}

export default function PeopleSelector({ 
  isOpen, 
  onClose, 
  onConfirm, 
  mode, 
  multiSelect = false, 
  title, 
  activeUsersOnly = true,
  viewMode = 'list', // 🟢 默认为列表视图
  showDeptTree = true, // 🟢 默认显示部门树
  initialDeptId // 🟢 初始部门ID
}: Props) {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedDeptName, setSelectedDeptName] = useState<string>('');
  const [users, setUsers] = useState<UserLite[]>([]);

  // Selection state
  const [selectedUsers, setSelectedUsers] = useState<UserLite[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<OrgNode[]>([]);

  // Loading state
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserLite[]>([]);
  
  // 🟢 新增：部门选择弹窗（用于网格视图）
  const [showDeptModal, setShowDeptModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTree();
      // Reset state
      setSelectedUsers([]);
      setSelectedDepts([]);
      setSearchQuery('');
      setSearchResults([]);
      
      // 🟢 如果提供了 initialDeptId，则使用它
      if (initialDeptId) {
        setSelectedDeptId(initialDeptId);
        // 部门名称将在 tree 加载后通过 getDeptName 获取
      } else {
        setSelectedDeptId(null);
        setSelectedDeptName('');
      }
    }
  }, [isOpen, initialDeptId]);
  
  // 🟢 当 tree 加载完成且有 initialDeptId 时，设置部门名称
  useEffect(() => {
    if (tree.length > 0 && selectedDeptId && !selectedDeptName) {
      const deptName = getDeptName(selectedDeptId);
      if (deptName !== selectedDeptId) {
        setSelectedDeptName(deptName);
      }
    }
  }, [tree, selectedDeptId, selectedDeptName]);

  useEffect(() => {
    if (selectedDeptId && (mode === 'user' || mode === 'dept_then_user')) {
      fetchUsers(selectedDeptId);
    } else {
        setUsers([]);
    }
  }, [selectedDeptId, mode]);

  const fetchTree = async () => {
    try {
      setIsLoadingTree(true);
      const res = await apiFetch('/api/org');
      if (res.ok) setTree(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingTree(false);
    }
  };

  const fetchUsers = async (deptId: string) => {
    try {
      setIsLoadingUsers(true);
      const url = activeUsersOnly 
        ? `/api/users/by-dept?deptId=${deptId}&activeOnly=true`
        : `/api/users/by-dept?deptId=${deptId}`;
      const res = await apiFetch(url);
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSearch = async (query: string) => {
      setSearchQuery(query);
      if (query.length < 2) {
          setSearchResults([]);
          return;
      }
      try {
           const url = activeUsersOnly
             ? `/api/users/search?q=${encodeURIComponent(query)}&activeOnly=true`
             : `/api/users/search?q=${encodeURIComponent(query)}`;
           const res = await apiFetch(url);
           if (res.ok) setSearchResults(await res.json());
      } catch(e) {
          console.error(e);
      }
  };

  const toggleUser = (user: UserLite) => {
    if (mode === 'dept') return;

    if (multiSelect) {
      const exists = selectedUsers.some(u => u.id === user.id);
      if (exists) {
        setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
      } else {
        setSelectedUsers([...selectedUsers, user]);
      }
    } else {
      setSelectedUsers([user]);
    }
  };

  const toggleDept = (dept: OrgNode) => {
      if (mode !== 'dept') {
          setSelectedDeptId(dept.id);
          setSelectedDeptName(dept.name);
          return;
      }

      if (multiSelect) {
          const exists = selectedDepts.some(d => d.id === dept.id);
          if (exists) {
              setSelectedDepts(selectedDepts.filter(d => d.id !== dept.id));
          } else {
              setSelectedDepts([...selectedDepts, dept]);
          }
      } else {
          setSelectedDepts([dept]);
      }
  };

  const handleConfirm = () => {
      if (mode === 'dept') {
          onConfirm(selectedDepts);
      } else {
          onConfirm(selectedUsers);
      }
      onClose();
  };

  const handleDeptSelect = (deptId: string, deptName: string) => {
    setSelectedDeptId(deptId);
    setSelectedDeptName(deptName);
    setShowDeptModal(false);
  };

  const clearDeptFilter = () => {
    setSelectedDeptId(null);
    setSelectedDeptName('');
  };

  const getDeptName = (deptId: string): string => {
    const findDept = (nodes: OrgNode[]): OrgNode | null => {
      for (const node of nodes) {
        if (node.id === deptId) return node;
        if (node.children) {
          const found = findDept(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    const dept = findDept(tree);
    return dept?.name || deptId;
  };

  // Tree Node Component
  const TreeNode = ({ node, level }: { node: OrgNode, level: number }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const isDeptSelected = mode === 'dept' && selectedDepts.some(d => d.id === node.id);
    const isActive = selectedDeptId === node.id;

    return (
      <div className="select-none">
        <div
            onClick={() => toggleDept(node)}
            className={`flex items-center gap-2 p-2 my-1 rounded cursor-pointer transition-all border-2
                ${isDeptSelected ? 'bg-blue-500 border-blue-600 text-white shadow-md font-semibold' :
                  isActive ? 'bg-slate-100 text-slate-900 font-medium border-slate-200' : 'hover:bg-slate-50 text-slate-600 border-transparent'}
            `}
            style={{ marginLeft: `${level * 16}px` }}
        >
          <div
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-slate-400 shrink-0 ${!hasChildren && 'invisible'}`}
          >
             {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <Briefcase size={14} className={isDeptSelected ? "text-white" : isActive ? "text-blue-600" : "text-slate-400"} />
          <span className="text-sm truncate flex-1">{node.name}</span>
          {isDeptSelected && <Check size={16} className="text-white font-bold" />}
        </div>
        {expanded && hasChildren && (
          <div className="border-l border-slate-200 ml-[1rem]">
             {node.children!.map(child => (
                <TreeNode key={child.id} node={child} level={level + 1} />
             ))}
          </div>
        )}
      </div>
    );
  };

  // 🟢 网格视图渲染
  const renderGridView = () => {
    const filteredUsers = searchQuery ? searchResults : users;
    
    return (
      <>
        {/* 筛选区 - 网格模式 */}
        <div className="p-6 border-b bg-gradient-to-b from-slate-50 to-white space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* 搜索框 */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索姓名或职位..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none shadow-sm"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            
            {/* 部门过滤按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowDeptModal(true)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Building2 size={16} className="text-slate-400 group-hover:text-blue-500 shrink-0" />
                  <span className={`truncate ${selectedDeptName ? 'text-slate-800' : 'text-slate-400'}`}>
                    {selectedDeptName || '部门过滤'}
                  </span>
                </div>
              </button>
              {selectedDeptName && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearDeptFilter();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-red-100 rounded-full transition-colors"
                >
                  <X size={14} className="text-red-500" />
                </button>
              )}
            </div>
          </div>

          {/* 当前筛选条件提示 */}
          {(searchQuery || selectedDeptName) && (
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
              <span className="font-medium">当前筛选:</span>
              {searchQuery && <span className="bg-white px-2 py-1 rounded border border-blue-200">关键词: {searchQuery}</span>}
              {selectedDeptName && <span className="bg-white px-2 py-1 rounded border border-blue-200">部门: {selectedDeptName}</span>}
              <button
                onClick={() => {
                  setSearchQuery('');
                  clearDeptFilter();
                }}
                className="ml-auto text-blue-600 hover:text-blue-700 font-medium"
              >
                清除筛选
              </button>
            </div>
          )}
        </div>

        {/* 用户网格 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredUsers.map(user => {
              const userDeptName = getDeptName(user.departmentId || '');
              const isSelected = selectedUsers.some(u => u.id === user.id);
              
              return (
                <div
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className={`group relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${
                    isSelected
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md'
                      : 'border-slate-200 hover:border-blue-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* 选中角标 */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    {/* 头像 */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold shrink-0 ${
                      isSelected 
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg' 
                        : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 group-hover:from-blue-100 group-hover:to-indigo-100'
                    }`}>
                      {user.name.charAt(0)}
                    </div>
                    
                    {/* 用户信息 */}
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold truncate mb-1 ${
                        isSelected ? 'text-blue-900' : 'text-slate-800'
                      }`}>
                        {user.name}
                      </div>
                      
                      {user.jobTitle && (
                        <div className="text-xs text-slate-600 truncate mb-1 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                          {user.jobTitle}
                        </div>
                      )}
                      
                      <div className={`text-xs truncate flex items-center gap-1 ${
                        isSelected ? 'text-blue-600' : 'text-slate-500'
                      }`}>
                        <Building2 size={12} className="shrink-0" />
                        {userDeptName}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-4">
                <Users size={40} className="text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">未找到匹配的用户</p>
              <p className="text-xs text-slate-400 mt-2">
                {searchQuery || selectedDeptName ? '请尝试调整筛选条件' : '暂无可用用户'}
              </p>
            </div>
          )}
        </div>

        {/* 底部操作 - 网格模式 */}
        <div className="flex items-center justify-between p-6 border-t bg-gradient-to-b from-white to-slate-50">
          {multiSelect && (
            <button
              onClick={() => setSelectedUsers([])}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium"
            >
              清空选择
            </button>
          )}
          {!multiSelect && <div></div>}
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-200 rounded-xl transition-colors font-medium"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedUsers.length === 0}
              className={`px-6 py-2.5 text-sm rounded-xl transition-all font-bold shadow-lg ${
                selectedUsers.length === 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl'
              }`}
            >
              确定选择 ({selectedUsers.length})
            </button>
          </div>
        </div>
      </>
    );
  };

  // 🟢 列表视图渲染（原有逻辑）
  const renderListView = () => (
    <>
      {/* Search Bar */}
      {mode !== 'dept' && (
        <div className="p-3 border-b bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="搜索人员姓名、职位..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Dept Tree */}
        {showDeptTree && (
          <div className={`border-r bg-slate-50/30 p-3 overflow-y-auto ${mode === 'dept' ? 'w-full' : 'w-1/3'}`}>
            <div className="text-xs font-bold text-slate-400 mb-2 uppercase">组织架构</div>
            {isLoadingTree ? <div className="text-sm text-slate-400 animate-pulse">加载中...</div> :
              tree.map(node => <TreeNode key={node.id} node={node} level={0} />)
            }
          </div>
        )}

        {/* Middle: User List */}
        {mode !== 'dept' && (
          <div className={`border-r p-3 overflow-y-auto bg-white ${showDeptTree ? 'w-1/3' : 'w-1/2'}`}>
            <div className="text-xs font-bold text-slate-400 mb-2 uppercase">
              {searchQuery ? '搜索结果' : (selectedDeptId ? '部门人员' : '请选择部门')}
            </div>

            {isLoadingUsers ? <div className="text-sm text-slate-400 animate-pulse">加载中...</div> :
              (searchQuery ? searchResults : users).length === 0 ?
                <div className="text-sm text-slate-400 text-center mt-10">
                  {searchQuery ? '无搜索结果' : selectedDeptId ? '暂无人员' : '请先从左侧选择部门'}
                </div> :
              (searchQuery ? searchResults : users).map(u => {
                const isSelected = selectedUsers.some(su => su.id === u.id);
                return (
                  <div key={u.id} onClick={() => toggleUser(u)}
                    className={`flex items-center justify-between p-3 mb-2 rounded border cursor-pointer transition-all
                      ${isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-slate-100 hover:border-blue-200'}
                    `}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                        ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {u.name.substring(0,1)}
                      </div>
                      <div>
                        <div className={`text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{u.name}</div>
                        <div className="text-xs text-slate-400">{u.jobTitle || '无职位'}</div>
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="text-blue-600"/>}
                  </div>
                )
              })
            }
          </div>
        )}

        {/* Right: Selected Items */}
        {mode !== 'dept' && (
          <div className={`p-3 overflow-y-auto bg-slate-50 ${showDeptTree ? 'w-1/3' : 'w-1/2'}`}>
            <div className="text-xs font-bold text-slate-400 mb-2 uppercase flex justify-between items-center">
              <span>已选 ({selectedUsers.length})</span>
              {selectedUsers.length > 0 && <button onClick={() => setSelectedUsers([])} className="text-xs text-red-500 hover:underline">清空</button>}
            </div>

            {selectedUsers.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">
                未选择任何人员
              </div>
            )}

            {selectedUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between p-2 bg-white border rounded mb-2 shadow-sm group">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                    {u.name.substring(0,1)}
                  </div>
                  <span className="text-sm text-slate-700">{u.name}</span>
                </div>
                <button onClick={() => toggleUser(u)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
        <button onClick={handleConfirm} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
          确定 {mode === 'dept' && selectedDepts.length > 0 ? `(${selectedDepts.length})` :
               mode !== 'dept' && selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
        </button>
      </div>
    </>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className={`bg-white rounded-xl w-full ${viewMode === 'grid' ? 'max-w-4xl' : 'max-w-5xl'} h-[85vh] flex flex-col shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Users size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {title || (mode === 'dept' ? '选择部门' : multiSelect ? '选择人员' : '选择责任人')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === 'dept' ? '' : multiSelect ? `已选择 ${selectedUsers.length} 人` : '单选模式'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* 根据 viewMode 渲染不同视图 */}
        {viewMode === 'grid' && mode !== 'dept' ? renderGridView() : renderListView()}
      </div>

      {/* 部门选择弹窗（仅在网格模式使用） */}
      {showDeptModal && (
        <PeopleSelector
          isOpen={showDeptModal}
          onClose={() => setShowDeptModal(false)}
          mode="dept"
          onConfirm={(selection) => {
            if (Array.isArray(selection) && selection.length > 0) {
              // @ts-ignore
              const dept = selection[0];
              handleDeptSelect(dept.id, dept.name);
            }
            setShowDeptModal(false);
          }}
          title="选择部门"
        />
      )}
    </div>
  );
}
