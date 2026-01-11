'use client';

import React from 'react';
import { apiFetch } from '@/lib/apiClient';

interface TrainingStats {
    totalUsers: number;
    trainedUsers: number;
    untrainedUsers: number;
    trainingRate: number;
}

export default function ArchiveStatsView() {
    const [stats, setStats] = React.useState<TrainingStats | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const res = await apiFetch('/api/archives/stats');
            const data = await res.json();
            if (data.training) {
                setStats({
                    totalUsers: data.training.total,
                    trainedUsers: data.training.trained,
                    untrainedUsers: data.training.untrained,
                    trainingRate: data.training.percentage
                });
            }
        } catch (e) {
            console.error('加载统计数据失败', e);
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

    if (!stats) {
        return (
            <div className="p-6 flex items-center justify-center h-full">
                <div className="text-slate-400">暂无统计数据</div>
            </div>
        );
    }

    // 计算饼图数据
    const trainedPercentage = stats.totalUsers > 0 ? (stats.trainedUsers / stats.totalUsers) * 100 : 0;
    const untrainedPercentage = stats.totalUsers > 0 ? (stats.untrainedUsers / stats.totalUsers) * 100 : 0;

    // SVG饼图参数
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const trainedOffset = circumference - (trainedPercentage / 100) * circumference;
    const untrainedOffset = circumference - (untrainedPercentage / 100) * circumference;

    return (
        <div className="p-6 h-full overflow-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">统计图表</h2>

            {/* 三级培训情况饼图 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
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
        </div>
    );
}

