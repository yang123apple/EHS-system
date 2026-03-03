// src/app/api/archives/personnel/exam-reminder/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotificationsFromTemplate } from '@/lib/notificationService';
import { withAuth } from '@/middleware/auth';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

// ─────────────────────────────────────────────────────
//  分布式锁（基于数据库 ArchiveConfig 表）
//  SQLite 为单写模型，$transaction 可保证原子性；
//  多节点部署时只要共享同一数据库（Postgres 等）同样有效。
// ─────────────────────────────────────────────────────
const LOCK_KEY = 'health_exam_reminder_lock';
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 分钟内认为锁有效

async function acquireLock(): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.archiveConfig.findUnique({ where: { key: LOCK_KEY } });
      if (existing) {
        const { lockedAt } = JSON.parse(existing.value) as { lockedAt: string };
        if (Date.now() - new Date(lockedAt).getTime() < LOCK_TTL_MS) {
          // 锁仍在有效期，本实例放弃执行
          return false;
        }
      }
      // 抢占锁
      await tx.archiveConfig.upsert({
        where: { key: LOCK_KEY },
        create: {
          key: LOCK_KEY,
          value: JSON.stringify({ lockedAt: new Date().toISOString(), pid: process.pid }),
        },
        update: {
          value: JSON.stringify({ lockedAt: new Date().toISOString(), pid: process.pid }),
        },
      });
      return true;
    });
  } catch (e) {
    console.error('[体检提醒] 获取分布式锁失败:', e);
    return false; // 抢锁失败 → 本次跳过，不中断主流程
  }
}

async function releaseLock(): Promise<void> {
  try {
    await prisma.archiveConfig.upsert({
      where: { key: LOCK_KEY },
      create: { key: LOCK_KEY, value: JSON.stringify({ lockedAt: null, pid: null }) },
      update: { value: JSON.stringify({ lockedAt: null, pid: null }) },
    });
  } catch (e) {
    console.error('[体检提醒] 释放分布式锁失败:', e);
  }
}

// ─────────────────────────────────────────────────────
//  对外类型
// ─────────────────────────────────────────────────────
export interface PendingExamPersonnel {
  userId: string;
  userName: string;
  departmentName: string | null;
  jobTitle: string | null;
  hazardFactors: string | null;
  lastExamDate: string | null;
  examCycle: number | null;
  nextExamDate: string;
  daysUntilExam: number;
}

export interface ExamReminderResult {
  success: boolean;
  skippedByLock: boolean;
  checkedCount: number;
  pendingCount: number;
  notifiedCount: number;   // 本次实际触发通知的人数（排除 30 天内已提醒的）
  skippedCount: number;    // 30 天内已提醒、本次跳过的人数
  errorCount: number;      // 单人处理失败次数（不中断整体）
  pendingPersonnel: PendingExamPersonnel[];
  error?: string;
}

// ─────────────────────────────────────────────────────
//  核心逻辑
// ─────────────────────────────────────────────────────
const BATCH_SIZE = 100;           // 游标分页批次大小
const REMINDER_INTERVAL_DAYS = 30; // 同一人 30 天内不重复发通知

/**
 * 每日 00:00（Asia/Shanghai）执行：
 * 统计下次体检日期距今 60 天内的待体检人员，写入数据库并发送通知。
 */
export async function checkHealthExamReminders(): Promise<ExamReminderResult> {
  // ── 死穴③ 分布式锁：多节点同时触发时只有一台执行 ──
  const locked = await acquireLock();
  if (!locked) {
    console.log('[体检提醒] 其他实例正在执行，本次跳过');
    return {
      success: true,
      skippedByLock: true,
      checkedCount: 0,
      pendingCount: 0,
      notifiedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      pendingPersonnel: [],
    };
  }

  // ── 死穴② 时区：所有时间计算绑定 Asia/Shanghai ──
  const nowSH = dayjs().tz(TZ);
  // 今天凌晨 00:00:00（上海时区），转为 UTC Date 供 Prisma 查询
  const todayStartUtc = nowSH.startOf('day').utc().toDate();
  // 60 天后 23:59:59（上海时区），转为 UTC Date
  const deadlineUtc = nowSH.add(60, 'day').endOf('day').utc().toDate();
  // 30 天前（用于判断是否已提醒过）
  const reminderCutoff = nowSH.subtract(REMINDER_INTERVAL_DAYS, 'day').utc().toDate();

  let checkedCount = 0;
  let notifiedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const allPending: PendingExamPersonnel[] = [];

  // ── 准备：一次性拉取所有管理员 ID（数量有限，不做分页）──
  let adminIds: string[] = [];
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    });
    adminIds = admins.map((a) => a.id);
  } catch (e) {
    console.error('[体检提醒] 获取管理员列表失败:', e);
    await releaseLock();
    return {
      success: false,
      skippedByLock: false,
      checkedCount: 0,
      pendingCount: 0,
      notifiedCount: 0,
      skippedCount: 0,
      errorCount: 1,
      pendingPersonnel: [],
      error: e instanceof Error ? e.message : '获取管理员列表失败',
    };
  }

  // ── 死穴④ 游标分页：分批读取，不全表塞内存 ──
  let cursor: string | undefined;

  try {
    while (true) {
      const batch = await prisma.personnelHealthRecord.findMany({
        where: {
          requirePeriodicExam: true,
          nextExamDate: {
            not: null,
            gte: todayStartUtc, // 今天起（不包含已过期）
            lte: deadlineUtc,   // 60 天内
          },
        },
        select: {
          id: true,
          userId: true,
          hazardFactors: true,
          lastExamDate: true,
          examCycle: true,
          nextExamDate: true,
          lastExamReminderAt: true,
        },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { id: 'asc' },
      });

      if (batch.length === 0) break;
      checkedCount += batch.length;

      // 批量查询本批次对应的用户信息
      const batchUserIds = batch.map((r) => r.userId);
      let userMap = new Map<string, { name: string; jobTitle: string | null; department: { name: string } | null }>();
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: batchUserIds }, isActive: true },
          select: { id: true, name: true, jobTitle: true, department: { select: { name: true } } },
        });
        userMap = new Map(users.map((u) => [u.id, u]));
      } catch (e) {
        console.error('[体检提醒] 批量查询用户失败（跳过本批次）:', e);
        errorCount++;
        // 本批次用户查询失败 → 跳过，继续下一批
        cursor = batch[batch.length - 1].id;
        if (batch.length < BATCH_SIZE) break;
        continue;
      }

      // ── 逐人处理 ──
      for (const record of batch) {
        // ── 死穴⑤ 异常隔离：单人失败不中断整体 ──
        try {
          const user = userMap.get(record.userId);
          if (!user) {
            // 用户已离职或不存在
            skippedCount++;
            continue;
          }

          const nextExamDate = record.nextExamDate as Date;
          const daysUntilExam = Math.ceil(
            (nextExamDate.getTime() - nowSH.valueOf()) / (1000 * 60 * 60 * 24)
          );

          const entry: PendingExamPersonnel = {
            userId: record.userId,
            userName: user.name,
            departmentName: user.department?.name ?? null,
            jobTitle: user.jobTitle ?? null,
            hazardFactors: record.hazardFactors ?? null,
            lastExamDate: record.lastExamDate ? record.lastExamDate.toISOString() : null,
            examCycle: record.examCycle ?? null,
            nextExamDate: nextExamDate.toISOString(),
            daysUntilExam,
          };
          allPending.push(entry);

          // ── 死穴① 防重：30 天内已提醒过则跳过 ──
          if (
            record.lastExamReminderAt &&
            record.lastExamReminderAt > reminderCutoff
          ) {
            skippedCount++;
            continue;
          }

          // 更新 lastExamReminderAt（标记本次已提醒）
          await prisma.personnelHealthRecord.update({
            where: { id: record.id },
            data: { lastExamReminderAt: nowSH.utc().toDate() },
          });
          notifiedCount++;
        } catch (e) {
          errorCount++;
          console.error(`[体检提醒] 处理人员 ${record.userId} 时出错（已跳过）:`, e);
          // 单人出错 → 记录日志，继续循环
        }
      }

      cursor = batch[batch.length - 1].id;
      if (batch.length < BATCH_SIZE) break; // 最后一批
    }
  } catch (e) {
    // 游标查询本身崩溃（极少数情况）
    console.error('[体检提醒] 分批查询异常:', e);
    await releaseLock();
    return {
      success: false,
      skippedByLock: false,
      checkedCount,
      pendingCount: allPending.length,
      notifiedCount,
      skippedCount,
      errorCount: errorCount + 1,
      pendingPersonnel: allPending,
      error: e instanceof Error ? e.message : '分批查询失败',
    };
  }

  // 按剩余天数升序排列（最紧迫的排最前）
  allPending.sort((a, b) => a.daysUntilExam - b.daysUntilExam);

  // ── 向管理员发送汇总通知（本次有新增待提醒人员才发） ──
  if (notifiedCount > 0 && adminIds.length > 0) {
    try {
      await createNotificationsFromTemplate({
        triggerEvent: 'personnel_exam_due',
        recipientIds: adminIds,
        context: {
          examReminder: {
            pendingCount: allPending.length,
            notifiedCount,
            topPersonnel: allPending.slice(0, 5), // 仅模板展示前 5 名
            checkDate: nowSH.format('YYYY-MM-DD HH:mm:ss'),
          },
        },
        relatedType: 'personnel_exam',
        relatedId: 'daily-check',
      });
    } catch (e) {
      // ── 死穴⑤ 通知发送失败不影响数据库已记录的状态 ──
      errorCount++;
      console.error('[体检提醒] 发送管理员通知失败（数据已记录）:', e);
    }
  }

  await releaseLock();

  console.log(
    `[体检提醒] 完成：扫描 ${checkedCount} 条，` +
      `待体检 ${allPending.length} 人，` +
      `本次新增提醒 ${notifiedCount} 人，` +
      `跳过（已近期提醒）${skippedCount} 人，` +
      `处理异常 ${errorCount} 次`
  );

  return {
    success: true,
    skippedByLock: false,
    checkedCount,
    pendingCount: allPending.length,
    notifiedCount,
    skippedCount,
    errorCount,
    pendingPersonnel: allPending,
  };
}

// GET：管理员手动触发 / 查询当前待体检人员列表
export const GET = withAuth(async () => {
  const result = await checkHealthExamReminders();
  return NextResponse.json(result);
});
