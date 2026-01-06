// src/app/hidden-danger/_components/views/StatsAnalysis.tsx
"use client";
import { HazardRecord } from '@/types/hidden-danger';
import { PieChart, BarChart3, TrendingUp, MapPin, Target } from 'lucide-react';
import { useMemo } from 'react';

interface StatsAnalysisProps {
  hazards: HazardRecord[];
  loading?: boolean;
}

export function StatsAnalysis({ hazards, loading }: StatsAnalysisProps) {
  // 1. 隐患类别分析（饼图数据）
  const categoryStats = useMemo(() => {
    const typeCount: Record<string, number> = {};
    hazards.forEach(h => {
      typeCount[h.type] = (typeCount[h.type] || 0) + 1;
    });
    
    const total = hazards.length;
    const stats = Object.entries(typeCount)
      .map(([type, count]) => ({
        type,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
    
    return stats;
  }, [hazards]);

  // 隐患整改率
  const rectificationRate = useMemo(() => {
    const total = hazards.length;
    const closed = hazards.filter(h => h.status === 'closed').length;
    return total > 0 ? ((closed / total) * 100).toFixed(1) : '0';
  }, [hazards]);

  // 2. 隐患发现位置高频词统计
  const locationStats = useMemo(() => {
    const locationCount: Record<string, number> = {};
    hazards.forEach(h => {
      // 分词：提取关键位置词（简单实现：按空格、逗号、顿号分割）
      const words = h.location.split(/[\s,，、]+/).filter(w => w.length > 0);
      words.forEach(word => {
        locationCount[word] = (locationCount[word] || 0) + 1;
      });
    });
    
    return Object.entries(locationCount)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // 取前10个高频词
  }, [hazards]);

  // 3. 隐患责任部门柱状图数据
  const deptStats = useMemo(() => {
    const deptCount: Record<string, number> = {};
    hazards.forEach(h => {
      const dept = h.responsibleDeptName || '未分配';
      deptCount[dept] = (deptCount[dept] || 0) + 1;
    });
    
    return Object.entries(deptCount)
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count);
  }, [hazards]);

  // 4. 隐患详情高频词 TOP5
  const descWordStats = useMemo(() => {
    const wordCount: Record<string, number> = {};
    hazards.forEach(h => {
      // 简单分词：提取2-4字的关键词（过滤常见词）
      const stopWords = ['的', '了', '在', '是', '有', '和', '与', '等', '及', '或'];
      const words = h.desc.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
      
      words.forEach(word => {
        if (!stopWords.includes(word)) {
          wordCount[word] = (wordCount[word] || 0) + 1;
        }
      });
    });
    
    return Object.entries(wordCount)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [hazards]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  if (hazards.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-slate-400">
          <BarChart3 size={64} className="mx-auto mb-4 opacity-50" />
          <p>暂无数据可分析</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="text-blue-600" size={24} />
        <h2 className="text-2xl font-bold text-slate-800">统计分析</h2>
        <span className="text-sm text-slate-500">（共 {hazards.length} 条隐患记录）</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 隐患整改率 */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target size={20} className="text-green-600" />
            <h3 className="font-bold text-slate-700">隐患整改率</h3>
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="relative">
              {/* 圆环背景 */}
              <svg width="200" height="200" className="transform -rotate-90">
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="20"
                />
                {/* 进度圆环 */}
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="20"
                  strokeDasharray={`${(parseFloat(rectificationRate) / 100) * 502.4} 502.4`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
              </svg>
              {/* 中心文字 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold text-green-600">{rectificationRate}%</div>
                <div className="text-sm text-slate-500 mt-1">整改完成率</div>
                <div className="text-xs text-slate-400 mt-2">
                  {hazards.filter(h => h.status === 'closed').length} / {hazards.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 1. 隐患类别分析饼图 */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={20} className="text-blue-600" />
            <h3 className="font-bold text-slate-700">隐患类别分析</h3>
          </div>
          <div className="flex items-center justify-center py-4">
            {categoryStats.length > 0 ? (
              <div className="relative">
                <svg width="200" height="200" viewBox="0 0 200 200">
                  {categoryStats.map((item, index) => {
                    const colors = [
                      '#3b82f6', // blue
                      '#10b981', // green
                      '#f59e0b', // yellow
                      '#a855f7', // purple
                      '#ec4899', // pink
                      '#6366f1', // indigo
                      '#ef4444', // red
                      '#f97316', // orange
                    ];
                    
                    // 计算每个扇形的起始和结束角度
                    let startAngle = 0;
                    for (let i = 0; i < index; i++) {
                      startAngle += (categoryStats[i].percentage / 100) * 360;
                    }
                    const endAngle = startAngle + (item.percentage / 100) * 360;
                    
                    // 转换为弧度
                    const startRad = (startAngle - 90) * Math.PI / 180;
                    const endRad = (endAngle - 90) * Math.PI / 180;
                    
                    // 计算路径
                    const x1 = 100 + 80 * Math.cos(startRad);
                    const y1 = 100 + 80 * Math.sin(startRad);
                    const x2 = 100 + 80 * Math.cos(endRad);
                    const y2 = 100 + 80 * Math.sin(endRad);
                    
                    const largeArc = item.percentage > 50 ? 1 : 0;
                    
                    const path = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    
                    return (
                      <path
                        key={item.type}
                        d={path}
                        fill={colors[index % colors.length]}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                        strokeWidth="2"
                        stroke="white"
                      >
                        <title>{item.type}: {item.count}条 ({item.percentage.toFixed(1)}%)</title>
                      </path>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="text-slate-400 text-sm">暂无数据</div>
            )}
          </div>
          {/* 图例 */}
          <div className="mt-4 space-y-2">
            {categoryStats.map((item, index) => {
              const colors = [
                'bg-blue-500',
                'bg-green-500',
                'bg-yellow-500',
                'bg-purple-500',
                'bg-pink-500',
                'bg-indigo-500',
                'bg-red-500',
                'bg-orange-500',
              ];
              
              return (
                <div key={item.type} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`} />
                    <span className="text-slate-700">{item.type}</span>
                  </div>
                  <span className="text-slate-500">{item.count} 条 ({item.percentage.toFixed(1)}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. 隐患发现位置高频词统计 */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={20} className="text-green-600" />
            <h3 className="font-bold text-slate-700">发现位置高频词</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {locationStats.map((item, index) => {
              const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'];
              const size = sizes[Math.min(index, sizes.length - 1)];
              const opacities = ['opacity-100', 'opacity-90', 'opacity-80', 'opacity-70', 'opacity-60'];
              const opacity = opacities[Math.min(index, opacities.length - 1)];
              
              return (
                <div 
                  key={item.location}
                  className={`${size} ${opacity} font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition-all`}
                  title={`出现 ${item.count} 次`}
                >
                  {item.location}
                  <span className="text-xs text-slate-400 ml-1">×{item.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. 隐患责任部门柱状图 */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-purple-600" />
            <h3 className="font-bold text-slate-700">责任部门分布</h3>
          </div>
          <div className="space-y-3">
            {deptStats.map((item, index) => {
              const maxCount = deptStats[0]?.count || 1;
              const percentage = ((item.count / maxCount) * 100).toFixed(0);
              
              return (
                <div key={item.dept} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 truncate">{item.dept}</span>
                    <span className="text-slate-500 ml-2 flex-shrink-0">{item.count} 条</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div 
                      className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. 隐患详情高频词 TOP5 */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-orange-600" />
            <h3 className="font-bold text-slate-700">隐患详情高频词 TOP5</h3>
          </div>
          <div className="space-y-4">
            {descWordStats.map((item, index) => {
              const maxCount = descWordStats[0]?.count || 1;
              const percentage = ((item.count / maxCount) * 100).toFixed(0);
              
              return (
                <div key={item.word} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700 font-medium">{item.word}</span>
                      <span className="text-slate-500">{item.count} 次</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
