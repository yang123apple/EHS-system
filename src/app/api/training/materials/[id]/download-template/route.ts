import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, withAuth } from '@/middleware/auth';
import * as XLSX from 'xlsx';

// 下载 Excel 导入模板
export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user) => {
    try {
      // 创建示例数据
      const templateData = [
        // 表头
        ['题目类型', '题干', '选项A', '选项B', '选项C', '选项D', '正确答案', '分值', '解析'],
        // 示例数据
        ['单选', '以下哪个是安全帽的正确佩戴方式？', '帽檐朝后', '帽檐朝前', '随意佩戴', '不佩戴', 'B', '10', '安全帽应帽檐朝前，确保保护头部'],
        ['多选', '以下哪些属于个人防护用品？', '安全帽', '安全鞋', '手机', '防护眼镜', 'A,B,D', '15', '个人防护用品包括安全帽、安全鞋、防护眼镜等'],
        ['单选', '发生火灾时，应该？', '乘坐电梯', '走楼梯', '跳窗', '原地等待', 'B', '10', '发生火灾时应走楼梯逃生，不能乘坐电梯']
      ];

      // 创建工作簿
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(templateData);

      // 设置列宽
      worksheet['!cols'] = [
        { wch: 12 }, // 题目类型
        { wch: 40 }, // 题干
        { wch: 20 }, // 选项A
        { wch: 20 }, // 选项B
        { wch: 20 }, // 选项C
        { wch: 20 }, // 选项D
        { wch: 15 }, // 正确答案
        { wch: 8 },  // 分值
        { wch: 30 }  // 解析
      ];

      // 添加工作表
      XLSX.utils.book_append_sheet(workbook, worksheet, '题目导入模板');

      // 生成 Excel 文件
      const excelBuffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx' 
      });

      // 返回文件
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="题目导入模板_${new Date().toISOString().split('T')[0]}.xlsx"`
        }
      });
    } catch (error: any) {
      console.error('[Download Template API] 错误:', error);
      return NextResponse.json({ 
        error: '生成模板失败: ' + (error.message || '未知错误') 
      }, { status: 500 });
    }
  })
);

