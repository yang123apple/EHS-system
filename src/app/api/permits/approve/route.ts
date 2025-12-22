import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLog } from '@/lib/logger';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recordId, opinion, action, userName, userId, operatorId } = body;
    
    console.log('🔍 [调试-后端] 收到的审批请求参数:', { recordId, userName, userId, operatorId });

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

    // 5. 更新数据库
    const updatedRecord = await prisma.workPermitRecord.update({
      where: { id: recordId },
      data: {
        approvalLogs: JSON.stringify(updatedLogs),
        currentStep: nextStep,
        status: nextStatus,
        dataJson: updatedDataJson // ✅ 保存 Excel 数据
      }
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

    return NextResponse.json(updatedRecord);

  } catch (error) {
    console.error("Approval Error:", error);
    return NextResponse.json({ error: '审批失败' }, { status: 500 });
  }
}