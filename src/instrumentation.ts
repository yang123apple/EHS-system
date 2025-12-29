/**
 * Next.js Instrumentation Hook
 * 在服务器启动时执行一次
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 只在服务器端运行
    const { initializeApp } = await import('./lib/startup');
    
    try {
      await initializeApp();
    } catch (error) {
      console.error('应用初始化失败，但服务器将继续运行:', error);
      // 不抛出错误，允许服务器继续启动
    }
  }
}
