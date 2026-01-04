// scripts/workers/autoassign-worker.js
// Node worker that processes auto-assign jobs from BullMQ
// Run with: node scripts/workers/autoassign-worker.js
// Ensure REDIS_URL is set in env
const { Worker } = require('bullmq');
const { prisma } = require('../../src/lib/prisma');

async function processJob(job){
  // job.data = { eventType, payload }
  try{
    const { eventType, payload } = job.data;
    console.log(`Processing event: ${eventType}`, payload);
    
    // 内联 processEvent 逻辑 (避免导入 TS 模块)
    const rules = await prisma.autoAssignRule.findMany({
      where: {
        mode: 'event',
        eventType: eventType,
        isActive: true
      },
      include: { task: true }
    });
    
    let assigned = 0;
    for (const rule of rules){
      if (!rule.condition) continue;
      const cond = JSON.parse(rule.condition);
      
      // 解析 userId 列表
      const userIds = await resolveUserIds(cond);
      
      for (const uid of userIds){
        const exist = await prisma.trainingAssignment.findUnique({
          where: { taskId_userId: { taskId: rule.taskId, userId: uid } }
        }).catch(() => null);
        
        if (!exist){
          await prisma.trainingAssignment.create({
            data: {
              taskId: rule.taskId,
              userId: uid,
              status: 'assigned',
              progress: 0,
              isPassed: false
            }
          });
          assigned++;
        }
      }
    }
    
    console.log(`✓ Event processing complete: ${assigned} assignments created`);
    return { assigned };
  }catch(e){
    console.error('autoassign worker error', e);
    throw e;
  }
}

// 内联 resolveUserIds 函数
async function resolveUserIds(cond){
  if (!cond) return [];
  if (cond.conjunction && cond.conditions){
    const allUsers = await prisma.user.findMany();
    return allUsers.filter(u => {
      const results = cond.conditions.map(c => matchCondition(c, u));
      return cond.conjunction === 'AND' ? results.every(r => r) : results.some(r => r);
    }).map(u => u.id);
  }
  return [];
}

// 内联 matchCondition 函数
function matchCondition(c, user){
  const val = user[c.field];
  switch(c.operator){
    case 'equals': return val === c.value;
    case 'contains': return String(val || '').includes(c.value);
    case 'startsWith': return String(val || '').startsWith(c.value);
    case 'in': return c.value.split(',').map(s => s.trim()).includes(String(val));
    case 'regex': return new RegExp(c.value).test(String(val || ''));
    case 'levelGte': return Number(val || 0) >= Number(c.value || 0);
    case 'levelLte': return Number(val || 0) <= Number(c.value || 0);
    default: return false;
  }
}

const connection = process.env.REDIS_URL ? { connection: { url: process.env.REDIS_URL } } : { connection: { host: '127.0.0.1', port: 6379 } };

const worker = new Worker('auto-assign-queue', async job => processJob(job), connection);

worker.on('completed', (job) => {
  console.log('job completed', job.id, job.name);
});

worker.on('failed', (job, err) => {
  console.error('job failed', job.id, err);
});

console.log('AutoAssign worker started');
