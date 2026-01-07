const fs = require('fs');
const path = require('path');

// 空冲突标记的正则表达式
const emptyConflictRegex = /<<<<<<< HEAD\s*\r?\n\s*=======\s*\r?\n\s*>>>>>>> 8518c9801bf645a75fe795aadaf63c080fd334f3/g;

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // 移除空冲突标记
    content = content.replace(emptyConflictRegex, '');
    
    // 处理实际冲突：保留 HEAD 版本
    const lines = content.split('\n');
    const result = [];
    let inHead = false;
    let inOther = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('<<<<<<< HEAD')) {
        inHead = true;
        inOther = false;
        continue;
      }
      
      if (line.includes('=======')) {
        inHead = false;
        inOther = true;
        continue;
      }
      
      if (line.includes('>>>>>>> 8518c9801bf645a75fe795aadaf63c080fd334f3')) {
        inHead = false;
        inOther = false;
        continue;
      }
      
      // 只保留 HEAD 版本的内容
      if (!inOther) {
        result.push(line);
      }
    }
    
    const newContent = result.join('\n');
    
    if (newContent !== originalContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✓ Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// 修复文档文件
const files = [
  '交付清单.md',
  '公共组件与API梳理.md',
  '技术栈总结.md'
];

console.log('Fixing markdown files...\n');

let fixedCount = 0;
files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    if (fixFile(filePath)) {
      fixedCount++;
    }
  } else {
    console.log(`⚠ File not found: ${file}`);
  }
});

console.log(`\n✓ Fixed ${fixedCount} markdown files.`);

