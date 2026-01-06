'use client';
import { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertCircle, Settings, Droplet, X, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';

export default function TrainingSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // 权限检查：只有admin可以访问
  useEffect(() => {
    if (user && user.role !== 'admin') {
      alert('您没有权限访问此页面');
      router.push('/training/my-tasks');
    }
  }, [user, router]);

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkIncludeUser, setWatermarkIncludeUser] = useState(false);
  const [watermarkIncludeTime, setWatermarkIncludeTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    console.log('[Training Settings] 开始加载设置...');
    apiFetch('/api/training/settings')
      .then(res => {
        if (!res.ok) {
          console.error('[Training Settings] 加载失败:', res.status);
          return { categories: [], watermarkText: '', watermarkEnabled: true, watermarkIncludeUser: false, watermarkIncludeTime: false };
        }
        return res.json();
      })
      .then(data => {
        console.log('[Training Settings] 加载的数据:', data);
        console.log('[Training Settings] loading 状态:', loading);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setWatermarkText(data.watermarkText || '');
        setWatermarkEnabled(data.watermarkEnabled !== false);
        setWatermarkIncludeUser(data.watermarkIncludeUser || false);
        setWatermarkIncludeTime(data.watermarkIncludeTime || false);
      })
      .catch(error => {
        console.error('[Training Settings] 加载异常:', error);
        setCategories([]);
      })
      .finally(() => {
        console.log('[Training Settings] 设置 loading 为 false');
        setLoading(false);
      });
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
      console.log('[Training Settings] 准备保存:', { categories, watermarkText, watermarkEnabled });
      
      const res = await apiFetch('/api/training/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          categories,
          watermarkText,
          watermarkEnabled,
          watermarkIncludeUser,
          watermarkIncludeTime
        })
      });

      console.log('[Training Settings] 保存响应状态:', res.status, res.ok);

      if (res.ok) {
        const result = await res.json();
        console.log('[Training Settings] 保存成功，返回结果:', result);
        alert('保存成功');
        
        // 保存成功后重新加载数据，确保显示最新状态
        const refreshRes = await apiFetch('/api/training/settings');
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          console.log('[Training Settings] 重新加载的数据:', data);
          setCategories(data.categories || []);
          setWatermarkText(data.watermarkText || '');
          setWatermarkEnabled(data.watermarkEnabled !== false);
          setWatermarkIncludeUser(data.watermarkIncludeUser || false);
          setWatermarkIncludeTime(data.watermarkIncludeTime || false);
        } else {
          console.error('[Training Settings] 重新加载失败:', refreshRes.status);
        }
      } else {
        const error = await res.json().catch(() => ({ error: '保存失败' }));
        console.error('[Training Settings] 保存失败:', error);
        alert(error.error || error.details || '保存失败，请检查权限或重试');
      }
    } catch (error) {
      console.error('[Training Settings] 保存异常:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                <Settings className="text-white" size={26} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">培训系统设置</h1>
                <p className="text-slate-500 text-sm mt-1.5 font-medium">配置学习类型和水印设置</p>
              </div>
            </div>
            {!loading && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    保存设置
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 卡片容器 - 并排显示 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 水印设置 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Droplet className="text-blue-600" size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">水印设置</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              配置学习内容的水印文本和显示状态。
            </p>

            {loading ? (
              <div className="text-center py-12 text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin" />
                <span>加载中...</span>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      id="watermarkEnabled"
                      checked={watermarkEnabled}
                      onChange={e => setWatermarkEnabled(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 border-slate-300"
                    />
                    <label htmlFor="watermarkEnabled" className="font-medium text-slate-700 cursor-pointer">
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
                      placeholder="例如：培训系统 · 请勿外传"
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
                      disabled={!watermarkEnabled}
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      提示：可配合下方动态信息选项使用
                    </p>
                  </div>
                  
                  {/* 🔴 动态选项 */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      动态信息选项
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watermarkIncludeUser}
                        onChange={(e) => setWatermarkIncludeUser(e.target.checked)}
                        disabled={!watermarkEnabled}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className={`text-sm ${watermarkEnabled ? 'text-slate-700' : 'text-slate-400'}`}>包含用户名及用户ID</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watermarkIncludeTime}
                        onChange={(e) => setWatermarkIncludeTime(e.target.checked)}
                        disabled={!watermarkEnabled}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className={`text-sm ${watermarkEnabled ? 'text-slate-700' : 'text-slate-400'}`}>包含当前系统时间</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 学习类型管理 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Settings className="text-indigo-600" size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">学习类型管理</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              设置可用的学习内容类型，这些类型将在上传学习内容时供选择。
            </p>

            {loading ? (
              <div className="text-center py-12 text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin" />
                <span>加载中...</span>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {categories.map(cat => (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      <span className="font-medium text-slate-700">{cat}</span>
                      <button
                        onClick={() => handleRemoveCategory(cat)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors hover:text-red-600"
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
                    className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <button
                    onClick={handleAddCategory}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
                  >
                    <Plus size={18} /> 添加
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
