
import React from 'react';
import { unstable_cache } from 'next/cache';
import { archiveService } from '@/services/archive-service';
import ArchiveExplorer from '@/components/archives/ArchiveExplorer';
import SettingsButton from '@/components/archives/SettingsButton';
import ArchiveLogButton from '@/components/archives/ArchiveLogButton';
import { AlertTriangle, Clock, Archive, Stethoscope, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

// ──────────────────────────────────────────────────────────────────────────────
// 用 unstable_cache 把两条数据库查询打上 'archive-status' tag，
// 这样 POST /api/webhooks/revalidate 调用 revalidateTag('archive-status') 时
// Next.js 会自动将两份缓存同时标记为 stale，下次请求触发无缝热更新，
// 不需要杀进程、不需要删文件、不需要等 revalidate 计时器。
// ──────────────────────────────────────────────────────────────────────────────
const CACHE_TAG = 'archive-status';
const CACHE_TTL = 3600; // 1 小时，与业务变化频率匹配

const getExpiringDocsCached = unstable_cache(
    (days: number) => archiveService.getExpiringDocuments(days),
    ['archive-expiring-docs'],
    { tags: [CACHE_TAG], revalidate: CACHE_TTL }
);

const getPendingExamCountCached = unstable_cache(
    (days: number) => archiveService.getPendingHealthExamCount(days),
    ['archive-pending-exam-count'],
    { tags: [CACHE_TAG], revalidate: CACHE_TTL }
);

// force-static：禁止 cookies/headers 进入渲染上下文，保证页面可静态化。
// revalidate 由 unstable_cache 在数据层控制，页面层不再重复声明。
export const dynamic = 'force-static';

export default async function ArchiveDashboard() {
    // Promise.allSettled：任何一条查询失败不影响另一条，拒绝白屏连坐。
    const [expiringDocsResult, pendingExamCountResult] = await Promise.allSettled([
        getExpiringDocsCached(30),
        getPendingExamCountCached(60),
    ]);

    const expiringDocs = expiringDocsResult.status === 'fulfilled' ? expiringDocsResult.value : [];
    const pendingExamCount = pendingExamCountResult.status === 'fulfilled' ? pendingExamCountResult.value : null;

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
                <div className="space-y-3">
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="text-orange-600" size={20} />
                            <h3 className="font-semibold text-orange-900">证照到期预警 ({expiringDocs.length})</h3>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {expiringDocs.map((doc) => (
                                <div key={doc.id} className="bg-white p-3 rounded-lg shadow-sm border border-orange-100 flex items-start gap-3">
                                    <Clock className="text-orange-500 shrink-0 mt-1" size={16} />
                                    <div className="min-w-0">
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
                    <HealthExamBanner count={pendingExamCount} />
                </div>
            ) : (
                // md: (768px) 给文字足够宽度，sm: (640px) 在有 layout padding 时过于紧张
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                        <div className="bg-green-100 p-2 rounded-full shrink-0">
                            <Archive size={20} className="text-green-600" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-green-900">所有证照状态良好</h3>
                            <p className="text-sm text-green-700">未来30天内没有即将过期的重要文档。</p>
                        </div>
                    </div>
                    <HealthExamBanner count={pendingExamCount} />
                </div>
            )}

            {/* 档案浏览器 */}
            <ArchiveExplorer />
        </div>
    );
}

// count=null 表示查询失败，显示降级 UI 而不是崩溃
function HealthExamBanner({ count }: { count: number | null }) {
    if (count === null) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                <div className="bg-slate-100 p-2 rounded-full shrink-0">
                    <AlertCircle size={20} className="text-slate-400" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-semibold text-slate-500">职业健康体检</h3>
                    <p className="text-sm text-slate-400">数据暂时无法加载，请刷新页面重试。</p>
                </div>
            </div>
        );
    }

    if (count > 0) {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-full shrink-0">
                    <Stethoscope size={20} className="text-blue-600" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-semibold text-blue-900">职业健康体检提醒</h3>
                    <p className="text-sm text-blue-700">
                        未来60天内有{' '}
                        <span className="font-bold text-blue-900">{count}</span>
                        {' '}人需进行职业健康体检。
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <div className="bg-green-100 p-2 rounded-full shrink-0">
                <Stethoscope size={20} className="text-green-600" />
            </div>
            <div className="min-w-0">
                <h3 className="font-semibold text-green-900">职业健康体检状态良好</h3>
                <p className="text-sm text-green-700">未来60天内无人员需进行职业健康体检。</p>
            </div>
        </div>
    );
}
