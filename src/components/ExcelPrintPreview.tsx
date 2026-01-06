/**
 * EHS 系统 - Excel 打印预览组件示例
 * 
 * 集成 A4 列宽计算工具与 LuckySheet 的完整示例
 */

'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  calculateA4ColumnWidths,
  validateA4Fit,
  getTotalTableWidth,
  formatWidthsForCSS
} from '@/utils/a4-column-width';

// ============================================================================
// 类型定义
// ============================================================================

interface ExcelPrintPreviewProps {
  /** Excel 数据 (2D 数组) */
  data: any[][];
  /** 表格标题 */
  title?: string;
  /** 是否显示调试信息 */
  showDebugInfo?: boolean;
  /** 自定义配置 */
  config?: {
    enableEdit?: boolean;
    showGridlines?: boolean;
    orientation?: 'portrait' | 'landscape';
  };
}

interface ValidationInfo {
  fits: boolean;
  totalWidth: number;
  maxWidth: number;
  overflow: number;
}

// ============================================================================
// 主组件
// ============================================================================

export const ExcelPrintPreview: React.FC<ExcelPrintPreviewProps> = ({
  data,
  title = '数据报表',
  showDebugInfo = false,
  config = {}
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 计算列宽
  const columnWidths = useMemo(() => {
    try {
      if (!data || data.length === 0) return [];
      return calculateA4ColumnWidths(data);
    } catch (err) {
      console.error('列宽计算失败:', err);
      setError('列宽计算失败,请检查数据格式');
      return [];
    }
  }, [data]);

  // 验证 A4 适配性
  const validation = useMemo((): ValidationInfo => {
    return validateA4Fit(columnWidths);
  }, [columnWidths]);

  // 页面方向
  const orientation = config.orientation || 
    (validation.fits ? 'portrait' : 'landscape');

  // 初始化 LuckySheet
  useEffect(() => {
    if (!containerRef.current || columnWidths.length === 0) return;

    // 确保 LuckySheet 已加载
    if (typeof window === 'undefined' || !window.luckysheet) {
      setError('LuckySheet 未加载,请在页面中引入 LuckySheet');
      return;
    }

    try {
      // 销毁旧实例
      const container = containerRef.current;
      container.innerHTML = '';

      // 转换数据为 LuckySheet 格式
      const celldata = convertToCellData(data);

      // 创建配置
      const columnlen = Object.fromEntries(
        columnWidths.map((width, index) => [String(index), width])
      );

      // 初始化 LuckySheet
      window.luckysheet.create({
        container: 'luckysheet-container',
        lang: 'zh',
        showinfobar: false,
        showsheetbar: false,
        showsheetbarConfig: {
          add: false,
          menu: false,
        },
        enableAddRow: config.enableEdit || false,
        enableAddCol: config.enableEdit || false,
        userInfo: false,
        hook: {
          updated: () => setIsLoaded(true),
        },
        data: [{
          name: title,
          row: data.length,
          column: columnWidths.length,
          config: {
            columnlen,
            rowlen: {}, // 可根据需要设置行高
          },
          celldata,
          status: 1,
        }],
        title,
        gridKey: 'ehs-print-preview',
      });

      setIsLoaded(true);
    } catch (err) {
      console.error('LuckySheet 初始化失败:', err);
      setError('表格初始化失败');
    }

    // 清理函数
    return () => {
      if (window.luckysheet && window.luckysheet.destroy) {
        try {
          window.luckysheet.destroy();
        } catch (err) {
          console.warn('LuckySheet 清理失败:', err);
        }
      }
    };
  }, [data, columnWidths, title, config.enableEdit]);

  // 打印处理
  const handlePrint = () => {
    window.print();
  };

  // A4 尺寸(根据方向)
  const a4Width = orientation === 'portrait' ? 794 : 1123;
  const a4Height = orientation === 'portrait' ? 1123 : 794;

  return (
    <div className="excel-print-preview">
      {/* 工具栏 */}
      <div className="toolbar no-print">
        <h2>{title}</h2>
        
        {/* 验证状态 */}
        {!validation.fits && (
          <div className="warning">
            ⚠️ 表格宽度({validation.totalWidth}px)超出 A4 纸张
            ({validation.maxWidth}px),建议使用横向打印
          </div>
        )}

        {error && (
          <div className="error">
            ❌ {error}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="actions">
          <button onClick={handlePrint} disabled={!isLoaded}>
            🖨️ 打印
          </button>
          <span className="orientation-badge">
            {orientation === 'portrait' ? '📄 纵向' : '📃 横向'}
          </span>
        </div>

        {/* 调试信息 */}
        {showDebugInfo && (
          <DebugPanel 
            columnWidths={columnWidths}
            validation={validation}
            data={data}
          />
        )}
      </div>

      {/* LuckySheet 容器 */}
      <div 
        className="luckysheet-wrapper"
        style={{
          width: `${a4Width}px`,
          height: `${a4Height}px`,
          margin: '0 auto',
          border: '1px solid #ddd',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <div 
          id="luckysheet-container"
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* 打印样式 */}
      <style jsx>{`
        .excel-print-preview {
          padding: 20px;
          background: #f5f5f5;
        }

        .toolbar {
          max-width: ${a4Width}px;
          margin: 0 auto 20px;
          padding: 15px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .toolbar h2 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .warning {
          padding: 10px;
          margin: 10px 0;
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 4px;
          color: #856404;
        }

        .error {
          padding: 10px;
          margin: 10px 0;
          background: #f8d7da;
          border: 1px solid #dc3545;
          border-radius: 4px;
          color: #721c24;
        }

        .actions {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-top: 10px;
        }

        .actions button {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .actions button:hover:not(:disabled) {
          background: #0056b3;
        }

        .actions button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .orientation-badge {
          padding: 4px 12px;
          background: #e9ecef;
          border-radius: 4px;
          font-size: 13px;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          .excel-print-preview {
            padding: 0;
            background: white;
          }

          .luckysheet-wrapper {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
          }

          @page {
            size: ${orientation === 'portrait' ? 'A4 portrait' : 'A4 landscape'};
            margin: 10mm;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// 调试面板组件
// ============================================================================

interface DebugPanelProps {
  columnWidths: number[];
  validation: ValidationInfo;
  data: any[][];
}

const DebugPanel: React.FC<DebugPanelProps> = ({ 
  columnWidths, 
  validation, 
  data 
}) => {
  return (
    <details className="debug-panel">
      <summary>🔧 调试信息</summary>
      <div className="debug-content">
        <h4>列宽分配</h4>
        <pre>{JSON.stringify(columnWidths, null, 2)}</pre>
        <p>总宽度: {getTotalTableWidth(columnWidths)}px</p>
        <p>CSS格式: {formatWidthsForCSS(columnWidths).join(', ')}</p>

        <h4>验证结果</h4>
        <pre>{JSON.stringify(validation, null, 2)}</pre>

        <h4>数据信息</h4>
        <p>行数: {data.length}</p>
        <p>列数: {data[0]?.length || 0}</p>
      </div>

      <style jsx>{`
        .debug-panel {
          margin-top: 15px;
          padding: 10px;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
        }

        .debug-panel summary {
          cursor: pointer;
          font-weight: bold;
          user-select: none;
        }

        .debug-content {
          margin-top: 10px;
        }

        .debug-content h4 {
          margin: 10px 0 5px 0;
          color: #495057;
        }

        .debug-content pre {
          background: white;
          padding: 8px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 12px;
        }

        .debug-content p {
          margin: 5px 0;
          font-size: 13px;
        }
      `}</style>
    </details>
  );
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 转换 2D 数组为 LuckySheet celldata 格式
 */
function convertToCellData(data: any[][]): any[] {
  const celldata: any[] = [];

  data.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const value = cell != null ? String(cell) : '';
      
      celldata.push({
        r: rowIndex,
        c: colIndex,
        v: {
          v: value,
          m: value,
          ct: { fa: 'General', t: 'g' },
          // 第一行作为表头,加粗显示
          ...(rowIndex === 0 && {
            bl: 1,
            fc: '#333333',
            bg: '#f0f0f0',
          }),
        },
      });
    });
  });

  return celldata;
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 示例 1: 基础使用
 */
export function Example1() {
  const data = [
    ['姓名', '部门', 'Email', '状态'],
    ['张三', '技术部门', 'zhangsan@example.com', '在职'],
    ['李四', '行政部', 'lisi@example.com', '离职'],
  ];

  return <ExcelPrintPreview data={data} title="员工信息表" />;
}

/**
 * 示例 2: 从 API 加载数据
 */
export function Example2() {
  const [data, setData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/hazard-report');
        const json = await response.json();
        
        // 转换为 2D 数组
        const tableData = [
          ['隐患编号', '隐患描述', '责任人', '整改期限', '状态'],
          ...json.data.map((item: any) => [
            item.code,
            item.description,
            item.responsible,
            item.deadline,
            item.status,
          ]),
        ];
        
        setData(tableData);
      } catch (err) {
        console.error('加载失败:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) return <div>加载中...</div>;
  if (data.length === 0) return <div>无数据</div>;

  return (
    <ExcelPrintPreview 
      data={data} 
      title="隐患排查报告"
      showDebugInfo={process.env.NODE_ENV === 'development'}
    />
  );
}

/**
 * 示例 3: 可编辑模式
 */
export function Example3() {
  const [data, setData] = useState([
    ['项目名称', '负责人', '开始日期', '状态'],
    ['环境健康安全管理', '张经理', '2023-01-15', '进行中'],
  ]);

  return (
    <ExcelPrintPreview 
      data={data}
      title="项目管理表"
      config={{
        enableEdit: true,
        showGridlines: true,
      }}
      showDebugInfo
    />
  );
}

// ============================================================================
// TypeScript 声明
// ============================================================================

declare global {
  interface Window {
    luckysheet: {
      create: (options: any) => void;
      destroy: () => void;
      getAllSheets: () => any[];
      getSheetData: () => any[][];
      // 其他 LuckySheet API...
    };
  }
}

export default ExcelPrintPreview;
