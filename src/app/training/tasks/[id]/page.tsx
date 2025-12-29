'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Users, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/training/tasks/${taskId}`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="text-center py-12 text-slate-400">加载中...</div>
      </div>
    );
  }

  if (!data || !data.task) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="text-center py-12 text-slate-400">任务不存在</div>
      </div>
    );
  }

  const { task, departmentStats } = data;
  const totalUsers = task.assignments.length;
  const completedUsers = task.assignments.filter((a: any) => a.status === 'passed' || a.status === 'completed').length;
  const completionRate = totalUsers > 0 ? ((completedUsers / totalUsers) * 100).toFixed(1) : 0;

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; className: string }> = {
      'assigned': { text: '未开始', className: 'bg-slate-100 text-slate-700' },
      'in-progress': { text: '进行中', className: 'bg-blue-100 text-blue-700' },
      'completed': { text: '已完成', className: 'bg-green-100 text-green-700' },
      'passed': { text: '通过', className: 'bg-green-100 text-green-700' },
      'failed': { text: '未通过', className: 'bg-red-100 text-red-700' }
    };
    const badge = badges[status] || badges['assigned'];
    return <span className={`px-2 py-1 rounded text-xs font-bold ${badge.className}`}>{badge.text}</span>;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
      >
        <ChevronLeft size={20} />
        返回
      </button>

      {/* 任务基本信息 */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">{task.title}</h2>
        {task.description && (
          <p className="text-slate-600 mb-4">{task.description}</p>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-sm text-slate-500">学习内容</div>
            <div className="font-medium">{task.material.title}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">发布人</div>
            <div className="font-medium">{task.publisher.name}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">开始时间</div>
            <div className="font-medium">{new Date(task.startDate).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">结束时间</div>
            <div className="font-medium">{new Date(task.endDate).toLocaleDateString()}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-4 border-t">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">总体完成率</span>
              <span className="text-sm font-bold text-blue-600">{completionRate}%</span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
          <div className="text-center px-4">
            <div className="text-2xl font-bold text-slate-800">{completedUsers}/{totalUsers}</div>
            <div className="text-xs text-slate-500">已完成人数</div>
          </div>
        </div>
      </div>

      {/* 部门完成情况 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold">部门完成情况</h3>
        </div>

        <div className="divide-y">
          {departmentStats.map((dept: any) => {
            const deptCompletionRate = dept.total > 0 ? ((dept.completed / dept.total) * 100).toFixed(1) : 0;
            const isExpanded = selectedDept === dept.deptId;

            return (
              <div key={dept.deptId}>
                <div
                  className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedDept(isExpanded ? null : dept.deptId)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Users size={20} className="text-blue-600" />
                      <div>
                        <h4 className="font-bold text-slate-800">{dept.deptName}</h4>
                        <div className="text-sm text-slate-500">
                          {dept.total}人 · {dept.completed}人完成
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle size={16} className="text-green-600" />
                        <span>{dept.passed}通过</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={16} className="text-blue-600" />
                        <span>{dept.inProgress}进行中</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <XCircle size={16} className="text-slate-400" />
                        <span>{dept.notStarted}未开始</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-600 transition-all"
                      style={{ width: `${deptCompletionRate}%` }}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-slate-50 p-4">
                    <table className="w-full">
                      <thead className="text-left text-sm text-slate-500">
                        <tr>
                          <th className="pb-2">姓名</th>
                          <th className="pb-2">状态</th>
                          <th className="pb-2">进度</th>
                          {task.material.isExamRequired && <th className="pb-2">考试成绩</th>}
                          <th className="pb-2">完成时间</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {dept.users.map((user: any) => (
                          <tr key={user.id} className="border-t border-slate-200">
                            <td className="py-2">{user.name}</td>
                            <td className="py-2">{getStatusBadge(user.status)}</td>
                            <td className="py-2">
                              {user.status === 'in-progress' || user.status === 'completed' || user.status === 'passed'
                                ? `${user.progress}%`
                                : '-'}
                            </td>
                            {task.material.isExamRequired && (
                              <td className="py-2">
                                {user.examScore !== null && user.examScore !== undefined
                                  ? `${user.examScore}分`
                                  : '-'}
                              </td>
                            )}
                            <td className="py-2 text-slate-600">
                              {user.completedAt
                                ? new Date(user.completedAt).toLocaleString()
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
