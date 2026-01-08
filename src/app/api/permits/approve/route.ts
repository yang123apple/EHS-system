import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveApprovers } from '@/lib/workflowUtils';
import { db } from '@/lib/mockDb';
import { withAuth, logApiOperation } from '@/middleware/auth';
import { PermissionManager } from '@/lib/permissions';
import { createPermitNotification } from '@/lib/notificationService';
import { createSignature, extractClientInfo } from '@/services/signatureService';
export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: Request, context, user) => {
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
    
    // 🟢 权限检查：如果是第一步（发起申请），允许有 create_permit 权限的用户；否则需要 approve_permit 权限
    console.log('🔍 [权限调试] 当前步骤索引:', currentStepIndex);
    console.log('🔍 [权限调试] 用户信息:', { 
      id: user.id, 
      name: user.name, 
      role: user.role,
      permissions: user.permissions 
    });
    
    if (currentStepIndex === 0) {
      // 第一步：允许有 create_permit 权限的用户发起申请
      const hasPermission = PermissionManager.hasPermission(user, 'work_permit', 'create_permit');
      console.log('🔍 [权限调试] 第一步审批，检查 create_permit 权限:', hasPermission);
      if (!hasPermission) {
        console.error('❌ [权限调试] 权限检查失败: 需要 work_permit.create_permit');
        return NextResponse.json(
          { 
            error: '权限不足',
            details: '需要 work_permit.create_permit 权限来发起申请',
            module: 'work_permit',
            permission: 'create_permit',
          },
          { status: 403 }
        );
      }
    } else {
      // 后续步骤：需要 approve_permit 权限
      const hasPermission = PermissionManager.hasPermission(user, 'work_permit', 'approve_permit');
      console.log('🔍 [权限调试] 后续步骤审批，检查 approve_permit 权限:', hasPermission);
      console.log('🔍 [权限调试] 用户权限详情:', {
        isAdmin: user.role === 'admin',
        hasPermissions: !!user.permissions,
        workPermitPerms: user.permissions?.['work_permit'],
        includesApprovePermit: user.permissions?.['work_permit']?.includes('approve_permit')
      });
      
      if (!hasPermission) {
        console.error('❌ [权限调试] 权限检查失败: 需要 work_permit.approve_permit');
        return NextResponse.json(
          { 
            error: '权限不足',
            details: '需要 work_permit.approve_permit 权限来审批',
            module: 'work_permit',
            permission: 'approve_permit',
            debug: {
              userId: user.id,
              userRole: user.role,
              hasPermissions: !!user.permissions,
              workPermitPerms: user.permissions?.['work_permit']
            }
          },
          { status: 403 }
        );
      }
    }
    
    // ---------------------------------------------------------
    // 1. 查找步骤配置
    // ---------------------------------------------------------
    console.log(`[电子签字调试] 正在查找步骤: ${currentStepIndex}`);
    const currentStepConfig = workflow.find((w: any) => {
        const stepNum = w.step ?? w.stepIndex; 
        return String(stepNum) === String(currentStepIndex);
    });
    
    // 🟢 如果是第一次审批且没有 candidateHandlers，需要设置第一步的 candidateHandlers
    if (currentStepIndex === 0 && !record.candidateHandlers && currentStepConfig) {
      const approvalMode = currentStepConfig.approvalMode || 'OR';
      
      // 如果第一步是多人模式，需要解析审批人并设置 candidateHandlers
      if ((approvalMode === 'OR' || approvalMode === 'AND') && currentStepConfig.approverStrategy) {
        try {
          const formData = record.dataJson ? JSON.parse(record.dataJson) : {};
          const parsedFields = record.template.parsedFields 
            ? JSON.parse(record.template.parsedFields) 
            : [];
          
          // 获取发起人部门
          let applicantDept = record.project?.requestDept || '';
          
          const allApprovers = await resolveApprovers(
            applicantDept,
            currentStepConfig,
            formData,
            parsedFields
          );
          
          if (allApprovers.length > 1) {
            // 多人模式：设置 candidateHandlers
            const initialCandidateHandlers = allApprovers.map(u => ({
              userId: u.id,
              userName: u.name,
              hasOperated: false
            }));
            
            // 更新记录，设置 candidateHandlers 和 approvalMode
            await prisma.workPermitRecord.update({
              where: { id: recordId },
              data: {
                candidateHandlers: JSON.stringify(initialCandidateHandlers),
                approvalMode: approvalMode
              }
            });
            
            // 更新 record 对象，以便后续逻辑使用
            (record as any).candidateHandlers = initialCandidateHandlers;
            (record as any).approvalMode = approvalMode;
            
            console.log(`🎯 [第一步] 设置${approvalMode}模式多人审批:`, initialCandidateHandlers);
          }
        } catch (e) {
          console.error('❌ [第一步] 解析审批人失败:', e);
        }
      }
    }
    
    // ---------------------------------------------------------
    // 🟢 1.5 检查OR/AND模式下审批权限（使用 candidateHandlers）
    // ---------------------------------------------------------
    if (currentStepConfig && action === 'pass') {
      const approvalMode = currentStepConfig.approvalMode || record.approvalMode || 'OR';
      console.log(`[审批检查] 当前步骤审批模式: ${approvalMode}`);
      
      // 解析 candidateHandlers（如果存在）
      const candidateHandlers = record.candidateHandlers 
        ? (typeof record.candidateHandlers === 'string' 
            ? JSON.parse(record.candidateHandlers) 
            : record.candidateHandlers)
        : [];
      
      if (candidateHandlers.length > 0) {
        // 检查当前用户是否在候选审批人列表中
        const isCandidate = candidateHandlers.some((h: any) => String(h.userId) === String(userId || user.id));
        if (!isCandidate) {
          console.log(`[审批检查] 当前用户不在候选审批人列表中`);
          return NextResponse.json(
            { error: '您不是当前步骤的候选审批人' },
            { status: 403 }
          );
        }
        
        if (approvalMode === 'OR') {
          // OR模式：检查 candidateHandlers 中是否已有人操作过
          const someoneOperated = candidateHandlers.some((h: any) => h.hasOperated);
          
          if (someoneOperated) {
            console.log(`[或签检查] 当前步骤已有人审批通过，拒绝重复审批`);
            return NextResponse.json(
              { error: '当前步骤已有其他人审批通过，无需重复审批' },
              { status: 400 }
            );
          }
        } else if (approvalMode === 'AND') {
          // AND模式（会签）：检查当前用户是否已审批过（防止重复审批）
          const currentUserHandler = candidateHandlers.find((h: any) => String(h.userId) === String(userId || user.id));
          if (currentUserHandler && currentUserHandler.hasOperated) {
            console.log(`[会签检查] 当前用户已审批过，拒绝重复审批`);
            return NextResponse.json(
              { error: '您已经审批过此步骤，无需重复审批' },
              { status: 400 }
            );
          }
        }
      }
    }

    if (currentStepConfig) {
        console.log(`[电子签字] 找到步骤配置: "${currentStepConfig.name}", 绑定单元格:`, currentStepConfig.outputCell);
    } else {
        console.log(`[电子签字] 未找到步骤配置，跳过签字`);
    }
    
    // ---------------------------------------------------------
    // 🟢 2. 增强版电子签字逻辑 (修复"数据结构异常")
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
        let parsedData = JSON.parse(record.dataJson);
        
        // 🟢 修复1：处理双重序列化 (如果解析出来还是字符串，再解一次)
        if (typeof parsedData === 'string') {
            console.log("[电子签字] 检测到数据是字符串，尝试二次解析...");
            try { parsedData = JSON.parse(parsedData); } catch(e) {}
        }

        // 🟢 修复：提取子表单数据（SECTION_* 键），避免在更新 Excel 数据时丢失
        const sectionData: Record<string, any> = {};
        Object.keys(parsedData).forEach(key => {
          if (key.startsWith('SECTION_')) {
            sectionData[key] = parsedData[key];
          }
        });

        // 提取 Excel 数据（排除 SECTION_* 键）
        let sheetData: any = { ...parsedData };
        Object.keys(sectionData).forEach(key => {
          delete sheetData[key];
        });

        // 判断数据格式：键值对格式（如 "0-0": "value"）还是 Excel 格式（有 celldata/grid）
        const isKeyValueFormat = Object.keys(sheetData).some(k => /^\d+-\d+$/.test(k));
        const isExcelFormat = sheetData.celldata || sheetData.grid || (Array.isArray(sheetData) && sheetData.length > 0);

        // C. 执行写入
        if (isKeyValueFormat) {
          // 键值对格式：直接更新对应的键
          const cellKey = `${r}-${c}`;
          sheetData[cellKey] = signText;
          
          // 合并回子表单数据
          const finalData = { ...sheetData, ...sectionData };
          updatedDataJson = JSON.stringify(finalData);
          console.log(`✅ [电子签字成功] 已写入 [${signText}] 到 R${r}:C${c}（键值对格式），保留子表单数据:`, Object.keys(sectionData));
        } else if (isExcelFormat) {
          // Excel 格式：更新 celldata 和 grid
          let targetSheet = null;
          
          if (Array.isArray(sheetData) && sheetData.length > 0) {
            targetSheet = sheetData[0];
          } else if (typeof sheetData === 'object' && sheetData !== null) {
            targetSheet = sheetData;
          } else {
            console.warn("[电子签字] 数据为空，初始化新 Sheet 结构");
            targetSheet = { celldata: [] };
            sheetData = [targetSheet];
          }

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

            // 合并回子表单数据
            const finalData = Array.isArray(sheetData) 
              ? { ...sectionData, _sheetData: sheetData } // 如果是数组，用特殊键保存
              : { ...sheetData, ...sectionData }; // 如果是对象，直接合并
            
            updatedDataJson = JSON.stringify(finalData);
            console.log(`✅ [电子签字成功] 已写入 [${signText}] 到 R${r}:C${c}（Excel格式），保留子表单数据:`, Object.keys(sectionData));
          }
        } else {
          // 未知格式，尝试作为键值对处理
          const cellKey = `${r}-${c}`;
          sheetData[cellKey] = signText;
          
          // 合并回子表单数据
          const finalData = { ...sheetData, ...sectionData };
          updatedDataJson = JSON.stringify(finalData);
          console.log(`✅ [电子签字成功] 已写入 [${signText}] 到 R${r}:C${c}（未知格式，按键值对处理），保留子表单数据:`, Object.keys(sectionData));
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
    const isLastStep = currentStepIndex + 1 >= workflow.length;
    const shouldStayAtCurrentStep = false; // 默认流转到下一步

    if (action === 'reject') {
        nextStatus = 'rejected'; 
    } else {
        if (!isLastStep) {
            nextStep = currentStepIndex + 1;
            nextStatus = 'processing';
        } else {
            nextStatus = 'approved'; 
        }
    }

    // 🟢 处理 candidateHandlers 和 approvalMode
    const approvalMode = currentStepConfig?.approvalMode || record.approvalMode || 'OR';
    let candidateHandlers = record.candidateHandlers 
      ? (typeof record.candidateHandlers === 'string' 
          ? JSON.parse(record.candidateHandlers) 
          : record.candidateHandlers)
      : [];
    
    // 如果是 OR 模式且通过审批，更新 hasOperated 状态
    if (action === 'pass' && approvalMode === 'OR' && candidateHandlers.length > 0) {
      candidateHandlers = candidateHandlers.map((candidate: any) => ({
        ...candidate,
        hasOperated: String(candidate.userId) === String(userId || user.id) ? true : candidate.hasOperated
      }));
      console.log('✅ [或签] 已更新当前用户的 hasOperated 状态');
    }
    
    // 如果是 AND 模式且通过审批，更新当前用户的 hasOperated 状态（但停留在当前步骤）
    if (action === 'pass' && approvalMode === 'AND' && candidateHandlers.length > 0) {
      candidateHandlers = candidateHandlers.map((candidate: any) => ({
        ...candidate,
        hasOperated: String(candidate.userId) === String(userId || user.id) ? true : candidate.hasOperated
      }));
      
      // 检查是否所有人都已审批
      const allApproved = candidateHandlers.every((c: any) => c.hasOperated);
      if (!allApproved) {
        // 会签未完成：停留在当前步骤
        nextStep = currentStepIndex;
        nextStatus = record.status; // 保持当前状态
        console.log('🟡 [会签] 未完成，停留在当前步骤');
      } else {
        // 会签完成：流转到下一步
        if (!isLastStep) {
          nextStep = currentStepIndex + 1;
          nextStatus = 'processing';
        } else {
          nextStatus = 'approved';
        }
        console.log('✅ [会签] 已完成，流转到下一步');
      }
    }
    
    // 🟢 如果流转到下一步，需要设置下一步的 candidateHandlers
    // 注意：会签未完成时（nextStep === currentStepIndex），不需要设置下一步的 candidateHandlers
    let nextStepApprovalMode: string | null = null;
    let nextStepCandidateHandlers: any[] | null = null;
    
    if (action === 'pass' && nextStep !== currentStepIndex && nextStep < workflow.length) {
      const nextStepConfig = workflow[nextStep];
      if (nextStepConfig) {
        nextStepApprovalMode = nextStepConfig.approvalMode || 'OR';
        
        // 如果下一步是多人模式，需要解析审批人并设置 candidateHandlers
        if ((nextStepApprovalMode === 'OR' || nextStepApprovalMode === 'AND') && nextStepConfig.approverStrategy) {
          try {
            const formData = record.dataJson ? JSON.parse(record.dataJson) : {};
            const parsedFields = record.template.parsedFields 
              ? JSON.parse(record.template.parsedFields) 
              : [];
            
            // 获取发起人部门
            let applicantDept = record.project?.requestDept || '';
            const logs = record.approvalLogs ? JSON.parse(record.approvalLogs) : [];
            if (logs.length > 0) {
              const firstLog = logs[0];
              const applicantUserId = firstLog.operatorId || firstLog.userId || '';
              if (applicantUserId) {
                const applicantUser = await db.getUserById(applicantUserId);
                applicantDept = (applicantUser as any)?.departmentId || applicantUser?.department || applicantDept;
              }
            }
            
            const allApprovers = await resolveApprovers(
              applicantDept,
              nextStepConfig,
              formData,
              parsedFields
            );
            
            if (allApprovers.length > 1) {
              // 多人模式：设置 candidateHandlers
              nextStepCandidateHandlers = allApprovers.map(u => ({
                userId: u.id,
                userName: u.name,
                hasOperated: false
              }));
              console.log(`🎯 [下一步] 设置${nextStepApprovalMode}模式多人审批:`, nextStepCandidateHandlers);
            }
          } catch (e) {
            console.error('❌ [下一步] 解析审批人失败:', e);
          }
        }
      }
    }
    
    // 如果 OR 模式已完成流转，清除 candidateHandlers（使用下一步的值）
    if (action === 'pass' && approvalMode === 'OR' && nextStep !== currentStepIndex) {
      candidateHandlers = nextStepCandidateHandlers || [];
      console.log('✅ [或签] 已完成流转，使用下一步的 candidateHandlers');
    }
    
    // 如果 AND 模式已完成流转，清除 candidateHandlers（使用下一步的值）
    if (action === 'pass' && approvalMode === 'AND' && nextStep !== currentStepIndex) {
      candidateHandlers = nextStepCandidateHandlers || [];
      console.log('✅ [会签] 已完成流转，使用下一步的 candidateHandlers');
    }

    // 5. 更新数据库（驳回时清空编号）
    // 🟢 确定最终的 approvalMode：
    // - 如果流转到下一步，使用下一步的 approvalMode
    // - 如果停留在当前步骤（会签未完成），保持当前的 approvalMode
    // - 如果驳回，清除 approvalMode
    let finalApprovalMode: string | null = null;
    if (action === 'reject') {
      finalApprovalMode = null; // 驳回时清除
    } else if (nextStep === currentStepIndex) {
      // 停留在当前步骤（会签未完成）：保持当前的 approvalMode
      finalApprovalMode = approvalMode;
    } else {
      // 流转到下一步：使用下一步的 approvalMode
      finalApprovalMode = nextStepApprovalMode;
    }
    
    const updateData: any = {
      approvalLogs: JSON.stringify(updatedLogs),
      currentStep: nextStep,
      status: nextStatus,
      dataJson: updatedDataJson, // ✅ 保存 Excel 数据
      approvalMode: finalApprovalMode,
      candidateHandlers: candidateHandlers.length > 0 ? JSON.stringify(candidateHandlers) : null
    };
    
    // 🟢 如果是驳回，清空编号（回收编号）
    if (action === 'reject') {
      updateData.code = null;
      updateData.candidateHandlers = null;
      updateData.approvalMode = null;
      console.log('🔄 [编号回收] 作业票被驳回，编号已清空');
    }
    
    const updatedRecord = await prisma.workPermitRecord.update({
      where: { id: recordId },
      data: updateData,
      include: { project: true, template: true } // 包含项目和模板信息，用于通知
    });
    
    // 🟢 创建电子签名记录（防篡改机制）
    try {
      const clientInfo = extractClientInfo(req);
      await createSignature(
        {
          permitId: recordId,
          signerId: userId || '',
          signerName: userName,
          action: action === 'pass' ? 'pass' : 'reject',
          comment: opinion,
          stepIndex: currentStepIndex,
          stepName: currentStepConfig?.name,
          clientInfo,
        },
        updatedDataJson, // 签字时刻的数据快照
        false // 不保存完整快照，仅保存 Hash（节省存储空间）
      );
      console.log('✅ [电子签名] 已创建签名记录');
    } catch (signatureError) {
      console.error('❌ [电子签名] 创建签名记录失败:', signatureError);
      // 签名记录失败不影响审批流程，但需要记录错误
    }

    // 🟢 记录权限系统审计日志（统一使用 logApiOperation，避免重复日志）
    await logApiOperation(
      user,
      'work_permit',
      action === 'pass' ? 'approve_permit' : 'reject_permit',
      { 
        permitId: recordId,
        step: currentStepIndex,
        stepName: currentStepConfig?.name,
        opinion 
      }
    );

    // 🟢 创建通知
    try {
      console.log('🔔 [通知调试] 开始检查是否需要创建通知');
      console.log('🔔 [通知调试] action:', action, 'nextStep:', nextStep, 'workflow.length:', workflow.length);
      
      // 🟢 会签/或签进度通知：通知其他候选人
      if (action === 'pass' && currentStepConfig) {
        const approvalMode = currentStepConfig.approvalMode || 'OR';
        
        if ((approvalMode === 'OR' || approvalMode === 'AND') && currentStepConfig.approverStrategy) {
          console.log(`🔔 [${approvalMode === 'AND' ? '会签' : '或签'}] 检测到多人审批模式，准备通知其他候选人`);
          
          try {
            // 获取当前步骤的所有审批人
            const formData = updatedRecord.dataJson ? JSON.parse(updatedRecord.dataJson) : {};
            const parsedFields = updatedRecord.template.parsedFields 
              ? JSON.parse(updatedRecord.template.parsedFields) 
              : [];
            
            // 获取发起人部门
            let applicantDept = updatedRecord.project?.requestDept || '';
            const logs = updatedRecord.approvalLogs ? JSON.parse(updatedRecord.approvalLogs) : [];
            if (logs.length > 0) {
              const firstLog = logs[0];
              const applicantUserId = firstLog.operatorId || firstLog.userId || '';
              if (applicantUserId) {
                const applicantUser = await db.getUserById(applicantUserId);
                applicantDept = (applicantUser as any)?.departmentId || applicantUser?.department || applicantDept;
              }
            }
            
            const allApprovers = await resolveApprovers(
              applicantDept,
              currentStepConfig,
              formData,
              parsedFields
            );
            
            // 找出还未审批的人（排除当前操作人）
            const oldLogs = record.approvalLogs ? JSON.parse(record.approvalLogs) : [];
            const approvedUserIds = new Set(
              oldLogs
                .filter((log: any) => 
                  (log.stepIndex === currentStepIndex || log.step === currentStepIndex) && 
                  log.action === 'pass'
                )
                .map((log: any) => log.operatorId || log.userId)
            );
            approvedUserIds.add(userId); // 包含当前操作人
            
            const pendingApprovers = allApprovers.filter(u => !approvedUserIds.has(u.id));
            
            if (pendingApprovers.length > 0) {
              const pendingIds = pendingApprovers.map(u => u.id);
              const modeText = approvalMode === 'AND' ? '会签' : '或签';
              const operatedCount = approvedUserIds.size;
              const totalCount = allApprovers.length;
              
              console.log(`🔔 [${modeText}] 通知 ${pendingApprovers.length} 位待审批人: ${pendingApprovers.map(u => u.name).join('、')}`);
              
              // 创建进度通知
              await createPermitNotification(
                'permit_approval_progress',
                pendingIds,
                {
                  id: recordId,
                  templateName: updatedRecord.template.name,
                  projectName: updatedRecord.project.name,
                  stepName: currentStepConfig.name,
                  approvalMode: modeText,
                  operatedCount,
                  totalCount,
                },
                userName
              );
              
              console.log(`✅ [${modeText}] 已创建进度通知: ${operatedCount}/${totalCount}人已处理`);
            } else {
              console.log(`🔔 [${approvalMode === 'AND' ? '会签' : '或签'}] 没有待通知的审批人`);
            }
          } catch (err) {
            console.error(`❌ [${approvalMode === 'AND' ? '会签' : '或签'}] 创建进度通知失败:`, err);
          }
        }
      }
      
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
          console.log('🔔 [通知调试] 准备解析审批人，策略:', nextStepConfig.approverStrategy);
          console.log('🔔 [通知调试] 策略配置:', JSON.stringify(nextStepConfig.strategyConfig));
          
          const resolvedUsers = await resolveApprovers(
            applicantDept,
            nextStepConfig,
            formData,
            parsedFields
          );
          
          console.log('🔔 [通知调试] resolveApprovers 返回的用户:', resolvedUsers.map(u => ({ id: u.id, name: u.name })));
          
          approversToNotify = resolvedUsers.map((u: any) => ({ id: u.id, name: u.name }));
          
          console.log('🔔 [后端] 解析出的审批人:', JSON.stringify(approversToNotify));
          
          if (approversToNotify.length > 0) {
            const approverIds = approversToNotify.map((a: any) => a.id).filter(Boolean);
            
            console.log('🔔 [通知调试] 提取的审批人ID列表:', approverIds);
            
            // Use notification service to create notifications
            await createPermitNotification(
              'permit_pending_approval',
              approverIds,
              {
                id: recordId,
                templateName: updatedRecord.template.name,
                projectName: updatedRecord.project.name,
                stepName: nextStepConfig.name,
                stepNumber: nextStep + 1,
              },
              userName
            );

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
          
          try {
            // Use notification service to create notification
            const event = action === 'pass' ? 'permit_approved' : 'permit_rejected';
            await createPermitNotification(
              event,
              [creatorId],
              {
                id: recordId,
                templateName: updatedRecord.template.name,
                projectName: updatedRecord.project.name,
              },
              userName
            );
            
            console.log(`✅ [通知] 已通知发起人: ${event}`);
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
});
