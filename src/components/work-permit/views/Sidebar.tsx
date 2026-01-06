import { FolderPlus, LayoutGrid, List, Plus, Settings, ShieldAlert } from 'lucide-react';

interface Props {
  viewMode: 'projects' | 'records' | 'logs'; // 🟢 1. 增加类型定义
  onSwitchView: (mode: 'projects' | 'records' | 'logs') => void;
  userRole: string; // 🟢 2. 需要传入角色来判断显示
  hasPerm: (perm: string) => boolean;
  onNewProject: () => void;
  onManageTemplates: () => void;
}

export default function Sidebar({
  viewMode,
  onSwitchView,
  userRole,
  hasPerm,
  onNewProject,
  onManageTemplates
}: Props) {
  // 检查是否有任意模板权限
  const hasAnyTemplatePerm = hasPerm('upload_template') ||
    hasPerm('edit_template') ||
    hasPerm('lock_template') ||
    hasPerm('delete_template');

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 space-y-4 h-full">
      <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
        <FolderPlus className="text-blue-600" /> 作业许可
      </h2>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase px-2">业务视图</label>
        <button
          onClick={() => onSwitchView('projects')}
          className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-3 transition ${
            viewMode === 'projects'
              ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <LayoutGrid size={18} /> 工程项目列表
        </button>
        <button
          onClick={() => onSwitchView('records')}
          className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-3 transition ${
            viewMode === 'records'
              ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <List size={18} /> 所有作业记录
        </button>
      </div>

      {/* 🟢 3. 仅 Admin 可见 */}
      {userRole === 'admin' && (
        <>
          <div className="my-4 border-t border-slate-200 mx-2"></div>
          <div className="px-2">
            <div className="text-xs font-bold text-slate-400 uppercase px-2 mb-2">系统管理</div>
            <button
              onClick={() => onSwitchView('logs')}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                viewMode === 'logs'
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ShieldAlert size={18} />
              <span>操作日志</span>
            </button>
          </div>
        </>
      )}

      <div className="pt-4 border-t border-slate-100 mt-auto">
        {/* 权限控制: 新建工程 */}
        {hasPerm('create_project') && (
          <button
            onClick={onNewProject}
            className="w-full bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition shadow-sm mb-3"
          >
            <Plus size={18} /> 新建工程
          </button>
        )}
        {/* 权限控制: 模板管理 (有任一权限即显示) */}
        {hasAnyTemplatePerm && (
          <button
            onClick={onManageTemplates}
            className="w-full bg-slate-100 text-slate-600 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-200 text-sm font-medium transition"
          >
            <Settings size={16} /> 模板管理
          </button>
        )}
      </div>
    </div>
  );
}