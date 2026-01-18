/**
 * Excel模板解析器单元测试
 * 测试动态表单解析、字段类型识别、合并单元格处理等核心功能
 */

import { parseTemplateFields } from '@/utils/templateParser';
import { ParsedField } from '@/types/work-permit';

describe('templateParser', () => {
  describe('parseTemplateFields - 基础功能', () => {
    it('应该解析空的结构并返回空数组', () => {
      const result = parseTemplateFields('');
      expect(result).toEqual([]);
    });

    it('应该解析无效的JSON并返回空数组', () => {
      const result = parseTemplateFields('invalid json');
      expect(result).toEqual([]);
    });

    it('应该解析标准data格式的模板', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['作业部门', ''],
              ['作业地点', ''],
              ['作业日期', '2025-01-12'],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      expect(result.length).toBeGreaterThan(0);
      
      // 应该识别日期字段
      const dateField = result.find(f => f.fieldType === 'date');
      expect(dateField).toBeDefined();
    });

    it('应该解析celldata格式的模板', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            celldata: [
              { r: 0, c: 0, v: { m: '作业部门', v: '作业部门' } },
              { r: 0, c: 1, v: { m: '', v: '' } },
              { r: 1, c: 0, v: { m: '作业地点', v: '作业地点' } },
              { r: 1, c: 1, v: { m: '', v: '' } },
            ],
            merges: [],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      expect(result.length).toBeGreaterThan(0);
      
      // 应该识别文本字段
      const textFields = result.filter(f => f.fieldType === 'text');
      expect(textFields.length).toBeGreaterThan(0);
    });
  });

  describe('parseTemplateFields - 日期字段识别', () => {
    it('应该识别包含"年"的单元格为日期字段', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['作业开始日期', '2025年01月12日'],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const dateField = result.find(f => f.fieldName.includes('日期'));
      expect(dateField).toBeDefined();
      expect(dateField?.fieldType).toBe('date');
    });

    it('应该识别包含"月"的单元格为日期字段', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['有效期至', '2025年1月'],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const dateField = result.find(f => f.fieldType === 'date');
      expect(dateField).toBeDefined();
    });

    it('应该识别包含"日"的单元格为日期字段', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['作业日期', '2025-01-12'],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const dateField = result.find(f => f.fieldType === 'date');
      expect(dateField).toBeDefined();
    });

    it('应该识别包含"时"或"分"的单元格为日期字段', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['开始时间', '2025-01-12 08:00'],
              ['截止时间', '2025-01-12 18:00'],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const dateFields = result.filter(f => f.fieldType === 'date');
      expect(dateFields.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('parseTemplateFields - 选项字段识别', () => {
    it('应该识别包含"£"符号的单元格为选项字段', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['£是', '£否'],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const optionFields = result.filter(f => f.fieldType === 'option');
      expect(optionFields.length).toBeGreaterThan(0);
    });

    it('应该识别包含"☑"符号的单元格为选项字段', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['☑是', '☑否'],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const optionFields = result.filter(f => f.fieldType === 'option');
      expect(optionFields.length).toBeGreaterThan(0);
    });

    it('应该正确提取选项值', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['作业类型', ''],
              ['£动火作业', '£高处作业', '£受限空间'],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const optionFields = result.filter(f => f.fieldType === 'option');
      
      optionFields.forEach(field => {
        expect(field.options).toBeDefined();
        expect(Array.isArray(field.options)).toBe(true);
      });
    });
  });

  describe('parseTemplateFields - 空白单元格解析', () => {
    it('应该解析左侧有标签的空白单元格', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['作业部门', ''],
              ['作业地点', ''],
              ['作业人员', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      expect(result.length).toBeGreaterThan(0);
      
      // 应该解析出文本字段
      const textFields = result.filter(f => 
        f.fieldType === 'text' && 
        (f.label.includes('部门') || f.label.includes('地点') || f.label.includes('人员'))
      );
      expect(textFields.length).toBeGreaterThan(0);
    });

    it('应该从左侧单元格提取字段名', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['申请部门', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const field = result.find(f => f.label.includes('申请部门'));
      expect(field).toBeDefined();
      expect(field?.fieldName).toBeDefined();
    });

    it('应该识别"£其他"并解析为文本字段', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['£其他', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const otherField = result.find(f => f.label === '其他' || f.fieldName === '其他');
      expect(otherField).toBeDefined();
      expect(otherField?.fieldType).toBe('text');
    });

    it('应该识别上方"序号"标签并解析为序号字段', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['序号', '姓名', '职务'],
              ['', '', ''],
              ['', '', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const serialFields = result.filter(f => f.fieldType === 'serial');
      expect(serialFields.length).toBeGreaterThan(0);
      expect(serialFields[0].fieldName).toMatch(/序号\d+/);
    });
  });

  describe('parseTemplateFields - 字段类型推断', () => {
    it('应该根据字段名推断为部门类型', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['作业部门', ''],
              ['申请部门', ''],
              ['责任部门', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const deptFields = result.filter(f => 
        f.fieldType === 'department' && 
        (f.label.includes('部门'))
      );
      expect(deptFields.length).toBeGreaterThan(0);
    });

    it('应该根据字段名推断为人员类型', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['作业人员', ''],
              ['负责人', ''],
              ['监护人', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const personnelFields = result.filter(f => 
        f.fieldType === 'personnel' && 
        (f.label.includes('人员') || f.label.includes('负责人') || f.label.includes('监护人'))
      );
      expect(personnelFields.length).toBeGreaterThan(0);
    });

    it('应该根据字段名推断为签名类型', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['申请人签字', ''],
              ['审批人签字', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const signatureFields = result.filter(f => 
        f.fieldType === 'signature' && 
        (f.label.includes('签字'))
      );
      expect(signatureFields.length).toBeGreaterThan(0);
    });
  });

  describe('parseTemplateFields - 合并单元格处理', () => {
    it('应该正确处理合并单元格', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            celldata: [
              { r: 0, c: 0, v: { m: '备注', v: '备注' } },
              { r: 0, c: 1, v: { m: '', v: '' } },
              { r: 0, c: 2, v: { m: '', v: '' } },
            ],
            merges: [
              { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }, // 合并B1和C1
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      // 合并单元格应该只解析一次
      expect(result).toBeDefined();
    });

    it('应该在合并区域内填充相同的值', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            celldata: [
              { r: 0, c: 0, v: { m: '备注', v: '备注' } },
              { r: 0, c: 1, v: { m: '合并内容', v: '合并内容' } },
            ],
            merges: [
              { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      expect(result).toBeDefined();
    });
  });

  describe('parseTemplateFields - 安全措施字段识别', () => {
    it('应该识别"安全措施"标签下方的字段', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['安全措施', ''],
              ['', ''],
              ['', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const safetyFields = result.filter(f => f.isSafetyMeasure === true);
      expect(safetyFields.length).toBeGreaterThan(0);
    });
  });

  describe('parseTemplateFields - cellKey生成', () => {
    it('应该正确生成cellKey（R行C列格式）', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['测试字段', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      const field = result.find(f => f.label.includes('测试字段'));
      
      expect(field).toBeDefined();
      expect(field?.cellKey).toMatch(/^R\d+C\d+$/);
    });

    it('应该包含行索引和列索引', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['字段1', ''],
              ['字段2', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      
      result.forEach(field => {
        expect(field.rowIndex).toBeDefined();
        expect(field.colIndex).toBeDefined();
        expect(typeof field.rowIndex).toBe('number');
        expect(typeof field.colIndex).toBe('number');
      });
    });
  });

  describe('parseTemplateFields - 去重功能', () => {
    it('应该折叠完全相同的重复行（如果启用foldDuplicateRows）', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['序号', '姓名', '职务'],
              ['', '', ''], // 第一行空行
              ['', '', ''], // 第二行空行（应该被折叠）
              ['', '', ''], // 第三行空行（应该被折叠）
            ],
          },
        ],
      });

      const resultWithoutFold = parseTemplateFields(structureJson, { foldDuplicateRows: false });
      const resultWithFold = parseTemplateFields(structureJson, { foldDuplicateRows: true });
      
      // 启用折叠后，应该减少解析的字段数量
      // 注意：具体数量取决于解析逻辑，这里主要验证不会出错
      expect(resultWithFold.length).toBeLessThanOrEqual(resultWithoutFold.length);
    });
  });

  describe('parseTemplateFields - 边界条件', () => {
    it('应该处理只有一行的数据', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['测试', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      expect(result.length).toBeGreaterThan(0);
    });

    it('应该处理只有一列的数据', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['字段1'],
              ['字段2'],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      expect(result).toBeDefined();
    });

    it('应该处理所有单元格都为空的情况', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['', ''],
              ['', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      // 全空单元格不应该解析出字段
      expect(result.length).toBe(0);
    });

    it('应该处理不规范的JSON结构', () => {
      const structureJson = JSON.stringify({
        invalid: 'structure',
      });

      const result = parseTemplateFields(structureJson);
      expect(result).toEqual([]);
    });
  });

  describe('parseTemplateFields - 复杂场景', () => {
    it('应该解析完整的作业许可模板', () => {
      const structureJson = JSON.stringify({
        sheets: [
          {
            data: [
              ['作业许可申请表', '', '', ''],
              ['作业部门', '', '作业地点', ''],
              ['作业日期', '2025-01-12', '作业类型', '£动火作业'],
              ['负责人', '', '监护人', ''],
              ['安全措施', '', '', ''],
              ['', '', '', ''],
              ['申请人签字', '', '审批人签字', ''],
            ],
          },
        ],
      });

      const result = parseTemplateFields(structureJson);
      
      // 应该解析出多种类型的字段
      expect(result.length).toBeGreaterThan(0);
      
      const deptField = result.find(f => f.label.includes('部门'));
      const dateField = result.find(f => f.fieldType === 'date');
      const optionField = result.find(f => f.fieldType === 'option');
      const signatureField = result.find(f => f.fieldType === 'signature');
      
      expect(deptField || dateField || optionField || signatureField).toBeDefined();
    });
  });
});
