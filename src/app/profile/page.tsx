"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, Building, Briefcase, Lock, Camera, Save, Loader2 } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  name: string;
  department: string;
  jobTitle?: string; // 新增职务
  avatar?: string;
}

export default function ProfilePage() {
  const { user: authUser } = useAuth(); // 获取当前登录的简略信息
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 表单状态
  const [name, setName] = useState('');
  const [password, setPassword] = useState(''); // 留空则不修改
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // 1. 加载当前用户的详细信息
  useEffect(() => {
    if (!authUser?.id) return;
    
    const fetchProfile = async () => {
      try {
        // 复用之前的 GET /api/users/[id] 接口
        const res = await fetch(`/api/users/${authUser.id}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setName(data.name);
          setAvatarPreview(data.avatar || '');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [authUser]);

  // 2. 处理头像选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      // 创建本地预览 URL
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  // 3. 保存修改
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const formData = new FormData();
    formData.append('name', name); // 允许改名
    if (password) formData.append('password', password); // 如果填了密码则修改
    if (avatarFile) formData.append('avatarFile', avatarFile); // 如果选了图则上传

    // 注意：这里我们故意不 append 'jobTitle' 和 'department'
    // 即使前端被人篡改传了过去，后端 API 如果没有特别限制，可能也会更新
    // 但在页面逻辑上，我们不提交这两个字段

    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: 'PUT',
        body: formData
      });

      if (res.ok) {
        alert('个人信息更新成功！');
        // 刷新页面或重新获取数据
        const data = await res.json();
        setProfile(data.user);
        setPassword(''); // 清空密码框
        setAvatarFile(null);
      } else {
        alert('更新失败，请重试');
      }
    } catch (err) {
      alert('网络错误');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2"/> 加载个人信息...</div>;
  if (!profile) return <div className="p-10 text-center">无法加载用户信息</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 px-3 md:px-0">
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-slate-900">个人空间</h1>
        <p className="text-slate-500 text-xs md:text-sm">查看您的档案信息，维护个人资料</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
        
        {/* 左侧：头像卡片 */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 h-fit flex flex-col items-center text-center">
            <div className="relative group cursor-pointer mb-3 md:mb-4">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-2 md:border-4 border-slate-50 shadow-inner">
                    {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                            <User size={48} />
                        </div>
                    )}
                </div>
                {/* 悬停显示的上传提示 */}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => document.getElementById('avatar-upload')?.click()}>
                    <Camera className="text-white" />
                </div>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-800">{profile.name}</h2>
            <p className="text-xs md:text-sm text-slate-500 mb-3 md:mb-4">@{profile.username}</p>
            
            <div className="w-full pt-3 md:pt-4 border-t border-slate-100 space-y-1.5 md:space-y-2">
                <div className="flex items-center justify-between text-xs md:text-sm">
                    <span className="text-slate-500">部门</span>
                    <span className="font-medium text-slate-700">{profile.department}</span>
                </div>
                {/* 如果有职务，也在左侧卡片显示一下 */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">职务</span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-xs">
                        {profile.jobTitle || '未设置'}
                    </span>
                </div>
            </div>
        </div>

        {/* 右侧：编辑表单 */}
        <div className="md:col-span-2 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 pb-2 border-b border-slate-100">基本资料</h3>
            
            <form onSubmit={handleSave} className="space-y-4 md:space-y-6">
                
                {/* 1. 姓名 (可修改) */}
                <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">真实姓名</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)}
                        className="w-full px-3 md:px-4 py-1.5 md:py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue transition-all text-sm md:text-base"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {/* 2. 部门 (只读) */}
                    <div>
                        <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                            <Building size={12} className="text-slate-400 md:hidden"/><Building size={14} className="text-slate-400 hidden md:block"/> 所属部门
                        </label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={profile.department} 
                                disabled 
                                className="w-full px-3 md:px-4 py-1.5 md:py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed text-sm md:text-base"
                            />
                            <Lock size={12} className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-slate-400 md:hidden" />
                            <Lock size={14} className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-slate-400 hidden md:block" />
                        </div>
                    </div>

                    {/* 3. 职务 (只读 - 核心需求) */}
                    <div>
                        <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                            <Briefcase size={12} className="text-slate-400 md:hidden"/><Briefcase size={14} className="text-slate-400 hidden md:block"/> 职务岗位
                        </label>
                        <div className="relative">
                            <input 
                                type="text" 
                                // 如果为空显示暂无
                                value={profile.jobTitle || '暂无职务信息'} 
                                disabled 
                                className="w-full px-3 md:px-4 py-1.5 md:py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed text-sm md:text-base"
                            />
                            {/* 锁图标暗示不可修改 */}
                            <Lock size={12} className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-slate-400 md:hidden" />
                            <Lock size={14} className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-slate-400 hidden md:block" />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">* 如需变更职务信息，请联系管理员</p>
                    </div>
                </div>

                {/* 4. 修改密码 */}
                <div className="pt-3 md:pt-4 border-t border-slate-100">
                     <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">修改密码</label>
                     <input 
                        type="password" 
                        placeholder="如果不修改请留空"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full px-3 md:px-4 py-1.5 md:py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-hytzer-blue transition-all text-sm md:text-base"
                    />
                </div>

                <div className="pt-3 md:pt-4 flex justify-end">
                    <button 
                        type="submit" 
                        disabled={saving}
                        className="flex items-center gap-2 px-4 md:px-6 py-1.5 md:py-2 bg-hytzer-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-wait text-sm md:text-base"
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        <Save size={18} className="hidden md:block" />
                        保存更改
                    </button>
                </div>

            </form>
        </div>
      </div>
    </div>
  );
}