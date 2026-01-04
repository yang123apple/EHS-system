/**
 * 简单队列服务封装（基于 BullMQ）
 * 注意：使用之前请安装依赖：
 *   npm install bullmq ioredis
 * 并在环境变量中设置 REDIS_URL，例如： redis://localhost:6379
 */
import { Queue } from 'bullmq';

// 检查是否启用队列功能
const QUEUE_ENABLED = process.env.ENABLE_QUEUE === 'true';

let autoAssignQueue: Queue | null = null;

// 仅在启用队列时初始化
if (QUEUE_ENABLED) {
  try {
    const connection = process.env.REDIS_URL 
      ? { connection: { url: process.env.REDIS_URL } } 
      : { connection: { host: '127.0.0.1', port: 6379 } };
    
    autoAssignQueue = new Queue('auto-assign-queue', connection as any);
    console.log('Queue service initialized');
  } catch (error) {
    console.error('Failed to initialize queue:', error);
  }
}

export async function enqueueAutoAssign(eventType: string, payload: any){
  // 如果队列未启用或初始化失败，直接返回成功（降级处理）
  if (!autoAssignQueue) {
    console.log(`Queue disabled - skipping event: ${eventType}`);
    return { id: 'mock-' + Date.now(), status: 'skipped' };
  }
  
  try {
    // job name 使用事件类型，payload 包含必要信息
    return await autoAssignQueue.add(eventType, { eventType, payload }, { removeOnComplete: true, removeOnFail: false });
  } catch (error) {
    console.error('Failed to enqueue:', error);
    // 队列失败时降级处理
    return { id: 'failed-' + Date.now(), status: 'failed' };
  }
}

export default { enqueueAutoAssign };
