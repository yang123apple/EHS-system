import { useState, useEffect } from 'react';
import { X, User, Check, ChevronRight, ChevronDown, Briefcase } from 'lucide-react';

interface User {
  id: string;
  name: string;
  jobTitle: string | null;
}

interface OrgNode {
  id: string;
  name: string;
  parentId: string | null;
  children?: OrgNode[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedUsers: User[]) => void;
  multiSelect?: boolean;
}

export default function UserSelectModal({ isOpen, onClose, onConfirm, multiSelect = true }: Props) {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTree();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedDeptId) {
      fetchUsers(selectedDeptId);
    } else {
      setUsers([]);
    }
  }, [selectedDeptId]);

  const fetchTree = async () => {
    try {
      setIsLoadingTree(true);
      const res = await fetch('/api/org');
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
      const res = await fetch(`/api/users/by-dept?deptId=${deptId}`);
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const toggleUser = (user: User) => {
    if (multiSelect) {
      const exists = selectedUsers.find(u => u.id === user.id);
      if (exists) {
        setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
      } else {
        setSelectedUsers([...selectedUsers, user]);
      }
    } else {
      setSelectedUsers([user]);
    }
  };

  const TreeNode = ({ node, level }: { node: OrgNode, level: number }) => {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedDeptId === node.id;

    return (
      <div className="select-none">
        <div
            onClick={() => setSelectedDeptId(node.id)}
            className={`flex items-center gap-2 p-2 my-1 rounded cursor-pointer transition-colors
                ${isSelected ? 'bg-blue-100 border-blue-300 text-blue-800' : 'hover:bg-slate-100 text-slate-700'}
            `}
            style={{ marginLeft: `${level * 16}px` }}
        >
          <div
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-slate-400 shrink-0 ${!hasChildren && 'invisible'}`}
          >
             {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <Briefcase size={14} className={isSelected ? "text-blue-600" : "text-slate-400"} />
          <span className="text-sm truncate">{node.name}</span>
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
      <div className="bg-white rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-lg text-slate-800">选择人员</h3>
           <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
           {/* Left: Dept Tree */}
           <div className="w-1/3 border-r bg-slate-50/50 p-3 overflow-y-auto">
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase">部门列表</div>
              {isLoadingTree ? <div className="text-sm text-slate-400">加载中...</div> :
                 tree.map(node => <TreeNode key={node.id} node={node} level={0} />)
              }
           </div>

           {/* Middle: User List */}
           <div className="w-1/3 border-r p-3 overflow-y-auto">
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase">人员列表 {selectedDeptId && '(点击选择)'}</div>
              {isLoadingUsers ? <div className="text-sm text-slate-400">加载中...</div> :
               users.length === 0 ? <div className="text-sm text-slate-400 text-center mt-10">该部门无人员或未选择部门</div> :
               users.map(u => {
                   const isSelected = selectedUsers.some(su => su.id === u.id);
                   return (
                       <div key={u.id} onClick={() => toggleUser(u)}
                            className={`flex items-center justify-between p-3 mb-2 rounded border cursor-pointer hover:shadow-sm transition-all
                                ${isSelected ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200'}
                            `}>
                           <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
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

           {/* Right: Selected Users */}
           <div className="w-1/3 p-3 overflow-y-auto bg-slate-50">
               <div className="text-xs font-bold text-slate-400 mb-2 uppercase flex justify-between">
                   <span>已选人员 ({selectedUsers.length})</span>
                   {selectedUsers.length > 0 && <button onClick={() => setSelectedUsers([])} className="text-red-500 hover:underline">清空</button>}
               </div>
               {selectedUsers.map(u => (
                   <div key={u.id} className="flex items-center justify-between p-2 bg-white border rounded mb-2 shadow-sm">
                       <span className="text-sm text-slate-700">{u.name}</span>
                       <button onClick={() => toggleUser(u)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                   </div>
               ))}
           </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded">取消</button>
            <button onClick={() => onConfirm(selectedUsers)} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">确定</button>
        </div>
      </div>
    </div>
  );
}
