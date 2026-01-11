// src/app/api/users/batch-avatar/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const AVATAR_DIR = path.join(PUBLIC_DIR, 'uploads', 'avatars');

// 确保目录存在
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = Array.from(formData.values()) as File[];
    
    if (files.length === 0) {
      return NextResponse.json({ error: '未接收到文件' }, { status: 400 });
    }

    const users = await prisma.user.findMany();
    let successCount = 0;
    const matchLog: string[] = [];

    console.log("--- 开始批量匹配 ---");

    for (const file of files) {
      // 1. 获取文件名
      const originalName = file.name; 
      const justFileName = originalName.split(/[/\\]/).pop() || originalName;

      const lastDotIndex = justFileName.lastIndexOf('.');
      if (lastDotIndex === -1) continue;
      
      const ext = justFileName.substring(lastDotIndex);
      
      // 2. 名称预处理
      const extractedName = justFileName.substring(0, lastDotIndex).trim().normalize('NFC');

      console.log(`正在处理: [${originalName}] -> 解析为姓名: [${extractedName}]`);

      // 3. 查找匹配的用户
      const targetUser = users.find(u => {
        if (!u.name) return false;
        const dbName = u.name.trim().normalize('NFC');
        return dbName === extractedName;
      });
      
      if (targetUser) {
        // 匹配成功！
        console.log(`✅ 匹配成功: ${extractedName} (ID: ${targetUser.id})`);

        // 4. 保存文件
        const buffer = Buffer.from(await file.arrayBuffer());
        const safeFileName = `AVATAR-${targetUser.id}-${Date.now()}${ext}`;
        const filePath = path.join(AVATAR_DIR, safeFileName);
        const relativePath = `/uploads/avatars/${safeFileName}`;
        let fileWritten = false;

        try {
          fs.writeFileSync(filePath, buffer);
          fileWritten = true;

          // 5. 更新数据库（使用事务）
          await prisma.$transaction(async (tx) => {
            // 更新用户头像
            await tx.user.update({
              where: { id: targetUser.id },
              data: { avatar: relativePath }
            });

            // 同步到FileMetadata表（用于备份索引）
            try {
              const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');
              await tx.fileMetadata.upsert({
                where: { filePath: relativePath },
                update: {
                  fileName: file.name,
                  fileType: ext.replace('.', '') || 'jpg',
                  fileSize: file.size,
                  md5Hash,
                  category: 'avatars',
                  uploaderId: targetUser.id,
                  uploadedAt: new Date()
                },
                create: {
                  filePath: relativePath,
                  fileName: file.name,
                  fileType: ext.replace('.', '') || 'jpg',
                  fileSize: file.size,
                  md5Hash,
                  category: 'avatars',
                  uploaderId: targetUser.id,
                  uploadedAt: new Date()
                }
              });
            } catch (metaError) {
              // FileMetadata保存失败不影响主流程，只记录日志
              console.warn('保存FileMetadata失败（不影响主流程）:', metaError);
            }
          });

          successCount++;
          matchLog.push(targetUser.name);
        } catch (error) {
          // 如果数据库保存失败，清理已写入的文件
          if (fileWritten && fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (cleanupError) {
              console.error('清理文件失败:', cleanupError);
            }
          }
          console.error(`保存头像失败: ${extractedName}`, error);
        }
      } else {
        console.log(`❌ 匹配失败: 数据库中未找到姓名 [${extractedName}]`);
      }
    }

    console.log(`--- 结束匹配: 成功 ${successCount} 个 ---`);

    return NextResponse.json({ 
      success: true, 
      count: successCount, 
      matched: matchLog 
    });

  } catch (error: any) {
    console.error("Batch Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
