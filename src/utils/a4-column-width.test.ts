/**
 * A4 Column Width Calculator 单元测试
 */

import {
  calculateA4ColumnWidths,
  calculateStringWidth,
  formatWidthsForCSS,
  getTotalTableWidth,
  validateA4Fit
} from './a4-column-width';

describe('A4 Column Width Calculator', () => {
  describe('calculateStringWidth', () => {
    it('应该正确计算 CJK 字符宽度', () => {
      const cjkWidth = calculateStringWidth('你好世界');
      const asciiWidth = calculateStringWidth('Hello');
      expect(cjkWidth).toBeGreaterThan(asciiWidth);
    });

    it('应该处理空字符串', () => {
      const width = calculateStringWidth('');
      expect(width).toBeGreaterThan(0); // 至少包含 padding
    });

    it('应该处理混合内容', () => {
      const mixedWidth = calculateStringWidth('Hello世界');
      expect(mixedWidth).toBeGreaterThan(0);
    });
  });

  describe('calculateA4ColumnWidths', () => {
    it('应该处理空数据', () => {
      const widths = calculateA4ColumnWidths([]);
      expect(widths).toEqual([]);
    });

    it('应该处理单单元格数据', () => {
      const widths = calculateA4ColumnWidths([['Test']]);
      expect(widths.length).toBe(1);
      expect(widths[0]).toBeGreaterThan(0);
    });

    it('应该为混合内容计算合适的列宽', () => {
      const employeeData = [
        ['姓名', '部门', 'Email', '状态', '入职日期'],
        ['张三', '技术部门', 'zhangsan@example.com', '在职', '2023-01-15'],
        ['李四', '行政部', 'lisi@example.com', '离职', '2022-06-20'],
      ];
      const widths = calculateA4ColumnWidths(employeeData);
      expect(widths.length).toBe(5);
      widths.forEach(width => {
        expect(width).toBeGreaterThanOrEqual(40); // 最小宽度
        expect(width).toBeLessThanOrEqual(300); // 最大宽度
      });
    });

    it('应该处理长文本列', () => {
      const longTextData = [
        ['ID', '标题', '描述'],
        ['001', '短标题', '这是一段很长很长很长很长的描述文字，用来测试列宽是否会被限制在最大宽度以内，防止单个列占用过多空间'],
        ['002', '另一个标题', '正常长度的描述']
      ];
      const widths = calculateA4ColumnWidths(longTextData);
      expect(widths.length).toBe(3);
      widths.forEach(width => {
        expect(width).toBeLessThanOrEqual(300); // 应该被限制在最大宽度
      });
    });

    it('应该处理纯 CJK 内容', () => {
      const cjkData = [
        ['项目名称', '负责人', '开始日期', '状态'],
        ['环境健康安全管理系统', '张经理', '2023年1月', '进行中'],
        ['隐患排查整改', '李主管', '2023年3月', '已完成'],
      ];
      const widths = calculateA4ColumnWidths(cjkData);
      expect(widths.length).toBe(4);
      widths.forEach(width => {
        expect(width).toBeGreaterThanOrEqual(40);
        expect(width).toBeLessThanOrEqual(300);
      });
    });

    it('应该处理纯 ASCII 内容', () => {
      const asciiData = [
        ['ID', 'Name', 'Email', 'Status', 'Date'],
        ['1', 'John Doe', 'john.doe@example.com', 'Active', '2023-01-15'],
        ['2', 'Jane Smith', 'jane.smith@example.com', 'Inactive', '2022-12-20'],
      ];
      const widths = calculateA4ColumnWidths(asciiData);
      expect(widths.length).toBe(5);
      widths.forEach(width => {
        expect(width).toBeGreaterThanOrEqual(40);
        expect(width).toBeLessThanOrEqual(300);
      });
    });

    it('应该处理多个窄列', () => {
      const narrowColumnsData = [
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      ];
      const widths = calculateA4ColumnWidths(narrowColumnsData);
      expect(widths.length).toBe(10);
      widths.forEach(width => {
        expect(width).toBeGreaterThanOrEqual(40); // 所有列都应该满足最小宽度
      });
    });

    it('应该按比例分配宽度', () => {
      const propData = [
        ['Short', 'Medium Length', 'Very Long Column Header Text'],
        ['A', 'B', 'C']
      ];
      const widths = calculateA4ColumnWidths(propData);
      expect(widths.length).toBe(3);
      expect(widths[0]).toBeLessThan(widths[1]);
      expect(widths[1]).toBeLessThan(widths[2]);
    });

    it('总宽度应该在 A4 可打印区域内', () => {
      const testData = [
        ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5'],
        ['Data 1', 'Data 2', 'Data 3', 'Data 4', 'Data 5']
      ];
      const widths = calculateA4ColumnWidths(testData);
      const totalWidth = getTotalTableWidth(widths);
      expect(totalWidth).toBeLessThanOrEqual(744); // A4 可打印区域宽度
    });
  });

  describe('formatWidthsForCSS', () => {
    it('应该将数字宽度格式化为 CSS 字符串', () => {
      const widths = [80, 120, 200];
      const cssWidths = formatWidthsForCSS(widths);
      expect(cssWidths).toEqual(['80px', '120px', '200px']);
    });

    it('应该处理空数组', () => {
      const cssWidths = formatWidthsForCSS([]);
      expect(cssWidths).toEqual([]);
    });
  });

  describe('getTotalTableWidth', () => {
    it('应该正确计算总宽度', () => {
      const widths = [80, 120, 200];
      const total = getTotalTableWidth(widths);
      expect(total).toBe(400);
    });

    it('应该处理空数组', () => {
      const total = getTotalTableWidth([]);
      expect(total).toBe(0);
    });
  });

  describe('validateA4Fit', () => {
    it('应该验证表格是否适合 A4 纸张', () => {
      const widths = [100, 150, 200, 150, 100];
      const validation = validateA4Fit(widths);
      expect(validation).toHaveProperty('fits');
      expect(validation).toHaveProperty('totalWidth');
      expect(validation).toHaveProperty('maxWidth');
      expect(validation).toHaveProperty('overflow');
      expect(validation.maxWidth).toBe(744); // A4 可打印区域宽度
    });

    it('应该正确计算溢出量', () => {
      const widths = [200, 200, 200, 200]; // 总宽度 800px，超出 744px
      const validation = validateA4Fit(widths);
      if (validation.totalWidth > 744) {
        expect(validation.fits).toBe(false);
        expect(validation.overflow).toBeGreaterThan(0);
      }
    });

    it('应该识别适合 A4 的表格', () => {
      const widths = [100, 100, 100, 100]; // 总宽度 400px，适合 A4
      const validation = validateA4Fit(widths);
      if (validation.totalWidth <= 744) {
        expect(validation.fits).toBe(true);
        expect(validation.overflow).toBe(0);
      }
    });
  });
});
