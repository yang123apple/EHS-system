// src/app/login/page.tsx
"use client";
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      router.push('/dashboard');
    } else {
      setError('用户名或密码错误');
    }
  };

  return (
    // 修改点：删除了 -mt-16，保留 min-h-screen 和 w-full
    <div className="min-h-screen w-full flex items-center justify-center bg-hytzer-dark relative overflow-hidden z-10">
        
        {/* 背景光效装饰 */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
             <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-hytzer-blue opacity-20 blur-[120px] rounded-full"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-400 opacity-10 blur-[120px] rounded-full"></div>
        </div>

      <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-2xl w-full max-w-md z-20 mx-4">
        <div className="text-center mb-8">
            <div className="relative w-40 h-12 mx-auto mb-4">
                 <Image src="/logo1.png" alt="Hytzer" fill className="object-contain brightness-0 invert" sizes="160px" priority />
            </div>
          <h2 className="text-2xl font-bold text-white">EHS 信息化管理平台</h2>
          <p className="text-slate-300 text-sm mt-2">安全 · 环保 · 健康 · 高效</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded text-sm text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">账号</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-hytzer-blue focus:border-transparent outline-none transition-all placeholder-slate-500"
              placeholder="请输入用户名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-hytzer-blue focus:border-transparent outline-none transition-all placeholder-slate-500"
              placeholder="请输入密码"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-hytzer-blue hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02] shadow-lg shadow-blue-900/50 cursor-pointer"
          >
            登 录
          </button>
        </form>
      </div>
    </div>
  );
}