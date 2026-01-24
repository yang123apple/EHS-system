#!/usr/bin/env node
/**
 * 获取本机局域网 IP 地址
 * 跨平台支持（Windows/Mac/Linux）
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 获取本机局域网 IP 地址
 * @returns {Promise<string>} IP 地址，如果获取失败返回 'localhost'
 */
async function getLocalIP() {
  const platform = os.platform();
  
  try {
    if (platform === 'win32') {
      // Windows: 使用 ipconfig
      const { stdout } = await execAsync('ipconfig');
      const lines = stdout.split('\n');
      
      // 查找 IPv4 地址（排除 127.0.0.1）
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('IPv4') || line.includes('IP Address')) {
          const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
          if (ipMatch) {
            const ip = ipMatch[1];
            // 排除 localhost 和自动配置的地址
            if (ip !== '127.0.0.1' && !ip.startsWith('169.254.')) {
              return ip;
            }
          }
        }
      }
    } else {
      // Mac/Linux: 使用 ifconfig 或 ip 命令
      try {
        // 尝试使用 ip 命令（Linux）
        const { stdout } = await execAsync('ip -4 addr show');
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          const match = line.match(/inet\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
          if (match) {
            const ip = match[1];
            if (ip !== '127.0.0.1' && !ip.startsWith('169.254.')) {
              return ip;
            }
          }
        }
      } catch (e) {
        // 如果 ip 命令失败，尝试 ifconfig（Mac/Linux）
        const { stdout } = await execAsync('ifconfig');
        const lines = stdout.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // 查找 inet 行
          if (line.includes('inet ') && !line.includes('127.0.0.1')) {
            const match = line.match(/inet\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
            if (match) {
              const ip = match[1];
              // 排除 localhost 和自动配置的地址
              if (ip !== '127.0.0.1' && !ip.startsWith('169.254.')) {
                return ip;
              }
            }
          }
        }
      }
    }
    
    // 如果上述方法都失败，使用 Node.js 的网络接口
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;
      
      for (const addr of iface) {
        // 只返回 IPv4 地址，排除 localhost 和内部地址
        if (addr.family === 'IPv4' && 
            addr.address !== '127.0.0.1' && 
            !addr.address.startsWith('169.254.')) {
          return addr.address;
        }
      }
    }
    
    // 如果都失败，返回 localhost
    return 'localhost';
  } catch (error) {
    console.warn('[getLocalIP] 获取 IP 地址失败:', error.message);
    return 'localhost';
  }
}

// 如果直接运行此脚本，输出 IP 地址
if (require.main === module) {
  getLocalIP().then(ip => {
    console.log(ip);
    process.exit(0);
  }).catch(err => {
    console.error('获取 IP 地址失败:', err);
    console.log('localhost');
    process.exit(1);
  });
}

module.exports = { getLocalIP };
