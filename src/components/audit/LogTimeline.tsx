/**
 * 日志时间线组件
 * 
 * 展示某个业务对象的完整操作历史，类似 GitHub Commit Timeline
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { LogDiffViewer } from './LogDiffViewer';
import { LogSnapshotViewer } from './LogSnapshotViewer';
import { ActionColorScheme } from '@/constants/audit';
import type { LogAction } from '@/types/audit';

interface LogTimelineProps {
  /** 日志列表 */
  logs: any[];
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 空状态文本 */
  emptyText?: string;
}

export function LogTimeline({
  logs,
  loading = false,
  emptyText = '暂无操作记录',
}: LogTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        {emptyText}
      </Card>
    );
  }

  return (
    <div className="relative">
      {/* 时间线竖线 */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />

      {/* 日志列表 */}
      <div className="space-y-6">
        {logs.map((log, index) => (
          <LogTimelineItem
            key={log.id}
            log={log}
            isFirst={index === 0}
            isLast={index === logs.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

// ============ 时间线项 ============
interface LogTimelineItemProps {
  log: any;
  isFirst: boolean;
  isLast: boolean;
}

function LogTimelineItem({ log, isFirst, isLast }: LogTimelineItemProps) {
  const actionColor = ActionColorScheme[log.action as LogAction] || 'text-gray-600 bg-gray-50';

  return (
    <div className="relative pl-16 pr-4">
      {/* 时间线圆点 */}
      <div
        className={`absolute left-6 top-2 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
          isFirst ? 'bg-blue-500' : 'bg-gray-400'
        }`}
      />

      <Card className="p-4">
        {/* 头部：操作类型 + 时间 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge className={actionColor}>
              {log.actionLabel || log.action}
            </Badge>
            {log.businessCode && (
              <Badge variant="outline" className="text-xs">
                {log.businessCode}
              </Badge>
            )}
          </div>
          <time className="text-xs text-muted-foreground">
            {formatDate(log.createdAt)}
          </time>
        </div>

        {/* 操作人信息 */}
        <div className="flex items-center gap-2 text-sm mb-2">
          <span className="font-medium">{log.userName || '系统'}</span>
          {log.userRole && (
            <Badge variant="secondary" className="text-xs">
              {log.userRole}
            </Badge>
          )}
          {log.userRoleInAction && (
            <Badge variant="outline" className="text-xs">
              {log.userRoleInAction}
            </Badge>
          )}
        </div>

        {/* 操作描述 */}
        {log.details && (
          <p className="text-sm text-gray-700 mb-3">{log.details}</p>
        )}

        {/* 变更对比 */}
        {log.diff && (
          <div className="mt-3">
            <LogDiffViewer diff={log.diff} mode="inline" showCard={false} />
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          {log.snapshot && (
            <LogSnapshotViewer
              snapshot={log.snapshot}
              title={`${log.actionLabel} - 数据快照`}
            />
          )}

          {log.targetLink && (
            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <a href={log.targetLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1" />
                查看详情
              </a>
            </Button>
          )}

          {log.clientInfo && <ClientInfoBadge clientInfo={log.clientInfo} />}
        </div>
      </Card>
    </div>
  );
}

// ============ 客户端信息徽章 ============
function ClientInfoBadge({ clientInfo }: { clientInfo: string | any }) {
  let parsed: any = clientInfo;

  if (typeof clientInfo === 'string') {
    try {
      parsed = JSON.parse(clientInfo);
    } catch {
      return null;
    }
  }

  if (!parsed) return null;

  const { ip, browser, device, os } = parsed;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
      {ip && <span>IP: {ip}</span>}
      {browser && <span>· {browser}</span>}
      {device && <span>· {device}</span>}
    </div>
  );
}

// ============ 辅助函数 ============
function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  // 相对时间
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  // 绝对时间
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
