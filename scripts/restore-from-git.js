// scripts/restore-from-git.js
// 从Git历史恢复org.json和users.json文件
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COMMIT_HASH = 'c4818a4';

console.log('从Git历史恢复数据文件...\n');

try {
  // 恢复 org.json
  console.log('恢复 data/org.json...');
  const orgContent = execSync(`git show ${COMMIT_HASH}:data/org.json`, { encoding: 'utf-8' });
  fs.writeFileSync(path.join(__dirname, '../data/org.json'), orgContent, 'utf-8');
  console.log('✓ data/org.json 已恢复');

  // 恢复 users.json
  console.log('恢复 data/users.json...');
  const usersContent = execSync(`git show ${COMMIT_HASH}:data/users.json`, { encoding: 'utf-8' });
  fs.writeFileSync(path.join(__dirname, '../data/users.json'), usersContent, 'utf-8');
  console.log('✓ data/users.json 已恢复');

  // 验证文件
  console.log('\n验证恢复的文件...');
  const orgData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/org.json'), 'utf-8'));
  const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf-8'));
  
  console.log(`✓ 找到 ${orgData.length} 个部门`);
  console.log(`✓ 找到 ${usersData.length} 个用户`);
  
  console.log('\n恢复成功！现在可以运行 npm run db:import 导入到数据库');
  
} catch (error) {
  console.error('恢复失败:', error.message);
  process.exit(1);
}
