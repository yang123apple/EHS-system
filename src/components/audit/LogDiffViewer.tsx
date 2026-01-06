/**
 * 日志差异查看器组件
 * 
 * 以左右分栏或高亮的形式展示字段变更
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { getFieldLabel } from '@/lib/audit-utils';
import type { DiffResult } from '@/types/audit';

interface LogDiffViewerProps {
  /** 差异对象 */
  diff: DiffResult | string | null;
  /** 显示模式：split（分栏）或 inline（行内） */
  mode?: 'split' | 'inline';
  /** 是否显示卡片包装 */
  showCard?: boolean;
}

export function LogDiffViewer({
  diff,
  mode = 'inline',
  showCard = true,
}: LogDiffViewerProps) {
  // 解析 diff
  let parsedDiff: DiffResult | null = null;

  if (!diff) {
    return null;
  }

  if (typeof diff === 'string') {
    try {
      parsedDiff = JSON.parse(diff);
    } catch (error) {
      console.error('解析 diff 失败:', error);
      return null;
    }
  } else {
    parsedDiff = diff;
  }

  if (!parsedDiff || Object.keys(parsedDiff).length === 0) {
    return null;
  }

  const content = mode === 'split' ? (
    <SplitView diff={parsedDiff} />
  ) : (
    <InlineView diff={parsedDiff} />
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Badge variant="outline" className="text-xs">变更对比</Badge>
          <span className="text-muted-foreground">
            {Object.keys(parsedDiff).length} 个字段发生变化
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

// ============ 分栏视图 ============
function SplitView({ diff }: { diff: DiffResult }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 修改前 */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Minus className="w-3 h-3 text-red-500" />
          修改前
        </div>
        <div className="space-y-2">
          {Object.entries(diff).map(([field, change]) => (
            <div
              key={field}
              className="p-2 rounded-md bg-red-50 border border-red-200"
            >
              <div className="text-xs font-medium text-red-900">
                {getFieldLabel(field)}
              </div>
              <div className="text-sm text-red-700 mt-1">
                {formatValue(change.old)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 修改后 */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Plus className="w-3 h-3 text-green-500" />
          修改后
        </div>
        <div className="space-y-2">
          {Object.entries(diff).map(([field, change]) => (
            <div
              key={field}
              className="p-2 rounded-md bg-green-50 border border-green-200"
            >
              <div className="text-xs font-medium text-green-900">
                {getFieldLabel(field)}
              </div>
              <div className="text-sm text-green-700 mt-1">
                {formatValue(change.new)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ 行内视图 ============
function InlineView({ diff }: { diff: DiffResult }) {
  return (
    <div className="space-y-2">
      {Object.entries(diff).map(([field, change]) => (
        <div
          key={field}
          className="flex items-center gap-2 p-2 rounded-md bg-gray-50 border border-gray-200"
        >
          {/* 字段名 */}
          <div className="text-xs font-medium text-gray-700 min-w-[120px]">
            {getFieldLabel(field)}:
          </div>

          {/* 旧值 */}
          <div className="flex items-center gap-2 flex-1">
            <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-sm line-through">
              {formatValue(change.old)}
            </span>

            <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

            {/* 新值 */}
            <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-sm font-medium">
              {formatValue(change.new)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ 辅助函数 ============
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '(空)';
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (value instanceof Date || !isNaN(Date.parse(value))) {
    try {
      const date = new Date(value);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(value);
    }
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}
