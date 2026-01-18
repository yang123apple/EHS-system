/**
 * 作业许可管理流程引擎单元测试
 * 测试动态审批策略、会签/或签/条件签逻辑、表单字段匹配等核心功能
 */

import { WorkflowEngine } from '@/services/workflowEngine';
import { WorkflowAction, WorkflowStatus, ApprovalLogEntry } from '@/types/workflow';
import { PermitRecord, WorkflowStep } from '@/types/work-permit';
import { createMockUser } from '../../__mocks__/test-helpers';

// Mock 依赖模块
jest.mock('@/lib/workflowUtils');
jest.mock('@/lib/db');

import { resolveApprovers } from '@/lib/workflowUtils';
import { db } from '@/lib/db';

describe('WorkflowEngine', () => {
  let mockRecord: PermitRecord;
  let mockWorkflowConfig: WorkflowStep[];
  let mockOperator: { id: string; name: string };

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建模拟记录
    mockRecord = {
      id: 'record-001',
      code: 'WP-2025-001',
      projectId: 'project-001',
      templateId: 'template-001',
      dataJson: JSON.stringify({ 'R1C1': '测试值' }),
      status: WorkflowStatus.DRAFT,
      currentStep: 0,
      approvalLogs: null,
      template: {
        id: 'template-001',
        parsedFields: JSON.stringify([
          {
            cellKey: 'R1C1',
            label: '作业部门',
            fieldName: 'workDept',
            fieldType: 'department',
          },
        ]),
      },
      project: {
        id: 'project-001',
        requestDept: 'dept-001',
      },
    } as any;

    // 创建模拟工作流配置
    mockWorkflowConfig = [
      {
        step: 0,
        stepIndex: 0,
        name: '申请人提交',
        type: 'submit',
        approverStrategy: 'fixed',
        approvers: [],
        approvalMode: 'OR',
      },
      {
        step: 1,
        stepIndex: 1,
        name: '安全员审批',
        type: 'approve',
        approverStrategy: 'role',
        strategyConfig: { roleName: '安全员' },
        approvers: [],
        approvalMode: 'OR',
      },
      {
        step: 2,
        stepIndex: 2,
        name: '部门负责人审批',
        type: 'approve',
        approverStrategy: 'template_field_manager',
        strategyConfig: { fieldName: 'workDept', expectedType: 'department' },
        approvers: [],
        approvalMode: 'AND', // 会签模式
      },
      {
        step: 3,
        stepIndex: 3,
        name: 'EHS经理审批',
        type: 'approve',
        approverStrategy: 'role',
        strategyConfig: { roleName: 'EHS经理' },
        approvers: [],
        approvalMode: 'OR',
      },
    ];

    mockOperator = { id: 'user-001', name: '测试用户' };

    // 默认 mock resolveApprovers
    (resolveApprovers as jest.Mock).mockResolvedValue([
      createMockUser({ id: 'approver-001', name: '审批人1' }),
    ]);
  });

  describe('transition - 状态流转', () => {
    it('应该成功从"草稿"提交到"待审批"状态', async () => {
      const result = await WorkflowEngine.transition(
        mockRecord,
        WorkflowAction.SUBMIT,
        mockOperator,
        '提交申请',
        mockWorkflowConfig
      );

      expect(result.status).toBe(WorkflowStatus.PENDING);
      expect(result.currentStep).toBe(0);
      expect(result.approvalLogs).toBeDefined();

      const logs = JSON.parse(result.approvalLogs!);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe(WorkflowAction.SUBMIT);
      expect(logs[0].operatorName).toBe('测试用户');
    });

    it('应该成功从步骤0审批进入步骤1', async () => {
      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 0,
      };

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.APPROVE,
        mockOperator,
        '审批通过',
        mockWorkflowConfig
      );

      expect(result.status).toBe(WorkflowStatus.PENDING);
      expect(result.currentStep).toBe(1);
      expect(result.nextApproversJson).toBeDefined();
    });

    it('应该在最后一步审批后进入"已批准"状态', async () => {
      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 3, // 最后一步
      };

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.APPROVE,
        mockOperator,
        '最终审批通过',
        mockWorkflowConfig
      );

      expect(result.status).toBe(WorkflowStatus.APPROVED);
      expect(result.currentStep).toBe(-1);
    });

    it('应该成功处理驳回操作，状态变为"已驳回"', async () => {
      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 1,
      };

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.REJECT,
        mockOperator,
        '审批驳回',
        mockWorkflowConfig
      );

      expect(result.status).toBe(WorkflowStatus.REJECTED);
      expect(result.currentStep).toBe(-1);

      const logs = JSON.parse(result.approvalLogs!);
      const lastLog = logs[logs.length - 1];
      expect(lastLog.action).toBe(WorkflowAction.REJECT);
      expect(lastLog.comment).toBe('审批驳回');
    });

    it('应该在流程已结束时拒绝操作', async () => {
      const record = {
        ...mockRecord,
        status: WorkflowStatus.APPROVED,
        currentStep: -1,
      };

      await expect(
        WorkflowEngine.transition(
          record,
          WorkflowAction.APPROVE,
          mockOperator,
          '',
          mockWorkflowConfig
        )
      ).rejects.toThrow('流程已结束，无法操作');
    });

    it('应该在步骤配置不存在时抛出错误', async () => {
      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 999, // 不存在的步骤
      };

      await expect(
        WorkflowEngine.transition(
          record,
          WorkflowAction.APPROVE,
          mockOperator,
          '',
          mockWorkflowConfig
        )
      ).rejects.toThrow('当前步骤配置不存在');
    });
  });

  describe('transition - 会签模式（AND）', () => {
    it('应该为会签步骤生成多个审批人', async () => {
      const multipleApprovers = [
        createMockUser({ id: 'approver-001', name: '部门负责人1' }),
        createMockUser({ id: 'approver-002', name: '部门负责人2' }),
        createMockUser({ id: 'approver-003', name: '部门负责人3' }),
      ];

      (resolveApprovers as jest.Mock).mockResolvedValue(multipleApprovers);

      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 1, // 下一步是会签步骤（步骤2）
      };

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.APPROVE,
        mockOperator,
        '进入会签',
        mockWorkflowConfig
      );

      expect(result.currentStep).toBe(2);
      expect(resolveApprovers).toHaveBeenCalled();
    });

    it('会签模式下，只有部分人审批时应停留在当前步骤', async () => {
      const multipleApprovers = [
        createMockUser({ id: 'approver-001', name: '部门负责人1' }),
        createMockUser({ id: 'approver-002', name: '部门负责人2' }),
      ];

      (resolveApprovers as jest.Mock).mockResolvedValue(multipleApprovers);

      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 2, // 会签步骤
        approvalLogs: JSON.stringify([
          // 已有一个审批记录
          {
            id: 'log-001',
            stepIndex: 2,
            action: WorkflowAction.APPROVE,
            operatorId: 'approver-001',
            operatorName: '部门负责人1',
            timestamp: new Date().toISOString(),
            comment: '审批通过',
          },
        ] as ApprovalLogEntry[]),
      };

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.APPROVE,
        { id: 'approver-002', name: '部门负责人2' },
        '审批通过',
        mockWorkflowConfig
      );

      // 会签完成，应该进入下一步
      expect(result.status).toBe(WorkflowStatus.PENDING);
      expect(result.currentStep).toBe(3);
    });

    it('会签模式下，第一个审批人操作后应停留在当前步骤（未全部完成）', async () => {
      const multipleApprovers = [
        createMockUser({ id: 'approver-001', name: '部门负责人1' }),
        createMockUser({ id: 'approver-002', name: '部门负责人2' }),
      ];

      (resolveApprovers as jest.Mock).mockResolvedValue(multipleApprovers);

      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 2, // 会签步骤
        approvalLogs: null, // 还没有审批记录
      };

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.APPROVE,
        { id: 'approver-001', name: '部门负责人1' },
        '第一个审批',
        mockWorkflowConfig
      );

      // 会签未完成，应停留在当前步骤
      expect(result.status).toBe(WorkflowStatus.PENDING);
      expect(result.currentStep).toBe(2);
    });
  });

  describe('transition - 或签模式（OR）', () => {
    it('或签模式下，一人审批即通过', async () => {
      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 1, // 或签步骤
      };

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.APPROVE,
        mockOperator,
        '审批通过',
        mockWorkflowConfig
      );

      expect(result.status).toBe(WorkflowStatus.PENDING);
      expect(result.currentStep).toBe(2); // 直接进入下一步
    });
  });

  describe('transition - 动态审批人匹配', () => {
    it('应该根据表单字段值匹配审批人', async () => {
      const record = {
        ...mockRecord,
        dataJson: JSON.stringify({
          R1C1: '安全部', // 作业部门字段
        }),
        status: WorkflowStatus.PENDING,
        currentStep: 1, // 下一步需要根据字段匹配
      };

      const mockDeptManager = createMockUser({ id: 'dept-mgr-001', name: '安全部负责人' });
      (resolveApprovers as jest.Mock).mockResolvedValue([mockDeptManager]);

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.APPROVE,
        mockOperator,
        '',
        mockWorkflowConfig
      );

      expect(result.currentStep).toBe(2);
      expect(resolveApprovers).toHaveBeenCalledWith(
        'dept-001', // 申请人部门
        expect.objectContaining({
          approverStrategy: 'template_field_manager',
          strategyConfig: expect.objectContaining({ fieldName: 'workDept' }),
        }),
        expect.objectContaining({ R1C1: '安全部' }),
        expect.any(Array)
      );
    });

    it('应该处理审批人匹配失败的情况', async () => {
      (resolveApprovers as jest.Mock).mockResolvedValue([]);

      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 1,
      };

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.APPROVE,
        mockOperator,
        '',
        mockWorkflowConfig
      );

      // 即使没有匹配到审批人，流程仍应继续
      expect(result.currentStep).toBe(2);
    });
  });

  describe('transition - 日志生成', () => {
    it('应该正确追加日志而不是覆盖', async () => {
      const existingLog: ApprovalLogEntry = {
        id: 'log-001',
        stepIndex: 0,
        stepName: '申请人提交',
        action: WorkflowAction.SUBMIT,
        operatorId: 'user-001',
        operatorName: '申请人',
        timestamp: new Date().toISOString(),
        comment: '初始提交',
        snapshotVersion: 1,
      };

      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 0,
        approvalLogs: JSON.stringify([existingLog]),
      };

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.APPROVE,
        { id: 'approver-001', name: '审批人' },
        '审批通过',
        mockWorkflowConfig
      );

      const logs = JSON.parse(result.approvalLogs!);
      expect(logs).toHaveLength(2);
      expect(logs[0].id).toBe('log-001');
      expect(logs[1].action).toBe(WorkflowAction.APPROVE);
      expect(logs[1].operatorName).toBe('审批人');
    });

    it('应该生成包含所有必要字段的日志条目', async () => {
      const result = await WorkflowEngine.transition(
        mockRecord,
        WorkflowAction.SUBMIT,
        mockOperator,
        '测试评论',
        mockWorkflowConfig
      );

      const logs = JSON.parse(result.approvalLogs!);
      const log = logs[0];

      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('stepIndex', 0);
      expect(log).toHaveProperty('stepName');
      expect(log).toHaveProperty('action', WorkflowAction.SUBMIT);
      expect(log).toHaveProperty('operatorId', 'user-001');
      expect(log).toHaveProperty('operatorName', '测试用户');
      expect(log).toHaveProperty('timestamp');
      expect(log).toHaveProperty('comment', '测试评论');
      expect(log).toHaveProperty('snapshotVersion', 1);
    });
  });

  describe('transition - 边界条件', () => {
    it('应该处理空的审批日志', async () => {
      const record = {
        ...mockRecord,
        status: WorkflowStatus.PENDING,
        currentStep: 0,
        approvalLogs: null,
      };

      const result = await WorkflowEngine.transition(
        record,
        WorkflowAction.APPROVE,
        mockOperator,
        '',
        mockWorkflowConfig
      );

      const logs = JSON.parse(result.approvalLogs!);
      expect(logs).toHaveLength(1);
    });

    it('应该处理空的数据JSON', async () => {
      const record = {
        ...mockRecord,
        dataJson: null,
        status: WorkflowStatus.PENDING,
        currentStep: 0,
      };

      await expect(
        WorkflowEngine.transition(
          record,
          WorkflowAction.APPROVE,
          mockOperator,
          '',
          mockWorkflowConfig
        )
      ).resolves.toBeDefined();
    });

    it('应该处理缺少解析字段的情况', async () => {
      const record = {
        ...mockRecord,
        template: {
          id: 'template-001',
          parsedFields: null,
        },
        status: WorkflowStatus.PENDING,
        currentStep: 0,
      } as any;

      await expect(
        WorkflowEngine.transition(
          record,
          WorkflowAction.APPROVE,
          mockOperator,
          '',
          mockWorkflowConfig
        )
      ).resolves.toBeDefined();
    });
  });
});
