/**
 * 日志快照查看器组件
 * 
 * 以格式化的 JSON 树展示操作时的完整数据快照
 */

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface LogSnapshotViewerProps {
  /** 快照数据 */
  snapshot: any | string | null;
  /** 触发按钮文本 */
  triggerText?: string;
  /** 对话框标题 */
  title?: string;
}

export function LogSnapshotViewer({
  snapshot,
  triggerText = '查看快照',
  title = '数据快照',
}: LogSnapshotViewerProps) {
  const [copied, setCopied] = useState(false);

  // 解析 snapshot
  let parsedSnapshot: any = null;

  if (!snapshot) {
    return null;
  }

  if (typeof snapshot === 'string') {
    try {
      parsedSnapshot = JSON.parse(snapshot);
    } catch (error) {
      console.error('解析快照失败:', error);
      return null;
    }
  } else {
    parsedSnapshot = snapshot;
  }

  // 复制到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(parsedSnapshot, null, 2)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4 mr-1" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {title}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="ml-auto"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1 text-green-600" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  复制
                </>
              )}
            </Button>
          </DialogTitle>
          <DialogDescription>
            此快照记录了操作时的完整数据状态，用于审计追溯
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] w-full">
          <div className="p-4">
            <JsonTree data={parsedSnapshot} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ============ JSON 树组件 ============
interface JsonTreeProps {
  data: any;
  level?: number;
}

function JsonTree({ data, level = 0 }: JsonTreeProps) {
  if (data === null || data === undefined) {
    return <span className="text-gray-400 italic">null</span>;
  }

  if (typeof data !== 'object') {
    return <span className="text-blue-600">{formatPrimitive(data)}</span>;
  }

  if (Array.isArray(data)) {
    return <ArrayNode data={data} level={level} />;
  }

  return <ObjectNode data={data} level={level} />;
}

// ============ 对象节点 ============
function ObjectNode({ data, level }: { data: Record<string, any>; level: number }) {
  const [expanded, setExpanded] = useState(level < 2); // 默认展开前2层

  const entries = Object.entries(data);

  if (entries.length === 0) {
    return <span className="text-gray-400">{'{}'}</span>;
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 hover:bg-gray-100 rounded px-1 -ml-1"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
        <span className="text-gray-600 text-sm">
          {'{'} {!expanded && `${entries.length} 项`}
        </span>
      </button>

      {expanded && (
        <div className="ml-4 border-l border-gray-200 pl-2 mt-1 space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="text-purple-600 font-medium text-sm min-w-[120px]">
                {key}:
              </span>
              <JsonTree data={value} level={level + 1} />
            </div>
          ))}
        </div>
      )}

      {expanded && <span className="text-gray-600 text-sm">{'}'}</span>}
    </div>
  );
}

// ============ 数组节点 ============
function ArrayNode({ data, level }: { data: any[]; level: number }) {
  const [expanded, setExpanded] = useState(level < 2);

  if (data.length === 0) {
    return <span className="text-gray-400">[]</span>;
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 hover:bg-gray-100 rounded px-1 -ml-1"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
        <span className="text-gray-600 text-sm">
          {'['} {!expanded && `${data.length} 项`}
        </span>
      </button>

      {expanded && (
        <div className="ml-4 border-l border-gray-200 pl-2 mt-1 space-y-1">
          {data.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <Badge variant="outline" className="text-xs">
                {index}
              </Badge>
              <JsonTree data={item} level={level + 1} />
            </div>
          ))}
        </div>
      )}

      {expanded && <span className="text-gray-600 text-sm">{']'}</span>}
    </div>
  );
}

// ============ 基本类型格式化 ============
function formatPrimitive(value: any): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  return String(value);
}
