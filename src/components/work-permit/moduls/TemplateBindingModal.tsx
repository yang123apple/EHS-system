import { useState, useEffect } from 'react';
import { X, Link2 } from 'lucide-react';
import { Template } from '@/types/work-permit';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cellKey: string; // 例如 "R5C3"
  currentTemplateId?: string; // 当前绑定的模板ID
  templates: Template[]; // 所有可用的二级模板
  onBind: (templateId: string) => void;
}

export default function TemplateBindingModal({
  isOpen,
  onClose,
  cellKey,
  currentTemplateId,
  templates,
  onBind
}: Props) {
  const [selectedId, setSelectedId] = useState(currentTemplateId || '');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedId(currentTemplateId || '');
      setSearchTerm('');
    }
  }, [isOpen, currentTemplateId]);

  // 只显示二级模板
  const secondaryTemplates = templates.filter(t => t.level === 'secondary');
  
  // 搜索过滤
  const filteredTemplates = secondaryTemplates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConfirm = () => {
    if (!selectedId) {
      alert('请选择一个模板');
      return;
    }
    onBind(selectedId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
        {/* 头部 */}
        <div className="p-4 border-b flex justify-between items-center bg-purple-50">
          <div className="flex items-center gap-2">
            <Link2 className="text-purple-600" size={20} />
            <div>
              <h3 className="font-bold text-lg">绑定二级模板</h3>
              <p className="text-xs text-slate-600">单元格位置: {cellKey}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-purple-100 rounded">
            <X size={20} />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="p-4 border-b">
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="搜索模板名称或类型..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* 模板列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">没有可用的二级模板</p>
              <p className="text-xs mt-2">请先创建级别为"二级"的模板</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredTemplates.map((template) => (
                <label
                  key={template.id}
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                    selectedId === template.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={template.id}
                    checked={selectedId === template.id}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-4 h-4 text-purple-600"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-sm">{template.name}</div>
                    <div className="text-xs text-slate-600">类型: {template.type}</div>
                  </div>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    二级模板
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-slate-100 text-sm"
          >
            取消
          </button>
          {currentTemplateId && (
            <button
              onClick={() => {
                onBind('');
                onClose();
              }}
              className="px-4 py-2 border border-red-300 rounded hover:bg-red-50 text-red-600 text-sm"
            >
              解除绑定
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            确认绑定
          </button>
        </div>
      </div>
    </div>
  );
}
