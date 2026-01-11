
import React from 'react';
import { archiveService } from '@/services/archive-service';
import ArchiveExplorer from '@/components/archives/ArchiveExplorer';
import SettingsButton from '@/components/archives/SettingsButton';
import ArchiveLogButton from '@/components/archives/ArchiveLogButton';
import { AlertTriangle, Clock, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

export default async function ArchiveDashboard() {
    const expiringDocs = await archiveService.getExpiringDocuments(30);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">EHS 档案库</h1>
                    <p className="text-slate-500 mt-1">企业、人员、设备"三档"管理中心</p>
                </div>
                <div className="flex items-center gap-2">
                    <ArchiveLogButton />
                    <SettingsButton />
                </div>
            </div>

            {/* 预警看板 */}
            {expiringDocs.length > 0 ? (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="text-orange-600" size={20} />
                        <h3 className="font-semibold text-orange-900">证照到期预警 ({expiringDocs.length})</h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {expiringDocs.map((doc) => (
                            <div key={doc.id} className="bg-white p-3 rounded-lg shadow-sm border border-orange-100 flex items-start gap-3">
                                <Clock className="text-orange-500 shrink-0 mt-1" size={16} />
                                <div>
                                    <h4 className="text-sm font-medium text-slate-900 truncate">{doc.name}</h4>
                                    <p className="text-xs text-slate-500 mt-1">
                                        到期日: <span className="text-orange-600 font-medium">{doc.expiryDate ? format(doc.expiryDate, 'yyyy-MM-dd') : 'N/A'}</span>
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {doc.archiveCategory === 'personnel' ? '人员证书' : doc.archiveCategory === 'equipment' ? '设备检修' : '企业证照'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full">
                        <Archive size={20} className="text-green-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-green-900">所有证照状态良好</h3>
                        <p className="text-sm text-green-700">未来30天内没有即将过期的重要文档。</p>
                    </div>
                </div>
            )}

            {/* 档案浏览器 */}
            <ArchiveExplorer />
        </div>
    );
}
