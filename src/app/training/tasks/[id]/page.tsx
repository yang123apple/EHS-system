'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Users, CheckCircle, Clock, XCircle, ChevronDown, ChevronRight, User } from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';
import { toLocaleDateString, formatDateTime } from '@/utils/dateUtils';

interface DepartmentStat {
  deptId: string;
  deptName: string;
  parentId: string | null;
  level: number;
  total: number;
  completed: number;
  passed: number;
  inProgress: number;
  notStarted: number;
  users: any[];
  children?: DepartmentStat[];
}

interface FlatRow {
  type: 'dept' | 'user';
  id: string;
  deptId?: string;
  level: number;
  dept?: DepartmentStat;
  user?: any;
  isVisible: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  isLast?: boolean;
  parentLasts?: boolean[];
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch(`/api/training/tasks/${taskId}`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [taskId]);

  const toggleDept = (deptId: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  // 扁平化树形结构为表格行
  const flatRows = useMemo(() => {
    if (!data?.departmentStats) return [];
    
    const rows: FlatRow[] = [];
    
    const traverse = (
      dept: DepartmentStat, 
      level: number, 
      parentExpanded: boolean,
      isLast: boolean = false,
      parentLasts: boolean[] = []
    ) => {
      const isExpanded = expandedDepts.has(dept.deptId);
      const hasChildren = (dept.children && dept.children.length > 0) || (dept.users && dept.users.length > 0);
      
      // 添加部门行
      rows.push({
        type: 'dept',
        id: dept.deptId,
        deptId: dept.deptId,
        level,
        dept,
        isVisible: parentExpanded || level === 0,
        hasChildren,
        isExpanded,
        isLast,
        parentLasts: [...parentLasts]
      });
      
      // 如果展开，添加用户行和子部门
      if (isExpanded && (parentExpanded || level === 0)) {
        const currentParentLasts = [...parentLasts, isLast];
        
        // 添加用户行
        if (dept.users && dept.users.length > 0) {
          dept.users.forEach((user: any, userIndex: number) => {
            const isUserLast = userIndex === dept.users.length - 1 && 
                              (!dept.children || dept.children.length === 0);
            rows.push({
              type: 'user',
              id: user.id,
              deptId: dept.deptId,
              level: level + 1,
              user,
              isVisible: true,
              hasChildren: false,
              isExpanded: false,
              isLast: isUserLast,
              parentLasts: currentParentLasts
            });
          });
        }
        
        // 递归处理子部门
        if (dept.children && dept.children.length > 0) {
          dept.children.forEach((child, childIndex) => {
            const isChildLast = childIndex === dept.children!.length - 1;
            traverse(child, level + 1, true, isChildLast, currentParentLasts);
          });
        }
      }
    };
    
    data.departmentStats.forEach((dept: DepartmentStat, index: number) => {
      const isLast = index === data.departmentStats.length - 1;
      traverse(dept, 0, true, isLast, []);
    });
    
    return rows;
  }, [data, expandedDepts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-8 py-10">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.task) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-8 py-10">
          <div className="text-center py-12 text-slate-400">任务不存在</div>
        </div>
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
      'passed': { text: '通过', className: 'bg-emerald-100 text-emerald-700' },
      'failed': { text: '未通过', className: 'bg-red-100 text-red-700' }
    };
    const badge = badges[status] || badges['assigned'];
    return <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${badge.className}`}>{badge.text}</span>;
  };

  // 渲染堆叠进度条
  const renderStackedProgress = (dept: DepartmentStat) => {
    const { total, passed, inProgress, notStarted } = dept;
    if (total === 0) return null;
    
    const passedPercent = (passed / total) * 100;
    const inProgressPercent = (inProgress / total) * 100;
    const notStartedPercent = (notStarted / total) * 100;
    
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden flex">
          {passed > 0 && (
            <div 
              className="bg-emerald-500 transition-all"
              style={{ width: `${passedPercent}%` }}
              title={`${passed}通过`}
            />
          )}
          {inProgress > 0 && (
            <div 
              className="bg-blue-500 transition-all"
              style={{ width: `${inProgressPercent}%` }}
              title={`${inProgress}进行中`}
            />
          )}
          {notStarted > 0 && (
            <div 
              className="bg-slate-300 transition-all"
              style={{ width: `${notStartedPercent}%` }}
              title={`${notStarted}未开始`}
            />
          )}
        </div>
        <div className="flex items-center gap-3 text-xs font-medium text-slate-600 min-w-[140px]">
          {passed > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>{passed}</span>
            </div>
          )}
          {inProgress > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>{inProgress}</span>
            </div>
          )}
          {notStarted > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-slate-300"></div>
              <span>{notStarted}</span>
            </div>
          )}
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-8 py-10">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ChevronLeft size={20} />
          返回
        </button>

        {/* 任务基本信息 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">{task.title}</h2>
          {task.description && (
            <p className="text-slate-600 mb-4">{task.description}</p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-slate-500 mb-1">学习内容</div>
              <div className="font-medium text-slate-900">{task.material.title}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">发布人</div>
              <div className="font-medium text-slate-900">{task.publisher.name}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">开始时间</div>
              <div className="font-medium text-slate-900">{toLocaleDateString(task.startDate)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">结束时间</div>
              <div className="font-medium text-slate-900">{toLocaleDateString(task.endDate)}</div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">总体完成率</span>
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

        {/* 部门完成情况 - 统一表格 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-900">部门完成情况</h3>
          </div>

          {departmentStats && departmentStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                {/* 统一表头 - 只在顶部显示一次 */}
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      组织架构
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      进度
                    </th>
                    {task.material.isExamRequired && (
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        考试成绩
                      </th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      完成时间
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flatRows.map((row, index) => {
                    if (row.type === 'dept') {
                      const dept = row.dept!;
                      const indent = row.level * 32;
                      const parentLasts = row.parentLasts || [];
                      const isLast = row.isLast || false;
                      
                      return (
                        <tr
                          key={row.id}
                          className={`bg-slate-50 hover:bg-slate-100 transition-colors ${
                            row.hasChildren ? 'cursor-pointer' : ''
                          }`}
                          onClick={() => {
                            if (row.hasChildren) {
                              toggleDept(dept.deptId);
                            }
                          }}
                        >
                          <td className="px-6 py-4 relative">
                            <div className="flex items-center gap-3" style={{ paddingLeft: `${indent}px` }}>
                              <div className="relative flex-shrink-0">
                                {/* 树形引导线 */}
                                {row.level > 0 && (
                                  <div 
                                    className="absolute left-0 top-0 bottom-0 flex pointer-events-none" 
                                    style={{ width: `${indent}px`, marginLeft: `-${indent}px` }}
                                  >
                                    {Array.from({ length: row.level }).map((_, idx) => {
                                      const isParentLast = parentLasts[idx] || false;
                                      const isCurrentLevel = idx === row.level - 1;
                                      return (
                                        <div key={idx} className="relative" style={{ width: '32px' }}>
                                          {/* 垂直引导线 - 只在不是最后一个父节点时显示 */}
                                          {!isParentLast && (
                                            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
                                          )}
                                          {/* 当前层级的水平连接线 */}
                                          {isCurrentLevel && (
                                            <div 
                                              className="absolute left-4 top-1/2 w-4 h-px bg-slate-200"
                                              style={{ transform: 'translateY(-50%)' }}
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                
                                {row.hasChildren ? (
                                  row.isExpanded ? (
                                    <ChevronDown size={18} className="text-slate-500" />
                                  ) : (
                                    <ChevronRight size={18} className="text-slate-500" />
                                  )
                                ) : (
                                  <div className="w-[18px]" />
                                )}
                              </div>
                              <Users size={18} className="text-blue-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-900">{dept.deptName}</div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {dept.total}人 · {dept.completed}人完成
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {/* 部门状态使用堆叠进度条 */}
                            {renderStackedProgress(dept)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-[120px]">
                                <div 
                                  className="h-full bg-emerald-500 transition-all"
                                  style={{ width: `${dept.total > 0 ? ((dept.completed / dept.total) * 100) : 0}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-slate-700">
                                {dept.total > 0 ? ((dept.completed / dept.total) * 100).toFixed(0) : 0}%
                              </span>
                            </div>
                          </td>
                          {task.material.isExamRequired && (
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-400">-</span>
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-400">-</span>
                          </td>
                        </tr>
                      );
                    } else {
                      // 员工行
                      const user = row.user!;
                      const indent = row.level * 32;
                      const parentLasts = row.parentLasts || [];
                      const isLast = row.isLast || false;
                      
                      return (
                        <tr
                          key={row.id}
                          className="bg-white hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-3 relative">
                            <div className="flex items-center gap-3" style={{ paddingLeft: `${indent}px` }}>
                              <div className="relative flex-shrink-0">
                                {/* 树形引导线 */}
                                {row.level > 0 && (
                                  <div 
                                    className="absolute left-0 top-0 bottom-0 flex pointer-events-none" 
                                    style={{ width: `${indent}px`, marginLeft: `-${indent}px` }}
                                  >
                                    {Array.from({ length: row.level }).map((_, idx) => {
                                      const isParentLast = parentLasts[idx] || false;
                                      const isCurrentLevel = idx === row.level - 1;
                                      return (
                                        <div key={idx} className="relative" style={{ width: '32px' }}>
                                          {/* 垂直引导线 - 只在不是最后一个父节点时显示 */}
                                          {!isParentLast && (
                                            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
                                          )}
                                          {/* 当前层级的水平连接线 */}
                                          {isCurrentLevel && (
                                            <div 
                                              className="absolute left-4 top-1/2 w-4 h-px bg-slate-200"
                                              style={{ transform: 'translateY(-50%)' }}
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <User size={16} className="text-slate-400" />
                              </div>
                              <span className="text-sm font-medium text-slate-900">{user.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            {getStatusBadge(user.status)}
                          </td>
                          <td className="px-6 py-3">
                            {user.status === 'in-progress' || user.status === 'completed' || user.status === 'passed'
                              ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-[120px]">
                                    <div 
                                      className="h-full bg-blue-500 transition-all"
                                      style={{ width: `${user.progress || 0}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium text-slate-700">{user.progress}%</span>
                                </div>
                              )
                              : <span className="text-sm text-slate-400">-</span>}
                          </td>
                          {task.material.isExamRequired && (
                            <td className="px-6 py-3">
                              {user.examScore !== null && user.examScore !== undefined
                                ? <span className="text-sm font-medium text-slate-900">{user.examScore}分</span>
                                : <span className="text-sm text-slate-400">-</span>}
                            </td>
                          )}
                          <td className="px-6 py-3">
                            {user.completedAt
                              ? <span className="text-sm text-slate-600">{formatDateTime(user.completedAt, 'datetime')}</span>
                              : <span className="text-sm text-slate-400">-</span>}
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              暂无部门数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
