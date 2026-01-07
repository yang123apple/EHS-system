"use client";

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import Link from 'next/link';

export default function RulesPage(){
  const [rules, setRules] = useState<any[]>([]);

  useEffect(()=>{ fetchRules(); }, []);

  async function fetchRules(){
    try{
      const res = await apiFetch('/api/auto-assign-rules');
      const data = await res.json();
      setRules(data);
    }catch(e){ console.error(e); }
  }

  async function toggle(rule: any){
    try{
      const updated = await apiFetch('/api/auto-assign-rules', { method: 'PUT', body: { ...rule, isActive: !rule.isActive } });
      if (updated.ok) fetchRules();
    }catch(e){ console.error(e); }
  }

  async function remove(id: string){
    if(!confirm('确定删除该规则吗？')) return;
    try{
      const res = await apiFetch(`/api/auto-assign-rules?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchRules();
    }catch(e){ console.error(e); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">自动派发规则管理</h1>
        <Link href="/training/tasks/create" className="px-3 py-2 bg-blue-600 text-white rounded">发布任务并配置规则</Link>
      </div>

      <div className="space-y-3">
        {rules.map(r => (
          <div key={r.id} className="p-4 border rounded flex items-start justify-between">
            <div>
              <div className="text-sm text-slate-700 font-medium">任务: {r.task?.title || r.taskId}</div>
              <div className="text-xs text-slate-500">模式: {r.mode} {r.eventType ? `• 事件:${r.eventType}` : ''}</div>
              <div className="text-xs text-slate-500">条件: {JSON.stringify(r.condition)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>toggle(r)} className={`px-3 py-1 rounded ${r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50'}`}>{r.isActive ? '启用' : '停用'}</button>
              <button onClick={()=>remove(r.id)} className="px-3 py-1 bg-red-50 text-red-700 rounded">删除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
