"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { 
  Search, FileText, FolderOpen, Download, Trash2, Edit, Upload, 
  Eye, ArrowLeft, Filter, ChevronRight, CornerDownRight, MoreHorizontal,
  File as FileIcon, Sheet, RefreshCw, History, Clock, Calendar, Layers
} from 'lucide-react';
import Link from 'next/link';

interface HistoryRecord {
  id: string; type: 'docx' | 'xlsx' | 'pdf'; name: string; path: string; uploadTime: number; uploader: string;
}

interface DocFile {
  id: string; name: string; prefix: string; suffix: number; fullNum: string; level: number; parentId: string | null;
  dept: string; docxPath: string; pdfPath: string | null; type: 'docx' | 'pdf' | 'xlsx'; uploadTime: number;
  uploader?: string; history?: HistoryRecord[];
  searchText?: string;
}

export default function DocSystemPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // === 筛选状态 ===
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState(''); // 新增：级别筛选
  const [startDate, setStartDate] = useState('');     // 新增：开始时间
  const [endDate, setEndDate] = useState('');         // 新增：结束时间
  
  const [allDepts, setAllDepts] = useState<string[]>([]);

  // 弹窗状态
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false); 
  
  const [uploadLevel, setUploadLevel] = useState(1);
  const [editLevel, setEditLevel] = useState(1);
  const [currentFile, setCurrentFile] = useState<DocFile | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  
  const isAdmin = user?.role === 'admin';

  const hasPerm = (key: string) => {
    if (!user) return false;
    if (isAdmin) return true;
    return user.permissions['doc_sys']?.includes(key);
  };

  const canDownloadSource = (file: DocFile) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (file.level === 4) return user.permissions['doc_sys']?.includes('down_docx_l4');
    return user.permissions['doc_sys']?.includes('down_docx_l123');
  };

  useEffect(() => { loadFiles(); }, []);

  const loadFiles = async () => {
    try {
      const res = await fetch('/api/docs');
      const data = await res.json();
      setFiles(data);
      const depts = Array.from(new Set(data.map((f: DocFile) => f.dept))).filter(Boolean) as string[];
      setAllDepts(depts);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (user) formData.append('uploader', user.username);
    if (!isAdmin && user) formData.set('dept', user.department);

    const file = formData.get('file') as File;
    const level = parseInt(formData.get('level') as string);
    const prefix = formData.get('prefix') as string;

    if (level === 4) {
        if (!file.name.endsWith('.docx') && !file.name.endsWith('.xlsx')) return alert("4级文件支持 .docx 或 .xlsx");
    } else {
        if (!file.name.endsWith('.docx')) return alert("仅支持 .docx");
        if (!prefix) return alert("请输入前缀");
    }

    try {
      const res = await fetch('/api/docs', { method: 'POST', body: formData });
      if (res.ok) { setShowUploadModal(false); loadFiles(); alert('上传成功'); } 
      else { const err = await res.json(); alert(err.error || '上传失败'); }
    } catch (err) { alert('网络错误'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此文档？')) return;
    try {
      const res = await fetch(`/api/docs/${id}`, { method: 'DELETE' });
      if (res.ok) { loadFiles(); if (currentFile?.id === id) { setShowPreviewModal(false); setShowEditModal(false); setShowUpdateModal(false); }} 
      else { const d = await res.json(); alert(d.error || '删除失败'); }
    } catch (err) { alert('请求出错'); }
  };

  const handleDeleteHistory = async (docId: string, historyId: string) => {
    if (!confirm('确定永久删除此历史文件？')) return;
    try {
        const res = await fetch(`/api/docs/${docId}?historyId=${historyId}`, { method: 'DELETE' });
        if (res.ok) {
            alert('历史版本已删除');
            loadFiles(); 
            if (currentFile && currentFile.id === docId) {
                const updatedHistory = currentFile.history?.filter(h => h.id !== historyId);
                setCurrentFile({ ...currentFile, history: updatedHistory });
            }
        } else alert('删除失败');
    } catch (e) { alert('网络错误'); }
  };

  const handleDownloadUrl = (url: string, filename: string) => {
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDownload = (file: DocFile, type: 'source' | 'pdf') => {
    if (type === 'source') {
        if (!canDownloadSource(file)) return alert('无权下载此源文件');
        const ext = file.type === 'xlsx' ? 'xlsx' : 'docx';
        handleDownloadUrl(file.docxPath, `${file.fullNum}_${file.name}.${ext}`);
    } else if (type === 'pdf') {
        if (!hasPerm('down_pdf')) return alert('无权下载 PDF');
        if (!file.pdfPath) return alert('PDF 不存在');
        handleDownloadUrl(file.pdfPath, `${file.fullNum}_${file.name}.pdf`);
    }
  };

  const handleUpdateVersion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!currentFile) return;
    const formData = new FormData(e.currentTarget);
    if (user) formData.append('uploader', user.username);
    try {
        const res = await fetch(`/api/docs/${currentFile.id}`, { method: 'PUT', body: formData });
        if (res.ok) { setShowUpdateModal(false); loadFiles(); alert('更新成功'); } else alert('更新失败');
    } catch (e) { alert('网络错误'); }
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!currentFile) return;
    const formData = new FormData(e.currentTarget);
    if (!isAdmin) formData.set('dept', currentFile.dept);
    if (formData.get('parentId') === currentFile.id) return alert("上级不能是自己");
    try {
        const res = await fetch(`/api/docs/${currentFile.id}`, { method: 'PUT', body: formData });
        if (res.ok) { setShowEditModal(false); loadFiles(); alert('修改成功'); } else alert('保存失败');
    } catch (err) { alert('网络错误'); }
  };

  const handlePreview = async (file: DocFile) => {
    setCurrentFile(file); setShowPreviewModal(true); setPreviewHtml('<div class="text-center p-4">正在解析...</div>');
    try {
        const res = await fetch(file.docxPath);
        const arrayBuffer = await res.arrayBuffer();
        if (file.type === 'xlsx') {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const html = XLSX.utils.sheet_to_html(workbook.Sheets[workbook.SheetNames[0]], { id: 'excel-preview-table' });
            setPreviewHtml(`<style>#excel-preview-table { border-collapse: collapse; width: 100%; } #excel-preview-table td, #excel-preview-table th { border: 1px solid #ddd; padding: 8px; font-size: 14px; } #excel-preview-table tr:nth-child(even) { background-color: #f9f9f9; }</style>${html}`);
        } else if (file.type === 'docx') {
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setPreviewHtml(result.value || '<p>空内容</p>');
        } else { setPreviewHtml('<div class="text-center p-8 text-slate-400">不支持预览</div>'); }
    } catch (err) { setPreviewHtml('<div class="text-red-500">解析失败</div>'); }
  };

  const highlightText = (text: string | undefined, keyword: string) => {
    if (!text || !keyword) return null;
    const lowerText = text.toLowerCase();
    const lowerKey = keyword.toLowerCase();
    const index = lowerText.indexOf(lowerKey);
    if (index === -1) return null;
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + keyword.length + 50);
    let snippet = text.substring(start, end);
    const regex = new RegExp(`(${keyword})`, 'gi');
    return snippet.replace(regex, '<span class="bg-yellow-200 font-bold text-slate-900">$1</span>');
  };

  const renderFileItem = (file: DocFile, depth: number, recursive: boolean, highlightContent?: string | null) => (
    <div key={file.id}>
        <div className={`flex flex-col bg-white p-3 rounded-lg border border-slate-200 hover:shadow-sm hover:border-blue-300 transition-all group ${depth > 0 && !highlightContent ? 'ml-8 relative' : ''}`}>
            {depth > 0 && !highlightContent && <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-px bg-slate-300"></div>}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 overflow-hidden cursor-pointer" onClick={() => handlePreview(file)}>
                    <div className={`p-2 rounded-lg shrink-0 ${file.level === 1 ? 'bg-blue-100 text-blue-600' : file.level === 4 ? ((file.type || 'docx') === 'xlsx' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600') : 'bg-slate-100 text-slate-600'}`}>
                        {file.level === 1 ? <FolderOpen size={20} /> : (file.type || 'docx') === 'xlsx' ? <Sheet size={20} /> : file.level === 4 ? <FileIcon size={20} /> : <FileText size={20} />}
                    </div>
                    <div className="min-w-0">
                        <div className="font-medium text-slate-800 flex items-center gap-2">
                            <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono shrink-0">{file.fullNum}</span>
                            <span className="truncate group-hover:text-hytzer-blue">{file.name}</span>
                            {file.type === 'xlsx' && <span className="text-[10px] bg-green-50 text-green-600 border border-green-100 px-1 rounded">XLSX</span>}
                            {file.pdfPath && <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1 rounded">PDF</span>}
                        </div>
                        <div className="text-xs text-slate-400 flex gap-2 mt-0.5">
                            <span className="bg-slate-50 px-1 rounded">{file.level}级文件</span>
                            <span>{file.dept}</span>
                            <span>{new Date(file.uploadTime).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button title="预览" onClick={() => handlePreview(file)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><Eye size={16} /></button>
                    {canDownloadSource(file) && <button title={`下载 ${(file.type || 'docx').toUpperCase()}`} onClick={() => handleDownload(file, 'source')} className={`p-1.5 rounded font-bold text-xs flex items-center gap-1 ${file.type === 'xlsx' ? 'hover:bg-green-50 hover:text-green-600' : 'hover:bg-blue-50 hover:text-blue-600 text-slate-500'}`}><Download size={14} /> {file.type === 'xlsx' ? 'E' : 'W'}</button>}
                    {hasPerm('upload') && <button title="更新" onClick={() => { setCurrentFile(file); setShowUpdateModal(true); }} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded text-slate-500"><RefreshCw size={16} /></button>}
                    {hasPerm('edit') && <button title="编辑" onClick={() => { setCurrentFile(file); setEditLevel(file.level); setShowEditModal(true); }} className="p-1.5 hover:bg-orange-50 hover:text-orange-600 rounded text-slate-500"><Edit size={16} /></button>}
                    {hasPerm('delete') && <button title="删除" onClick={() => handleDelete(file.id)} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-500"><Trash2 size={16} /></button>}
                </div>
            </div>
            {highlightContent && (
                <div className="mt-2 ml-11 p-2 bg-yellow-50 rounded text-xs text-slate-600 border border-yellow-100">
                    <div className="flex gap-1"><span className="font-bold text-yellow-600 shrink-0">匹配内容:</span><span dangerouslySetInnerHTML={{ __html: `...${highlightContent}...` }} /></div>
                </div>
            )}
        </div>
        {recursive && renderTree(file.id, depth + 1)}
    </div>
  );

  const renderTree = (parentId: string | null, depth: number = 0) => {
    // === 核心逻辑修改：是否处于“筛选/搜索模式” ===
    const isFiltering = !!(searchTerm || deptFilter || levelFilter || startDate || endDate);

    // 1. 筛选/搜索模式：扁平化展示所有匹配项 (包含 4级文件)
    if (isFiltering) {
        if (depth > 0) return null; // 只渲染一次
        
        let filtered = files;

        // 应用所有筛选条件
        if (deptFilter) filtered = filtered.filter(f => f.dept === deptFilter);
        if (levelFilter) filtered = filtered.filter(f => f.level === parseInt(levelFilter));
        if (startDate) filtered = filtered.filter(f => f.uploadTime >= new Date(startDate).getTime());
        if (endDate) filtered = filtered.filter(f => f.uploadTime <= new Date(endDate).getTime() + 86400000); // 包含结束当天

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            const nameMatches = filtered.filter(f => f.name.toLowerCase().includes(lowerTerm) || f.fullNum.includes(lowerTerm));
            const contentMatches = filtered.filter(f => {
                if (nameMatches.find(n => n.id === f.id)) return false;
                if (!f.searchText) return false;
                return f.searchText.toLowerCase().includes(lowerTerm);
            });

            if (nameMatches.length === 0 && contentMatches.length === 0) return <div className="text-center py-20 text-slate-400">无搜索结果</div>;

            return (
                <div className="space-y-4">
                    {nameMatches.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">文件名匹配 ({nameMatches.length})</h3>
                            {nameMatches.map(f => renderFileItem(f, 0, false, null))}
                        </div>
                    )}
                    {contentMatches.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">全文内容匹配 ({contentMatches.length})</h3>
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">Markdown/Text</span>
                            </div>
                            {contentMatches.map(f => {
                                const snippet = highlightText(f.searchText, searchTerm);
                                return renderFileItem(f, 0, false, snippet);
                            })}
                        </div>
                    )}
                </div>
            );
        }

        // 如果没有关键词，仅有筛选条件，直接渲染列表
        if (filtered.length === 0) return <div className="text-center py-20 text-slate-400">暂无匹配文件</div>;
        return <div className="space-y-2">{filtered.map(f => renderFileItem(f, 0, false, null))}</div>;
    }

    // 2. 默认模式：树状展示 (隐藏 4级文件)
    let levelFiles = files.filter(f => f.parentId === parentId);
    
    // 关键点：默认树状图中，过滤掉 4级文件
    levelFiles = levelFiles.filter(f => f.level !== 4);

    levelFiles.sort((a, b) => a.level - b.level);
    if (levelFiles.length === 0 && depth === 0) return <div className="text-center py-20 text-slate-400">暂无文档</div>;
    return <div className="space-y-2">{levelFiles.map(file => <div key={file.id}>{renderFileItem(file, depth, true)}</div>)}</div>;
  };

  const getBreadcrumbs = (file: DocFile) => {
    const chain = []; let currentId = file.parentId; let safe = 0;
    while (currentId && safe < 10) { const parent = files.find(f => f.id === currentId); if (parent) { chain.unshift(parent); currentId = parent.parentId; } else break; safe++; }
    return chain;
  };
  const getChildrenPreview = (file: DocFile) => files.filter(f => f.parentId === file.id);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center justify-between mb-3 md:mb-6 shrink-0 px-2 md:px-0">
         <div className="flex items-center gap-2 md:gap-4"><Link href="/dashboard" className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={20} className="md:hidden" /><ArrowLeft size={24} className="hidden md:block" /></Link><div><h1 className="text-lg md:text-2xl font-bold text-slate-900">文档管理系统</h1><p className="text-xs md:text-sm text-slate-500 hidden sm:block">EHS 体系文件库</p></div></div>
      </div>
      <div className="flex flex-col md:flex-row flex-1 gap-3 md:gap-6 overflow-hidden">
         {/* Sidebar: 增加筛选控件 */}
         <div className="w-full md:w-80 bg-white rounded-lg md:rounded-xl shadow-sm border border-slate-200 p-3 md:p-5 flex flex-col gap-3 md:gap-6 shrink-0 h-auto md:h-full overflow-y-auto max-h-[40vh] md:max-h-none">
             
             {/* 1. 搜索 */}
             <div className="relative"><Search className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" placeholder="搜索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-7 md:pl-9 pr-3 md:pr-4 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm outline-none focus:ring-2 focus:ring-hytzer-blue" /></div>
             
             {/* 2. 部门筛选 */}
             <div><label className="text-xs md:text-sm font-medium text-slate-700 mb-1 md:mb-2 flex items-center gap-1 md:gap-2"><Filter size={12} className="md:hidden" /><Filter size={14} className="hidden md:block" /> 部门筛选</label><select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-full px-2 md:px-3 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm outline-none"><option value="">全部部门</option>{allDepts.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
             
             {/* 3. 级别筛选 (新增) */}
             <div>
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2"><Layers size={14} /> 文件级别</label>
                <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none">
                    <option value="">全部级别</option>
                    {[1, 2, 3, 4].map(l => <option key={l} value={l}>{l}级文件</option>)}
                </select>
             </div>

             {/* 4. 时间筛选 (新增) */}
             <div>
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2"><Calendar size={14} /> 发布时间</label>
                <div className="flex flex-col gap-2">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" />
                    <div className="text-center text-slate-400 text-xs">至</div>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" />
                </div>
             </div>

             <div className="border-t border-slate-100 my-2"></div>

             {hasPerm('upload') ? <button onClick={() => { setShowUploadModal(true); setUploadLevel(1); }} className="w-full bg-hytzer-blue text-white py-2 md:py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-600 shadow-lg shadow-blue-500/20 font-medium text-sm md:text-base"><Upload size={16} className="md:hidden" /><Upload size={18} className="hidden md:block" /> 上传文件</button> : <div className="p-3 md:p-4 bg-slate-50 text-slate-400 text-xs md:text-sm text-center rounded-lg border border-dashed">暂无上传权限</div>}
         </div>
         <div className="flex-1 bg-slate-50/50 rounded-lg md:rounded-xl border border-slate-200 p-3 md:p-6 overflow-y-auto custom-scrollbar">{loading ? <div className="text-center py-10 text-sm">加载中...</div> : renderTree(null)}</div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-3 md:p-0">
            <div className="bg-white rounded-xl w-full max-w-md p-4 md:p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold mb-4">上传新文档</h3>
                <form onSubmit={handleUpload} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">级别</label>
                            <select name="level" value={uploadLevel} onChange={(e) => setUploadLevel(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg outline-none">
                                {[1,2,3,4].map(l => <option key={l} value={l}>{l}级</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">部门</label>
                            <input name="dept" type="text" required defaultValue={user?.department} readOnly={!isAdmin} className={`w-full px-3 py-2 border rounded-lg outline-none ${!isAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} />
                        </div>
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">源文件 *</label><input name="file" type="file" accept={uploadLevel === 4 ? ".docx,.xlsx" : ".docx"} required className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/><p className="text-xs text-slate-400 mt-1">{uploadLevel === 4 ? '支持 .docx 或 .xlsx' : '仅支持 .docx'}</p></div>
                    {uploadLevel < 4 ? (<div><label className="block text-sm font-medium text-slate-700 mb-1">前缀编号</label><input name="prefix" type="text" placeholder="ESH-XF" required className="w-full px-3 py-2 border rounded-lg outline-none uppercase" /></div>) : (<div className="p-3 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-100"><strong>4级文件模式：</strong><br/>无需输入前缀，编号将自动继承自“上级文件”。<br/>例如：上级 ESH-001 &rarr; 本文件 ESH-001-001</div>)}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">上级文件 {uploadLevel === 4 && <span className="text-red-500">*</span>}</label>
                        <select name="parentId" required={uploadLevel === 4} className="w-full px-3 py-2 border rounded-lg outline-none">
                            <option value="">-- 无 --</option>
                            {files.filter(f => f.level === uploadLevel - 1).map(f => <option key={f.id} value={f.id}>[{f.fullNum}] {f.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-hytzer-blue text-white rounded-lg hover:bg-blue-600">提交</button></div>
                </form>
            </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && currentFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-fade-in">
                <h3 className="text-lg font-bold mb-4">修改文件信息</h3>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded text-sm text-slate-500 mb-4 border border-slate-200">当前编号: <strong>{currentFile.fullNum}</strong> (自动生成，不可修改)</div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">文件名称</label><input name="name" type="text" required defaultValue={currentFile.name} className="w-full px-3 py-2 border rounded-lg outline-none" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">级别</label>
                            <select name="level" value={editLevel} onChange={(e) => setEditLevel(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg outline-none">
                                {[1,2,3,4].map(l => <option key={l} value={l}>{l}级</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">部门</label>
                            <input name="dept" type="text" required defaultValue={currentFile.dept} readOnly={!isAdmin} className={`w-full px-3 py-2 border rounded-lg outline-none ${!isAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">上级文件</label>
                        <select name="parentId" defaultValue={currentFile.parentId || ''} className="w-full px-3 py-2 border rounded-lg outline-none bg-yellow-50">
                            <option value="">-- 设为根文件 --</option>
                            {files.filter(f => f.level === editLevel - 1 && f.id !== currentFile!.id).map(f => <option key={f.id} value={f.id}>[{f.fullNum}] {f.name}</option>)}
                        </select>
                    </div>
                    <div className="pt-4 border-t border-slate-100"><label className="block text-sm font-medium text-slate-700 mb-1">更新 PDF 附件 (旧 PDF 将移入历史)</label><input name="pdfFile" type="file" accept=".pdf" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-red-50 file:text-red-700 hover:file:bg-red-100"/>{currentFile.pdfPath && <p className="text-xs text-green-600 mt-1">✓ 当前已包含 PDF 副本</p>}</div>
                    <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-hytzer-blue text-white rounded-lg hover:bg-blue-600">保存修改</button></div>
                </form>
            </div>
        </div>
      )}

      {/* Update Version Modal & Preview Modal 保持不变 */}
      {showUpdateModal && currentFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
                <h3 className="text-lg font-bold mb-2">更新文档版本</h3>
                <p className="text-sm text-slate-500 mb-4">上传新文件将覆盖当前版本，旧文件将自动存入“历史文件清单”。</p>
                <form onSubmit={handleUpdateVersion} className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 border border-slate-200">正在更新: <strong>{currentFile.fullNum} {currentFile.name}</strong></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">新源文件 *</label><input name="mainFile" type="file" accept={currentFile.level === 4 ? ".docx,.xlsx" : ".docx"} required className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/><p className="text-xs text-slate-400 mt-1">当前类型: {currentFile.type || 'docx'}。{currentFile.level === 4 ? '支持更新为 .docx 或 .xlsx' : '仅支持 .docx'}</p></div>
                    <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setShowUpdateModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">确认更新</button></div>
                </form>
            </div>
        </div>
      )}

      {showPreviewModal && currentFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg md:rounded-xl w-full max-w-5xl h-[95vh] md:h-[90vh] flex flex-col shadow-2xl animate-fade-in">
            <div className="p-4 border-b flex justify-between items-start bg-slate-50 rounded-t-xl">
                <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><span className="bg-slate-200 px-1 rounded">ROOT</span>{getBreadcrumbs(currentFile).map(p => <div key={p.id} className="flex items-center gap-2"><ChevronRight size={10} /><span className="hover:text-blue-600 cursor-pointer" onClick={() => handlePreview(p)}>{p.name}</span></div>)}</div>
                    <div className="flex items-center gap-2"><h3 className="text-lg font-bold text-slate-900">{currentFile.name}</h3><span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{currentFile.fullNum}</span>{currentFile.type === 'xlsx' && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded border border-green-200">EXCEL</span>}</div>
                </div>
                <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">❌</button>
            </div>
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-3 md:p-8 bg-slate-100">
                    <div className={`bg-white shadow-sm p-4 md:p-10 min-h-full mx-auto ${currentFile.type === 'xlsx' ? 'max-w-full overflow-x-auto' : 'max-w-3xl prose prose-slate prose-sm md:prose'}`}>
                        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </div>
                </div>
                <div className="w-full md:w-72 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-3 md:p-4 overflow-y-auto shrink-0 flex flex-col gap-4 md:gap-6 max-h-[30vh] md:max-h-none">
                    <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><CornerDownRight size={14} /> 下级关联文件</h4>
                        <div className="space-y-2">{getChildrenPreview(currentFile).slice(0, 3).map(child => <div key={child.id} onClick={() => handlePreview(child)} className="p-2 border border-slate-100 rounded hover:bg-blue-50 cursor-pointer"><div className="text-xs text-slate-500">{child.fullNum}</div><div className="text-sm font-medium text-slate-800 truncate">{child.name}</div></div>)}
                            {getChildrenPreview(currentFile).length === 0 && <p className="text-xs text-slate-400 py-2 text-center">无下级文件</p>}
                            {getChildrenPreview(currentFile).length > 3 && <div className="text-center pt-2"><button className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1 w-full"><MoreHorizontal size={12} /> 查看全部</button></div>}
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-2">下载当前版本</h4>
                        <div className="space-y-2">
                            {canDownloadSource(currentFile) && <button onClick={() => handleDownload(currentFile, 'source')} className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${currentFile.type === 'xlsx' ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}><Download size={14} /> 源文件 ({(currentFile.type || 'docx').toUpperCase()})</button>}
                            {hasPerm('down_pdf') && currentFile.pdfPath ? <button onClick={() => handleDownload(currentFile, 'pdf')} className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded text-sm hover:bg-red-100"><Download size={14} /> 副本 (PDF)</button> : <div className="text-xs text-slate-400 px-3 py-1">PDF 副本未上传</div>}
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><History size={14} /> 历史文件清单</h4>
                        {currentFile.history && currentFile.history.length > 0 ? (
                            <div className="space-y-3">
                                {currentFile.history.map((h, idx) => (
                                    <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-100 text-xs">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium text-slate-700 truncate w-32" title={h.name}>{h.name}</span>
                                            <span className="text-slate-400 bg-white px-1 rounded border uppercase">{h.type}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-slate-400 mb-2"><Clock size={10} /> {new Date(h.uploadTime).toLocaleDateString()}</div>
                                        <div className="flex justify-end gap-2">
                                            {((h.type === 'pdf' && hasPerm('down_pdf')) || (h.type !== 'pdf' && canDownloadSource(currentFile))) && (<button onClick={() => handleDownloadUrl(h.path, h.name)} className="text-blue-600 hover:underline flex items-center gap-1"><Download size={12} /> 下载</button>)}
                                            {hasPerm('delete') && (<button onClick={() => handleDeleteHistory(currentFile.id, h.id)} className="text-red-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={12} /> 删除</button>)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (<p className="text-xs text-slate-400 py-2 text-center">暂无历史版本</p>)}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}