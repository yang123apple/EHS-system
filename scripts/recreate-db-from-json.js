/**
 * 从 JSON 文件重新创建数据库
 * 1. 删除损坏的数据库文件
 * 2. 运行 Prisma 迁移创建表结构
 * 3. 从 JSON 文件导入数据
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_PATH = path.join(__dirname, '../prisma/dev.db');
const DB_WAL_PATH = DB_PATH + '-wal';
const DB_SHM_PATH = DB_PATH + '-shm';
const DB_JOURNAL_PATH = DB_PATH + '-journal';

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 从 JSON 文件重新创建数据库');
  console.log('='.repeat(60));
  
  try {
    // 1. 备份并删除损坏的数据库文件
    console.log('\n📦 步骤 1: 清理损坏的数据库文件...');
    
    if (fs.existsSync(DB_PATH)) {
      const backupPath = DB_PATH + '.corrupted.' + Date.now();
      try {
        fs.copyFileSync(DB_PATH, backupPath);
        console.log(`  ✓ 已备份损坏的数据库到: ${path.basename(backupPath)}`);
      } catch (e) {
        console.log(`  ⚠ 备份失败，直接删除: ${e.message}`);
      }
      
      try {
        fs.unlinkSync(DB_PATH);
        console.log('  ✓ 已删除损坏的数据库文件');
      } catch (e) {
        console.log(`  ⚠ 删除失败: ${e.message}`);
      }
    }
    
    // 删除相关文件
    [DB_WAL_PATH, DB_SHM_PATH, DB_JOURNAL_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          console.log(`  ✓ 已删除: ${path.basename(file)}`);
        } catch (e) {
          // 忽略错误
        }
      }
    });
    
    // 2. 运行 Prisma 迁移创建表结构
    console.log('\n📊 步骤 2: 创建数据库表结构...');
    try {
      console.log('  运行: npx prisma migrate deploy');
      execSync('npx prisma migrate deploy', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });
      console.log('  ✓ 数据库表结构创建成功');
    } catch (e) {
      console.error('  ✗ 迁移失败:', e.message);
      throw e;
    }
    
    // 3. 生成 Prisma Client
    console.log('\n🔧 步骤 3: 生成 Prisma Client...');
    try {
      execSync('npx prisma generate', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });
      console.log('  ✓ Prisma Client 生成成功');
    } catch (e) {
      console.error('  ✗ 生成失败:', e.message);
      throw e;
    }
    
    // 4. 从 JSON 文件导入数据
    console.log('\n📥 步骤 4: 从 JSON 文件导入数据...');
    console.log('  运行: npm run db:import');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      readline.question('  是否清空现有数据后导入？(y/N): ', (ans) => {
        readline.close();
        resolve(ans.toLowerCase());
      });
    });
    
    // 运行导入脚本（非交互式）
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // 读取 JSON 文件
      const orgPath = path.join(__dirname, '../data/org.json');
      const usersPath = path.join(__dirname, '../data/users.json');
      
      if (!fs.existsSync(orgPath) || !fs.existsSync(usersPath)) {
        throw new Error('找不到 JSON 备份文件');
      }
      
      let orgContent = fs.readFileSync(orgPath, 'utf-8');
      if (orgContent.charCodeAt(0) === 0xFEFF) {
        orgContent = orgContent.slice(1);
      }
      const orgData = JSON.parse(orgContent);
      
      let usersContent = fs.readFileSync(usersPath, 'utf-8');
      if (usersContent.charCodeAt(0) === 0xFEFF) {
        usersContent = usersContent.slice(1);
      }
      const usersData = JSON.parse(usersContent);
      
      console.log(`  找到 ${orgData.length} 个部门`);
      console.log(`  找到 ${usersData.length} 个用户\n`);
      
      // 清空现有数据（如果需要）
      if (answer === 'y' || answer === 'yes') {
        console.log('  清理现有数据...');
        await prisma.user.deleteMany({});
        await prisma.department.deleteMany({});
        console.log('  ✓ 现有数据已清理\n');
      }
      
      // 导入部门
      console.log('  导入部门数据...');
      const sortedDepts = orgData.sort((a, b) => a.level - b.level);
      let deptCreated = 0;
      let deptUpdated = 0;
      
      for (const dept of sortedDepts) {
        try {
          const existing = await prisma.department.findUnique({ where: { id: dept.id } });
          
          if (existing) {
            await prisma.department.update({
              where: { id: dept.id },
              data: {
                name: dept.name,
                parentId: dept.parentId,
                level: dept.level,
                managerId: dept.managerId || null,
              }
            });
            deptUpdated++;
          } else {
            await prisma.department.create({
              data: {
                id: dept.id,
                name: dept.name,
                parentId: dept.parentId,
                level: dept.level,
                managerId: dept.managerId || null,
              }
            });
            deptCreated++;
          }
        } catch (error) {
          console.error(`  ✗ 部门 ${dept.name} 导入失败:`, error.message);
        }
      }
      console.log(`  ✓ 部门导入完成: ${deptCreated} 个新建, ${deptUpdated} 个更新`);
      
      // 导入用户
      console.log('  导入用户数据...');
      const allDepts = await prisma.department.findMany();
      const validDeptIds = new Set(allDepts.map(d => d.id));
      const rootDept = allDepts.find(d => d.level === 0) || allDepts[0];
      
      let userCreated = 0;
      let userUpdated = 0;
      
      for (const user of usersData) {
        try {
          let departmentId = user.departmentId;
          if (!validDeptIds.has(departmentId)) {
            departmentId = rootDept?.id || allDepts[0]?.id;
          }
          
          const existing = await prisma.user.findUnique({ where: { id: user.id } });
          
          const userData = {
            username: user.username,
            name: user.name,
            password: user.password, // 保持原密码（可能是哈希值）
            avatar: user.avatar || '/image/default_avatar.jpg',
            role: user.role || 'user',
            departmentId: departmentId,
            jobTitle: user.jobTitle || null,
            directManagerId: user.directManagerId || null,
            permissions: typeof user.permissions === 'string' 
              ? user.permissions 
              : JSON.stringify(user.permissions || {}),
          };
          
          if (existing) {
            await prisma.user.update({
              where: { id: user.id },
              data: userData
            });
            userUpdated++;
          } else {
            await prisma.user.create({
              data: {
                id: user.id,
                ...userData
              }
            });
            userCreated++;
          }
        } catch (error) {
          console.error(`  ✗ 用户 ${user.name} 导入失败:`, error.message);
        }
      }
      console.log(`  ✓ 用户导入完成: ${userCreated} 个新建, ${userUpdated} 个更新`);
      
      // 验证
      const finalUserCount = await prisma.user.count();
      const finalDeptCount = await prisma.department.count();
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 数据库重建完成！');
      console.log(`   部门总数: ${finalDeptCount}`);
      console.log(`   用户总数: ${finalUserCount}`);
      console.log('='.repeat(60) + '\n');
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('\n❌ 重建失败:', error.message);
    process.exit(1);
  }
}

main();

