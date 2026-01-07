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
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过 node_modules 和 .next
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        walkDir(filePath, fileList);
      }
    } else if (/\.(ts|tsx|js|jsx|md|bat|sh|ps1)$/.test(file)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// 从项目根目录开始
const projectRoot = path.resolve(__dirname, '..');
const files = walkDir(projectRoot);

console.log(`Found ${files.length} files to check...\n`);

let fixedCount = 0;
files.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n✓ Fixed ${fixedCount} files with empty merge conflicts.`);

