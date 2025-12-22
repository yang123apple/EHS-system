import { useState } from 'react';
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
}

export default function ProjectDetailModal({ isOpen, onClose, project, records, hasPerm, onViewRecord, onDeleteRecord }: Props) {
    const [filterType, setFilterType] = useState('');
    const [filterDate, setFilterDate] = useState('');

    const filteredRecords = records.filter(r => {
        const matchType = !filterType || r.template.type === filterType;
        const matchDate = !filterDate || new Date(r.createdAt).toISOString().startsWith(filterDate);
        return matchType && matchDate;
    });

    // 🟢 解析项目附件
    const projectAttachments = project.attachments ? JSON.parse(project.attachments as unknown as string) : [];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
                <div className="p-6 border-b flex justify-between bg-white rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{project.name}</h2>
                        <p className="text-sm text-slate-500 mt-1 flex gap-4">
                            <span>📍 {project.location}</span>
                            <span>🏢 {project.requestDept}</span>
                            <span>📅 {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X /></button>
                </div>
                
                <div className="flex-1 bg-slate-50 p-6 overflow-hidden flex gap-6">
                    {/* 左侧：表单记录列表 (保持原有逻辑，宽度自适应) */}
                    <div className="flex-1 flex flex-col bg-white rounded-lg border shadow-sm overflow-hidden">
                        <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">关联作业单</h3>
                            <div className="flex gap-2 text-sm">
                                <div className="flex items-center gap-1 bg-white border rounded px-2">
                                    <Filter size={14} className="text-slate-400" />
                                    <select className="outline-none bg-transparent py-1 text-slate-600" value={filterType} onChange={e => setFilterType(e.target.value)}>
                                        <option value="">所有类型</option>
                                        {Array.from(new Set(records.map(r => r.template.type))).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <input type="date" className="border rounded px-2 py-1 outline-none text-slate-600" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto">
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
                        </div>
                    </div>

                    {/* 🟢 右侧：项目附件列表 (新增) */}
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
                </div>
            </div>
        </div>
    );
}