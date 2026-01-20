import { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Printer,
  CheckCircle,
  Paperclip,
  Clock,
  XCircle,
  User,
  MessageSquare,
  Send,
  FileText,
  Calendar,
  List,
  Hash,
  AlignLeft,
  CheckSquare,
  Building2,
  Users,
} from 'lucide-react';
import { PermitRecord } from '@/types/work-permit';
import { PermitService } from '@/services/workPermitService';
import ExcelRenderer from '../ExcelRenderer';
import SectionFormModal from './SectionFormModal';
import MobileFormRenderer from '../views/MobileFormRenderer';
import PrintStyle from '../PrintStyle';
import { MobileFormConfig } from './MobileFormEditor';
// 🟢 引入工具函数
import { findDeptRecursive } from '@/utils/departmentUtils';
// 🟢 水印组件
import Watermark from '@/components/common/Watermark';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  record: PermitRecord;
  user: any;
  departments: any[];
  allUsers: any[];
  allTemplates: any[]; // 🔵 新增：用于section模板查询
  onRefresh: () => void;
  onOpenApproval: () => void;
  onViewAttachments: (files: any[]) => void;
}

export default function RecordDetailModal({
  isOpen,
  onClose,
  record,
  user,
  departments,
  allUsers,
  allTemplates,
  onRefresh,
  onOpenApproval,
  onViewAttachments,
}: Props) {
  const [replyText, setReplyText] = useState<{ [key: number]: string }>({});
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isMobile, setIsMobile] = useState(false);
  const [fullTemplate, setFullTemplate] = useState<any>(null); // 🟢 完整的模板信息
  const [showFlowModal, setShowFlowModal] = useState(false); // 🟢 流程进度弹窗状态
  
  // 🔵 V3.4 Section相关state
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [currentSectionCell, setCurrentSectionCell] = useState<{ cellKey: string; fieldName: string } | null>(null);

  // 🟢 V3.4 初始化纸张方向
  useEffect(() => {
    if (record.template?.orientation) {
      setOrientation(record.template.orientation as 'portrait' | 'landscape');
    }
  }, [record.template?.orientation]);

  // 🟢 获取完整的模板信息（包含mobileFormConfig）
  useEffect(() => {
    const fetchFullTemplate = async () => {
      try {
        // 从 allTemplates 中查找完整模板信息
        const template = allTemplates.find(t => t.id === record.template.id);
        if (template) {
          console.log('✅ 找到完整模板信息:', {
            id: template.id,
            name: template.name,
            hasMobileFormConfig: !!template.mobileFormConfig,
            mobileFormConfigLength: template.mobileFormConfig?.length,
            mobileFormConfigPreview: template.mobileFormConfig ? template.mobileFormConfig.substring(0, 100) : null
          });
          setFullTemplate(template);
        } else {
          console.warn('⚠️ 在 allTemplates 中未找到模板:', record.template.id);
          console.log('📋 allTemplates 列表:', allTemplates.map(t => ({ id: t.id, name: t.name })));
        }
      } catch (e) {
        console.error('获取完整模板失败:', e);
      }
    };
    
    if (record.template?.id) {
      fetchFullTemplate();
    }
  }, [record.template?.id, allTemplates]);

  // 🟢 检测屏幕尺寸
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 预解析模板解析字段
  const parsedFields = useMemo(() => {
    if (!record.template?.parsedFields) return [] as any[];
    try {
      return JSON.parse(record.template.parsedFields as any) as any[];
    } catch (e) {
      console.error("解析 parsedFields 失败", e);
      return [] as any[];
    }
  }, [record.template?.parsedFields, record.template?.id]);

  // 预解析表单数据，供找人策略使用
  const recordData = useMemo(() => {
    try {
      if (!record.dataJson) return {};
      
      // 🔴 方案A：多层解析，防止 dataJson 被双重字符串化
      let data = record.dataJson;
      while (typeof data === 'string') {
        data = JSON.parse(data);
      }

      // 🔴 如果是数组，利用 parsedFields 重建对象
      if (Array.isArray(data)) {
        console.warn("⚠️ 详情页：检测到数组格式，正在利用 parsedFields 重建对象");
        const obj: any = {};
        parsedFields.forEach((f, idx) => {
          if (f.cellKey && data[idx] !== undefined) {
            obj[f.cellKey] = data[idx];
          }
        });
        
        // 🟢 修复：如果原始数据是数组，但可能包含SECTION_*数据在_sheetData中
        // 检查是否有_sheetData字段（可能在其他地方）
        if (typeof record.dataJson === 'string') {
          try {
            const parsed = JSON.parse(record.dataJson);
            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
              // 提取所有SECTION_*数据
              Object.keys(parsed).forEach(key => {
                if (key.startsWith('SECTION_')) {
                  obj[key] = parsed[key];
                }
              });
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
        
        console.log("📊 [RecordDetail] 数组重建为对象后:", obj);
        return obj;
      }
      
      // 🟢 修复：确保SECTION_*数据被正确提取
      // 如果data是对象，直接使用；但需要确保所有SECTION_*键都被包含
      // 添加类型检查，确保data是对象才进行展开
      const result: any = (typeof data === 'object' && data !== null && !Array.isArray(data)) 
        ? { ...data as object } 
        : {};
      
      // 检查是否有嵌套的_sheetData结构
      if (result._sheetData && typeof result._sheetData === 'object') {
        // 合并_sheetData中的SECTION_*数据
        Object.keys(result._sheetData).forEach(key => {
          if (key.startsWith('SECTION_')) {
            result[key] = result._sheetData[key];
          }
        });
      }
      
      console.log("📊 [RecordDetail] 解析的 recordData:", result);
      console.log("📊 [RecordDetail] recordData 键列表:", Object.keys(result));
      console.log("📊 [RecordDetail] SECTION_键列表:", Object.keys(result).filter(k => k.startsWith('SECTION_')));
      console.log("📊 [RecordDetail] recordData 类型检查:", {
        isArray: Array.isArray(result),
        isObject: typeof result === 'object',
        keys: Object.keys(result).slice(0, 10)
      });
      
      return result;
    } catch (e) {
      console.error("解析 dataJson 失败", e);
      return {};
    }
  }, [record.dataJson, parsedFields]);

  // 🔵 V3.4 Section点击处理
  const handleSectionClick = (cellKey: string, fieldName: string) => {
    setCurrentSectionCell({ cellKey, fieldName });
    setSectionModalOpen(true);
  };

  // 🟢 准备移动端配置（V3.6 统一逻辑）
  const mobileFormConfigForRenderer = useMemo(() => {
    const templateToUse = fullTemplate || record.template;
    
    if (!templateToUse?.mobileFormConfig) {
      return null;
    }
    
    try {
      const config = JSON.parse(templateToUse.mobileFormConfig as string);
      
      // 🟢 兼容旧格式转换
      if (config.groups && Array.isArray(config.groups)) {
        const isOldFormat = config.groups.length > 0 && 
          config.groups[0].name !== undefined && 
          config.groups[0].title === undefined;
        
        if (isOldFormat) {
          console.log('⚠️ 检测到旧格式的 mobileFormConfig，正在转换...');
          const newGroups = config.groups.map((g: any) => {
            const fieldsInGroup = (config.fields || []).filter((f: any) => f.group === g.name && !f.hidden);
            const fieldKeys = fieldsInGroup.map((f: any) => f.id || f.cellKey || f.fieldKey);
            return {
              title: g.name,
              fieldKeys: fieldKeys
            };
          });
          
          return {
            groups: newGroups,
            fields: config.fields || [],
            title: config.title
          };
        }
        
        // 新格式，直接使用
        if (config.groups.length > 0 && config.groups[0].fieldKeys !== undefined) {
          return {
            groups: config.groups,
            fields: config.fields,
            title: config.title
          };
        }
      }
      
      console.warn('⚠️ mobileFormConfig 格式无效:', config);
      return null;
    } catch (e) {
      console.error('❌ 解析 mobileFormConfig 失败:', e);
      return null;
    }
  }, [fullTemplate, record.template]);

  // 2. 解析动态审批人
  const resolveDynamicApprovers = (stepConfig: any) => {
    console.log('🔍 [调试-流程] 动态找人解析', {
      currentStep: record.currentStep,
      stepConfig,
      parsedFields,
      recordData,
    });

    // 策略A: 固定人员
    if (stepConfig.approverStrategy === 'fixed' || !stepConfig.approverStrategy) {
      return stepConfig.approvers || [];
    }

    // 获取提交人 (发起者)
    const logs = record.approvalLogs ? JSON.parse(record.approvalLogs) : [];
    const initiatorLog = logs[0];
    const initiatorId = initiatorLog?.operatorId || initiatorLog?.userId;
    
    console.log('🔍 [调试-前端] 解析审批人时的日志:', logs);
    console.log('🔍 [调试-前端] 第一条日志:', initiatorLog);
    console.log('🔍 [调试-前端] 提取的发起人ID:', initiatorId);
    
    if (!initiatorId) {
      console.warn("⚠️ 警告：无法从日志中识别发起人 ID，导致 '部门负责人' 策略失效。");
      console.warn("⚠️ 完整日志数据:", JSON.stringify(logs, null, 2));
      return [];
    }

    // 策略B: 提交人部门负责人
    if (stepConfig.approverStrategy === 'current_dept_manager') {
      const initiator = allUsers.find((u) => String(u.id) === String(initiatorId));
      if (initiator?.departmentId) {
        const dept = findDeptRecursive(departments, initiator.departmentId);
        if (dept?.managerId) {
          const manager = allUsers.find((u) => String(u.id) === String(dept.managerId));
          if (manager) return [{ userId: manager.id, userName: manager.name }];
        }
      }
    }

    // 策略C: 指定部门负责人
    if (
      stepConfig.approverStrategy === 'specific_dept_manager' &&
      stepConfig.strategyConfig?.targetDeptId
    ) {
      const dept = findDeptRecursive(departments, stepConfig.strategyConfig.targetDeptId);
      if (dept?.managerId) {
        const manager = allUsers.find((u) => String(u.id) === String(dept.managerId));
        if (manager) return [{ userId: manager.id, userName: manager.name }];
      }
    }

    // 策略D: 指定角色 (简化版：匹配部门+职位)
    if (stepConfig.approverStrategy === 'role' && stepConfig.strategyConfig) {
      const { targetDeptId, roleName } = stepConfig.strategyConfig;
      const candidates = allUsers.filter(
        (u) =>
          String(u.departmentId) === String(targetDeptId) && u.jobTitle?.includes(roleName)
      );
      return candidates.map((u) => ({ userId: u.id, userName: u.name }));
    }

    // 策略E: 模板文本匹配 -> 路由到目标部门负责人
    if (
      stepConfig.approverStrategy === 'template_text_match' &&
      stepConfig.strategyConfig?.textMatches?.length &&
      parsedFields.length
    ) {
      const matches = stepConfig.strategyConfig.textMatches as Array<{
        fieldName: string;
        containsText: string;
        targetDeptId: string;
      }>;

      for (const match of matches) {
        const field = parsedFields.find(
          (f) =>
            (f.fieldType === 'text' || f.fieldType === 'match') &&
            (f.fieldName === match.fieldName || f.label?.includes(match.fieldName))
        );

        if (!field?.cellKey) continue;
        // 🟢 统一使用 cellKey 读取数据
        const key = field.cellKey;
        const fieldValue = String(recordData[key] ?? recordData[`${Number(key.match(/R(\d+)/)?.[1] || 1) - 1}-${Number(key.match(/C(\d+)/)?.[1] || 1) - 1}`] ?? '').trim();
        
        // 🟢 支持逗号分隔多个匹配值
        const matchValues = (match.containsText || '')
          .split(',')
          .map(v => v.trim())
          .filter(v => v.length > 0);
        
        const hit = fieldValue && (matchValues.length === 0 || matchValues.some(matchText => 
          fieldValue.includes(matchText)
        ));

        console.log('🔍 [调试-文本匹配]', {
          field: field.fieldName,
          cellKey: field.cellKey,
          value: fieldValue,
          rule: match.containsText,
          matchValues,
          hit,
        });

        if (hit) {
          const dept = findDeptRecursive(departments, match.targetDeptId);
          if (dept?.managerId) {
            const manager = allUsers.find((u) => String(u.id) === String(dept.managerId));
            if (manager) return [{ userId: manager.id, userName: manager.name }];
          }
        }
      }
    }

    // 策略F: 模板选项匹配 -> 指定人员或部门负责人
    if (
      stepConfig.approverStrategy === 'template_option_match' &&
      stepConfig.strategyConfig?.optionMatches?.length &&
      parsedFields.length
    ) {
      const matches = stepConfig.strategyConfig.optionMatches as Array<{
        fieldName: string;
        checkedValue: string;
        approverType: 'person' | 'dept_manager';
        approverUserId?: string;
        targetDeptId?: string;
      }>;

      console.log('🔍 [选项匹配] 开始匹配，配置:', {
        matchesCount: matches.length,
        matches: matches,
        parsedFieldsCount: parsedFields.length,
        optionFields: parsedFields.filter(f => f.fieldType === 'option').map(f => ({
          fieldName: f.fieldName,
          label: f.label,
          cellKey: f.cellKey
        })),
        recordDataKeys: Object.keys(recordData).slice(0, 10)
      });

      const picked: { userId: string; userName: string }[] = [];

      for (const match of matches) {
        console.log('🔍 [选项匹配] 处理匹配规则:', {
          matchFieldName: match.fieldName,
          matchCheckedValue: match.checkedValue,
          approverType: match.approverType
        });

        // 🟢 更宽松的字段匹配：支持 fieldName、label、cellKey 匹配
        const field = parsedFields.find(
          (f) => {
            if (f.fieldType !== 'option') return false;
            // 精确匹配 fieldName
            if (f.fieldName === match.fieldName) return true;
            // label 包含 fieldName
            if (f.label?.includes(match.fieldName)) return true;
            // fieldName 包含 label（反向匹配）
            if (match.fieldName && f.label && match.fieldName.includes(f.label)) return true;
            return false;
          }
        );

        if (!field) {
          console.warn('⚠️ [选项匹配] 未找到匹配的选项字段:', {
            matchFieldName: match.fieldName,
            availableOptionFields: parsedFields
              .filter(f => f.fieldType === 'option')
              .map(f => ({ fieldName: f.fieldName, label: f.label, cellKey: f.cellKey }))
          });
          continue;
        }

        if (!field.cellKey) {
          console.warn('⚠️ [选项匹配] 字段没有 cellKey:', field);
          continue;
        }
        // 🟢 统一使用 cellKey 读取数据
        const key = field.cellKey;
        // 尝试多种格式读取数据
        const rawCell = recordData[key] 
          ?? recordData[`${Number(key.match(/R(\d+)/)?.[1] || 1) - 1}-${Number(key.match(/C(\d+)/)?.[1] || 1) - 1}`]
          ?? recordData[field.cellKey.toLowerCase()]
          ?? recordData[field.cellKey.toUpperCase()];
        
        const rawValue = String(rawCell ?? '');
        const fieldValue = rawValue.trim();
        const normalized = fieldValue.replace(/\s+/g, '');

        console.log('🔍 [选项匹配] 读取字段值:', {
          cellKey: key,
          rawCell,
          rawValue,
          fieldValue,
          normalized,
          recordDataHasKey: key in recordData,
          recordDataSample: Object.keys(recordData).slice(0, 5)
        });

        // 自动识别勾选：含 √/☑/✔/✅ 即视为勾选；如果未配置 checkedValue，则任意非空也视为勾选
        const hasCheckMark = /[√☑✔✅]/.test(normalized);
        
        // 🟢 支持逗号分隔多个匹配值
        const matchValues = (match.checkedValue || '')
          .split(',')
          .map(v => v.trim())
          .filter(v => v.length > 0);
        
        const valueHit = matchValues.length > 0
          ? matchValues.some(matchValue => {
              const normalizedMatch = matchValue.replace(/\s+/g, '');
              // 更宽松的匹配：支持包含、相等、忽略大小写
              const matchLower = matchValue.toLowerCase();
              const fieldLower = fieldValue.toLowerCase();
              return fieldValue.includes(matchValue) 
                || normalized.includes(normalizedMatch)
                || fieldLower.includes(matchLower)
                || fieldValue === matchValue;
            })
          : normalized.length > 0; // 没配置值时，任意非空视为选中

        const booleanHit = rawCell === true 
          || normalized === 'true' 
          || normalized === '1' 
          || normalized === 'yes' 
          || normalized === '是'
          || normalized === 'y'
          || normalized === 'Y';

        const isChecked = hasCheckMark || valueHit || booleanHit;

        console.log('🔍 [调试-选项匹配]', {
          field: field.fieldName,
          cellKey: field.cellKey,
          rawCell,
          rawValue,
          normalized,
          matchValues,
          hasCheckMark,
          valueHit,
          booleanHit,
          isChecked,
          rule: match,
        });

        if (isChecked) {
          console.log('✅ [选项匹配] 匹配成功，查找审批人:', {
            approverType: match.approverType,
            approverUserId: match.approverUserId,
            targetDeptId: match.targetDeptId
          });

          if (match.approverType === 'person' && match.approverUserId) {
            const person = allUsers.find((u) => String(u.id) === String(match.approverUserId));
            if (person) {
              console.log('✅ [选项匹配] 找到指定人员:', person.name);
              picked.push({ userId: person.id, userName: person.name });
            } else {
              console.warn('⚠️ [选项匹配] 未找到指定人员:', match.approverUserId);
            }
          }
          if (match.approverType === 'dept_manager' && match.targetDeptId) {
            const dept = findDeptRecursive(departments, match.targetDeptId);
            if (dept?.managerId) {
              const manager = allUsers.find((u) => String(u.id) === String(dept.managerId));
              if (manager) {
                console.log('✅ [选项匹配] 找到部门负责人:', manager.name);
                picked.push({ userId: manager.id, userName: manager.name });
              } else {
                console.warn('⚠️ [选项匹配] 未找到部门负责人:', dept.managerId);
              }
            } else {
              console.warn('⚠️ [选项匹配] 部门没有负责人:', match.targetDeptId);
            }
          }
        } else {
          console.log('❌ [选项匹配] 匹配失败，字段未选中');
        }
      }

      console.log('🔍 [选项匹配] 最终结果:', {
        pickedCount: picked.length,
        picked: picked
      });

      // 去重
      if (picked.length) {
        const dedup = Array.from(new Map(picked.map((p) => [p.userId, p])).values());
        console.log('✅ [选项匹配] 返回去重后的审批人:', dedup);
        return dedup;
      } else {
        console.warn('⚠️ [选项匹配] 未找到任何审批人，返回空数组');
      }
    }

    return [];
  };

  // 计算是否有审批权限
  const canApprove = useMemo(() => {
    if (record.status === 'rejected' || record.status === 'approved') return false;

    const config = record.template.workflowConfig ? JSON.parse(record.template.workflowConfig) : [];
    const currentStepConfig = config.find(
      (s: any) => s.step === record.currentStep || s.stepIndex === record.currentStep
    );
    if (!currentStepConfig) return false;

    // 获取审批模式（默认OR）
    const approvalMode = currentStepConfig.approvalMode || (record as any).approvalMode || 'OR';
    
    // 🟢 使用 candidateHandlers 检查（如果存在）
    const candidateHandlers = (record as any).candidateHandlers 
      ? (typeof (record as any).candidateHandlers === 'string' 
          ? JSON.parse((record as any).candidateHandlers) 
          : (record as any).candidateHandlers)
      : [];
    
    if (candidateHandlers.length > 0 && approvalMode) {
      // 多人模式：检查是否在候选审批人列表中
      if (approvalMode === 'OR') {
        // OR模式（或签）：任何一人操作后，其他人不能再操作
        const someoneOperated = candidateHandlers.some((h: any) => h.hasOperated);
        if (someoneOperated) {
          return false;
        }
      } else if (approvalMode === 'AND') {
        // AND模式（会签）：每个人都可以操作，但只能操作一次
        const currentUserHandler = candidateHandlers.find((h: any) => String(h.userId) === String(user?.id));
        if (currentUserHandler && currentUserHandler.hasOperated) {
          return false; // 当前用户已操作过
        }
      }
      
      // 检查当前用户是否在候选人列表中
      const isCandidate = candidateHandlers.some((h: any) => String(h.userId) === String(user?.id));
      if (isCandidate) return true;
    }
    
    // 单人模式或没有 candidateHandlers：使用旧逻辑检查日志
    const logs: any[] = record.approvalLogs ? JSON.parse(record.approvalLogs) : [];
    
    if (approvalMode === 'OR') {
      // OR模式（或签）：任何一人通过审批后，其他人不能再审批
      const stepHasApproved = logs.some(
        (log: any) =>
          (log.stepIndex === record.currentStep || log.step === record.currentStep) &&
          log.action === 'pass'
      );
      if (stepHasApproved) return false;
    } else if (approvalMode === 'AND') {
      // AND模式（会签）：检查当前用户是否已审批过
      const currentUserApproved = logs.some(
        (log: any) =>
          (log.stepIndex === record.currentStep || log.step === record.currentStep) &&
          log.action === 'pass' &&
          String(log.operatorId || log.userId) === String(user?.id)
      );
      if (currentUserApproved) return false;
    }
    // CONDITIONAL模式：正常检查当前用户是否已审批
    else {
      const currentUserApproved = logs.some(
        (log: any) =>
          (log.stepIndex === record.currentStep || log.step === record.currentStep) &&
          log.action === 'pass' &&
          String(log.operatorId || log.userId) === String(user?.id)
      );
      if (currentUserApproved) return false;
    }

    // 计算审批人名单
    const potentialApprovers = resolveDynamicApprovers(currentStepConfig);
    const isApprover = potentialApprovers.some((app: any) => String(app.userId) === String(user?.id));

    return isApprover;
  }, [record, user, departments, allUsers]);

  // 缓存解析数据
  const templateData = useMemo(() => JSON.parse(record.template.structureJson), [
    record.template.id,
  ]);

  const approvalLogs = useMemo(
    () => (record.approvalLogs ? JSON.parse(record.approvalLogs) : []),
    [record.approvalLogs]
  );

  const attachments = useMemo(
    () => (record.attachments ? JSON.parse(record.attachments) : []),
    [record.attachments]
  );

  // 🟢 从 template.watermarkSettings 获取水印配置
  const wmSettings = record.template.watermarkSettings || {
    text: '公司内部文件',
    enabled: true,
    includeUser: false,
    includeTime: false
  };

  // 回复处理函数
  const handleReply = async (logIndex: number) => {
    const content = replyText[logIndex];
    if (!content?.trim()) return;

    try {
      const logs = [...approvalLogs];
      if (!logs[logIndex]) return;

      if (!logs[logIndex].replies) logs[logIndex].replies = [];

      logs[logIndex].replies.push({
        user: user?.name || 'User',
        userId: user?.id,
        content,
        time: new Date().toLocaleString(),
      });

      await PermitService.update(record.id, {
        approvalLogs: JSON.stringify(logs),
      });

      setReplyText((prev) => ({ ...prev, [logIndex]: '' }));
      alert('回复成功');
      onRefresh();
    } catch (e) {
      alert('回复失败');
    }
  };

  // 3. 渲染流程图
  const renderFlowTimeline = () => {
    const config = record.template.workflowConfig ? JSON.parse(record.template.workflowConfig) : [];
    if (!config || config.length === 0) return null;

    const currentStep = Number(record.currentStep);
    const isRejected = record.status === 'rejected';
    const isApproved = record.status === 'approved';
    const logs = approvalLogs;

    // 🟢 移动端使用垂直布局
    if (isMobile) {
      return (
        <div className="space-y-3">
          {/* 发起节点 */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center ring-2 ring-white shadow-sm">
                <User size={16} />
              </div>
              <div className="w-0.5 h-8 bg-green-300 my-1"></div>
            </div>
            <div className="flex-1 pt-1">
              <div className="text-sm font-medium text-slate-800">发起</div>
              <div className="text-xs text-slate-500">{logs[0]?.approver || '申请人'}</div>
            </div>
          </div>

          {config.map((step: any, idx: number) => {
            let statusColor = 'bg-slate-100 text-slate-400';
            let icon = <span className="font-bold text-xs">{idx + 1}</span>;

            const stepNum = Number(step.step ?? step.stepIndex ?? -1);

            if (stepNum < currentStep || isApproved) {
              statusColor = 'bg-green-100 text-green-600';
              icon = <CheckCircle size={16} />;
            } else if (stepNum === currentStep && !isRejected && !isApproved) {
              statusColor = 'bg-blue-100 text-blue-600 border border-blue-200 animate-pulse';
              icon = <Clock size={16} />;
            } else if (stepNum === currentStep && isRejected) {
              statusColor = 'bg-red-100 text-red-600';
              icon = <XCircle size={16} />;
            }

            let approverName = '待定';
            const completedLog = logs.find(
              (log: any) =>
                (log.stepIndex === stepNum || log.step === stepNum) &&
                (log.action === 'pass' || log.action === 'reject')
            );
            if (completedLog) {
              approverName = completedLog.approver || '未知';
            } else {
              const potentialApprovers = resolveDynamicApprovers(step);
              if (potentialApprovers.length > 0) {
                approverName = potentialApprovers.map((u: any) => u.userName).join(', ');
              }
            }

            return (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusColor} ring-2 ring-white shadow-sm`}>
                    {icon}
                  </div>
                  {idx < config.length - 1 && <div className="w-0.5 h-8 bg-slate-200 my-1"></div>}
                </div>
                <div className="flex-1 pt-1">
                  <div className="text-sm font-medium text-slate-800">{step.name}</div>
                  <div className="text-xs text-slate-500">{approverName}</div>
                </div>
              </div>
            );
          })}

          {/* 结束节点 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center ring-2 ring-white shadow-sm">
              {isApproved ? <CheckCircle size={16} className="text-green-600" /> : <span className="text-slate-400 text-xs">完</span>}
            </div>
            <div className="flex-1 pt-1">
              <div className="text-sm font-medium text-slate-800">完成</div>
              <div className="text-xs text-slate-500">{isApproved ? '已归档' : '待完成'}</div>
            </div>
          </div>
        </div>
      );
    }

    // 桌面端使用水平布局
    return (
      <div className="flex items-center overflow-x-auto py-4 mb-4 px-2 border-b border-slate-200">
        {/* 发起节点 */}
        <div className="flex items-center shrink-0">
          <div className="flex flex-col items-center w-20">
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-1 ring-2 ring-white shadow-sm">
              <User size={16} />
            </div>
            <span className="text-[10px] text-slate-600 font-medium">发起</span>
            <span className="text-[9px] text-slate-400 mt-0.5 truncate w-full text-center px-1">
              {logs[0]?.approver || '申请人'}
            </span>
          </div>
          <div className="w-8 h-0.5 bg-green-300 mx-1 mb-3"></div>
        </div>

        {config.map((step: any, idx: number) => {
          let statusColor = 'bg-slate-100 text-slate-400';
          let lineColor = 'bg-slate-200';
          let icon = <span className="font-bold text-xs">{idx + 1}</span>;

          const stepNum = Number(step.step ?? step.stepIndex ?? -1);

          if (stepNum < currentStep || isApproved) {
            statusColor = 'bg-green-100 text-green-600';
            lineColor = 'bg-green-300';
            icon = <CheckCircle size={16} />;
          } else if (stepNum === currentStep && !isRejected && !isApproved) {
            statusColor = 'bg-blue-100 text-blue-600 border border-blue-200 animate-pulse';
            lineColor = 'bg-slate-200';
            icon = <Clock size={16} />;
          } else if (stepNum === currentStep && isRejected) {
            statusColor = 'bg-red-100 text-red-600';
            icon = <XCircle size={16} />;
          }

          let approverName = '待定';
          const completedLogs = logs.filter(
            (log: any) =>
              (log.stepIndex === stepNum || log.step === stepNum) &&
              (log.action === 'pass' || log.action === 'reject')
          );
          if (completedLogs.length > 0) {
            // 显示所有已审批的人（支持会签模式）
            approverName = completedLogs.map((log: any) => log.approver || '未知').join('、');
          } else {
            const potentialApprovers = resolveDynamicApprovers(step);
            if (potentialApprovers.length > 0) {
              // 获取审批模式
              const approvalMode = step.approvalMode || 'OR';
              const names = potentialApprovers.map((u: any) => u.userName).join('、');
              // 如果是会签模式，添加标识
              approverName = approvalMode === 'AND' ? `${names}（会签）` : names;
            }
          }

          return (
            <div key={idx} className="flex items-center shrink-0">
              <div className="flex flex-col items-center w-24 relative group">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${statusColor} ring-2 ring-white shadow-sm transition-all`}
                >
                  {icon}
                </div>
                <span
                  className="text-[10px] text-slate-600 text-center truncate w-full px-1 font-medium"
                  title={step.name}
                >
                  {step.name}
                </span>
                <span
                  className="text-[9px] text-slate-400 mt-0.5 truncate w-full text-center px-1"
                  title={approverName}
                >
                  {approverName}
                </span>
              </div>
              {idx < config.length - 1 && <div className={`w-8 h-0.5 mx-1 mb-3 ${lineColor}`}></div>}
            </div>
          );
        })}

        {/* 结束节点 */}
        <div className="flex items-center shrink-0">
          <div
            className={`w-8 h-0.5 mx-1 mb-3 ${
              isApproved ? 'bg-green-300' : 'bg-slate-200'
            }`}
          ></div>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
              isApproved ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-300'
            }`}
          >
            <CheckCircle size={16} />
          </div>
          <span className="text-[10px] text-slate-600">归档</span>
          <span className="text-[9px] text-transparent mt-0.5">.</span>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm print:!block print:!static print:bg-white print:!p-0 print:!m-0 ${isMobile ? 'p-0' : 'p-4'}`}>
       {/* 🟢 水印层 - 移到最外层 */}
       {wmSettings.enabled && (wmSettings.text || wmSettings.includeUser || wmSettings.includeTime) && (
         <div className="absolute inset-0 pointer-events-none watermark-layer overflow-hidden z-[100]">
           <Watermark 
             text={wmSettings.text || ''} 
             includeUser={wmSettings.includeUser}
             includeTime={wmSettings.includeTime}
             user={user}
           />
         </div>
       )}
       
       {/* 🟢 新增：打印专用样式 */}
       <PrintStyle orientation={orientation} />
       <style jsx global>{`
        @media print {
          /* 强制重置 html 和 body */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* 隐藏所有非打印元素 */
          body > *:not(:has(#print-area)) {
            display: none !important;
          }
          
          /* 强制重置所有父容器 */
          body > div {
            margin: 0 !important;
            padding: 0 !important;
            position: static !important;
            display: block !important;
          }
          
          .watermark-layer {
            z-index: 9999 !important;
            opacity: 0.15 !important; 
          }
        }
      `}</style>

      <div className={`bg-white w-full max-w-5xl flex flex-col shadow-2xl print:!block print:shadow-none print:h-auto print:w-full print:max-w-none print:!p-0 print:!m-0 ${isMobile ? 'h-full rounded-none' : 'h-[95vh] rounded-xl'}`}>
        {/* 头部操作栏 */}
        <div className={`border-b bg-slate-50 print:hidden ${isMobile ? 'p-3 flex flex-col gap-3' : 'p-4 rounded-t-xl flex justify-between items-center'}`}>
          <div className={isMobile ? 'w-full' : ''}>
            {isMobile ? (
              // 移动端：标题、状态、单号、提交时间在一行
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800 text-base">{record.template.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border shrink-0 ${
                        record.status === 'approved'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : record.status === 'rejected'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {record.status === 'approved'
                        ? '已归档'
                        : record.status === 'rejected'
                        ? '已驳回'
                        : '审批中'}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 text-right shrink-0">
                  <div>单号: {record.id}</div>
                  <div className="mt-0.5">{new Date(record.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ) : (
              // 桌面端：保持原样
              <>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                  <span>{record.template.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${
                      record.status === 'approved'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : record.status === 'rejected'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {record.status === 'approved'
                      ? '已归档'
                      : record.status === 'rejected'
                      ? '已驳回'
                      : '审批中'}
                  </span>
                </h3>
                <p className="text-slate-500 mt-1 text-xs">
                  单号: {record.id} · 提交于: {new Date(record.createdAt).toLocaleString()}
                </p>
              </>
            )}
          </div>
          <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
            {!isMobile && (
              <button
                onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
                className="p-2 rounded border transition flex items-center justify-center bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
                title={orientation === 'portrait' ? '当前：竖向纸张，点击切换为横向' : '当前：横向纸张，点击切换为竖向'}
              >
                {orientation === 'portrait' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="7" y="2" width="10" height="20" rx="1" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="10" rx="1" />
                  </svg>
                )}
              </button>
            )}
            {canApprove && (() => {
              // 双重检查：业务逻辑（canApprove）+ 系统权限（approve_permit）
              const hasApprovePermission = user?.role === 'admin' || 
                user?.permissions?.['work_permit']?.includes('approve_permit');
              
              if (!hasApprovePermission) return null;
              
              return (
                <button
                  onClick={onOpenApproval}
                  className={`bg-blue-600 text-white px-4 py-1.5 rounded font-bold shadow hover:bg-blue-700 flex items-center gap-1 ${isMobile ? 'flex-1 justify-center' : ''}`}
                >
                  <CheckCircle size={16} /> 审批
                </button>
              );
            })()}
            {attachments.length > 0 && (
              <button
                onClick={() => onViewAttachments(attachments)}
                className={`hover:bg-slate-200 rounded text-slate-600 ${isMobile ? 'flex-1 py-2 border border-slate-300' : 'p-2 rounded-full'}`}
                title="附件"
              >
                <Paperclip size={20} className={isMobile ? 'inline' : ''} />
                {isMobile && <span className="ml-1 text-sm">附件</span>}
              </button>
            )}
            {!isMobile && (
              <button
                onClick={() => window.print()}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <Printer size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className={`hover:bg-slate-200 rounded text-slate-600 ${isMobile ? 'p-2 border border-slate-300' : 'p-2 rounded-full'}`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 主内容区 */}
        <div className={`flex-1 overflow-auto bg-slate-100 print:!block print:!p-0 print:!m-0 print:bg-white print:overflow-visible custom-scrollbar ${isMobile ? 'p-3' : 'p-6'}`}>
          {/* 流程进度条（仅屏幕显示） */}
          {isMobile ? (
            // 移动端：进度按钮
            <button
              onClick={() => setShowFlowModal(true)}
              className="w-full bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3 print:hidden hover:bg-slate-50 transition flex items-center justify-between"
            >
              <span className="text-sm font-medium text-slate-800">查看流程进度</span>
              <span className="text-xs text-slate-500">当前步骤: {record.currentStep}</span>
            </button>
          ) : (
            // 桌面端：直接显示进度条
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4 print:hidden">
              <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">流程进度</h4>
              {renderFlowTimeline()}
            </div>
          )}

          {/* 表单主体 */}
          <div
            id="print-area"
            className={`mx-auto bg-white shadow-lg print:shadow-none print:!w-full print:!p-0 print:!m-0 relative print-container ${isMobile ? 'p-4 rounded-lg' : 'p-8'}`}
            style={{
              width: orientation === 'portrait' ? '210mm' : '297mm',
              minHeight: orientation === 'portrait' ? '297mm' : '210mm',
              maxWidth: '100%',
            }}
          >
            
            {/* 根据屏幕尺寸和配置决定渲染哪个视图 */}
            {(() => {
              // 🟢 修复：检查是否应该显示移动端视图（打印时强制使用桌面端样式）
              const shouldShowMobile = isMobile && mobileFormConfigForRenderer && !window.matchMedia('print').matches;
              
              console.log('🔍 [RecordDetail] 渲染决策:', {
                isMobile,
                hasMobileConfig: !!mobileFormConfigForRenderer,
                isPrinting: window.matchMedia('print').matches,
                shouldShowMobile,
                fullTemplateId: fullTemplate?.id,
                recordTemplateId: record.template?.id
              });
              
              if (shouldShowMobile) {
                console.log('✅ 使用 MobileFormRenderer 渲染移动端表单');
                return (
                  <div className="relative z-10">
                    <MobileFormRenderer
                      config={mobileFormConfigForRenderer}
                      parsedFields={parsedFields}
                      title={mobileFormConfigForRenderer.title}
                      code={record.code}
                      formData={recordData}
                      mode="readonly"
                      onSectionClick={handleSectionClick}
                    />
                  </div>
                );
              }
              
              // 否则显示桌面端视图
              console.log('📊 渲染桌面端表格视图');
              return (
                <ExcelRenderer
                  key={record.id + '_' + (approvalLogs.length || 0)}
                  templateData={templateData}
                  initialData={recordData}
                  approvalLogs={approvalLogs}
                  workflowConfig={
                    record.template.workflowConfig ? JSON.parse(record.template.workflowConfig) : []
                  }
                  parsedFields={parsedFields}
                  permitCode={record.status === 'rejected' ? undefined : record.code} // 🟢 驳回时不显示编号
                  orientation={orientation}
                  mode="view"
                  onSectionClick={handleSectionClick}
                />
              );
            })()}
          </div>

          {/* 底部留言板 UI */}
          <div className="max-w-4xl mx-auto mt-6 space-y-6 print:hidden">
            {/* 发起人附言 */}
            {approvalLogs.length > 0 && (() => {
              const initiatorLog = approvalLogs[0];
              return (
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-orange-200 text-orange-700 flex items-center justify-center text-xs font-bold">
                      {initiatorLog.approver ? initiatorLog.approver[0] : 'U'}
                    </div>
                    <span className="font-bold text-orange-800 text-sm">发起人附言</span>
                    <span className="text-xs text-orange-400 ml-auto">{initiatorLog.time}</span>
                  </div>
                  <div className="text-slate-700 text-sm pl-8">{initiatorLog.opinion || '无附言'}</div>
                </div>
              );
            })()}

            {/* 审批记录与回复 */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <MessageSquare size={18} /> 流程记录与留言{' '}
                <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {Math.max(0, approvalLogs.length - 1)} 条记录
                </span>
              </h4>
              <div className="space-y-6 relative before:absolute before:left-5 before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100">
                {approvalLogs.slice(1).map((log: any, idx: number) => {
                  const realIdx = idx + 1;
                  const isPass = log.action === 'pass';
                  const isReject = log.action === 'reject';

                  return (
                    <div key={idx} className="relative pl-12 group">
                      <div
                        className={`absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm z-10 ${
                          isPass ? 'bg-blue-500' : isReject ? 'bg-red-500' : 'bg-slate-400'
                        }`}
                      >
                        {log.approver ? log.approver.slice(-2) : '系统'}
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-bold text-slate-700 mr-2">{log.approver}</span>
                            <span className="text-xs text-slate-400">{log.stepName}</span>
                          </div>
                          <span className="text-xs text-slate-400">{log.time}</span>
                        </div>
                        
                        <div className="mb-2">
                           {/* Status Badge */}
                           <span className={`text-xs px-2 py-0.5 rounded ${isPass ? 'bg-green-100 text-green-700' : isReject ? 'bg-red-100 text-red-700' : 'bg-slate-200'}`}>
                             {isPass ? '已通过' : isReject ? '已驳回' : '处理中'}
                           </span>
                        </div>

                        <div className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-100 mb-3">
                          {log.opinion || '无审批意见'}
                        </div>

                        {/* Replies */}
                        {log.replies && log.replies.length > 0 && (
                          <div className="space-y-2 mb-3 border-t border-slate-100 pt-2">
                            {log.replies.map((reply: any, rIdx: number) => (
                              <div key={rIdx} className="flex gap-2 text-xs">
                                <span className="font-bold text-slate-600">{reply.user}:</span>
                                <span className="text-slate-500">{reply.content}</span>
                                <span className="text-slate-300 ml-auto">{reply.time}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply Input */}
                        <div className="flex gap-2">
                          <input
                            className="flex-1 bg-white border border-slate-200 rounded px-3 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors"
                            placeholder="输入回复内容..."
                            value={replyText[realIdx] || ''}
                            onChange={(e) =>
                              setReplyText({ ...replyText, [realIdx]: e.target.value })
                            }
                            onKeyDown={(e) => e.key === 'Enter' && handleReply(realIdx)}
                          />
                          <button
                            onClick={() => handleReply(realIdx)}
                            className="bg-slate-200 hover:bg-blue-600 hover:text-white text-slate-600 p-1.5 rounded transition-colors"
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {approvalLogs.length <= 1 && (
                  <div className="pl-12 text-sm text-slate-400 italic">暂无后续审批记录</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 🔵 V3.4 Section表单查看弹窗 */}
      {sectionModalOpen && currentSectionCell && (() => {
        // 🟢 修复：尝试多种方式提取sectionData
        let sectionData = recordData[`SECTION_${currentSectionCell.cellKey}`];
        
        // 如果没找到，尝试从其他可能的位置查找
        if (!sectionData) {
          // 检查是否有嵌套的_sheetData结构
          if (recordData._sheetData && typeof recordData._sheetData === 'object') {
            sectionData = recordData._sheetData[`SECTION_${currentSectionCell.cellKey}`];
          }
          
          // 检查所有以SECTION_开头的键
          const sectionKeys = Object.keys(recordData).filter(k => k.startsWith('SECTION_'));
          if (sectionKeys.length > 0) {
            console.log('🔍 [RecordDetail] 找到的SECTION键:', sectionKeys);
            // 尝试匹配cellKey
            const matchedKey = sectionKeys.find(k => k.includes(currentSectionCell.cellKey));
            if (matchedKey) {
              sectionData = recordData[matchedKey];
              console.log('✅ [RecordDetail] 通过匹配找到sectionData:', matchedKey);
            }
          }
        }
        
        // 调试日志
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 [RecordDetail] 子表单数据提取:', {
            cellKey: currentSectionCell.cellKey,
            sectionKey: `SECTION_${currentSectionCell.cellKey}`,
            hasSectionData: !!sectionData,
            sectionDataKeys: sectionData ? Object.keys(sectionData) : [],
            recordDataKeys: Object.keys(recordData).filter(k => k.startsWith('SECTION_')),
            recordDataSample: Object.keys(recordData).slice(0, 10)
          });
        }
        
        if (!sectionData) {
          console.warn('⚠️ [RecordDetail] 未找到子表单数据:', {
            cellKey: currentSectionCell.cellKey,
            sectionKey: `SECTION_${currentSectionCell.cellKey}`,
            recordDataKeys: Object.keys(recordData)
          });
          return null;
        }
        
        // 从allTemplates中查找完整的template信息
        const boundTemplate = allTemplates.find(t => t.id === sectionData.templateId) || null;
        const allowAppend = record.status === 'approved' && !!boundTemplate?.isDynamicLog;
        
        // 解析审批日志
        const approvalLogs = record.approvalLogs ? JSON.parse(record.approvalLogs) : [];
        
        // 解析流程配置
        const workflowConfig = record.template?.workflowConfig ? JSON.parse(record.template.workflowConfig) : [];
        
        return (
          <SectionFormModal
            isOpen={true}
            cellKey={currentSectionCell.cellKey}
            fieldName={currentSectionCell.fieldName}
            boundTemplate={boundTemplate}
            parentCode={record.status === 'rejected' ? '' : (record.code || '')} // 🟢 驳回时不传递编号
            parentPermitId={record.id}
            parentFormData={recordData}
            parentParsedFields={parsedFields}
            parentApprovalLogs={approvalLogs}
            parentWorkflowConfig={workflowConfig}
            existingData={sectionData}
            onSave={() => {}} // 只读模式，不需要保存
            onClose={() => {
              setSectionModalOpen(false);
              setCurrentSectionCell(null);
            }}
            readOnly={true}
            appendOnly={allowAppend}
            onAfterAppend={() => {
              // 追加成功后刷新父表单数据（保证列表/打印视图一致）
              onRefresh();
            }}
          />
        );
      })()}

      {/* 🟢 移动端流程进度弹窗 */}
      {isMobile && showFlowModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setShowFlowModal(false)}>
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                流程进度
                <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  步骤 {record.currentStep}
                </span>
              </h3>
              <button onClick={() => setShowFlowModal(false)} className="p-1 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {renderFlowTimeline()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
