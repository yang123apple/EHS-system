import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronDown, Briefcase, Check, Search, User as UserIcon } from 'lucide-react';
import { User } from '@prisma/client';

export type SelectorMode = 'user' | 'dept' | 'dept_then_user';

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
}

export default function PeopleSelector({ isOpen, onClose, onConfirm, mode, multiSelect = false, title }: Props) {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
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

  useEffect(() => {
    if (isOpen) {
      fetchTree();
      // Reset state
      setSelectedUsers([]);
      setSelectedDepts([]);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen]);

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
      const res = await fetch('/api/org'); // Assumes existing API
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
      const res = await fetch(`/api/users/by-dept?deptId=${deptId}`); // Assumes existing API or needs creation
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
      // Assuming a search API exists or we implement one
      // For now, client-side filter if users are loaded, or simple mock if not
      // Ideally calls PeopleFinder.searchUsers via API
      try {
           // TODO: Create /api/users/search endpoint if not exists
           // Fallback to filtering current loaded users if in dept mode, or global search?
           // Let's assume global search is better
           const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
           if (res.ok) setSearchResults(await res.json());
      } catch(e) {
          console.error(e);
      }
  };

  const toggleUser = (user: UserLite) => {
    if (mode === 'dept') return; // Cannot select users in dept mode

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
          // In user modes, clicking dept just selects it for viewing users
          setSelectedDeptId(dept.id);
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

  // Tree Node Component
  const TreeNode = ({ node, level }: { node: OrgNode, level: number }) => {
    // 默认展开所有节点
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    // Check selection state
    const isDeptSelected = mode === 'dept' && selectedDepts.some(d => d.id === node.id);
    const isActive = selectedDeptId === node.id; // Currently viewing users of this dept

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-lg text-slate-800">{title || (mode === 'dept' ? '选择部门' : '选择人员')}</h3>
           <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
        </div>

        {/* Search Bar (Global) */}
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
           <div className={`border-r bg-slate-50/30 p-3 overflow-y-auto ${mode === 'dept' ? 'w-full' : 'w-1/3'}`}>
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase">组织架构</div>
              {isLoadingTree ? <div className="text-sm text-slate-400 animate-pulse">加载中...</div> :
                 tree.map(node => <TreeNode key={node.id} node={node} level={0} />)
              }
           </div>

           {/* Middle: User List (Only in User Modes) */}
           {mode !== 'dept' && (
               <div className="w-1/3 border-r p-3 overflow-y-auto bg-white">
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
               <div className="w-1/3 p-3 overflow-y-auto bg-slate-50">
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
      </div>
    </div>
  );
}
