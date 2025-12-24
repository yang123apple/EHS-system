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
  UploadCloud, ImageIcon, ChevronRight
} from 'lucide-react';
import DepartmentSelectModal from '@/components/work-permit/moduls/DepartmentSelectModal';

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

  // ✅ V2 新增字段
  rectifyRequirement?: string;      // 整改要求
  requireEmergencyPlan?: boolean;   // 是否要求应急预案
  emergencyPlanDeadline?: string;   // 应急预案截止日期
  emergencyPlanContent?: string;    // 应急预案内容
  emergencyPlanSubmitTime?: string; // 应急预案提交时间
  ccDepts?: string[];               // 抄送部门
  ccUsers?: string[];               // 抄送人员
};

// ✅ V2 新增类型：抄送规则
type CCRule = {
  id: string;
  name: string;
  riskLevels: ('low' | 'medium' | 'high' | 'major')[];
  ccDepts: string[];
  ccUsers: string[];
  enabled: boolean;
};

// ✅ V2 新增类型：应急预案规则
type EmergencyPlanRule = {
  id: string;
  name: string;
  riskLevels: ('high' | 'major')[];
  daysBeforeDeadline: number;
  enabled: boolean;
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

  // ✅ V2 新增：工作流规则
  const [ccRules, setCCRules] = useState<CCRule[]>([]);
  const [emergencyPlanRules, setEmergencyPlanRules] = useState<EmergencyPlanRule[]>([]);

  // ✅ V2 阶段6：部门选择弹窗状态
  const [showDeptSelectModal, setShowDeptSelectModal] = useState(false);

  // 导入 Ref
  const importInputRef = useRef<HTMLInputElement>(null);
  
  const hasPerm = (key: string) => user?.role === 'admin' || user?.permissions?.['hidden_danger']?.includes(key);

  // --- Effects ---
  useEffect(() => {
    fetchData();
    fetchConfig();
    fetchRealUsers();
    fetchStats();
    fetchWorkflowRules();
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

  // ✅ V2 新增：获取工作流规则
  const fetchWorkflowRules = async () => {
      try {
          const res = await fetch('/api/hazards/workflow');
          if (res.ok) {
              const data = await res.json();
              setCCRules(data.ccRules || []);
              setEmergencyPlanRules(data.emergencyPlanRules || []);
          }
      } catch (e) {
          console.error('获取工作流规则失败:', e);
      }
  };

  // ✅ V2 新增：自动匹配抄送规则
  const autoMatchCCRules = (riskLevel: string) => {
      const matchedRules = ccRules.filter(rule => 
          rule.enabled && rule.riskLevels.includes(riskLevel as any)
      );
      
      const ccDepts: string[] = [];
      const ccUsers: string[] = [];
      
      matchedRules.forEach(rule => {
          ccDepts.push(...rule.ccDepts);
          ccUsers.push(...rule.ccUsers);
      });
      
      return {
          ccDepts: Array.from(new Set(ccDepts)),
          ccUsers: Array.from(new Set(ccUsers))
      };
  };

  // ✅ V2 新增：检查是否需要应急预案
  const checkEmergencyPlanRequired = (riskLevel: string, deadline: string) => {
      const matchedRules = emergencyPlanRules.filter(rule =>
          rule.enabled && rule.riskLevels.includes(riskLevel as any)
      );
      
      if (matchedRules.length === 0) return { required: false };
      
      // 计算应急预案截止日期（截止日期前N天）
      const rectifyDeadline = new Date(deadline);
      const maxDays = Math.max(...matchedRules.map(r => r.daysBeforeDeadline));
      const planDeadline = new Date(rectifyDeadline);
      planDeadline.setDate(planDeadline.getDate() - maxDays);
      
      return {
          required: true,
          deadline: planDeadline.toISOString().split('T')[0]
      };
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
  const handleProcess = async (action: 'assign' | 'start_rectify' | 'finish_rectify' | 'verify_pass' | 'verify_reject' | 'request_extension' | 'approve_extension' | 'submit_emergency_plan') => {
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
            
            // ✅ V2：自动匹配抄送规则
            const ccInfo = autoMatchCCRules(selectedHazard.riskLevel);
            
            updates = {
                ...updates,
                actionName: '指派责任人',
                status: 'assigned',
                responsibleDept: processData.responsibleDept,
                responsibleId: processData.responsibleId,
                responsibleName: selectedUser?.name,
                deadline: processData.deadline,
                // ✅ V2 新增字段
                rectifyRequirement: processData.rectifyRequirement || selectedHazard.rectifyRequirement,
                requireEmergencyPlan: processData.requireEmergencyPlan || false,
                emergencyPlanDeadline: processData.emergencyPlanDeadline,
                ccDepts: ccInfo.ccDepts,
                ccUsers: ccInfo.ccUsers
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
        
        case 'submit_emergency_plan':
            if (!processData.emergencyPlanContent) return alert("请填写应急预案内容");
            updates = {
                ...updates,
                actionName: '提交应急预案',
                emergencyPlanContent: processData.emergencyPlanContent,
                emergencyPlanSubmitTime: new Date().toISOString()
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

      <div className="w-16 md:w-64 bg-white border-r border-slate-200 flex flex-col p-2 md:p-4 space-y-1 md:space-y-2 transition-all">
         <div className="mb-3 md:mb-6 flex items-center gap-2 text-slate-800 font-bold text-sm md:text-lg px-1 md:px-2">
           <AlertTriangle className="text-red-500" size={18} />
           <span className="hidden md:inline">隐患排查治理</span>
         </div>
         <NavBtn active={viewMode==='overview'} icon={<LayoutDashboard size={18} />} label="工作台" onClick={()=>setViewMode('overview')} />
         <NavBtn active={viewMode==='my_tasks'} icon={<ListTodo size={18} />} label="我的任务" onClick={()=>setViewMode('my_tasks')} />
         <NavBtn active={viewMode==='all_list'} icon={<Search size={18} />} label="隐患查询" onClick={()=>setViewMode('all_list')} />
         {hasPerm('view_stats') && <NavBtn active={viewMode==='stats'} icon={<BarChart3 size={18} />} label="统计" onClick={()=>setViewMode('stats')} />}
         <div className="border-t pt-2 md:pt-4 mt-2 md:mt-4">
             {hasPerm('report') && <button onClick={() => setShowReportModal(true)} className="w-full bg-red-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 transition shadow-sm mb-2 text-xs md:text-sm">
               <Plus size={18} /> 
               <span className="hidden md:inline">立即上报</span>
             </button>}
             {hasPerm('manage_config') && <NavBtn active={viewMode==='config'} icon={<Settings size={18} />} label="设置" onClick={()=>setViewMode('config')} />}
         </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {['overview', 'my_tasks', 'all_list'].includes(viewMode) && (
            <div className="bg-white border-b p-2 md:p-4 flex gap-2 md:gap-3 items-center flex-wrap">
                {/* 筛选条件 */}
                <div className="flex items-center gap-1 md:gap-2 bg-slate-50 border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm">
                    <Filter size={14} className="text-slate-400 hidden md:block"/>
                    <select className="bg-transparent outline-none text-xs md:text-sm" value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">类型</option>{config.types.map(t=><option key={t} value={t}>{t}</option>)}</select>
                </div>
                <div className="flex items-center gap-1 md:gap-2 bg-slate-50 border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm">
                    <MapPin size={14} className="text-slate-400 hidden md:block"/>
                    <select className="bg-transparent outline-none text-xs md:text-sm" value={filterArea} onChange={e=>setFilterArea(e.target.value)}><option value="">区域</option>{config.areas.map(a=><option key={a} value={a}>{a}</option>)}</select>
                </div>
                
                {/* 按钮组 */}
                <div className="ml-auto flex gap-2">
                    {hasPerm('report') && (
                        <button onClick={()=>importInputRef.current?.click()} className="flex items-center gap-1 md:gap-2 text-blue-700 bg-blue-50 border border-blue-200 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm hover:bg-blue-100 transition">
                            <UploadCloud size={14}/> <span className="hidden sm:inline">导入</span>
                        </button>
                    )}
                    <button onClick={handleExport} className="flex items-center gap-1 md:gap-2 text-green-700 bg-green-50 border border-green-200 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm hover:bg-green-100 transition">
                        <FileSpreadsheet size={14}/> <span className="hidden sm:inline">导出</span>
                    </button>
                </div>
            </div>
        )}

        <div className="flex-1 overflow-auto p-6">
            {viewMode === 'overview' && (
                <div className="space-y-4 md:space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                        <StatCard label="待整改 (高风险)" value={hazards.filter(h=>h.status==='assigned' && (h.riskLevel==='high'||h.riskLevel==='major')).length} color="text-red-600" />
                        <StatCard label="整改中" value={hazards.filter(h=>h.status==='rectifying').length} color="text-blue-600" />
                        <StatCard label="延期申请" value={hazards.filter(h=>h.isExtensionRequested).length} color="text-orange-600" />
                        <StatCard label="整改闭环率" value={stats.rate + '%'} color="text-green-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm md:text-base"><Clock size={16} className="md:hidden"/><Clock size={18} className="hidden md:block"/> 最新上报</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                            {filteredHazards.slice(0, 6).map(h => <HazardCard key={h.id} data={h} onClick={()=>{setSelectedHazard(h); setShowDetailModal(true); setShowExtensionForm(false); setProcessData({}); }} />)}
                        </div>
                    </div>
                </div>
            )}

            {(viewMode === 'all_list' || viewMode === 'my_tasks') && (
                 <div className="bg-white rounded-lg md:rounded-xl shadow-sm border overflow-hidden flex flex-col h-full">
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-xs md:text-sm text-left min-w-[640px]">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="bg-white p-4 md:p-6 rounded-xl border shadow-sm">
                        <h4 className="font-bold mb-3 md:mb-4 text-slate-700 text-sm md:text-base">隐患风险分布</h4>
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

            {/* ✅ V2 阶段5：配置页面 */}
            {viewMode === 'config' && (
                <ConfigView 
                    config={config}
                    ccRules={ccRules}
                    emergencyPlanRules={emergencyPlanRules}
                    departments={departments}
                    allUsers={allUsers}
                    onConfigChange={setConfig}
                    onCCRulesChange={setCCRules}
                    onEmergencyPlanRulesChange={setEmergencyPlanRules}
                    onAddConfig={handleAddConfig}
                    onDeleteConfig={handleDeleteConfig}
                />
            )}
        </div>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm">
           <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-4 md:p-6 space-y-3 md:space-y-4 max-h-[95vh] overflow-y-auto">
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

                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">隐患描述</label>
                   <textarea className="w-full border rounded p-2 h-20" placeholder="详细描述发现的隐患..." onChange={e=>setNewHazardData({...newHazardData, desc: e.target.value})}></textarea>
                </div>

                {/* ✅ V2 新增：整改要求输入 */}
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">建议整改要求 (可选)</label>
                   <textarea className="w-full border rounded p-2 h-16 text-sm" placeholder="例如：更换老化电缆、加装防护栏..." onChange={e=>setNewHazardData({...newHazardData, rectifyRequirement: e.target.value})}></textarea>
                   <div className="text-xs text-slate-400 mt-1">💡 提示：填写建议的整改措施，可帮助责任人快速理解整改方向</div>
                </div>

                <button onClick={submitReport} className="w-full bg-red-600 text-white py-2 rounded shadow hover:bg-red-700 font-bold">提交</button>
           </div>
        </div>
      )}

      {/* ✅ V2 阶段6：部门选择弹窗 */}
      <DepartmentSelectModal
        isOpen={showDeptSelectModal}
        onClose={() => setShowDeptSelectModal(false)}
        onSelect={(deptId, deptName) => {
          setProcessData({...processData, responsibleDept: deptName, responsibleId: ''});
          setShowDeptSelectModal(false);
        }}
        selectedDeptId={processData.responsibleDept}
      />

      {showDetailModal && selectedHazard && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm">
             <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl h-[95vh] md:h-[90vh] flex flex-col">
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
                 
                 <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                     <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6">
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

                     <div className="w-full lg:w-80 bg-slate-50 border-t lg:border-t-0 lg:border-l p-3 md:p-4 overflow-y-auto max-h-[40vh] lg:max-h-none">
                         <div className="mb-4 font-bold flex justify-between items-center">
                             <span>当前状态</span>
                             {getStatusBadge(selectedHazard.status)}
                         </div>

                         {selectedHazard.status === 'reported' && hasPerm('assign') && (
                             <div className="space-y-3 p-3 bg-white rounded border shadow-sm">
                                 <h5 className="font-bold text-sm text-orange-700">一步指派任务</h5>
                                 
                                 {/* ✅ V2 阶段6：使用DepartmentSelectModal替换下拉框 */}
                                 {(() => {
                                     const targetDept = processData.responsibleDept ?? selectedHazard.responsibleDept ?? '';
                                     return (
                                         <>
                                             <div>
                                                 <label className="block text-xs font-bold text-slate-600 mb-1">责任部门 *</label>
                                                 <button 
                                                     onClick={() => setShowDeptSelectModal(true)}
                                                     className="w-full border rounded p-2 text-sm text-left hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-between group"
                                                 >
                                                     <span className={targetDept ? "text-slate-800" : "text-slate-400"}>
                                                         {targetDept || "点击选择部门..."}
                                                     </span>
                                                     <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-500" />
                                                 </button>
                                             </div>
                                             <div>
                                                 <label className="block text-xs font-bold text-slate-600 mb-1">责任人 *</label>
                                                 <select className="w-full border rounded p-2 text-sm disabled:bg-slate-200" value={processData.responsibleId || ''} onChange={e => setProcessData({...processData, responsibleId: e.target.value})} disabled={!targetDept}>
                                                     <option value="">{targetDept ? '请选择人员...' : '请先选择部门'}</option>
                                                     {allUsers.filter(u => u.department === targetDept).map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
                                                 </select>
                                             </div>
                                         </>
                                     );
                                 })()}
                                 
                                 {/* 截止日期 */}
                                 <div>
                                     <label className="block text-xs font-bold text-slate-600 mb-1">整改截止日期 *</label>
                                     <input type="date" className="w-full border rounded p-2 text-sm" onChange={e=>{
                                         setProcessData({...processData, deadline: e.target.value});
                                         // 自动检查应急预案要求
                                         if (e.target.value) {
                                             const planCheck = checkEmergencyPlanRequired(selectedHazard.riskLevel, e.target.value);
                                             if (planCheck.required) {
                                                 setProcessData((prev: any) => ({
                                                     ...prev,
                                                     deadline: e.target.value,
                                                     requireEmergencyPlan: true,
                                                     emergencyPlanDeadline: planCheck.deadline
                                                 }));
                                             }
                                         }
                                     }} />
                                 </div>
                                 
                                 {/* 整改要求 */}
                                 <div>
                                     <label className="block text-xs font-bold text-slate-600 mb-1">整改要求</label>
                                     <textarea 
                                         className="w-full border rounded p-2 text-sm h-20" 
                                         placeholder="详细描述整改措施要求..."
                                         defaultValue={selectedHazard.rectifyRequirement || ''}
                                         onChange={e=>setProcessData({...processData, rectifyRequirement: e.target.value})}
                                     />
                                     {selectedHazard.rectifyRequirement && (
                                         <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-1">
                                             💡 上报人建议：{selectedHazard.rectifyRequirement}
                                         </div>
                                     )}
                                 </div>
                                 
                                 {/* 应急预案要求（自动判断） */}
                                 {processData.requireEmergencyPlan && (
                                     <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
                                         <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                                             <Siren size={16}/>
                                             <span>需要提交应急预案</span>
                                         </div>
                                         <div className="text-xs text-red-600">
                                             截止日期：{processData.emergencyPlanDeadline}
                                         </div>
                                         <div className="text-xs text-slate-600">
                                             根据规则，{selectedHazard.riskLevel === 'major' ? '重大' : '高'}风险隐患需要在整改前提交应急预案
                                         </div>
                                     </div>
                                 )}
                                 
                                 {/* 抄送信息（自动匹配） */}
                                 {(() => {
                                     const ccInfo = autoMatchCCRules(selectedHazard.riskLevel);
                                     if (ccInfo.ccDepts.length > 0 || ccInfo.ccUsers.length > 0) {
                                         return (
                                             <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
                                                 <div className="font-bold text-sm text-blue-700">自动抄送</div>
                                                 {ccInfo.ccDepts.length > 0 && (
                                                     <div className="text-xs">
                                                         <span className="text-slate-600">部门：</span>
                                                         <span className="text-blue-700">{ccInfo.ccDepts.join(', ')}</span>
                                                     </div>
                                                 )}
                                                 {ccInfo.ccUsers.length > 0 && (
                                                     <div className="text-xs">
                                                         <span className="text-slate-600">人员：</span>
                                                         <span className="text-blue-700">
                                                             {ccInfo.ccUsers.map(userId => {
                                                                 const user = allUsers.find(u => u.id === userId);
                                                                 return user?.name || userId;
                                                             }).join(', ')}
                                                         </span>
                                                     </div>
            )}

        </div>
    );
}
                                     return null;
                                 })()}
                                 
                                 <button 
                                     onClick={()=>handleProcess('assign')} 
                                     className="w-full bg-orange-500 text-white py-2 rounded text-sm shadow hover:bg-orange-600 font-bold flex items-center justify-center gap-2"
                                 >
                                     <CheckCircle size={16}/>
                                     确认指派
                                 </button>
                             </div>
                         )}

 {(selectedHazard.status === 'assigned' || selectedHazard.status === 'rectifying') && (
                             <div className="space-y-3">
                                 <div className="bg-orange-50 p-3 rounded border text-sm space-y-1">
                                    <div>责任人: {selectedHazard.responsibleName}</div>
                                    <div className="text-red-600 font-bold">截止: {selectedHazard.deadline}</div>
                                    {selectedHazard.rectifyRequirement && (
                                        <div className="text-xs text-slate-600 mt-2 pt-2 border-t">
                                            <div className="font-bold mb-1">整改要求：</div>
                                            <div className="bg-white p-2 rounded text-slate-700">{selectedHazard.rectifyRequirement}</div>
                                        </div>
                                    )}
                                 </div>
                                 
                                 {/* ✅ V2 阶段4：应急预案提交 */}
                                 {selectedHazard.requireEmergencyPlan && !selectedHazard.emergencyPlanContent && (
                                     <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
                                         <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                                             <Siren size={16}/>
                                             <span>需要提交应急预案</span>
                                         </div>
                                         <div className="text-xs text-red-600">
                                             截止日期：{selectedHazard.emergencyPlanDeadline}
                                             {new Date(selectedHazard.emergencyPlanDeadline!) < new Date() && (
                                                 <span className="ml-2 bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">已逾期</span>
                                             )}
                                         </div>
                                         <textarea 
                                             className="w-full border border-red-300 p-2 text-sm h-24 rounded focus:ring-2 focus:ring-red-200" 
                                             placeholder="请详细描述应急预案内容，包括应急措施、资源准备、责任分工等..."
                                             onChange={e=>setProcessData({...processData, emergencyPlanContent:e.target.value})}
                                         />
                                         <button 
                                             onClick={()=>handleProcess('submit_emergency_plan')} 
                                             className="w-full bg-red-600 text-white py-2 rounded text-sm shadow hover:bg-red-700 font-bold"
                                         >
                                             提交应急预案
                                         </button>
                                     </div>
                                 )}
                                 
                                 {/* ✅ V2 阶段4：应急预案已提交显示 */}
                                 {selectedHazard.emergencyPlanContent && (
                                     <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                                         <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                                             <CheckCircle size={16}/>
                                             <span>应急预案已提交</span>
                                         </div>
                                         <div className="text-xs text-green-600">
                                             提交时间：{new Date(selectedHazard.emergencyPlanSubmitTime!).toLocaleString()}
                                         </div>
                                         <div className="bg-white p-2 rounded text-xs text-slate-700 max-h-32 overflow-y-auto">
                                             {selectedHazard.emergencyPlanContent}
                                         </div>
                                     </div>
                                 )}
                                 
                                 {/* ✅ 阶段一：点击开始整改 (仅在 assigned 状态下显示，且如需应急预案则必须先提交) */}
                                 {selectedHazard.status === 'assigned' && (
                                     <>
                                         {selectedHazard.requireEmergencyPlan && !selectedHazard.emergencyPlanContent ? (
                                             <div className="bg-slate-100 border border-slate-300 text-slate-500 py-2 rounded text-sm text-center">
                                                 <AlertCircle size={16} className="inline mr-1"/>
                                                 请先提交应急预案后才能开始整改
                                             </div>
                                         ) : (
                                             <button onClick={()=>handleProcess('start_rectify')} className="w-full bg-blue-600 text-white py-2 rounded text-sm flex justify-center gap-2 shadow hover:bg-blue-700">
                                                 <TimerReset size={16}/> 开始整改
                                             </button>
                                         )}
                                     </>
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
        <div onClick={onClick} className="bg-white border rounded-lg md:rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col h-full group">
            <div className="flex justify-between items-start mb-2">
                <div className="flex gap-1.5 md:gap-2">
                    <span className={`text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded border ${s.color} text-slate-600`}>{s.text}</span>
                    <span className={`text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded font-bold ${r.color}`}>{r.text}风险</span>
                </div>
                <span className="text-[10px] md:text-xs text-slate-400">{new Date(data.reportTime).toLocaleDateString()}</span>
            </div>
            
            <div className="flex gap-2 md:gap-3 mb-2 md:mb-3">
                {data.photos[0] ? (
                    <img src={data.photos[0]} className="w-12 h-12 md:w-16 md:h-16 rounded object-cover border bg-slate-100 shrink-0" />
                ) : (
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded border bg-slate-50 flex items-center justify-center text-slate-300 shrink-0"><Camera size={14} className="md:hidden"/><Camera size={16} className="hidden md:block"/></div>
                )}
                <div>
                    <h4 className="font-bold text-slate-800 text-xs md:text-sm line-clamp-2 mb-1 group-hover:text-red-600 transition-colors">{data.desc}</h4>
                    <div className="text-[10px] md:text-xs text-slate-500 flex items-center gap-1"><MapPin size={8} className="md:hidden"/><MapPin size={10} className="hidden md:block"/> {data.location}</div>
                </div>
            </div>

            <div className="mt-auto pt-2 md:pt-3 border-t flex justify-between items-center text-[10px] md:text-xs text-slate-400">
                <span>{data.type}</span>
                <span className="flex items-center gap-1 hover:text-slate-600">详情 <ArrowRight size={10} className="md:hidden"/><ArrowRight size={12} className="hidden md:block"/></span>
            </div>
        </div>
    )
}

function NavBtn({ active, icon, label, onClick }: any) {
    return <button onClick={onClick} className={`w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-2 md:px-4 py-2 md:py-2.5 rounded-lg transition-all text-xs md:text-sm font-medium ${active ? 'bg-red-50 text-red-700 border border-red-100 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>{icon}<span className="hidden md:inline">{label}</span></button>
}
function StatCard({ label, value, color }: any) {
    return <div className="bg-white p-3 md:p-4 rounded-xl border shadow-sm"><div className="text-slate-400 text-[10px] md:text-xs mb-1">{label}</div><div className={`text-lg md:text-2xl font-bold ${color}`}>{value}</div></div>
}

// ✅ V2 阶段5：配置视图组件
function ConfigView({ 
    config, 
    ccRules, 
    emergencyPlanRules, 
    departments, 
    allUsers,
    onConfigChange,
    onCCRulesChange,
    onEmergencyPlanRulesChange,
    onAddConfig,
    onDeleteConfig
}: {
    config: HazardConfig;
    ccRules: CCRule[];
    emergencyPlanRules: EmergencyPlanRule[];
    departments: string[];
    allUsers: SimpleUser[];
    onConfigChange: (config: HazardConfig) => void;
    onCCRulesChange: (rules: CCRule[]) => void;
    onEmergencyPlanRulesChange: (rules: EmergencyPlanRule[]) => void;
    onAddConfig: (key: 'types' | 'areas', value: string) => void;
    onDeleteConfig: (key: 'types' | 'areas', value: string) => void;
}) {
    const [activeTab, setActiveTab] = useState<'basic' | 'cc' | 'plan'>('basic');
    const [editingCCRule, setEditingCCRule] = useState<CCRule | null>(null);
    const [editingPlanRule, setEditingPlanRule] = useState<EmergencyPlanRule | null>(null);
    const [newType, setNewType] = useState('');
    const [newArea, setNewArea] = useState('');

    // 保存工作流规则到后端
    const saveWorkflowRules = async () => {
        try {
            await fetch('/api/hazards/workflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ccRules, emergencyPlanRules })
            });
            alert('规则保存成功！');
        } catch (e) {
            alert('保存失败，请重试');
        }
    };

    // 添加/编辑抄送规则
    const saveCCRule = () => {
        if (!editingCCRule) return;
        
        const exists = ccRules.find(r => r.id === editingCCRule.id);
        if (exists) {
            onCCRulesChange(ccRules.map(r => r.id === editingCCRule.id ? editingCCRule : r));
        } else {
            onCCRulesChange([...ccRules, editingCCRule]);
        }
        setEditingCCRule(null);
    };

    // 删除抄送规则
    const deleteCCRule = (id: string) => {
        if (confirm('确定删除此规则？')) {
            onCCRulesChange(ccRules.filter(r => r.id !== id));
        }
    };

    // 添加/编辑应急预案规则
    const savePlanRule = () => {
        if (!editingPlanRule) return;
        
        const exists = emergencyPlanRules.find(r => r.id === editingPlanRule.id);
        if (exists) {
            onEmergencyPlanRulesChange(emergencyPlanRules.map(r => r.id === editingPlanRule.id ? editingPlanRule : r));
        } else {
            onEmergencyPlanRulesChange([...emergencyPlanRules, editingPlanRule]);
        }
        setEditingPlanRule(null);
    };

    // 删除应急预案规则
    const deletePlanRule = (id: string) => {
        if (confirm('确定删除此规则？')) {
            onEmergencyPlanRulesChange(emergencyPlanRules.filter(r => r.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            {/* 标签页 */}
            <div className="bg-white rounded-lg border shadow-sm p-4">
                <div className="flex gap-2 border-b pb-2">
                    <button 
                        onClick={() => setActiveTab('basic')}
                        className={`px-4 py-2 rounded-t text-sm font-medium transition ${activeTab === 'basic' ? 'bg-red-50 text-red-700 border-b-2 border-red-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        基础配置
                    </button>
                    <button 
                        onClick={() => setActiveTab('cc')}
                        className={`px-4 py-2 rounded-t text-sm font-medium transition ${activeTab === 'cc' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        抄送规则
                    </button>
                    <button 
                        onClick={() => setActiveTab('plan')}
                        className={`px-4 py-2 rounded-t text-sm font-medium transition ${activeTab === 'plan' ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        应急预案规则
                    </button>
                </div>
            </div>

            {/* 基础配置 */}
            {activeTab === 'basic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h4 className="font-bold mb-4 text-slate-700">隐患类型配置</h4>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                className="flex-1 border rounded p-2 text-sm" 
                                placeholder="输入新类型..."
                                value={newType}
                                onChange={e => setNewType(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && (onAddConfig('types', newType), setNewType(''))}
                            />
                            <button 
                                onClick={() => {onAddConfig('types', newType); setNewType('');}}
                                className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700"
                            >
                                添加
                            </button>
                        </div>
                        <div className="space-y-2">
                            {config.types.map(t => (
                                <div key={t} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                                    <span className="text-sm">{t}</span>
                                    <button onClick={() => onDeleteConfig('types', t)} className="text-red-600 hover:bg-red-50 p-1 rounded">
                                        <X size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h4 className="font-bold mb-4 text-slate-700">区域配置</h4>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                className="flex-1 border rounded p-2 text-sm" 
                                placeholder="输入新区域..."
                                value={newArea}
                                onChange={e => setNewArea(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && (onAddConfig('areas', newArea), setNewArea(''))}
                            />
                            <button 
                                onClick={() => {onAddConfig('areas', newArea); setNewArea('');}}
                                className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700"
                            >
                                添加
                            </button>
                        </div>
                        <div className="space-y-2">
                            {config.areas.map(a => (
                                <div key={a} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                                    <span className="text-sm">{a}</span>
                                    <button onClick={() => onDeleteConfig('areas', a)} className="text-red-600 hover:bg-red-50 p-1 rounded">
                                        <X size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 抄送规则配置 */}
            {activeTab === 'cc' && (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-700">抄送规则列表</h4>
                            <button 
                                onClick={() => setEditingCCRule({ id: Date.now().toString(), name: '', riskLevels: [], ccDepts: [], ccUsers: [], enabled: true })}
                                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 flex items-center gap-2"
                            >
                                <Plus size={16}/> 新建规则
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {ccRules.map(rule => (
                                <div key={rule.id} className="border rounded p-4 hover:bg-slate-50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-800">{rule.name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${rule.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {rule.enabled ? '启用' : '禁用'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <div>风险等级：{rule.riskLevels.map(l => l === 'major' ? '重大' : l === 'high' ? '高' : l === 'medium' ? '中' : '低').join(', ')}</div>
                                                {rule.ccDepts.length > 0 && <div>抄送部门：{rule.ccDepts.join(', ')}</div>}
                                                {rule.ccUsers.length > 0 && <div>抄送人员：{rule.ccUsers.map(id => allUsers.find(u => u.id === id)?.name || id).join(', ')}</div>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setEditingCCRule(rule)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs">编辑</button>
                                            <button onClick={() => deleteCCRule(rule.id)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs">删除</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {ccRules.length === 0 && (
                                <div className="text-center text-slate-400 py-8">暂无抄送规则，点击"新建规则"开始配置</div>
                            )}
                        </div>

                        <button onClick={saveWorkflowRules} className="w-full mt-4 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-bold">
                            保存所有规则到服务器
                        </button>
                    </div>
                </div>
            )}

            {/* 应急预案规则配置 */}
            {activeTab === 'plan' && (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-700">应急预案规则列表</h4>
                            <button 
                                onClick={() => setEditingPlanRule({ id: Date.now().toString(), name: '', riskLevels: ['high'], daysBeforeDeadline: 3, enabled: true })}
                                className="bg-orange-600 text-white px-4 py-2 rounded text-sm hover:bg-orange-700 flex items-center gap-2"
                            >
                                <Plus size={16}/> 新建规则
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {emergencyPlanRules.map(rule => (
                                <div key={rule.id} className="border rounded p-4 hover:bg-slate-50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-800">{rule.name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${rule.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {rule.enabled ? '启用' : '禁用'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <div>适用风险：{rule.riskLevels.map(l => l === 'major' ? '重大' : '高').join(', ')}</div>
                                                <div>提前天数：整改截止日期前 {rule.daysBeforeDeadline} 天</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setEditingPlanRule(rule)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs">编辑</button>
                                            <button onClick={() => deletePlanRule(rule.id)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs">删除</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {emergencyPlanRules.length === 0 && (
                                <div className="text-center text-slate-400 py-8">暂无应急预案规则，点击"新建规则"开始配置</div>
                            )}
                        </div>

                        <button onClick={saveWorkflowRules} className="w-full mt-4 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-bold">
                            保存所有规则到服务器
                        </button>
                    </div>
                </div>
            )}

            {/* 编辑抄送规则弹窗 */}
            {editingCCRule && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4">编辑抄送规则</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">规则名称</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded p-2" 
                                    value={editingCCRule.name}
                                    onChange={e => setEditingCCRule({...editingCCRule, name: e.target.value})}
                                    placeholder="例如：重大隐患抄送安全部"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-1">适用风险等级</label>
                                <div className="flex gap-2 flex-wrap">
                                    {(['low', 'medium', 'high', 'major'] as const).map(level => (
                                        <label key={level} className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={editingCCRule.riskLevels.includes(level)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setEditingCCRule({...editingCCRule, riskLevels: [...editingCCRule.riskLevels, level]});
                                                    } else {
                                                        setEditingCCRule({...editingCCRule, riskLevels: editingCCRule.riskLevels.filter(l => l !== level)});
                                                    }
                                                }}
                                            />
                                            <span className="text-sm">{level === 'major' ? '重大' : level === 'high' ? '高' : level === 'medium' ? '中' : '低'}风险</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-1">抄送部门</label>
                                <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
                                    {departments.map(dept => (
                                        <label key={dept} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50">
                                            <input 
                                                type="checkbox" 
                                                checked={editingCCRule.ccDepts.includes(dept)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setEditingCCRule({...editingCCRule, ccDepts: [...editingCCRule.ccDepts, dept]});
                                                    } else {
                                                        setEditingCCRule({...editingCCRule, ccDepts: editingCCRule.ccDepts.filter(d => d !== dept)});
                                                    }
                                                }}
                                            />
                                            <span className="text-sm">{dept}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-1">抄送人员</label>
                                <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
                                    {allUsers.map(user => (
                                        <label key={user.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50">
                                            <input 
                                                type="checkbox" 
                                                checked={editingCCRule.ccUsers.includes(user.id)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setEditingCCRule({...editingCCRule, ccUsers: [...editingCCRule.ccUsers, user.id]});
                                                    } else {
                                                        setEditingCCRule({...editingCCRule, ccUsers: editingCCRule.ccUsers.filter(id => id !== user.id)});
                                                    }
                                                }}
                                            />
                                            <span className="text-sm">{user.name} ({user.department})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={editingCCRule.enabled}
                                        onChange={e => setEditingCCRule({...editingCCRule, enabled: e.target.checked})}
                                    />
                                    <span className="text-sm font-bold">启用此规则</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setEditingCCRule(null)} className="flex-1 border py-2 rounded hover:bg-slate-50">取消</button>
                            <button onClick={saveCCRule} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">保存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 编辑应急预案规则弹窗 */}
            {editingPlanRule && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                        <h3 className="font-bold text-lg mb-4">编辑应急预案规则</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">规则名称</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded p-2" 
                                    value={editingPlanRule.name}
                                    onChange={e => setEditingPlanRule({...editingPlanRule, name: e.target.value})}
                                    placeholder="例如：高风险隐患需提交应急预案"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-1">适用风险等级</label>
                                <div className="flex gap-2">
                                    {(['high', 'major'] as const).map(level => (
                                        <label key={level} className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={editingPlanRule.riskLevels.includes(level)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setEditingPlanRule({...editingPlanRule, riskLevels: [...editingPlanRule.riskLevels, level]});
                                                    } else {
                                                        setEditingPlanRule({...editingPlanRule, riskLevels: editingPlanRule.riskLevels.filter(l => l !== level)});
                                                    }
                                                }}
                                            />
                                            <span className="text-sm">{level === 'major' ? '重大' : '高'}风险</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-1">应急预案截止时间</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-600">整改截止日期前</span>
                                    <input 
                                        type="number" 
                                        className="w-20 border rounded p-2 text-center" 
                                        value={editingPlanRule.daysBeforeDeadline}
                                        onChange={e => setEditingPlanRule({...editingPlanRule, daysBeforeDeadline: parseInt(e.target.value) || 0})}
                                        min="1"
                                        max="30"
                                    />
                                    <span className="text-sm text-slate-600">天</span>
                                </div>
                                <div className="text-xs text-slate-400 mt-1">例如：设置为3天，则应急预案需要在整改截止日期前3天提交</div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={editingPlanRule.enabled}
                                        onChange={e => setEditingPlanRule({...editingPlanRule, enabled: e.target.checked})}
                                    />
                                    <span className="text-sm font-bold">启用此规则</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setEditingPlanRule(null)} className="flex-1 border py-2 rounded hover:bg-slate-50">取消</button>
                            <button onClick={savePlanRule} className="flex-1 bg-orange-600 text-white py-2 rounded hover:bg-orange-700">保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
