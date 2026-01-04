import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, withAuth, withResourcePermission, logApiOperation } from '@/middleware/auth';
import * as XLSX from 'xlsx';

// Excel 导入题目
export const POST = withErrorHandling(
  withResourcePermission(
    'training',
    'edit_material',
    async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
      const { id } = await params;
      const material = await prisma.trainingMaterial.findUnique({
        where: { id },
        select: { uploaderId: true }
      });
      return material?.uploaderId || null;
    },
    async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user) => {
      const { id } = await params;
      
      try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
          return NextResponse.json({ error: '未上传文件' }, { status: 400 });
        }

        // 读取 Excel 文件
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (data.length < 2) {
          return NextResponse.json({ error: 'Excel 文件至少需要包含表头和数据行' }, { status: 400 });
        }

        // 解析表头（第一行）
        const headers = data[0].map((h: any) => String(h).trim().toLowerCase());
        const headerMap: Record<string, number> = {};
        
        // 支持的列名映射
        const columnMappings: Record<string, string[]> = {
          'type': ['题目类型', '类型', 'type', 'questiontype'],
          'question': ['题干', '题目', 'question', '题目内容'],
          'optiona': ['选项a', '选项 a', 'optiona', 'a'],
          'optionb': ['选项b', '选项 b', 'optionb', 'b'],
          'optionc': ['选项c', '选项 c', 'optionc', 'c'],
          'optiond': ['选项d', '选项 d', 'optiond', 'd'],
          'answere': ['选项e', '选项 e', 'optione', 'e'],
          'answerf': ['选项f', '选项 f', 'optionf', 'f'],
          'answer': ['正确答案', '答案', 'answer', 'correctanswer'],
          'score': ['分值', '分数', 'score', '分值'],
          'explanation': ['解析', '说明', 'explanation', '解析说明']
        };

        // 建立列索引映射
        headers.forEach((header, index) => {
          const normalizedHeader = String(header).trim().toLowerCase();
          for (const [key, aliases] of Object.entries(columnMappings)) {
            if (aliases.some(alias => normalizedHeader.includes(alias.toLowerCase()))) {
              headerMap[key] = index;
              break;
            }
          }
        });

        // 验证必需字段
        if (!headerMap['question'] || !headerMap['answer']) {
          return NextResponse.json({ 
            error: 'Excel 文件必须包含"题干"和"正确答案"列' 
          }, { status: 400 });
        }

        // 解析数据行
        const questions: any[] = [];
        const errors: string[] = [];

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.every(cell => !cell)) continue; // 跳过空行

          try {
            const questionType = String(row[headerMap['type']] || 'single').trim().toLowerCase();
            const type = questionType.includes('多') || questionType === 'multiple' ? 'multiple' : 'single';
            const question = String(row[headerMap['question']] || '').trim();
            const answerStr = String(row[headerMap['answer']] || '').trim();
            const score = parseInt(String(row[headerMap['score']] || '10')) || 10;

            if (!question) {
              errors.push(`第 ${i + 1} 行：题干不能为空`);
              continue;
            }

            if (!answerStr) {
              errors.push(`第 ${i + 1} 行：正确答案不能为空`);
              continue;
            }

            // 构建选项数组
            const options: { label: string; text: string }[] = [];
            const optionKeys = ['optiona', 'optionb', 'optionc', 'optiond', 'answere', 'answerf'];
            
            for (const key of optionKeys) {
              if (headerMap[key] !== undefined) {
                const optionText = String(row[headerMap[key]] || '').trim();
                if (optionText) {
                  options.push({
                    label: key.slice(-1).toUpperCase(), // A, B, C, D, E, F
                    text: optionText
                  });
                }
              }
            }

            if (options.length < 2) {
              errors.push(`第 ${i + 1} 行：至少需要 2 个选项`);
              continue;
            }

            // 解析答案（支持 "A" 或 "A,B" 或 ["A","B"]）
            let answer: string[];
            if (answerStr.startsWith('[') && answerStr.endsWith(']')) {
              // JSON 数组格式
              try {
                answer = JSON.parse(answerStr).map((a: any) => String(a).trim().toUpperCase());
              } catch {
                answer = answerStr.split(',').map(a => a.trim().toUpperCase());
              }
            } else {
              // 逗号分隔格式
              answer = answerStr.split(',').map(a => a.trim().toUpperCase());
            }

            // 验证答案是否在选项中
            const validLabels = options.map(opt => opt.label);
            const invalidAnswers = answer.filter(a => !validLabels.includes(a));
            if (invalidAnswers.length > 0) {
              errors.push(`第 ${i + 1} 行：答案 "${invalidAnswers.join(',')}" 不在选项中`);
              continue;
            }

            // 单选验证
            if (type === 'single' && answer.length !== 1) {
              errors.push(`第 ${i + 1} 行：单选题只能有一个正确答案`);
              continue;
            }

            questions.push({
              materialId: id,
              type,
              question,
              options: JSON.stringify(options),
              answer: JSON.stringify(answer),
              score
            });
          } catch (error: any) {
            errors.push(`第 ${i + 1} 行：解析失败 - ${error.message}`);
          }
        }

        if (questions.length === 0) {
          return NextResponse.json({ 
            error: '没有有效的题目数据',
            errors 
          }, { status: 400 });
        }

        // 批量插入题目
        await prisma.examQuestion.createMany({
          data: questions
        });

        // 记录操作日志
        await logApiOperation(user, 'training', 'import_questions', {
          materialId: id,
          importedCount: questions.length,
          errorsCount: errors.length
        });

        return NextResponse.json({
          success: true,
          imported: questions.length,
          errors: errors.length > 0 ? errors : undefined
        });
      } catch (error: any) {
        console.error('[Import Questions API] 错误:', error);
        return NextResponse.json({ 
          error: '导入失败: ' + (error.message || '未知错误') 
        }, { status: 500 });
      }
    }
  )
);

