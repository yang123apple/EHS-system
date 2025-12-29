import { useState, useEffect } from 'react';
import { X, Filter, Search, Paperclip, Download, FileText } from 'lucide-react'; // 🟢 引入图标
import { Project, PermitRecord } from '@/types/work-permit';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    records: PermitRecord[];
    hasPerm: (perm: string) => boolean;
    onViewRecord: (r: PermitRecord) => void;
    onDeleteRecord: (id: string) => void;
    currentPage?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
}

export default function ProjectDetailModal({
    isOpen, onClose, project, records, hasPerm, onViewRecord, onDeleteRecord,
    currentPage = 1, totalPages = 1, onPageChange
}: Props) {
    const [filterType, setFilterType] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [showAttachments, setShowAttachments] = useState(false); // 移动端附件抽屉状态

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const filteredRecords = records.filter(r => {
        const matchType = !filterType || r.template.type === filterType;
        const matchDate = !filterDate || new Date(r.createdAt).toISOString().startsWith(filterDate);
        return matchType && matchDate;
    });

    // 🟢 解析项目附件
    const projectAttachments = project.attachments ? JSON.parse(project.attachments as unknown as string) : [];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
            <div className={`bg-white rounded-xl w-full h-[90vh] flex flex-col shadow-2xl ${isMobile ? 'max-w-full' : 'max-w-6xl'}`}>
                <div className={`p-4 border-b bg-white rounded-t-xl ${isMobile ? '' : 'p-6'}`}>
                    <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-2">
                            <h2 className={`font-bold text-slate-800 ${isMobile ? 'text-lg' : 'text-2xl'}`}>{project.name}</h2>
                            <p className={`text-sm text-slate-500 mt-1 ${isMobile ? 'flex flex-col gap-1' : 'flex gap-4'}`}>
                                <span>📍 {project.location}</span>
                                <span>🏢 {project.requestDept}</span>
                                <span>📅 {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}</span>
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full shrink-0"><X /></button>
                    </div>
                    {isMobile && projectAttachments.length > 0 && (
                        <button
                            onClick={() => setShowAttachments(true)}
                            className="mt-3 w-full bg-blue-50 text-blue-600 px-4 py-2 rounded-lg border border-blue-200 hover:bg-blue-100 flex items-center justify-center gap-2"
                        >
                            <Paperclip size={16} />
                            <span>查看项目附件 ({projectAttachments.length})</span>
                        </button>
                    )}
                </div>
                
                <div className={`flex-1 bg-slate-50 overflow-hidden ${isMobile ? 'p-3' : 'p-6 flex gap-6'}`}>
                    {/* 左侧：表单记录列表 (保持原有逻辑，宽度自适应) */}
                    <div className={`flex flex-col bg-white rounded-lg border shadow-sm overflow-hidden ${isMobile ? '' : 'flex-1'}`}>
                        <div className={`border-b bg-slate-50/50 flex flex-col gap-2 ${isMobile ? 'p-3' : 'p-4 flex-row justify-between items-center'}`}>
                            <h3 className="font-bold text-slate-800">关联作业单</h3>
                            <div className={`flex gap-2 ${isMobile ? 'w-full' : 'text-sm'}`}>
                                <div className="flex items-center gap-1 bg-white border rounded px-2 flex-1">
                                    <Filter size={14} className="text-slate-400" />
                                    <select className="outline-none bg-transparent py-1 text-slate-600 flex-1" value={filterType} onChange={e => setFilterType(e.target.value)}>
                                        <option value="">所有类型</option>
                                        {Array.from(new Set(records.map(r => r.template.type))).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <input type="date" className="border rounded px-2 py-1 outline-none text-slate-600" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto">
                            {isMobile ? (
                                // 移动端：卡片式布局
                                <div className="p-3 space-y-3">
                                    {filteredRecords.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400">暂无记录</div>
                                    ) : (
                                        filteredRecords.map(r => (
                                            <div key={r.id} className="bg-slate-50 border rounded-lg p-3">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="font-medium text-slate-800">{r.template.name}</div>
                                                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs shrink-0 ml-2">{r.template.type}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 mb-3">{new Date(r.createdAt).toLocaleString()}</div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => onViewRecord(r)} className="flex-1 bg-blue-600 text-white py-1.5 rounded text-sm hover:bg-blue-700">查看</button>
                                                    {hasPerm('delete_permit') && (
                                                        <button onClick={() => onDeleteRecord(r.id)} className="px-3 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50">删除</button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                // 桌面端：表格布局
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b text-slate-500">
                                        <tr>
                                            <th className="p-3 font-medium">名称</th>
                                            <th className="p-3 font-medium">类型</th>
                                            <th className="p-3 font-medium">提交时间</th>
                                            <th className="p-3 text-right font-medium">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.length === 0 ? (
                                            <tr><td colSpan={4} className="p-6 text-center text-slate-400">暂无记录</td></tr>
                                        ) : (
                                            filteredRecords.map(r => (
                                                <tr key={r.id} className="border-b hover:bg-slate-50 transition-colors">
                                                    <td className="p-3">{r.template.name}</td>
                                                    <td className="p-3"><span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs">{r.template.type}</span></td>
                                                    <td className="p-3 text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
                                                    <td className="p-3 text-right flex justify-end gap-3">
                                                        <button onClick={() => onViewRecord(r)} className="text-blue-600 font-bold hover:underline">查看</button>
                                                        {hasPerm('delete_permit') && (
                                                            <button onClick={() => onDeleteRecord(r.id)} className="text-red-600 hover:underline">删除</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        {/* Pagination Controls */}
                        {onPageChange && totalPages > 1 && (
                            <div className="bg-white border-t border-slate-200 p-2 flex justify-center items-center gap-4">
                                <button
                                    onClick={() => onPageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-slate-50"
                                >
                                    上一页
                                </button>
                                <span className="text-xs text-slate-600">{currentPage}/{totalPages}</span>
                                <button
                                    onClick={() => onPageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-slate-50"
                                >
                                    下一页
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 🟢 右侧：项目附件列表 - 桌面端固定显示，移动端抽屉 */}
                    {!isMobile && (
                        <div className="w-80 bg-white rounded-lg border shadow-sm flex flex-col overflow-hidden">
                        <div className="p-4 border-b bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Paperclip size={16}/> 项目附件
                                <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{projectAttachments.length}</span>
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {projectAttachments.length > 0 ? (
                                projectAttachments.map((file: any, idx: number) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded border border-slate-100 hover:border-blue-200 transition group">
                                        <div className="bg-white p-2 rounded border text-blue-500 shrink-0">
                                            <FileText size={20}/>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-700 truncate" title={file.name}>{file.name}</div>
                                            <div className="text-xs text-slate-400 mt-1">{file.size}</div>
                                        </div>
                                        <a 
                                            href={file.content} 
                                            download={file.name}
                                            className="text-slate-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition"
                                            title="下载"
                                        >
                                            <Download size={16}/>
                                        </a>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-slate-400 text-sm">
                                    暂无项目附件
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </div>

                {/* 🟢 移动端附件抽屉 */}
                {isMobile && showAttachments && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setShowAttachments(false)}>
                        <div className="bg-white w-full rounded-t-2xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Paperclip size={16}/> 项目附件
                                    <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{projectAttachments.length}</span>
                                </h3>
                                <button onClick={() => setShowAttachments(false)} className="p-1 hover:bg-slate-100 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {projectAttachments.length > 0 ? (
                                    projectAttachments.map((file: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded border">
                                            <div className="bg-white p-2 rounded border text-blue-500 shrink-0">
                                                <FileText size={20}/>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-700">{file.name}</div>
                                                <div className="text-xs text-slate-400 mt-1">{file.size}</div>
                                            </div>
                                            <a 
                                                href={file.content} 
                                                download={file.name}
                                                className="text-blue-600 p-2 hover:bg-blue-50 rounded"
                                            >
                                                <Download size={20}/>
                                            </a>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-slate-400">
                                        暂无项目附件
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}