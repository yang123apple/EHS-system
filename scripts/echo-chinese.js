// 辅助脚本：安全输出中文到控制台
// 用于批处理文件中输出中文，避免编码问题

const message = process.argv[2];
if (message) {
  // 尝试使用 GBK 编码输出
  try {
    const iconv = require('iconv-lite');
    const gbkBuffer = iconv.encode(message, 'gbk');
    process.stdout.write(gbkBuffer);
    process.stdout.write('\n');
  } catch (e) {
    // 如果 iconv-lite 不可用，直接输出（可能乱码，但不会导致命令错误）
    console.log(message);
  }
}

