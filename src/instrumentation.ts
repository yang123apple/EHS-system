/**
 * Next.js Instrumentation Hook
 * 在服务器启动时执行一次
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 添加全局错误处理，捕获未处理的 Promise rejection
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[UnhandledRejection] 未处理的 Promise rejection:', reason);
      if (reason instanceof Error) {
        console.error('[UnhandledRejection] 错误堆栈:', reason.stack);
      }
      // 不退出进程，只记录错误
    });
    
    process.on('uncaughtException', (error) => {
      console.error('[UncaughtException] 未捕获的异常:', error);
      console.error('[UncaughtException] 错误堆栈:', error.stack);
      // 不退出进程，只记录错误
    });
    
    // 只在服务器端运行
    const { initializeApp } = await import('./lib/startup');
    
    try {
      await initializeApp();
      
      // 显示 Next.js 启动后的访问信息
      setTimeout(() => {
        try {
          const os = require('os');
          const interfaces = os.networkInterfaces();
          let localIP: string | null = null;
          
          // 查找局域网 IP
          for (const name of Object.keys(interfaces)) {
            const iface = interfaces[name];
            if (!iface) continue;
            
            for (const addr of iface) {
              if (addr.family === 'IPv4' && 
                  addr.address !== '127.0.0.1' && 
                  !addr.address.startsWith('169.254.')) {
                localIP = addr.address;
                break;
              }
            }
            if (localIP) break;
          }
          
          if (localIP) {
            const nextjsPort = process.env.PORT || '3000';
            console.log('');
            console.log('========================================');
            console.log('  🌐 Next.js 服务访问地址');
            console.log('========================================');
            console.log(`📍 本机访问:     http://localhost:${nextjsPort}`);
            console.log(`📍 局域网访问:   http://${localIP}:${nextjsPort}`);
            console.log('========================================');
            console.log('');
          }
        } catch (error) {
          // 忽略错误
        }
      }, 1000); // 延迟 1 秒显示，确保 Next.js 启动信息先显示
      
    } catch (error) {
      console.error('应用初始化失败，但服务器将继续运行:', error);
      // 不抛出错误，允许服务器继续启动
    }
  }
}
