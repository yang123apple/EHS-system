/**
 * 子表单服务：解耦二级表单数据
 * 
 * 核心功能：
 * 1. 将子表单数据从父表单的 JSON 中分离，存储到独立的 SubPermit 表
 * 2. 父表单 JSON 中只保留子表单的 ID 引用
 * 3. 提供子表单的 CRUD 操作
 */

import { prisma } from '@/lib/prisma';

export interface SubPermitInput {
  parentPermitId: string;
  templateId: string;
  cellKey: string; // 如 "R5C3"
  fieldName?: string;
  code?: string;
  dataJson: string | Record<string, any>;
  status?: string;
  currentStep?: number;
  approvalLogs?: string;
}

export interface SubPermitUpdateInput {
  dataJson?: string | Record<string, any>;
  status?: string;
  currentStep?: number;
  approvalLogs?: string;
}

/**
 * 创建子表单记录
 */
export async function createSubPermit(input: SubPermitInput) {
  const dataJson = typeof input.dataJson === 'string' 
    ? input.dataJson 
    : JSON.stringify(input.dataJson);
  
  // 生成子表单编号（如果未提供）
  let code = input.code;
  if (!code && input.fieldName) {
    // 获取父表单编号
    const parentPermit = await prisma.workPermitRecord.findUnique({
      where: { id: input.parentPermitId },
      select: { code: true },
    });
    
    if (parentPermit?.code) {
      const suffix = input.fieldName.substring(0, 3).toUpperCase();
      code = `${parentPermit.code}-${suffix}`;
    }
  }
  
  const subPermit = await prisma.subPermit.create({
    data: {
      parentPermitId: input.parentPermitId,
      templateId: input.templateId,
      cellKey: input.cellKey,
      fieldName: input.fieldName || null,
      code: code || null,
      dataJson,
      status: input.status || 'draft',
      currentStep: input.currentStep || 0,
      approvalLogs: input.approvalLogs || null,
    },
  });
  
  // 更新父表单 JSON：将子表单数据替换为 ID 引用
  await updateParentPermitJson(input.parentPermitId, input.cellKey, subPermit.id);
  
  console.log(`✅ [子表单] 已创建子表单: ${subPermit.id}, 编号: ${code}`);
  
  return subPermit;
}

/**
 * 更新子表单记录
 */
export async function updateSubPermit(
  subPermitId: string,
  input: SubPermitUpdateInput
) {
  const updateData: any = {};
  
  if (input.dataJson !== undefined) {
    updateData.dataJson = typeof input.dataJson === 'string'
      ? input.dataJson
      : JSON.stringify(input.dataJson);
  }
  
  if (input.status !== undefined) {
    updateData.status = input.status;
  }
  
  if (input.currentStep !== undefined) {
    updateData.currentStep = input.currentStep;
  }
  
  if (input.approvalLogs !== undefined) {
    updateData.approvalLogs = typeof input.approvalLogs === 'string'
      ? input.approvalLogs
      : JSON.stringify(input.approvalLogs);
  }
  
  return await prisma.subPermit.update({
    where: { id: subPermitId },
    data: updateData,
  });
}

/**
 * 获取子表单记录
 */
export async function getSubPermit(subPermitId: string) {
  return await prisma.subPermit.findUnique({
    where: { id: subPermitId },
    include: {
      parentPermit: {
        include: {
          project: true,
          template: true,
        },
      },
    },
  });
}

/**
 * 获取父表单的所有子表单
 */
export async function getSubPermitsByParent(parentPermitId: string) {
  return await prisma.subPermit.findMany({
    where: { parentPermitId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * 根据单元格键获取子表单
 */
export async function getSubPermitByCellKey(
  parentPermitId: string,
  cellKey: string
) {
  return await prisma.subPermit.findFirst({
    where: {
      parentPermitId,
      cellKey,
    },
  });
}

/**
 * 删除子表单记录
 */
export async function deleteSubPermit(subPermitId: string) {
  // 获取子表单信息，用于更新父表单 JSON
  const subPermit = await prisma.subPermit.findUnique({
    where: { id: subPermitId },
    select: { parentPermitId: true, cellKey: true },
  });
  
  if (!subPermit) {
    throw new Error('子表单不存在');
  }
  
  // 删除子表单
  await prisma.subPermit.delete({
    where: { id: subPermitId },
  });
  
  // 从父表单 JSON 中移除引用
  await removeSubPermitFromParentJson(subPermit.parentPermitId, subPermit.cellKey);
  
  console.log(`✅ [子表单] 已删除子表单: ${subPermitId}`);
}

/**
 * 更新父表单 JSON：将子表单数据替换为 ID 引用
 */
async function updateParentPermitJson(
  parentPermitId: string,
  cellKey: string,
  subPermitId: string
) {
  const parentPermit = await prisma.workPermitRecord.findUnique({
    where: { id: parentPermitId },
    select: { dataJson: true },
  });
  
  if (!parentPermit) {
    throw new Error('父表单不存在');
  }
  
  try {
    let dataJson: any = JSON.parse(parentPermit.dataJson);
    
    // 处理数组格式（Excel grid 格式）
    if (Array.isArray(dataJson) && dataJson.length > 0) {
      const sheet = dataJson[0];
      if (sheet?.celldata) {
        // 查找并更新单元格
        const cellIndex = sheet.celldata.findIndex(
          (cell: any) => {
            const key = `R${cell.r}C${cell.c}`;
            return key === cellKey;
          }
        );
        
        if (cellIndex > -1) {
          // 替换为引用格式：{ _subPermitId: "xxx" }
          sheet.celldata[cellIndex].v = {
            v: `[子表单:${subPermitId}]`,
            m: `[子表单:${subPermitId}]`,
            _subPermitId: subPermitId,
          };
        }
      }
    } else if (typeof dataJson === 'object' && dataJson !== null) {
      // 对象格式：直接替换
      if (dataJson[cellKey]) {
        dataJson[cellKey] = {
          _subPermitId: subPermitId,
          _display: `[子表单:${subPermitId}]`,
        };
      }
    }
    
    // 保存更新后的 JSON
    await prisma.workPermitRecord.update({
      where: { id: parentPermitId },
      data: { dataJson: JSON.stringify(dataJson) },
    });
    
    console.log(`✅ [子表单] 已更新父表单 JSON，单元格 ${cellKey} 引用子表单 ${subPermitId}`);
  } catch (error) {
    console.error('[子表单] 更新父表单 JSON 失败:', error);
    throw error;
  }
}

/**
 * 从父表单 JSON 中移除子表单引用
 */
async function removeSubPermitFromParentJson(
  parentPermitId: string,
  cellKey: string
) {
  const parentPermit = await prisma.workPermitRecord.findUnique({
    where: { id: parentPermitId },
    select: { dataJson: true },
  });
  
  if (!parentPermit) {
    return;
  }
  
  try {
    let dataJson: any = JSON.parse(parentPermit.dataJson);
    
    // 处理数组格式
    if (Array.isArray(dataJson) && dataJson.length > 0) {
      const sheet = dataJson[0];
      if (sheet?.celldata) {
        const cellIndex = sheet.celldata.findIndex(
          (cell: any) => {
            const key = `R${cell.r}C${cell.c}`;
            return key === cellKey;
          }
        );
        
        if (cellIndex > -1) {
          // 清空单元格
          sheet.celldata[cellIndex].v = {
            v: '',
            m: '',
          };
        }
      }
    } else if (typeof dataJson === 'object' && dataJson !== null) {
      // 对象格式：清空
      if (dataJson[cellKey]) {
        dataJson[cellKey] = '';
      }
    }
    
    // 保存更新后的 JSON
    await prisma.workPermitRecord.update({
      where: { id: parentPermitId },
      data: { dataJson: JSON.stringify(dataJson) },
    });
    
    console.log(`✅ [子表单] 已从父表单 JSON 中移除单元格 ${cellKey} 的引用`);
  } catch (error) {
    console.error('[子表单] 移除父表单 JSON 引用失败:', error);
  }
}

/**
 * 从父表单 JSON 中提取子表单数据（迁移现有数据用）
 */
export async function extractSubPermitsFromParent(parentPermitId: string) {
  const parentPermit = await prisma.workPermitRecord.findUnique({
    where: { id: parentPermitId },
    include: { template: true },
  });
  
  if (!parentPermit) {
    throw new Error('父表单不存在');
  }
  
  // 解析 sectionBindings 获取绑定的单元格
  let sectionBindings: Record<string, any> = {};
  try {
    if (parentPermit.template.sectionBindings) {
      sectionBindings = JSON.parse(parentPermit.template.sectionBindings);
    }
  } catch (e) {
    console.warn('[子表单] 解析 sectionBindings 失败:', e);
  }
  
  const extracted: string[] = [];
  
  // 解析父表单 JSON
  let dataJson: any = {};
  try {
    dataJson = JSON.parse(parentPermit.dataJson);
    
    // 处理数组格式
    if (Array.isArray(dataJson) && dataJson.length > 0) {
      const sheet = dataJson[0];
      if (sheet?.celldata) {
        const cellMap: Record<string, any> = {};
        sheet.celldata.forEach((cell: any) => {
          if (cell.r !== undefined && cell.c !== undefined) {
            const key = `R${cell.r}C${cell.c}`;
            cellMap[key] = cell.v?.v || cell.v?.m || cell.v || '';
          }
        });
        dataJson = cellMap;
      }
    }
  } catch (e) {
    console.error('[子表单] 解析父表单 JSON 失败:', e);
    return extracted;
  }
  
  // 遍历 sectionBindings，提取子表单数据
  for (const [cellKey, binding] of Object.entries(sectionBindings)) {
    if (binding.templateId && dataJson[cellKey]) {
      const subData = dataJson[cellKey];
      
      // 检查是否已经是引用格式
      if (typeof subData === 'object' && subData._subPermitId) {
        console.log(`[子表单] 单元格 ${cellKey} 已经是引用格式，跳过`);
        continue;
      }
      
      // 创建子表单
      try {
        const subPermit = await createSubPermit({
          parentPermitId,
          templateId: binding.templateId,
          cellKey,
          fieldName: binding.fieldName,
          dataJson: typeof subData === 'string' ? subData : JSON.stringify(subData),
        });
        
        extracted.push(subPermit.id);
        console.log(`✅ [子表单] 已从父表单提取子表单: ${subPermit.id}`);
      } catch (error) {
        console.error(`[子表单] 提取单元格 ${cellKey} 失败:`, error);
      }
    }
  }
  
  return extracted;
}

