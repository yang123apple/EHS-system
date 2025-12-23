import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLog } from '@/lib/logger';
import { resolveApprovers } from '@/lib/workflowUtils';
import { db } from '@/lib/mockDb';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recordId, opinion, action, userName, userId, operatorId, nextStepApprovers } = body;
    
    console.log('🔍 [调试-后端] 收到的审批请求参数:', { recordId, userName, userId, operatorId, nextStepApprovers });

    // 1. 获取记录
    const record = await prisma.workPermitRecord.findUnique({
      where: { id: recordId },
      include: { template: true }
    });

    if (!record) return NextResponse.json({ error: '记录不存在' }, { status: 404 });

    const workflow = record.template.workflowConfig ? JSON.parse(record.template.workflowConfig) : [];
    const currentStepIndex = record.currentStep;
    
    // ---------------------------------------------------------
    // 1. 查找步骤配置
    // ---------------------------------------------------------
    console.log(`[电子签字调试] 正在查找步骤: ${currentStepIndex}`);
    const currentStepConfig = workflow.find((w: any) => {
        const stepNum = w.step ?? w.stepIndex; 
        return String(stepNum) === String(currentStepIndex);
    });

    if (currentStepConfig) {
        console.log(`[电子签字] 找到步骤配置: "${currentStepConfig.name}", 绑定单元格:`, currentStepConfig.outputCell);
    } else {
        console.log(`[电子签字] 未找到步骤配置，跳过签字`);
    }
    
    // ---------------------------------------------------------
    // 🟢 2. 增强版电子签字逻辑 (修复“数据结构异常”)
    // ---------------------------------------------------------
    let updatedDataJson = record.dataJson; 

    if (currentStepConfig?.outputCell) {
      try {
        const { r, c } = currentStepConfig.outputCell;
        
        // A. 准备内容
        const actionText = action === 'pass' ? '同意' : (action === 'reject' ? '驳回' : action);
        const timeText = new Date().toLocaleString('zh-CN', { hour12: false }); 
        const signText = `【${actionText}】 ${userName}  ${timeText}`;

        // B. 解析 Excel 数据 (核心修复点)
        let sheetData = JSON.parse(record.dataJson);
        
        // 🟢 修复1：处理双重序列化 (如果解析出来还是字符串，再解一次)
        if (typeof sheetData === 'string') {
            console.log("[电子签字] 检测到数据是字符串，尝试二次解析...");
            try { sheetData = JSON.parse(sheetData); } catch(e) {}
        }

        let targetSheet = null;

        // 🟢 修复2：更宽容的数据判定
        if (Array.isArray(sheetData) && sheetData.length > 0) {
            targetSheet = sheetData[0]; 
        } else if (typeof sheetData === 'object' && sheetData !== null) {
            targetSheet = sheetData;
        } else {
            // 🟢 修复3：如果是 null 或空，直接初始化一个新的结构，不要报错
            console.warn("[电子签字] 数据为空，初始化新 Sheet 结构");
            targetSheet = { celldata: [] };
            sheetData = [targetSheet]; // 包装回数组结构以便保存
        }

        // C. 执行写入
        if (targetSheet) {
           if (!targetSheet.celldata) targetSheet.celldata = [];

           // 查找或追加单元格
           const cellIndex = targetSheet.celldata.findIndex((cell: any) => cell.r === r && cell.c === c);
           const cellPayload = {
             r, c, 
             v: {
               v: signText,
               m: signText,
               fc: action === 'reject' ? "#ff0000" : "#000000",
               tb: 1, // 自动换行
               vt: 1, ht: 1, fs: 10,
             }
           };

           if (cellIndex > -1) {
             targetSheet.celldata[cellIndex].v = { ...targetSheet.celldata[cellIndex].v, ...cellPayload.v };
           } else {
             targetSheet.celldata.push(cellPayload);
           }
           
           // 同步 grid (如果有)
           if (targetSheet.grid && Array.isArray(targetSheet.grid) && targetSheet.grid[r]) {
               if (typeof targetSheet.grid[r][c] === 'object') {
                   targetSheet.grid[r][c] = { ...targetSheet.grid[r][c], ...cellPayload.v };
               } else {
                   targetSheet.grid[r][c] = cellPayload.v;
               }
           }

           // D. 保存回字符串
           updatedDataJson = JSON.stringify(sheetData);
           console.log(`✅ [电子签字成功] 已写入 [${signText}] 到 R${r}:C${c}`);
        }
      } catch (e) {
        console.error("❌ [电子签字] 写入失败:", e);
      }
    }
    // ---------------------------------------------------------

    // 3. 构建日志
    const newLog = {
      step: currentStepIndex,
      stepName: currentStepConfig?.name || "未知步骤",
      approver: userName,
      userId: userId || null,
      operatorId: operatorId || userId || null,
      opinion: opinion,
      time: new Date().toLocaleString(),
      action: action
    };
    
    console.log('🔍 [调试-后端] 构建的日志对象:', newLog);

    const oldLogs = record.approvalLogs ? JSON.parse(record.approvalLogs) : [];
    const updatedLogs = [...oldLogs, newLog];

    // 4. 计算下一状态
    let nextStep = currentStepIndex;
    let nextStatus = record.status;

    if (action === 'reject') {
        nextStatus = 'rejected'; 
    } else {
        if (currentStepIndex + 1 < workflow.length) {
            nextStep = currentStepIndex + 1;
            nextStatus = 'processing';
        } else {
            nextStatus = 'approved'; 
        }
    }

    // 5. 更新数据库（驳回时清空编号）
    const updateData: any = {
      approvalLogs: JSON.stringify(updatedLogs),
      currentStep: nextStep,
      status: nextStatus,
      dataJson: updatedDataJson // ✅ 保存 Excel 数据
    };
    
    // 🟢 如果是驳回，清空编号（回收编号）
    if (action === 'reject') {
      updateData.code = null;
      console.log('🔄 [编号回收] 作业票被驳回，编号已清空');
    }
    
    const updatedRecord = await prisma.workPermitRecord.update({
      where: { id: recordId },
      data: updateData,
      include: { project: true, template: true } // 包含项目和模板信息，用于通知
    });

    // 🟢 插入日志
    const actionType = action === 'pass' ? 'APPROVE_PASS' : 'APPROVE_REJECT';
    createLog(
      userId, 
      userName, 
      actionType, 
      recordId, 
      `审批意见: ${opinion}`
    );

    // 🟢 创建通知
    try {
      console.log('🔔 [通知调试] 开始检查是否需要创建通知');
      console.log('🔔 [通知调试] action:', action, 'nextStep:', nextStep, 'workflow.length:', workflow.length);
      
      // 如果是通过，且还有下一步，通知下一个审批人
      if (action === 'pass' && nextStep < workflow.length) {
        console.log('🔔 [通知调试] 需要创建通知，查找下一步配置...');
        
        const nextStepConfig = workflow.find((w: any) => {
          const stepNum = w.step ?? w.stepIndex;
          return String(stepNum) === String(nextStep);
        });

        console.log('🔔 [通知调试] 下一步配置:', JSON.stringify(nextStepConfig));

        if (nextStepConfig) {
          // 🟢 在服务器端解析动态审批人
          let approversToNotify = [];
          
          // 🟢 获取发起人部门
          // 如果当前是第一步(step=0)，发起人就是本次提交者
          // 如果已经在后续步骤，从第一条日志获取
          let applicantDept = '';
          let applicantUserId = '';
          
          const logs = updatedRecord.approvalLogs ? JSON.parse(updatedRecord.approvalLogs) : [];
          console.log('🔍 [调试] 审批日志数量:', logs.length);
          console.log('🔍 [调试] 当前步骤:', currentStepIndex, '下一步:', nextStep);
          
          if (currentStepIndex === 0) {
            // 第一步：发起人就是当前提交者
            applicantUserId = userId || operatorId || '';
            console.log('🔍 [调试] 第一步提交，发起人ID:', applicantUserId);
          } else if (logs.length > 0) {
            // 后续步骤：从第一条日志获取发起人
            const firstLog = logs[0];
            applicantUserId = firstLog.operatorId || firstLog.userId || '';
            console.log('🔍 [调试] 从日志获取发起人ID:', applicantUserId);
          }
          
          if (applicantUserId) {
            const applicantUser = await db.getUserById(applicantUserId);
            console.log('🔍 [调试] 发起人用户信息:', JSON.stringify(applicantUser));
            applicantDept = (applicantUser as any)?.departmentId || applicantUser?.department || '';
          }
          
          if (!applicantDept) {
            applicantDept = updatedRecord.project?.requestDept || '';
            console.log('🔍 [调试] 使用项目申请部门:', applicantDept);
          }
          
          console.log('🔔 [后端] 最终确定的发起人部门:', applicantDept);
          
          // 解析表单数据和模板字段
          const formData = updatedRecord.dataJson ? JSON.parse(updatedRecord.dataJson) : {};
          const parsedFields = updatedRecord.template.parsedFields 
            ? JSON.parse(updatedRecord.template.parsedFields) 
            : [];
          
          // 调用 resolveApprovers 解析审批人
          const resolvedUsers = await resolveApprovers(
            applicantDept,
            nextStepConfig,
            formData,
            parsedFields
          );
          
          approversToNotify = resolvedUsers.map((u: any) => ({ id: u.id, name: u.name }));
          
          console.log('🔔 [后端] 解析出的审批人:', JSON.stringify(approversToNotify));
          
          if (approversToNotify.length > 0) {
            const approverIds = approversToNotify.map((a: any) => a.id).filter(Boolean);
            
            console.log('🔔 [通知调试] 提取的审批人ID列表:', approverIds);
            
            const notificationPromises = approverIds.map((approverId: string) => 
              prisma.notification.create({
                data: {
                  userId: approverId,
                  type: 'approval_pending',
                  title: '待审批作业票',
                  content: `【${updatedRecord.template.name}】 ${updatedRecord.project.name} - 等待您审批（第${nextStep + 1}步：${nextStepConfig.name}）`,
                  relatedType: 'permit',
                  relatedId: recordId,
                  isRead: false,
                }
              })
            );

            await Promise.all(notificationPromises);
            console.log(`✅ [通知] 已为 ${approverIds.length} 位下一步审批人创建通知`);
          } else {
            console.log('⚠️ [通知调试] 解析审批人结果为空');
          }
        } else {
          console.log('⚠️ [通知调试] 未找到下一步配置');
        }
      } else {
        console.log('🔔 [通知调试] 不需要创建下一步审批通知（可能是最后一步或被驳回）');
      }
      
      // 🟢 给发起人发送审批结果通知（每次审批都发送）
      const logs = updatedRecord.approvalLogs ? JSON.parse(updatedRecord.approvalLogs) : [];
      if (logs.length > 0) {
        const firstLog = logs[0];
        const creatorId = firstLog.operatorId || firstLog.userId;
        
        if (creatorId) {
          console.log('🔔 [通知] 给发起人发送审批结果通知, 发起人ID:', creatorId);
          
          // 构建通知内容
          const actionText = action === 'pass' ? '通过' : '驳回';
          const statusText = nextStatus === 'approved' ? '【已完成】' : 
                           nextStatus === 'rejected' ? '【已驳回】' : 
                           `【进行中】`;
          
          const notificationTitle = action === 'pass' ? '作业票审批通过' : '作业票被驳回';
          const notificationContent = `${statusText}【${updatedRecord.template.name}】 ${updatedRecord.project.name} - ${userName}${actionText}了您的申请`;
          
          try {
            await prisma.notification.create({
              data: {
                userId: creatorId,
                type: action === 'pass' ? 'approval_passed' : 'approval_rejected',
                title: notificationTitle,
                content: notificationContent,
                relatedType: 'permit',
                relatedId: recordId,
                isRead: false,
              }
            });
            console.log(`✅ [通知] 已通知发起人: ${notificationTitle}`);
          } catch (err) {
            console.error('❌ [通知] 通知发起人失败:', err);
          }
        }
      }
      
      // 如果全部通过，额外通知相关人员
      if (nextStatus === 'approved') {
        console.log('✅ 作业票已全部审批通过');
      }
    } catch (notificationError) {
      console.error('❌ 创建通知失败:', notificationError);
      // 通知创建失败不影响审批流程
    }

    return NextResponse.json(updatedRecord);

  } catch (error) {
    console.error("❌ [审批失败] 详细错误:", error);
    console.error("❌ [审批失败] 错误堆栈:", error instanceof Error ? error.stack : '无堆栈信息');
    console.error("❌ [审批失败] 错误消息:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ 
      error: '审批失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}