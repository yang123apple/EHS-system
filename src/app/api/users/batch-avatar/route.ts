// src/app/api/users/batch-avatar/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getUsers, saveUsers } from '@/lib/userDb';

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

    const users = getUsers();
    let successCount = 0;
    const matchLog: string[] = [];

    console.log("--- 开始批量匹配 ---");

    for (const file of files) {
      // 1. 获取文件名
      // 注意：某些浏览器/系统上传文件夹时，name 可能会包含路径 (例如 "photos/张三.jpg")
      const originalName = file.name; 
      
      // 使用 path.basename 强制只保留文件名部分，去掉可能存在的路径前缀
      // 注意：path.basename 在不同OS下表现不同，这里用正则做一次兜底处理
      const justFileName = originalName.split(/[/\\]/).pop() || originalName;

      const lastDotIndex = justFileName.lastIndexOf('.');
      if (lastDotIndex === -1) continue; // 忽略无后缀文件
      
      const ext = justFileName.substring(lastDotIndex); // 提取后缀 (.jpg)
      
      // 2. 核心修复：名称预处理
      // .trim(): 去除首尾空格
      // .normalize('NFC'): 解决 Mac/Windows 中文编码不一致问题 (关键!)
      const extractedName = justFileName.substring(0, lastDotIndex).trim().normalize('NFC');

      console.log(`正在处理: [${originalName}] -> 解析为姓名: [${extractedName}]`);

      // 3. 查找匹配的用户 (数据库中的名字也需要标准化对比)
      const targetUserIndex = users.findIndex(u => {
        if (!u.name) return false;
        // 数据库里的名字也要处理，防止数据库里存了 "张三 " (带空格)
        const dbName = u.name.trim().normalize('NFC');
        return dbName === extractedName;
      });
      
      if (targetUserIndex !== -1) {
        // 匹配成功！
        const user = users[targetUserIndex];
        console.log(`✅ 匹配成功: ${extractedName} (ID: ${user.id})`);

        // 4. 保存文件
        const buffer = Buffer.from(await file.arrayBuffer());
        // 使用用户 ID 命名文件，避免中文乱码问题
        const safeFileName = `AVATAR-${user.id}-${Date.now()}${ext}`;
        fs.writeFileSync(path.join(AVATAR_DIR, safeFileName), buffer);

        // 5. 更新数据库
        user.avatar = `/uploads/avatars/${safeFileName}`;
        successCount++;
        matchLog.push(user.name);
      } else {
        console.log(`❌ 匹配失败: 数据库中未找到姓名 [${extractedName}]`);
      }
    }

    // 6. 保存更改
    if (successCount > 0) {
      saveUsers(users);
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