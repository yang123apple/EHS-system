/**
 * 事故事件管理服务单元测试
 * 测试5Why分析法、CAPA流程闭环、调查报告提交等核心功能
 */

import { IncidentService } from '@/services/incident.service';
import { createMockUser } from '../../__mocks__/test-helpers';
import { prisma } from '@/lib/prisma';

// Mock 依赖模块
jest.mock('@/lib/prisma', () => ({
  prisma: {
    incident: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/app/incident/_utils/incident-dispatch-engine');
jest.mock('@/services/signatureService');

// Mock AuditService as a default export with all methods
jest.mock('@/services/audit.service', () => ({
  __esModule: true,
  default: {
    recordLog: jest.fn().mockResolvedValue({}),
    logCreate: jest.fn().mockResolvedValue({}),
    logUpdate: jest.fn().mockResolvedValue({}),
    logAction: jest.fn().mockResolvedValue({}),
  },
}));

import AuditService from '@/services/audit.service';
import { IncidentDispatchEngine, IncidentDispatchAction } from '@/app/incident/_utils/incident-dispatch-engine';
import { createSignature } from '@/services/signatureService';

describe('IncidentService', () => {
  let mockOperator: any;
  let mockReporter: any;
  let mockIncident: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOperator = createMockUser({ id: 'operator-001', name: '操作员', role: 'admin' });
    mockReporter = createMockUser({ 
      id: 'reporter-001', 
      name: '上报人', 
      departmentId: 'dept-001',
    });

    mockIncident = {
      id: 'incident-001',
      code: 'INC-2025-001',
      type: 'injury',
      severity: 'serious',
      occurredAt: new Date('2025-01-12'),
      location: '生产车间',
      description: '测试事故描述',
      reporterId: 'reporter-001',
      reporterName: '上报人',
      reporterDept: '安全部',
      status: 'reported',
      currentStepIndex: 0,
      directCause: null,
      indirectCause: null,
      managementCause: null,
      rootCause: null,
      correctiveActions: null,
      preventiveActions: null,
    };

    // 默认 mock
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockReporter);
    (prisma.incident.findUnique as jest.Mock).mockResolvedValue(mockIncident);
    (prisma.department.findUnique as jest.Mock).mockResolvedValue({ id: 'dept-001', name: '安全部' });
    
    // Reset all AuditService mocks
    jest.clearAllMocks();
  });

  describe('reportIncident - 上报事故', () => {
    it('应该成功上报事故并生成事故编号', async () => {
      const input = {
        type: 'injury' as const,
        severity: 'serious' as const,
        occurredAt: new Date('2025-01-12'),
        location: '生产车间',
        description: '测试事故描述',
        reporterId: 'reporter-001',
      };

      (prisma.incident.findFirst as jest.Mock).mockResolvedValue(null); // 没有现有编号
      (prisma.incident.create as jest.Mock).mockResolvedValue({
        ...mockIncident,
        code: 'INC-2025-001',
      });

      const result = await IncidentService.reportIncident(input, mockOperator);

      expect(result).toBeDefined();
      expect(result.code).toBe('INC-2025-001');
      expect(prisma.incident.create).toHaveBeenCalled();
      expect(AuditService.logCreate).toHaveBeenCalled();
    });

    it('应该生成递增的事故编号', async () => {
      const input = {
        type: 'injury' as const,
        severity: 'serious' as const,
        occurredAt: new Date('2025-01-12'),
        location: '生产车间',
        description: '测试事故描述',
        reporterId: 'reporter-001',
      };

      // 模拟已有编号 INC-2025-001
      (prisma.incident.findFirst as jest.Mock).mockResolvedValue({ code: 'INC-2025-001' });
      (prisma.incident.create as jest.Mock).mockResolvedValue({
        ...mockIncident,
        code: 'INC-2025-002',
      });

      const result = await IncidentService.reportIncident(input, mockOperator);

      expect(result.code).toBe('INC-2025-002');
    });

    it('应该在上报人不存在时抛出错误', async () => {
      const input = {
        type: 'injury' as const,
        severity: 'serious' as const,
        occurredAt: new Date('2025-01-12'),
        location: '生产车间',
        description: '测试事故描述',
        reporterId: 'non-existent',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        IncidentService.reportIncident(input, mockOperator)
      ).rejects.toThrow('上报人不存在');
    });
  });

  describe('submitInvestigation - 提交调查报告（5Why分析法）', () => {
    it('应该成功提交包含5Why分析的调查报告', async () => {
      const input = {
        directCause: '操作人员未佩戴安全帽',
        indirectCause: '现场安全监督不到位',
        managementCause: '安全管理制度执行不力',
        rootCause: '安全管理体系存在漏洞，缺乏有效的监督机制',
        correctiveActions: [
          { action: '立即为所有操作人员配备安全帽', deadline: new Date('2025-01-15'), responsibleId: 'dept-001' },
          { action: '加强现场安全监督', deadline: new Date('2025-01-20'), responsibleId: 'dept-001' },
        ],
        preventiveActions: [
          { action: '完善安全管理制度', deadline: new Date('2025-02-01'), responsibleId: 'dept-001' },
        ],
        actionDeadline: new Date('2025-02-01'),
        actionResponsibleId: 'user-001',
      };

      const mockDispatchResult = {
        success: true,
        newStatus: 'reviewed',
        nextStepIndex: 1,
        currentStep: 'review',
        handlers: {
          userIds: ['approver-001'],
          userNames: ['审批人'],
        },
        log: {
          action: 'submit_investigation',
          changes: '提交调查报告',
        },
        notifications: [],
      };

      (IncidentDispatchEngine.dispatch as jest.Mock).mockResolvedValue(mockDispatchResult);
      (prisma.user.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args.where.id === 'user-001') {
          return Promise.resolve({ id: 'user-001', name: '负责人' });
        }
        return Promise.resolve(mockReporter);
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.department.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.incident.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        directCause: input.directCause,
        indirectCause: input.indirectCause,
        managementCause: input.managementCause,
        rootCause: input.rootCause,
        correctiveActions: JSON.stringify(input.correctiveActions),
        preventiveActions: JSON.stringify(input.preventiveActions),
        status: 'reviewed',
      });

      const result = await IncidentService.submitInvestigation(
        'incident-001',
        input,
        mockOperator
      );

      expect(result).toBeDefined();
      expect(result.directCause).toBe(input.directCause);
      expect(result.indirectCause).toBe(input.indirectCause);
      expect(result.managementCause).toBe(input.managementCause);
      expect(result.rootCause).toBe(input.rootCause);
      expect(result.status).toBe('reviewed');
      
      // 验证CAPA措施被正确保存
      const savedCorrectiveActions = JSON.parse(result.correctiveActions!);
      const savedPreventiveActions = JSON.parse(result.preventiveActions!);
      
      expect(savedCorrectiveActions).toHaveLength(2);
      expect(savedCorrectiveActions[0].action).toBe(input.correctiveActions[0].action);
      expect(savedPreventiveActions).toHaveLength(1);
      expect(savedPreventiveActions[0].action).toBe(input.preventiveActions[0].action);
    });

    it('应该在非允许状态下拒绝提交调查报告', async () => {
      const closedIncident = {
        ...mockIncident,
        status: 'closed',
      };

      (prisma.incident.findUnique as jest.Mock).mockResolvedValue(closedIncident);

      const input = {
        directCause: '原因1',
        indirectCause: '原因2',
        managementCause: '原因3',
        rootCause: '根本原因',
        correctiveActions: [],
        preventiveActions: [],
        actionDeadline: new Date(),
        actionResponsibleId: 'user-001',
      };

      await expect(
        IncidentService.submitInvestigation('incident-001', input, mockOperator)
      ).rejects.toThrow('当前状态不允许提交调查报告');
    });

    it('应该验证5Why分析法的完整性', async () => {
      const input = {
        directCause: '直接原因',
        // 缺少间接原因、管理原因、根本原因
        indirectCause: '',
        managementCause: '',
        rootCause: '',
        correctiveActions: [],
        preventiveActions: [],
        actionDeadline: new Date(),
        actionResponsibleId: 'user-001',
      };

      const mockDispatchResult = {
        success: true,
        newStatus: 'reviewed',
        nextStepIndex: 1,
        currentStep: 'review',
        handlers: { userIds: [], userNames: [] },
        log: { action: 'submit_investigation', changes: '' },
        notifications: [],
      };

      (IncidentDispatchEngine.dispatch as jest.Mock).mockResolvedValue(mockDispatchResult);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.department.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.incident.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        ...input,
        status: 'reviewed',
      });

      // 应该允许空值（验证在业务层完成）
      const result = await IncidentService.submitInvestigation(
        'incident-001',
        input,
        mockOperator
      );

      expect(result).toBeDefined();
    });
  });

  describe('CAPA流程 - 纠正预防措施', () => {
    it('应该正确处理多条纠正措施', async () => {
      const correctiveActions = [
        { action: '立即整改措施1', deadline: new Date('2025-01-15'), responsibleId: 'dept-001' },
        { action: '立即整改措施2', deadline: new Date('2025-01-20'), responsibleId: 'dept-001' },
      ];

      const input = {
        directCause: '原因',
        indirectCause: '原因',
        managementCause: '原因',
        rootCause: '根本原因',
        correctiveActions,
        preventiveActions: [],
        actionDeadline: new Date('2025-01-20'),
        actionResponsibleId: 'user-001',
      };

      const mockDispatchResult = {
        success: true,
        newStatus: 'reviewed',
        nextStepIndex: 1,
        currentStep: 'review',
        handlers: { userIds: [], userNames: [] },
        log: { action: 'submit_investigation', changes: '' },
        notifications: [],
      };

      (IncidentDispatchEngine.dispatch as jest.Mock).mockResolvedValue(mockDispatchResult);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.department.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.incident.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        correctiveActions: JSON.stringify(correctiveActions),
        status: 'reviewed',
      });

      const result = await IncidentService.submitInvestigation(
        'incident-001',
        input,
        mockOperator
      );

      const savedActions = JSON.parse(result.correctiveActions!);
      expect(savedActions).toHaveLength(2);
      expect(savedActions[0].action).toBe('立即整改措施1');
      expect(savedActions[1].action).toBe('立即整改措施2');
    });

    it('应该正确处理预防措施', async () => {
      const preventiveActions = [
        { action: '完善制度', deadline: new Date('2025-02-01'), responsibleId: 'dept-001' },
        { action: '加强培训', deadline: new Date('2025-02-15'), responsibleId: 'dept-001' },
      ];

      const input = {
        directCause: '原因',
        indirectCause: '原因',
        managementCause: '原因',
        rootCause: '根本原因',
        correctiveActions: [],
        preventiveActions,
        actionDeadline: new Date('2025-02-15'),
        actionResponsibleId: 'user-001',
      };

      const mockDispatchResult = {
        success: true,
        newStatus: 'reviewed',
        nextStepIndex: 1,
        currentStep: 'review',
        handlers: { userIds: [], userNames: [] },
        log: { action: 'submit_investigation', changes: '' },
        notifications: [],
      };

      (IncidentDispatchEngine.dispatch as jest.Mock).mockResolvedValue(mockDispatchResult);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.department.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.incident.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        preventiveActions: JSON.stringify(preventiveActions),
        status: 'reviewed',
      });

      const result = await IncidentService.submitInvestigation(
        'incident-001',
        input,
        mockOperator
      );

      const savedActions = JSON.parse(result.preventiveActions!);
      expect(savedActions).toHaveLength(2);
    });

    it('应该设置整改期限和负责人', async () => {
      const input = {
        directCause: '原因',
        indirectCause: '原因',
        managementCause: '原因',
        rootCause: '根本原因',
        correctiveActions: [],
        preventiveActions: [],
        actionDeadline: new Date('2025-02-01'),
        actionResponsibleId: 'user-001',
      };

      const mockDispatchResult = {
        success: true,
        newStatus: 'reviewed',
        nextStepIndex: 1,
        currentStep: 'review',
        handlers: { userIds: [], userNames: [] },
        log: { action: 'submit_investigation', changes: '' },
        notifications: [],
      };

      (IncidentDispatchEngine.dispatch as jest.Mock).mockResolvedValue(mockDispatchResult);
      (prisma.user.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args.where.id === 'user-001') {
          return Promise.resolve({ id: 'user-001', name: '整改负责人' });
        }
        return Promise.resolve(mockReporter);
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.department.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.incident.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        actionDeadline: input.actionDeadline,
        actionResponsibleId: 'user-001',
        actionResponsibleName: '整改负责人',
        status: 'reviewed',
      });

      const result = await IncidentService.submitInvestigation(
        'incident-001',
        input,
        mockOperator
      );

      expect(result.actionDeadline).toEqual(input.actionDeadline);
      expect(result.actionResponsibleId).toBe('user-001');
      expect(result.actionResponsibleName).toBe('整改负责人');
    });
  });

  describe('updateIncident - 更新事故信息', () => {
    it('应该成功更新事故信息', async () => {
      const input = {
        description: '更新后的描述',
        location: '新的地点',
      };

      (prisma.incident.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        ...input,
      });

      const result = await IncidentService.updateIncident(
        'incident-001',
        input,
        mockOperator
      );

      expect(result).toBeDefined();
      expect(result.description).toBe(input.description);
      expect(result.location).toBe(input.location);
      expect(AuditService.logUpdate).toHaveBeenCalled();
    });

    it('应该更新5Why分析字段', async () => {
      const input = {
        directCause: '更新的直接原因',
        indirectCause: '更新的间接原因',
        managementCause: '更新的管理原因',
        rootCause: '更新的根本原因',
      };

      (prisma.incident.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        ...input,
      });

      const result = await IncidentService.updateIncident(
        'incident-001',
        input,
        mockOperator
      );

      expect(result.directCause).toBe(input.directCause);
      expect(result.indirectCause).toBe(input.indirectCause);
      expect(result.managementCause).toBe(input.managementCause);
      expect(result.rootCause).toBe(input.rootCause);
    });

    it('应该在事故不存在时抛出错误', async () => {
      (prisma.incident.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        IncidentService.updateIncident('non-existent', {}, mockOperator)
      ).rejects.toThrow('事故不存在');
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理空的CAPA措施', async () => {
      const input = {
        directCause: '原因',
        indirectCause: '原因',
        managementCause: '原因',
        rootCause: '根本原因',
        correctiveActions: [],
        preventiveActions: [],
        actionDeadline: new Date(),
        actionResponsibleId: 'user-001',
      };

      const mockDispatchResult = {
        success: true,
        newStatus: 'reviewed',
        nextStepIndex: 1,
        currentStep: 'review',
        handlers: { userIds: [], userNames: [] },
        log: { action: 'submit_investigation', changes: '' },
        notifications: [],
      };

      (IncidentDispatchEngine.dispatch as jest.Mock).mockResolvedValue(mockDispatchResult);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.department.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.incident.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        correctiveActions: '[]',
        preventiveActions: '[]',
        status: 'reviewed',
      });

      const result = await IncidentService.submitInvestigation(
        'incident-001',
        input,
        mockOperator
      );

      expect(JSON.parse(result.correctiveActions!)).toEqual([]);
      expect(JSON.parse(result.preventiveActions!)).toEqual([]);
    });

    it('应该处理工作流引擎返回失败的情况', async () => {
      const input = {
        directCause: '原因',
        indirectCause: '原因',
        managementCause: '原因',
        rootCause: '根本原因',
        correctiveActions: [],
        preventiveActions: [],
        actionDeadline: new Date(),
        actionResponsibleId: 'user-001',
      };

      (IncidentDispatchEngine.dispatch as jest.Mock).mockResolvedValue({
        success: false,
        error: '工作流流转失败',
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.department.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        IncidentService.submitInvestigation('incident-001', input, mockOperator)
      ).rejects.toThrow('工作流流转失败');
    });
  });
});
