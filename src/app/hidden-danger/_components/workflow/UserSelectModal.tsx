// src/app/hidden-danger/_components/workflow/UserSelectModal.tsx
import { useState } from 'react';
import { X, Search, User, Users, Building2 } from 'lucide-react';
import { SimpleUser } from '@/types/hidden-danger';
import DepartmentSelectModal from '@/components/work-permit/moduls/DepartmentSelectModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (users: Array<{ userId: string; userName: string }>) => void;
  allUsers: SimpleUser[];
  departments: any[];
  selectedUserIds?: string[];
  singleSelect?: boolean; // 新增：单选模式
}

export function UserSelectModal({
  isOpen,
  onClose,
  onSelect,
  allUsers,
  departments = [],
  selectedUserIds = [],
  singleSelect = false,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedDeptName, setSelectedDeptName] = useState<string>('');
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set(selectedUserIds));
  const [showDeptModal, setShowDeptModal] = useState(false);

  if (!isOpen) return null;

  // 安全检查
  const safeDepartments = departments || [];
  const safeUsers = allUsers || [];

  const filteredUsers = safeUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !selectedDeptId || user.departmentId === selectedDeptId;
    return matchesSearch && matchesDept;
  });

  const handleToggleUser = (userId: string) => {
    if (singleSelect) {
      // 单选模式：直接替换选择
      setTempSelected(new Set([userId]));
    } else {
      // 多选模式：切换选择状态
      const newSelected = new Set(tempSelected);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      setTempSelected(newSelected);
    }
  };

  const handleConfirm = () => {
    const selectedUsers = Array.from(tempSelected).map(userId => {
      const user = safeUsers.find(u => u.id === userId);
      return {
        userId,
        userName: user?.name || '',
      };
    });
    onSelect(selectedUsers);
    onClose();
  };

  const getDeptName = (deptId: string) => {
    const dept = safeDepartments.find(d => d.id === deptId);
    return dept?.name || deptId;
  };

  const handleDeptSelect = (deptId: string, deptName: string) => {
    setSelectedDeptId(deptId);
    setSelectedDeptName(deptName);
    setShowDeptModal(false);
  };

  const clearDeptFilter = () => {
    setSelectedDeptId('');
    setSelectedDeptName('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Users size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {singleSelect ? '选择责任人' : '选择处理人员'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {singleSelect ? '单选模式' : `已选择 ${tempSelected.size} 人`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* 筛选区 */}
        <div className="p-6 border-b bg-gradient-to-b from-slate-50 to-white space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* 搜索框 */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索姓名或职位..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
          {(searchTerm || selectedDeptName) && (
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
              <span className="font-medium">当前筛选:</span>
              {searchTerm && <span className="bg-white px-2 py-1 rounded border border-blue-200">关键词: {searchTerm}</span>}
              {selectedDeptName && <span className="bg-white px-2 py-1 rounded border border-blue-200">部门: {selectedDeptName}</span>}
              <button
                onClick={() => {
                  setSearchTerm('');
                  clearDeptFilter();
                }}
                className="ml-auto text-blue-600 hover:text-blue-700 font-medium"
              >
                清除筛选
              </button>
            </div>
          )}
        </div>

        {/* 用户列表 - 响应式 Grid 布局 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredUsers?.map(user => {
              const userDeptName = getDeptName(user.department || '');
              const isSelected = tempSelected.has(user.id);
              
              return (
                <div
                  key={user.id}
                  onClick={() => handleToggleUser(user.id)}
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
                {searchTerm || selectedDeptName ? '请尝试调整筛选条件' : '暂无可用用户'}
              </p>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between p-6 border-t bg-gradient-to-b from-white to-slate-50">
          {!singleSelect && (
            <button
              onClick={() => setTempSelected(new Set())}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium"
            >
              清空选择
            </button>
          )}
          {singleSelect && <div></div>}
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-200 rounded-xl transition-colors font-medium"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={tempSelected.size === 0}
              className={`px-6 py-2.5 text-sm rounded-xl transition-all font-bold shadow-lg ${
                tempSelected.size === 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl'
              }`}
            >
              确定选择 ({tempSelected.size})
            </button>
          </div>
        </div>
      </div>

      {/* 部门选择弹窗 */}
      <DepartmentSelectModal
        isOpen={showDeptModal}
        onClose={() => setShowDeptModal(false)}
        onSelect={handleDeptSelect}
        selectedDeptId={selectedDeptId}
      />
    </div>
  );
}
