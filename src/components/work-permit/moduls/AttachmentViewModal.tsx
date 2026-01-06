import { X, Paperclip, Download, FileText } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    attachments: any[];
}

export default function AttachmentViewModal({ isOpen, onClose, attachments }: Props) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Paperclip size={20}/> 附件列表</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X/></button>
                </div>
                
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {attachments.map((file, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded border hover:bg-slate-100 transition">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="bg-white p-2 rounded border"><FileText size={20} className="text-blue-500"/></div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-sm truncate w-48" title={file.name}>{file.name}</span>
                                    <span className="text-xs text-slate-400">{file.size}</span>
                                </div>
                            </div>
                            <a 
                                href={file.content} 
                                download={file.name}
                                className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-full"
                                title="下载"
                            >
                                <Download size={18}/>
                            </a>
                        </div>
                    ))}
                    {attachments.length === 0 && <p className="text-center text-slate-400 py-4">无附件</p>}
                </div>
            </div>
        </div>
    );
}