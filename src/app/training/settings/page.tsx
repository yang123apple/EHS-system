'use client';
import { useState, useEffect } from 'react';
import { Settings, Plus, X, Droplet } from 'lucide-react';

export default function TrainingSettingsPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/training/settings')
      .then(res => res.json())
      .then(data => {
        setCategories(data.categories || []);
        setWatermarkText(data.watermarkText || '');
        setWatermarkEnabled(data.watermarkEnabled !== false);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    if (categories.includes(newCategory.trim())) {
      alert('该类型已存在');
      return;
    }
    setCategories([...categories, newCategory.trim()]);
    setNewCategory('');
  };

  const handleRemoveCategory = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/training/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          categories,
          watermarkText,
          watermarkEnabled
        })
      });

      if (res.ok) {
        alert('保存成功');
      } else {
        alert('保存失败');
      }
    } catch (error) {
      console.error(error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="text-blue-600" size={32} />
        <h2 className="text-2xl font-bold text-slate-800">培训系统设置</h2>
      </div>

      {/* 水印设置 */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Droplet className="text-blue-600" size={24} />
          <h3 className="text-lg font-bold">水印设置</h3>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          配置学习内容的水印文本和显示状态。
        </p>

        {loading ? (
          <div className="text-center py-8 text-slate-400">加载中...</div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="watermarkEnabled"
                  checked={watermarkEnabled}
                  onChange={e => setWatermarkEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="watermarkEnabled" className="font-medium text-slate-700">
                  启用水印
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  水印文本
                </label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={e => setWatermarkText(e.target.value)}
                  placeholder="输入水印文本（支持 {username} 和 {name} 变量）"
                  className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!watermarkEnabled}
                />
                <p className="text-xs text-slate-500 mt-1">
                  提示：可使用 {'{username}'} 显示用户名，{'{name}'} 显示姓名
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 学习类型管理 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-bold mb-4">学习类型管理</h3>
        <p className="text-sm text-slate-600 mb-6">
          设置可用的学习内容类型，这些类型将在上传学习内容时供选择。
        </p>

        {loading ? (
          <div className="text-center py-8 text-slate-400">加载中...</div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {categories.map(cat => (
                <div
                  key={cat}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <span className="font-medium text-slate-700">{cat}</span>
                  <button
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                    title="删除"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="text-center py-8 text-slate-400">暂无学习类型</div>
              )}
            </div>

            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAddCategory()}
                placeholder="输入新类型名称"
                className="flex-1 border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddCategory}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} /> 添加
              </button>
            </div>

            <div className="flex justify-end pt-6 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
