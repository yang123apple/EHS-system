/**
 * Test Suite and Usage Examples for A4 Column Width Calculator
 */

import {
  calculateA4ColumnWidths,
  calculateStringWidth,
  formatWidthsForCSS,
  getTotalTableWidth,
  validateA4Fit
} from './a4-column-width';

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

console.log('='.repeat(80));
console.log('A4 COLUMN WIDTH CALCULATOR - USAGE EXAMPLES');
console.log('='.repeat(80));

// ----------------------------------------------------------------------------
// Example 1: Simple table with mixed CJK and ASCII content
// ----------------------------------------------------------------------------

console.log('\n📋 Example 1: Employee Table (Mixed Content)');
console.log('-'.repeat(80));

const employeeData = [
  ['姓名', '部门', 'Email', '状态', '入职日期'],
  ['张三', '技术部门', 'zhangsan@example.com', '在职', '2023-01-15'],
  ['李四', '行政部', 'lisi@example.com', '离职', '2022-06-20'],
  ['王五', '销售部门与市场营销', 'wangwu@example.com', '在职', '2023-03-10'],
  ['赵六', 'IT', 'zhaoliu@example.com', '在职', '2021-11-05']
];

const widths1 = calculateA4ColumnWidths(employeeData);
console.log('Input Data:', JSON.stringify(employeeData, null, 2));
console.log('\nCalculated Widths:', widths1);
console.log('CSS Widths:', formatWidthsForCSS(widths1));
console.log('Total Width:', getTotalTableWidth(widths1), 'px');

const validation1 = validateA4Fit(widths1);
console.log('Fits A4:', validation1.fits ? '✅' : '❌');
console.log('Overflow:', validation1.overflow, 'px');

// ----------------------------------------------------------------------------
// Example 2: Table with very long text in one column
// ----------------------------------------------------------------------------

console.log('\n\n📋 Example 2: Table with Long Text (Max Width Test)');
console.log('-'.repeat(80));

const longTextData = [
  ['ID', '标题', '描述'],
  ['001', '短标题', '这是一段很长很长很长很长的描述文字，用来测试列宽是否会被限制在最大宽度以内，防止单个列占用过多空间'],
  ['002', '另一个标题', '正常长度的描述']
];

const widths2 = calculateA4ColumnWidths(longTextData);
console.log('Calculated Widths:', widths2);
console.log('Total Width:', getTotalTableWidth(widths2), 'px');

// ----------------------------------------------------------------------------
// Example 3: Pure CJK content
// ----------------------------------------------------------------------------

console.log('\n\n📋 Example 3: Pure CJK Content');
console.log('-'.repeat(80));

const cjkData = [
  ['项目名称', '负责人', '开始日期', '状态'],
  ['环境健康安全管理系统', '张经理', '2023年1月', '进行中'],
  ['隐患排查整改', '李主管', '2023年3月', '已完成'],
  ['应急演练', '王组长', '2023年6月', '计划中']
];

const widths3 = calculateA4ColumnWidths(cjkData);
console.log('Calculated Widths:', widths3);
console.log('Total Width:', getTotalTableWidth(widths3), 'px');

// ----------------------------------------------------------------------------
// Example 4: Pure ASCII/Numbers
// ----------------------------------------------------------------------------

console.log('\n\n📋 Example 4: Pure ASCII/Numbers');
console.log('-'.repeat(80));

const asciiData = [
  ['ID', 'Name', 'Email', 'Status', 'Date'],
  ['1', 'John Doe', 'john.doe@example.com', 'Active', '2023-01-15'],
  ['2', 'Jane Smith', 'jane.smith@example.com', 'Inactive', '2022-12-20'],
  ['3', 'Bob Johnson', 'bob.johnson@example.com', 'Active', '2023-05-10']
];

const widths4 = calculateA4ColumnWidths(asciiData);
console.log('Calculated Widths:', widths4);
console.log('Total Width:', getTotalTableWidth(widths4), 'px');

// ----------------------------------------------------------------------------
// Example 5: Many narrow columns
// ----------------------------------------------------------------------------

console.log('\n\n📋 Example 5: Many Narrow Columns (Min Width Test)');
console.log('-'.repeat(80));

const narrowColumnsData = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  ['✓', '✗', '✓', '✓', '✗', '✓', '✗', '✓', '✓', '✗']
];

const widths5 = calculateA4ColumnWidths(narrowColumnsData);
console.log('Calculated Widths:', widths5);
console.log('Total Width:', getTotalTableWidth(widths5), 'px');
console.log('All columns >= 40px:', widths5.every(w => w >= 40) ? '✅' : '❌');

// ============================================================================
// UNIT TESTS
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('UNIT TESTS');
console.log('='.repeat(80));

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log('✅', message);
  } else {
    console.error('❌', message);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Test 1: String width calculation - CJK vs ASCII
console.log('\n🧪 Test Suite 1: String Width Calculation');
console.log('-'.repeat(80));

const cjkWidth = calculateStringWidth('你好世界');
const asciiWidth = calculateStringWidth('Hello');
assert(cjkWidth > asciiWidth, 'CJK text should be wider than ASCII text of same length');
console.log(`  CJK "你好世界" width: ${cjkWidth}px`);
console.log(`  ASCII "Hello" width: ${asciiWidth}px`);

const mixedWidth = calculateStringWidth('Hello世界');
console.log(`  Mixed "Hello世界" width: ${mixedWidth}px`);

// Test 2: Empty data handling
console.log('\n🧪 Test Suite 2: Edge Cases');
console.log('-'.repeat(80));

const emptyWidths = calculateA4ColumnWidths([]);
assert(emptyWidths.length === 0, 'Empty data should return empty array');

const singleCellWidths = calculateA4ColumnWidths([['Test']]);
assert(singleCellWidths.length === 1, 'Single cell should return one width');
assert(singleCellWidths[0] > 0, 'Single cell width should be positive');
console.log(`  Single cell "Test" width: ${singleCellWidths[0]}px`);

// Test 3: Total width constraint
console.log('\n🧪 Test Suite 3: A4 Width Constraints');
console.log('-'.repeat(80));

const testData = [
  ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5'],
  ['Data 1', 'Data 2', 'Data 3', 'Data 4', 'Data 5']
];

const testWidths = calculateA4ColumnWidths(testData);
const totalWidth = getTotalTableWidth(testWidths);
assert(totalWidth <= 744, `Total width (${totalWidth}px) should fit within A4 printable area (744px)`);
console.log(`  Total width: ${totalWidth}px / 744px (${((totalWidth/744)*100).toFixed(1)}% of printable area)`);

// Test 4: Minimum width constraint
console.log('\n🧪 Test Suite 4: Minimum Width Constraint');
console.log('-'.repeat(80));

const tinyData = [['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']];
const tinyWidths = calculateA4ColumnWidths(tinyData);
const allAboveMin = tinyWidths.every(w => w >= 40);
assert(allAboveMin, 'All columns should meet minimum width of 40px');
console.log(`  Widths for tiny columns: ${tinyWidths.join(', ')}`);
console.log(`  All >= 40px: ${allAboveMin ? '✅' : '❌'}`);

// Test 5: Maximum width constraint
console.log('\n🧪 Test Suite 5: Maximum Width Constraint');
console.log('-'.repeat(80));

const hugeData = [
  ['Short', 'This is an extremely long column header with lots and lots and lots of text that should be capped'],
  ['A', 'More extremely long text content that keeps going and going and going']
];

const hugeWidths = calculateA4ColumnWidths(hugeData);
const allBelowMax = hugeWidths.every(w => w <= 300);
assert(allBelowMax, 'All columns should respect maximum width of 300px');
console.log(`  Widths: ${hugeWidths.join(', ')}`);
console.log(`  All <= 300px: ${allBelowMax ? '✅' : '❌'}`);

// Test 6: Proportional distribution
console.log('\n🧪 Test Suite 6: Proportional Distribution');
console.log('-'.repeat(80));

const propData = [
  ['Short', 'Medium Length', 'Very Long Column Header Text'],
  ['A', 'B', 'C']
];

const propWidths = calculateA4ColumnWidths(propData);
console.log(`  Widths: ${propWidths.join(', ')}`);
assert(propWidths[0] < propWidths[1], 'Shorter content should get less width');
assert(propWidths[1] < propWidths[2], 'Longer content should get more width');
console.log(`  Proportional: ${propWidths[0]} < ${propWidths[1]} < ${propWidths[2]} ✅`);

// ============================================================================
// INTEGRATION EXAMPLE: React Component
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('INTEGRATION EXAMPLE: React Component with LuckySheet');
console.log('='.repeat(80));

const reactExample = `
import React, { useEffect, useMemo } from 'react';
import { calculateA4ColumnWidths, validateA4Fit } from '@/utils/a4-column-width';

interface ExcelPrintPreviewProps {
  data: any[][];
}

export const ExcelPrintPreview: React.FC<ExcelPrintPreviewProps> = ({ data }) => {
  // Calculate optimal column widths
  const columnWidths = useMemo(() => {
    return calculateA4ColumnWidths(data);
  }, [data]);

  // Validate fit
  const validation = useMemo(() => {
    return validateA4Fit(columnWidths);
  }, [columnWidths]);

  useEffect(() => {
    // Initialize LuckySheet with calculated widths
    if (typeof window !== 'undefined' && window.luckysheet) {
      window.luckysheet.create({
        container: 'luckysheet-container',
        data: [{
          name: 'Sheet1',
          row: data.length,
          column: columnWidths.length,
          config: {
            columnlen: Object.fromEntries(
              columnWidths.map((width, index) => [index, width])
            )
          },
          celldata: convertToCellData(data)
        }],
        showinfobar: false,
        showsheetbar: false,
        enableAddRow: false,
        enableAddCol: false,
      });
    }
  }, [data, columnWidths]);

  return (
    <div className="print-preview">
      {!validation.fits && (
        <div className="warning">
          ⚠️ 表格宽度超出A4纸张 {validation.overflow}px
        </div>
      )}
      
      <div 
        id="luckysheet-container"
        style={{
          width: '794px', // A4 width
          height: '1123px', // A4 height
          margin: '0 auto'
        }}
      />
      
      <style jsx>{\`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      \`}</style>
    </div>
  );
};

function convertToCellData(data: any[][]) {
  const celldata: any[] = [];
  data.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      celldata.push({
        r: rowIndex,
        c: colIndex,
        v: { v: cell, m: String(cell) }
      });
    });
  });
  return celldata;
}
`;

console.log(reactExample);

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('✅ ALL TESTS PASSED');
console.log('='.repeat(80));
console.log('\n📚 Algorithm Summary:');
console.log('1. Calculate weight for each column based on longest content');
console.log('2. CJK characters counted as 2× width, ASCII as 1×');
console.log('3. Distribute 700px target width proportionally by weight');
console.log('4. Apply min (40px) and max (300px) constraints');
console.log('5. Redistribute excess space among unconstrained columns');
console.log('\n📦 Ready for production use!');
console.log('='.repeat(80));
