import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 将PPTX/DOCX转换为PDF
 * 优先尝试使用LibreOffice，失败则创建占位PDF
 */
export async function convertToPdf(inputPath: string, originalFilename: string): Promise<string | null> {
  try {
    console.log('[Converter] 开始转换文件:', inputPath);
    
    const outputDir = path.dirname(inputPath);
    const outputFilename = path.basename(inputPath, path.extname(inputPath)) + '.pdf';
    const outputPath = path.join(outputDir, outputFilename);

    // 尝试使用LibreOffice进行转换
    try {
      console.log('[Converter] 尝试使用LibreOffice转换...');
      
      // 检查LibreOffice是否可用
      const libreOfficePaths = [
        'libreoffice', // Linux
        '/usr/bin/libreoffice', // Linux
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe', // Windows
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe', // Windows 32-bit
        '/Applications/LibreOffice.app/Contents/MacOS/soffice', // macOS
      ];

      let libreOfficeCmd = null;
      for (const cmdPath of libreOfficePaths) {
        try {
          if (cmdPath.includes('\\') || cmdPath.includes('/')) {
            // 检查文件是否存在
            await fs.access(cmdPath);
            libreOfficeCmd = `"${cmdPath}"`;
            break;
          } else {
            // 检查命令是否在PATH中（跨平台）
            const os = await import('os');
            const isWindows = os.platform() === 'win32';
            const checkCmd = isWindows ? `where ${cmdPath}` : `which ${cmdPath}`;
            await execAsync(checkCmd);
            libreOfficeCmd = cmdPath;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (libreOfficeCmd) {
        console.log('[Converter] 找到LibreOffice:', libreOfficeCmd);
        
        // 使用LibreOffice转换
        const command = `${libreOfficeCmd} --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;
        console.log('[Converter] 执行命令:', command);
        
        await execAsync(command, { timeout: 60000 }); // 60秒超时
        
        // 检查PDF是否成功生成
        await fs.access(outputPath);
        console.log('[Converter] LibreOffice转换成功');
        
        // 返回相对URL
        const relativePath = outputPath.split('public')[1].replace(/\\/g, '/');
        return relativePath;
      } else {
        console.log('[Converter] 未找到LibreOffice，将创建占位PDF');
      }
    } catch (libreError) {
      console.log('[Converter] LibreOffice转换失败，将创建占位PDF:', libreError instanceof Error ? libreError.message : String(libreError));
    }

    // 如果LibreOffice不可用或转换失败，创建占位PDF
    console.log('[Converter] 创建占位PDF...');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // 绘制标题
    page.drawText(`文档预览: ${originalFilename}`, {
      x: 50,
      y: height - 100,
      size: 20,
      font,
      color: rgb(0, 0, 0),
    });

    // 绘制说明
    const instructions = [
      '注意：此PDF为系统自动生成的占位文件',
      '',
      '原因：系统未检测到LibreOffice转换工具',
      '',
      '解决方案：',
      '1. 安装LibreOffice (https://www.libreoffice.org/)',
      '2. 重新上传文件以进行自动转换',
      '',
      '当前您可以：',
      '- 下载原始DOCX文件进行查看',
      '- 完成相关学习任务',
      '- 参加考试（如需要）',
    ];

    let yPosition = height - 150;
    instructions.forEach(line => {
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 20;
    });

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);
    console.log('[Converter] 占位PDF创建成功');

    // 返回相对URL
    const relativePath = outputPath.split('public')[1].replace(/\\/g, '/');
    return relativePath;
  } catch (error) {
    console.error('[Converter] PDF转换完全失败:', error);
    return null;
  }
}
