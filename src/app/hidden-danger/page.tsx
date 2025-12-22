"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/mockDb'; 
import * as XLSX from 'xlsx'; 
import { 
  AlertTriangle, Plus, Search, Filter, Camera, CheckCircle, 
  Clock, BarChart3, Settings, MapPin, ArrowRight, X, 
  LayoutDashboard, ListTodo, Users, Trash2, AlertCircle,
  FileSpreadsheet, History, Siren, TimerReset, Ban, CalendarClock,
  UploadCloud, ImageIcon
} from 'lucide-react';

// --- 类型定义 ---
type HazardLog = {
  operatorName: string;
  action: string;
  time: string;
  changes: string;
};

type HazardRecord = {
  id: string;
  status: 'reported' | 'assigned' | 'rectifying' | 'verified' | 'closed';
  riskLevel: 'low' | 'medium' | 'high' | 'major';
  type: string;
  location: string;
  desc: string;
  photos: string[];
  
  reporterId: string;
  reporterName: string;
  reportTime: string;

  responsibleDept?: string; 
  responsibleId?: string;
  responsibleName?: string;
  deadline?: string;

  isExtensionRequested?: boolean; 
  extensionReason?: string;
  
  rectifyDesc?: string;
  rectifyPhotos?: string[];
  rectifyTime?: string;

  verifierId?: string;
  verifierName?: string;
  verifyTime?: string;
  
  logs?: HazardLog[];
};

type HazardConfig = { types: string[]; areas: string[]; };
type SimpleUser = { id: string; name: string; department: string; };

export default function HiddenDangerPage() {
  const { user } = useAuth();
  
  // --- State ---
  const [viewMode, setViewMode] = useState<'overview' | 'my_tasks' | 'all_list' | 'stats' | 'config'>('overview');
  const [hazards, setHazards] = useState<HazardRecord[]>([]);
  const [config, setConfig] = useState<HazardConfig>({ types: [], areas: [] });
  const [loading, setLoading] = useState(true);

  // 分页状态
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 用户数据
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  // 筛选 State
  const [filterType, setFilterType] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRisk, setFilterRisk] = useState(''); 

  // 统计数据
  const [backendStats, setBackendStats] = useState<any>(null);

  // 弹窗 State
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState<HazardRecord | null>(null);

  // 表单 State
  const [newHazardData, setNewHazardData] = useState<Partial<HazardRecord>>({ riskLevel: 'low' });
  const [tempPhotos, setTempPhotos] = useState<string[]>([]);
  
  // 处理流程 State
  const [processData, setProcessData] = useState<any>({});
  // ✅ 新增：控制延期申请卡片的显示
  const [showExtensionForm, setShowExtensionForm] = useState(false);

  // 导入 Ref
  const importInputRef = useRef<HTMLInputElement>(null);
  
  const hasPerm = (key: string) => user?.role === 'admin' || user?.permissions?.['hidden_danger']?.includes(key);

  // --- Effects ---
  useEffect(() => {
    fetchData();
    fetchConfig();
    fetchRealUsers();
    fetchStats();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/hazards');
      if (res.ok) setHazards(await res.json());
      setLoading(false);
    } catch (e) { console.error(e); }
  };

  const fetchStats = async () => {
      try {
          const res = await fetch('/api/hazards?type=stats');
          if (res.ok) setBackendStats(await res.json());
      } catch (e) {}
  }

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/hazards/config');
      if (res.ok) setConfig(await res.json());
    } catch (e) {}
  };

  const fetchRealUsers = async () => {
     try {
         const res = await fetch('/api/users');
         if (res.ok) {
             const data: SimpleUser[] = await res.json();
             setAllUsers(data);
             setDepartments(Array.from(new Set(data.map(u => u.department).filter(Boolean))));
         }
     } catch (e) {}
  };

  // --- 辅助函数 ---
  const getStatusBadge = (status: string) => {
    const map = {
      'reported': { color: 'bg-red-50 text-red-600 border-red-200', text: '待指派' },
      'assigned': { color: 'bg-orange-50 text-orange-600 border-orange-200', text: '待整改' },
      'rectifying': { color: 'bg-blue-50 text-blue-600 border-blue-200', text: '整改中' },
      'verified': { color: 'bg-purple-50 text-purple-600 border-purple-200', text: '待验收' },
      'closed': { color: 'bg-green-50 text-green-600 border-green-200', text: '已闭环' }
    };
    const s = map[status as keyof typeof map] || map['reported'];
    return <span className={`px-2 py-0.5 rounded text-xs border ${s.color}`}>{s.text}</span>;
  };

  const getRiskBadge = (level: string) => {
      const map = {
          'low': { color: 'bg-blue-100 text-blue-700', text: '低风险' },
          'medium': { color: 'bg-yellow-100 text-yellow-700', text: '中风险' },
          'high': { color: 'bg-orange-100 text-orange-700', text: '高风险' },
          'major': { color: 'bg-red-100 text-red-700 font-bold', text: '重大风险' },
      };
      const r = map[level as keyof typeof map] || map['low'];
      return <span className={`px-2 py-0.5 rounded text-xs ${r.color}`}>{r.text}</span>;
  };

  // ✅ 辅助：计算是否临近截止日期 (<=3天)
  const isNearDeadline = (deadlineStr?: string) => {
      if (!deadlineStr) return false;
      const today = new Date();
      today.setHours(0,0,0,0);
      const deadline = new Date(deadlineStr);
      deadline.setHours(0,0,0,0);
      const diffTime = deadline.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 3 && diffDays >= -10; // 过期也算
  };

  // ✅ 导出 Excel
  const handleExport = () => {
      const exportData = filteredHazards.map(h => ({
          '单号': h.id,
          '风险等级': h.riskLevel === 'major' ? '重大' : h.riskLevel === 'high' ? '高' : h.riskLevel === 'medium' ? '中' : '低',
          '状态': h.status,
          '类型': h.type,
          '区域': h.location,
          '描述': h.desc,
          '上报人': h.reporterName,
          '上报时间': new Date(h.reportTime).toLocaleString(),
          '责任人': h.responsibleName || '-',
          '截止日期': h.deadline || '-'
      }));
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "隐患列表");
      XLSX.writeFile(wb, `隐患台账_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // ✅ 批量导入
  const handleBatchImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const data = XLSX.utils.sheet_to_json(ws); // 假设第一行是表头

              let successCount = 0;
              // 映射中文表头到字段
              for (const row of data as any[]) {
                  const payload = {
                      riskLevel: row['风险等级'] === '重大' ? 'major' : row['风险等级'] === '高' ? 'high' : row['风险等级'] === '中' ? 'medium' : 'low',
                      type: row['隐患类型'] || '其他',
                      location: row['区域'] || '未知区域',
                      desc: row['隐患描述'] || '无描述',
                      photos: [],
                      reporterId: user?.id || 'system',
                      reporterName: user?.name || '系统导入',
                      reportTime: new Date().toISOString(),
                      logs: [{
                          operatorId: user?.id,
                          operatorName: user?.name,
                          action: '批量导入',
                          time: new Date().toISOString(),
                          changes: 'Excel 导入'
                      }]
                  };
                  // 逐条创建 (实际项目建议用批量API)
                  await fetch('/api/hazards', { method: 'POST', body: JSON.stringify(payload) });
                  successCount++;
              }
              alert(`成功导入 ${successCount} 条隐患记录！`);
              fetchData();
          } catch (err) {
              console.error(err);
              alert("导入失败，请检查 Excel 格式");
          }
      };
      reader.readAsBinaryString(file);
      e.target.value = ''; // 重置 input
  };

  // --- 业务逻辑 ---

  // 1. 上报隐患
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isProcess = false) => {
    const files = e.target.files;
    if (files && files[0]) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (isProcess) setProcessData((prev: any) => ({ ...prev, photos: [...(prev.photos||[]), evt.target?.result] }));
        else setTempPhotos(prev => [...prev, evt.target?.result as string]);
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const submitReport = async () => {
    if (!newHazardData.type || !newHazardData.location || !newHazardData.desc) return alert("信息不完整");
    
    const payload = {
      ...newHazardData,
      photos: tempPhotos,
      reporterId: user?.id,
      reporterName: user?.name,
      reportTime: new Date().toISOString(),
      logs: [{
          operatorId: user?.id,
          operatorName: user?.name,
          action: '上报隐患',
          time: new Date().toISOString(),
          changes: '新建记录'
      }]
    };
    
    await fetch('/api/hazards', { method: 'POST', body: JSON.stringify(payload) });
    alert("上报成功！");
    setShowReportModal(false);
    setTempPhotos([]);
    setNewHazardData({ riskLevel: 'low' });
    fetchData();
  };

  // 2. 核心流程处理 (PATCH)
  const handleProcess = async (action: 'assign' | 'start_rectify' | 'finish_rectify' | 'verify_pass' | 'verify_reject' | 'request_extension' | 'approve_extension') => {
    if (!selectedHazard) return;
    
    let updates: any = { 
        operatorId: user?.id, 
        operatorName: user?.name 
    };
    
    switch (action) {
        case 'assign':
            if (!processData.responsibleId || !processData.deadline) return alert("请完善信息");
            if (new Date(processData.deadline) < new Date(new Date().setHours(0,0,0,0))) {
                return alert("截止日期不能早于今天");
            }
            const selectedUser = allUsers.find(u => u.id === processData.responsibleId);
            updates = {
                ...updates,
                actionName: '指派责任人',
                status: 'assigned',
                responsibleDept: processData.responsibleDept,
                responsibleId: processData.responsibleId,
                responsibleName: selectedUser?.name,
                deadline: processData.deadline
            };
            break;

        case 'start_rectify':
            updates = { ...updates, actionName: '开始整改', status: 'rectifying' };
            break;

        case 'request_extension':
            if(!processData.extensionReason) return alert("请填写延期原因");
            updates = {
                ...updates,
                actionName: '申请延期',
                isExtensionRequested: true,
                extensionReason: processData.extensionReason
            };
            break;

        case 'approve_extension':
            if(!processData.newDeadline) return alert("请选择新的截止日期");
            updates = {
                ...updates,
                actionName: '批准延期',
                isExtensionRequested: false, // 清除标记
                deadline: processData.newDeadline,
                extensionReason: `已批准延期至 ${processData.newDeadline}`
            };
            break;

        case 'finish_rectify':
            // ✅ 必须传照片校验
            if (!processData.rectifyDesc) return alert("请填写整改措施描述");
            if (!processData.photos || processData.photos.length === 0) return alert("请上传整改后的现场照片");

            updates = {
                ...updates,
                actionName: '完成整改',
                status: 'verified', 
                rectifyDesc: processData.rectifyDesc,
                rectifyPhotos: processData.photos,
                rectifyTime: new Date().toISOString()
            };
            break;

        case 'verify_pass':
            updates = {
                ...updates,
                actionName: '验收通过',
                status: 'closed',
                verifierId: user?.id,
                verifierName: user?.name,
                verifyTime: new Date().toISOString()
            };
            break;
            
        case 'verify_reject':
            if (!processData.rejectReason) return alert("请填写驳回原因");
            updates = {
                ...updates,
                actionName: '驳回重整',
                status: 'assigned',
                extensionReason: `验收被驳回: ${processData.rejectReason}`
            };
            break;
    }

    await fetch('/api/hazards', { 
        method: 'PATCH', 
        body: JSON.stringify({ id: selectedHazard.id, ...updates }) 
    });
    
    alert("操作成功");
    setShowDetailModal(false);
    setShowExtensionForm(false); // 重置延期表单
    setProcessData({}); // 重置表单
    fetchData();
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("⚠️ 确定要彻底删除这条隐患记录吗？\n此操作不可恢复！")) return;
    try {
      const res = await fetch(`/api/hazards?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert("删除成功");
        if (showDetailModal && selectedHazard?.id === id) setShowDetailModal(false);
        fetchData(); 
      } else { alert("删除失败"); }
    } catch (err) { alert("网络错误"); }
  };

  const handleAddConfig = async (key: 'types' | 'areas', value: string) => {
    if (!value) return;
    const newConfig = { ...config, [key]: [...config[key], value] };
    await fetch('/api/hazards/config', { method: 'POST', body: JSON.stringify(newConfig) });
    setConfig(newConfig);
  };
  
  const handleDeleteConfig = async (key: 'types' | 'areas', value: string) => {
      const newConfig = { ...config, [key]: config[key].filter(v => v !== value) };
      await fetch('/api/hazards/config', { method: 'POST', body: JSON.stringify(newConfig) });
      setConfig(newConfig);
  };

  const filteredHazards = hazards.filter(h => {
      const matchType = !filterType || h.type === filterType;
      const matchArea = !filterArea || h.location === filterArea;
      const matchStatus = !filterStatus || h.status === filterStatus;
      const matchRisk = !filterRisk || h.riskLevel === filterRisk;
      
      if (viewMode === 'my_tasks') {
          return (h.reporterId === user?.id || h.responsibleId === user?.id) && matchType && matchArea && matchStatus && matchRisk;
      }
      return matchType && matchArea && matchStatus && matchRisk;
  });

  const stats = useMemo(() => {
      const total = hazards.length;
      const closed = hazards.filter(h => h.status === 'closed').length;
      const rate = total ? Math.round((closed / total) * 100) : 0;
      const typeDist = config.types.map(t => ({ name: t, count: hazards.filter(h => h.type === t).length }));
      const areaDist = config.areas.map(a => ({ name: a, count: hazards.filter(h => h.location === a).length }));
      return { total, closed, rate, typeDist, areaDist };
  }, [hazards, config]);

  const paginatedHazards = filteredHazards.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* 隐藏的文件输入框，用于批量导入 */}
      <input type="file" ref={importInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleBatchImport} />

      <div className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 space-y-2">
         <div className="mb-6 flex items-center gap-2 text-slate-800 font-bold text-lg px-2"><AlertTriangle className="text-red-500" />隐患排查治理</div>
         <NavBtn active={viewMode==='overview'} icon={<LayoutDashboard size={18}/>} label="工作台概览" onClick={()=>setViewMode('overview')} />
         <NavBtn active={viewMode==='my_tasks'} icon={<ListTodo size={18}/>} label="我的任务" onClick={()=>setViewMode('my_tasks')} />
         <NavBtn active={viewMode==='all_list'} icon={<Search size={18}/>} label="隐患查询" onClick={()=>setViewMode('all_list')} />
         {hasPerm('view_stats') && <NavBtn active={viewMode==='stats'} icon={<BarChart3 size={18}/>} label="统计分析" onClick={()=>setViewMode('stats')} />}
         <div className="border-t pt-4 mt-4">
             {hasPerm('report') && <button onClick={() => setShowReportModal(true)} className="w-full bg-red-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 transition shadow-sm mb-2"><Plus size={18} /> 立即上报</button>}
             {hasPerm('manage_config') && <NavBtn active={viewMode==='config'} icon={<Settings size={18}/>} label="基础设置 (Admin)" onClick={()=>setViewMode('config')} />}
         </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {['overview', 'my_tasks', 'all_list'].includes(viewMode) && (
            <div className="bg-white border-b p-4 flex gap-3 items-center flex-wrap">
                {/* 筛选条件 */}
                <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2">
                    <Filter size={16} className="text-slate-400"/>
                    <select className="bg-transparent outline-none text-sm" value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">所有类型</option>{config.types.map(t=><option key={t} value={t}>{t}</option>)}</select>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2">
                    <MapPin size={16} className="text-slate-400"/>
                    <select className="bg-transparent outline-none text-sm" value={filterArea} onChange={e=>setFilterArea(e.target.value)}><option value="">所有区域</option>{config.areas.map(a=><option key={a} value={a}>{a}</option>)}</select>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2">
                    <Siren size={16} className="text-slate-400"/>
                    <select className="bg-transparent outline-none text-sm" value={filterRisk} onChange={e=>setFilterRisk(e.target.value)}><option value="">所有风险</option><option value="low">低风险</option><option value="medium">中风险</option><option value="high">高风险</option><option value="major">重大风险</option></select>
                </div>
                
                {/* 按钮组 */}
                <div className="ml-auto flex gap-2">
                    {/* ✅ 批量导入按钮 */}
                    {hasPerm('report') && (
                        <button onClick={()=>importInputRef.current?.click()} className="flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg text-sm hover:bg-blue-100 transition">
                            <UploadCloud size={16}/> 批量导入
                        </button>
                    )}
                    <button onClick={handleExport} className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg text-sm hover:bg-green-100 transition">
                        <FileSpreadsheet size={16}/> 导出Excel
                    </button>
                </div>
            </div>
        )}

        <div className="flex-1 overflow-auto p-6">
            {viewMode === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-4 gap-4">
                        <StatCard label="待整改 (高风险)" value={hazards.filter(h=>h.status==='assigned' && (h.riskLevel==='high'||h.riskLevel==='major')).length} color="text-red-600" />
                        <StatCard label="整改中" value={hazards.filter(h=>h.status==='rectifying').length} color="text-blue-600" />
                        <StatCard label="延期申请" value={hazards.filter(h=>h.isExtensionRequested).length} color="text-orange-600" />
                        <StatCard label="整改闭环率" value={stats.rate + '%'} color="text-green-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Clock size={18}/> 最新上报</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredHazards.slice(0, 6).map(h => <HazardCard key={h.id} data={h} onClick={()=>{setSelectedHazard(h); setShowDetailModal(true); setShowExtensionForm(false); setProcessData({}); }} />)}
                        </div>
                    </div>
                </div>
            )}

            {(viewMode === 'all_list' || viewMode === 'my_tasks') && (
                 <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col h-full">
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b text-slate-500 sticky top-0">
                                <tr><th className="p-4">风险/状态</th><th className="p-4">描述</th><th className="p-4">责任信息</th><th className="p-4 text-right">操作</th></tr>
                            </thead>
                            <tbody>
                                {paginatedHazards.map(h => (
                                    <tr key={h.id} className="border-b hover:bg-slate-50 transition cursor-pointer" onClick={()=>{setSelectedHazard(h); setShowDetailModal(true); setShowExtensionForm(false); setProcessData({}); }}>
                                        <td className="p-4 space-y-1"><div>{getRiskBadge(h.riskLevel)}</div><div>{getStatusBadge(h.status)}</div></td>
                                        <td className="p-4 max-w-xs"><div className="truncate font-medium text-slate-800">{h.desc}</div><div className="text-xs text-slate-400 mt-1">{h.location} | {h.type}</div></td>
                                        <td className="p-4">
                                            {h.responsibleName ? (
                                                <div>
                                                    <div className="font-bold text-slate-700">{h.responsibleName}</div>
                                                    <div className={`text-xs ${new Date(h.deadline!) < new Date() && h.status!=='closed' ? 'text-red-500 font-bold' : 'text-slate-400'}`}>截止: {h.deadline}</div>
                                                    {h.isExtensionRequested && <span className="text-[10px] bg-orange-100 text-orange-600 px-1 rounded animate-pulse">申请延期</span>}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2 items-center">
                                            <button className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-xs font-bold border border-blue-200">查看</button>
                                            {hasPerm('delete') && <button onClick={(e) => handleDelete(h.id, e)} className="text-red-600 hover:bg-red-50 p-1.5 rounded border border-transparent hover:border-red-200"><Trash2 size={16}/></button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 border-t bg-slate-50 flex justify-between items-center text-sm text-slate-500">
                        <span>第 {page} 页 / 共 {Math.ceil(filteredHazards.length/pageSize) || 1} 页</span>
                        <div className="flex gap-2">
                            <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50">上一页</button>
                            <button disabled={page>=Math.ceil(filteredHazards.length/pageSize)} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50">下一页</button>
                        </div>
                    </div>
                 </div>
            )}

            {viewMode === 'stats' && backendStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h4 className="font-bold mb-4 text-slate-700">隐患风险分布</h4>
                        <div className="flex gap-6 items-center">
                            <div className="w-32 h-32 rounded-full border-[10px] border-slate-100 flex items-center justify-center relative">
                                {/* 这里使用简单的 CSS 渐变模拟饼图视觉，实际项目可用 ECharts/Recharts */}
                                <div className="absolute inset-0 rounded-full border-[10px] border-l-blue-500 border-t-yellow-500 border-r-orange-500 border-b-red-500 opacity-80"></div>
                                <span className="font-bold text-slate-500 text-xs">分布图</span>
                            </div>
                            <div className="space-y-2 text-sm flex-1">
                                <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-600"/> 重大风险</span> <span className="font-bold">{backendStats.riskStats.major}</span></div>
                                <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"/> 高风险</span> <span className="font-bold">{backendStats.riskStats.high}</span></div>
                                <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500"/> 中风险</span> <span className="font-bold">{backendStats.riskStats.medium}</span></div>
                                <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"/> 低风险</span> <span className="font-bold">{backendStats.riskStats.low}</span></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h4 className="font-bold mb-4 text-slate-700">近30天同区域同类隐患 TOP5</h4>
                        <div className="space-y-3">
                            {backendStats.recurringIssues.length === 0 && <div className="text-slate-400 text-center py-8">暂无重复发生隐患</div>}
                            {backendStats.recurringIssues.slice(0,5).map((item:any, idx:number) => (
                                <div key={item.key} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded">
                                    <span className="flex items-center gap-2"><span className="bg-slate-200 text-slate-600 w-5 h-5 rounded-full flex items-center justify-center text-xs">{idx+1}</span> {item.key}</span>
                                    <span className="font-bold text-red-600">{item.count}次</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between font-bold text-lg"><h3>上报隐患</h3><button onClick={()=>setShowReportModal(false)}><X/></button></div>
                
                <div className="flex gap-2 overflow-x-auto pb-2">
                   {tempPhotos.map((p,i) => <img key={i} src={p} className="w-20 h-20 object-cover rounded border" />)}
                   <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-red-400 hover:text-red-500 transition">
                       <Camera size={24}/><span className="text-xs">添加照片</span><input type="file" accept="image/*" className="hidden" onChange={(e)=>handlePhotoUpload(e)} />
                   </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold mb-1">隐患类型</label>
                        <select className="w-full border rounded p-2" onChange={e=>setNewHazardData({...newHazardData, type: e.target.value})}><option value="">请选择...</option>{config.types.map(t=><option key={t} value={t}>{t}</option>)}</select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">发现地点</label>
                        <select className="w-full border rounded p-2" onChange={e=>setNewHazardData({...newHazardData, location: e.target.value})}><option value="">请选择...</option>{config.areas.map(a=><option key={a} value={a}>{a}</option>)}</select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold mb-1">风险等级</label>
                    <div className="flex gap-2">
                        {['low','medium','high','major'].map(l => (
                            <button key={l} onClick={()=>setNewHazardData({...newHazardData, riskLevel: l as any})}
                                className={`px-3 py-1 rounded text-sm border transition ${newHazardData.riskLevel===l ? 'bg-slate-800 text-white shadow-md transform scale-105' : 'bg-white hover:bg-slate-50'}`}
                            >
                                {l==='major'?'重大':l==='high'?'高':l==='medium'?'中':'低'}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">建议责任部门 (可选)</label>
                   <select className="w-full border rounded p-2" onChange={e=>setNewHazardData({...newHazardData, responsibleDept: e.target.value})}><option value="">未知/待定</option>{departments.map(d=><option key={d} value={d}>{d}</option>)}</select>
                </div>

                <textarea className="w-full border rounded p-2 h-20" placeholder="隐患描述..." onChange={e=>setNewHazardData({...newHazardData, desc: e.target.value})}></textarea>
                <button onClick={submitReport} className="w-full bg-red-600 text-white py-2 rounded shadow hover:bg-red-700 font-bold">提交</button>
           </div>
        </div>
      )}

      {showDetailModal && selectedHazard && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl h-[90vh] flex flex-col">
                 <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                     <div className="flex items-center gap-3">
                         <h3 className="font-bold text-lg text-slate-800">隐患详情</h3>
                         {getRiskBadge(selectedHazard.riskLevel)}
                         {selectedHazard.isExtensionRequested && <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded text-xs border border-orange-200 flex items-center gap-1"><CalendarClock size={12}/> 申请延期中</span>}
                     </div>
                     <div className="flex gap-2">
                        {hasPerm('delete') && <button onClick={() => handleDelete(selectedHazard.id)} className="flex items-center gap-1 text-red-600 hover:bg-red-50 px-3 py-1 rounded text-sm font-bold transition"><Trash2 size={16}/> 删除</button>}
                        <button onClick={()=>setShowDetailModal(false)} className="p-1 hover:bg-slate-200 rounded"><X/></button>
                     </div>
                 </div>
                 
                 <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                     <div className="flex-1 overflow-y-auto p-6 space-y-6">
                         <div className="bg-slate-50 p-4 rounded border">
                             <div className="font-bold text-lg mb-2">{selectedHazard.desc}</div>
                             <div className="flex gap-4 text-sm text-slate-500 mb-2">
                                 <span>类型: {selectedHazard.type}</span>
                                 <span>区域: {selectedHazard.location}</span>
                                 <span>上报: {selectedHazard.reporterName}</span>
                             </div>
                             <div className="flex gap-2">{selectedHazard.photos.map((s,i)=><img key={i} src={s} className="w-20 h-20 bg-white border object-cover"/>)}</div>
                         </div>

                         <div className="border border-dashed border-slate-300 p-3 rounded text-center text-slate-400 text-sm bg-slate-50">
                             暂无关联的 EHS 记录或作业票
                         </div>

                         <div className="border-t pt-4">
                             <h4 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2"><History size={16}/> 处理记录</h4>
                             <div className="space-y-4 pl-2">
                                 {selectedHazard.logs?.map((log, idx) => (
                                     <div key={idx} className="relative pl-6 border-l border-slate-200 pb-2 last:pb-0">
                                         <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-slate-300"></div>
                                         <div className="text-xs text-slate-400">{new Date(log.time).toLocaleString()}</div>
                                         <div className="text-sm"><span className="font-bold text-slate-700">{log.operatorName}</span> <span className="mx-1 text-slate-500">{log.action}</span></div>
                                         {log.changes && <div className="text-xs text-orange-600 bg-orange-50 inline-block px-1 rounded mt-1">{log.changes}</div>}
                                     </div>
                                 ))}
                             </div>
                         </div>
                     </div>

                     <div className="w-full md:w-80 bg-slate-50 border-l p-4 overflow-y-auto">
                         <div className="mb-4 font-bold flex justify-between items-center">
                             <span>当前状态</span>
                             {getStatusBadge(selectedHazard.status)}
                         </div>

                         {selectedHazard.status === 'reported' && hasPerm('assign') && (
                             <div className="space-y-3 p-3 bg-white rounded border shadow-sm">
                                 <h5 className="font-bold text-sm">指派任务</h5>
                                 {(() => {
                                     const targetDept = processData.responsibleDept ?? selectedHazard.responsibleDept ?? '';
                                     return (
                                         <>
                                             <select className="w-full border rounded p-2 text-sm" value={targetDept} onChange={e => setProcessData({...processData, responsibleDept: e.target.value, responsibleId: ''})}>
                                                 <option value="">请选择部门...</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}
                                             </select>
                                             <select className="w-full border rounded p-2 text-sm disabled:bg-slate-200" value={processData.responsibleId || ''} onChange={e => setProcessData({...processData, responsibleId: e.target.value})} disabled={!targetDept}>
                                                 <option value="">{targetDept ? '请选择人员...' : '请先选择部门'}</option>
                                                 {allUsers.filter(u => u.department === targetDept).map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
                                             </select>
                                         </>
                                     );
                                 })()}
                                 <input type="date" className="w-full border rounded p-2 text-sm" onChange={e=>setProcessData({...processData, deadline: e.target.value})} />
                                 <button onClick={()=>handleProcess('assign')} className="w-full bg-orange-500 text-white py-2 rounded text-sm shadow hover:bg-orange-600">确认指派</button>
                             </div>
                         )}

 {(selectedHazard.status === 'assigned' || selectedHazard.status === 'rectifying') && (
                             <div className="space-y-3">
                                 <div className="bg-orange-50 p-3 rounded border text-sm space-y-1">
                                    <div>责任人: {selectedHazard.responsibleName}</div>
                                    <div className="text-red-600 font-bold">截止: {selectedHazard.deadline}</div>
                                 </div>
                                 
                                 {/* ✅ 阶段一：点击开始整改 (仅在 assigned 状态下显示) */}
                                 {selectedHazard.status === 'assigned' && (
                                     <button onClick={()=>handleProcess('start_rectify')} className="w-full bg-blue-600 text-white py-2 rounded text-sm flex justify-center gap-2 shadow hover:bg-blue-700">
                                         <TimerReset size={16}/> 开始整改
                                     </button>
                                 )}

                                 {/* ✅ 延期申请逻辑：临期才显示按钮，点击展开表单 */}
                                 {!selectedHazard.isExtensionRequested && (selectedHazard.status === 'assigned' || selectedHazard.status === 'rectifying') && (
                                     <>
                                         {/* 只有未申请过，且临近截止日期(<=3天)才显示按钮 */}
                                         {isNearDeadline(selectedHazard.deadline) && !showExtensionForm && (
                                             <button onClick={()=>setShowExtensionForm(true)} className="w-full border border-orange-300 text-orange-600 py-1.5 rounded text-xs hover:bg-orange-50 flex justify-center gap-1 mt-2">
                                                 <CalendarClock size={14}/> 申请延期 (即将到期)
                                             </button>
                                         )}

                                         {/* 展开的延期表单 */}
                                         {showExtensionForm && (
                                             <div className="mt-2 p-3 bg-white border border-orange-200 rounded shadow-sm animate-in fade-in slide-in-from-top-2">
                                                 <h6 className="text-xs font-bold text-orange-700 mb-2">填写延期原因</h6>
                                                 <textarea className="w-full border p-2 text-xs mb-2 rounded h-16" placeholder="例如：备件未到货..." onChange={e=>setProcessData({...processData, extensionReason:e.target.value})}/>
                                                 <div className="flex gap-2">
                                                     <button onClick={()=>setShowExtensionForm(false)} className="flex-1 border text-slate-500 py-1 rounded text-xs">取消</button>
                                                     <button onClick={()=>handleProcess('request_extension')} className="flex-1 bg-orange-500 text-white py-1 rounded text-xs hover:bg-orange-600">提交申请</button>
                                                 </div>
                                             </div>
                                         )}
                                     </>
                                 )}
                                 
                                 {/* 延期审批逻辑 */}
                                 {selectedHazard.isExtensionRequested && (
                                     <div className="bg-white p-3 rounded border border-orange-200 shadow-sm">
                                         <h6 className="font-bold text-orange-600 text-xs mb-1">延期申请中</h6>
                                         <p className="text-xs text-slate-500 mb-2">原因: {selectedHazard.extensionReason}</p>
                                         {hasPerm('assign') && (
                                            <div className="pt-2 border-t">
                                                <div className="text-xs font-bold mb-1">新截止日期:</div>
                                                <input type="date" className="w-full border p-1 text-xs mb-2 rounded" onChange={e=>setProcessData({...processData, newDeadline:e.target.value})}/>
                                                <button onClick={()=>handleProcess('approve_extension')} className="w-full bg-orange-500 text-white py-1 rounded text-xs shadow hover:bg-orange-600">批准延期</button>
                                            </div>
                                         )}
                                     </div>
                                 )}
                             </div>
                         )}

                         {/* ✅ 阶段二：整改进行中 (rectifying) - 提交照片和描述 */}
                         {selectedHazard.status === 'rectifying' && (
                             <div className="space-y-3 p-4 bg-blue-50/50 rounded border border-blue-100 shadow-sm mt-4">
                                 <h5 className="font-bold text-sm text-blue-800 flex items-center gap-2"><Camera size={16}/> 提交整改结果</h5>
                                 
                                 {/* 照片上传 */}
                                 <div className="flex gap-2 overflow-x-auto pb-2">
                                    {processData.photos?.map((p:string,i:number) => <img key={i} src={p} className="w-16 h-16 object-cover rounded border" />)}
                                    <label className="w-16 h-16 border-2 border-dashed border-blue-300 rounded flex flex-col items-center justify-center text-blue-400 cursor-pointer hover:bg-blue-50 transition">
                                        <ImageIcon size={20}/>
                                        <input type="file" accept="image/*" className="hidden" onChange={(e)=>handlePhotoUpload(e, true)} />
                                    </label>
                                 </div>

                                 <textarea className="w-full border p-2 text-sm h-24 rounded focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none" placeholder="请详细描述整改措施..." onChange={e=>setProcessData({...processData, rectifyDesc:e.target.value})}></textarea>
                                 <button onClick={()=>handleProcess('finish_rectify')} className="w-full bg-green-600 text-white py-2 rounded text-sm shadow hover:bg-green-700 font-bold">提交整改闭环</button>
                             </div>
                         )}

                         {selectedHazard.status === 'verified' && hasPerm('handle') && (
                             <div className="space-y-3 p-3 bg-white rounded border shadow-sm">
                                 <h5 className="font-bold text-sm">验收确认</h5>
                                 <div className="bg-slate-100 p-2 text-xs text-slate-600 rounded">整改人描述: {selectedHazard.rectifyDesc}</div>
                                 <button onClick={()=>handleProcess('verify_pass')} className="w-full bg-green-600 text-white py-2 rounded text-sm shadow hover:bg-green-700">验收通过</button>
                                 <div className="border-t pt-2 mt-2">
                                     <input className="w-full border p-1 text-xs mb-1 rounded" placeholder="驳回原因..." onChange={e=>setProcessData({...processData, rejectReason:e.target.value})}/>
                                     <button onClick={()=>handleProcess('verify_reject')} className="w-full bg-red-50 text-red-600 border border-red-200 py-1 rounded text-xs flex justify-center gap-1 hover:bg-red-100"><Ban size={14}/> 驳回重整</button>
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
}
// --- 修复 HazardCard 缺少风险标识的问题 ---
function HazardCard({ data, onClick }: { data: HazardRecord, onClick: () => void }) {
    const statusMap = {
        'reported': { color: 'border-red-200 bg-red-50', text: '待指派' },
        'assigned': { color: 'border-orange-200 bg-orange-50', text: '待整改' },
        'rectifying': { color: 'border-blue-200 bg-blue-50', text: '整改中' },
        'verified': { color: 'border-purple-200 bg-purple-50', text: '待验收' },
        'closed': { color: 'border-green-200 bg-green-50', text: '已闭环' },
    };
    
    const riskMap = {
        'low': { color: 'bg-blue-100 text-blue-700', text: '低' },
        'medium': { color: 'bg-yellow-100 text-yellow-700', text: '中' },
        'high': { color: 'bg-orange-100 text-orange-700', text: '高' },
        'major': { color: 'bg-red-600 text-white shadow-sm', text: '重大' },
    };

    const s = statusMap[data.status] || statusMap['reported'];
    const r = riskMap[data.riskLevel] || riskMap['low'];

    return (
        <div onClick={onClick} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col h-full group">
            <div className="flex justify-between items-start mb-2">
                <div className="flex gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${s.color} text-slate-600`}>{s.text}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${r.color}`}>{r.text}风险</span>
                </div>
                <span className="text-xs text-slate-400">{new Date(data.reportTime).toLocaleDateString()}</span>
            </div>
            
            <div className="flex gap-3 mb-3">
                {data.photos[0] ? (
                    <img src={data.photos[0]} className="w-16 h-16 rounded object-cover border bg-slate-100 shrink-0" />
                ) : (
                    <div className="w-16 h-16 rounded border bg-slate-50 flex items-center justify-center text-slate-300 shrink-0"><Camera size={16}/></div>
                )}
                <div>
                    <h4 className="font-bold text-slate-800 text-sm line-clamp-2 mb-1 group-hover:text-red-600 transition-colors">{data.desc}</h4>
                    <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={10}/> {data.location}</div>
                </div>
            </div>

            <div className="mt-auto pt-3 border-t flex justify-between items-center text-xs text-slate-400">
                <span>{data.type}</span>
                <span className="flex items-center gap-1 hover:text-slate-600">详情 <ArrowRight size={12}/></span>
            </div>
        </div>
    )
}

function NavBtn({ active, icon, label, onClick }: any) {
    return <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${active ? 'bg-red-50 text-red-700 border border-red-100 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>{icon}{label}</button>
}
function StatCard({ label, value, color }: any) {
    return <div className="bg-white p-4 rounded-xl border shadow-sm"><div className="text-slate-400 text-xs mb-1">{label}</div><div className={`text-2xl font-bold ${color}`}>{value}</div></div>
}