'use client';

import React from 'react';
import { apiFetch } from '@/lib/apiClient';

interface TrainingStats {
    totalUsers: number;
    trainedUsers: number;
    untrainedUsers: number;
    trainingRate: number;
}

interface HealthExamStats {
    total: number;
    requireExam: number;
    noExamRequired: number;
    upcomingExam: number;
    overdueExam: number;
}

export default function ArchiveStatsView() {
    const [stats, setStats] = React.useState<TrainingStats | null>(null);
    const [healthExamStats, setHealthExamStats] = React.useState<HealthExamStats | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await apiFetch('/api/archives/stats');
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                setError(errData.error || errData.details || `请求失败 (${res.status})`);
                return;
            }
            const data = await res.json();
            if (data.training) {
                setStats({
                    totalUsers: data.training.total,
                    trainedUsers: data.training.trained,
                    untrainedUsers: data.training.untrained,
                    trainingRate: data.training.percentage
                });
            }
            if (data.healthExam) {
                setHealthExamStats(data.healthExam);
            }
        } catch (e) {
            console.error('加载统计数据失败', e);
            setError('网络请求失败，请检查服务是否正常运行');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center h-full">
                <div className="text-slate-400">加载中...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 flex flex-col items-center justify-center h-full gap-3">
                <div className="text-red-500 text-sm font-medium">加载统计数据失败</div>
                <div className="text-slate-400 text-xs max-w-sm text-center">{error}</div>
                <button
                    onClick={loadStats}
                    className="mt-2 px-4 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                    重试
                </button>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="p-6 flex items-center justify-center h-full">
                <div className="text-slate-400">暂无统计数据</div>
            </div>
        );
    }

    // 计算培训饼图数据
    const trainedPercentage = stats.totalUsers > 0 ? (stats.trainedUsers / stats.totalUsers) * 100 : 0;
    const untrainedPercentage = stats.totalUsers > 0 ? (stats.untrainedUsers / stats.totalUsers) * 100 : 0;

    // SVG饼图参数
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const trainedOffset = circumference - (trainedPercentage / 100) * circumference;
    const untrainedOffset = circumference - (untrainedPercentage / 100) * circumference;

    // 计算职业健康体检饼图数据
    const examTotal = healthExamStats?.total ?? 0;
    const requireExamCount = healthExamStats?.requireExam ?? 0;
    const noExamRequiredCount = healthExamStats?.noExamRequired ?? 0;
    const upcomingExamCount = healthExamStats?.upcomingExam ?? 0;
    const overdueExamCount = healthExamStats?.overdueExam ?? 0;
    const requireExamPercentage = examTotal > 0 ? (requireExamCount / examTotal) * 100 : 0;
    const noExamRequiredPercentage = examTotal > 0 ? (noExamRequiredCount / examTotal) * 100 : 0;
    const examRequireOffset = circumference - (requireExamPercentage / 100) * circumference;
    const examNoRequireOffset = circumference - (noExamRequiredPercentage / 100) * circumference;

    return (
        <div className="p-6 h-full overflow-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">统计图表</h2>

            {/* 三级培训情况饼图 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4">三级培训情况统计</h3>

                <div className="flex items-center justify-center gap-12">
                    {/* 饼图 */}
                    <div className="relative">
                        <svg width="200" height="200" className="transform -rotate-90">
                            <circle
                                cx="100"
                                cy="100"
                                r={radius}
                                fill="none"
                                stroke="#e2e8f0"
                                strokeWidth="40"
                            />
                            <circle
                                cx="100"
                                cy="100"
                                r={radius}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="40"
                                strokeDasharray={circumference}
                                strokeDashoffset={trainedOffset}
                                strokeLinecap="round"
                                className="transition-all duration-500"
                            />
                            {stats.untrainedUsers > 0 && (
                                <circle
                                    cx="100"
                                    cy="100"
                                    r={radius}
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="40"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={untrainedOffset}
                                    strokeLinecap="round"
                                    className="transition-all duration-500"
                                />
                            )}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-slate-900">{stats.trainingRate.toFixed(1)}%</div>
                                <div className="text-xs text-slate-500">培训率</div>
                            </div>
                        </div>
                    </div>

                    {/* 图例 */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-green-500"></div>
                            <div>
                                <div className="text-sm font-medium text-slate-900">已完成三级培训</div>
                                <div className="text-xs text-slate-500">
                                    {stats.trainedUsers} 人 ({trainedPercentage.toFixed(1)}%)
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                            <div>
                                <div className="text-sm font-medium text-slate-900">未完成三级培训</div>
                                <div className="text-xs text-slate-500">
                                    {stats.untrainedUsers} 人 ({untrainedPercentage.toFixed(1)}%)
                                </div>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                            <div className="text-sm text-slate-500">总人数</div>
                            <div className="text-lg font-semibold text-slate-900">{stats.totalUsers} 人</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 职业健康体检情况统计 */}
            {healthExamStats && (
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h3 className="text-base font-semibold text-slate-900 mb-4">职业健康体检情况统计</h3>

                    <div className="flex items-center justify-center gap-12">
                        {/* 饼图 */}
                        <div className="relative">
                            <svg width="200" height="200" className="transform -rotate-90">
                                <circle
                                    cx="100"
                                    cy="100"
                                    r={radius}
                                    fill="none"
                                    stroke="#e2e8f0"
                                    strokeWidth="40"
                                />
                                <circle
                                    cx="100"
                                    cy="100"
                                    r={radius}
                                    fill="none"
                                    stroke="#6366f1"
                                    strokeWidth="40"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={examRequireOffset}
                                    strokeLinecap="round"
                                    className="transition-all duration-500"
                                />
                                {noExamRequiredCount > 0 && (
                                    <circle
                                        cx="100"
                                        cy="100"
                                        r={radius}
                                        fill="none"
                                        stroke="#94a3b8"
                                        strokeWidth="40"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={examNoRequireOffset}
                                        strokeLinecap="round"
                                        className="transition-all duration-500"
                                    />
                                )}
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-slate-900">{requireExamCount}</div>
                                    <div className="text-xs text-slate-500">需体检人数</div>
                                </div>
                            </div>
                        </div>

                        {/* 图例 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-indigo-500"></div>
                                <div>
                                    <div className="text-sm font-medium text-slate-900">需定期职业健康体检</div>
                                    <div className="text-xs text-slate-500">
                                        {requireExamCount} 人 ({requireExamPercentage.toFixed(1)}%)
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-slate-400"></div>
                                <div>
                                    <div className="text-sm font-medium text-slate-900">无需定期体检</div>
                                    <div className="text-xs text-slate-500">
                                        {noExamRequiredCount} 人 ({noExamRequiredPercentage.toFixed(1)}%)
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-slate-200 space-y-2">
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                        <span className="text-xs text-slate-500">即将到期（60天内）</span>
                                    </div>
                                    <span className="text-sm font-semibold text-amber-600">{upcomingExamCount} 人</span>
                                </div>
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        <span className="text-xs text-slate-500">已逾期未体检</span>
                                    </div>
                                    <span className="text-sm font-semibold text-red-600">{overdueExamCount} 人</span>
                                </div>
                                <div className="pt-1 border-t border-slate-100">
                                    <div className="text-sm text-slate-500">在职总人数</div>
                                    <div className="text-lg font-semibold text-slate-900">{examTotal} 人</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
