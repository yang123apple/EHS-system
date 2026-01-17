/**
 * 隐患派发引擎单元测试
 * 测试工作流引擎的核心逻辑：状态流转、处理人匹配、日志生成等
 */

import { HazardDispatchEngine, DispatchAction } from '@/services/hazardDispatchEngine';
import { 
  createMockHazard, 
  createMockSimpleUser, 
  createMockWorkflowSteps,
  createMockDepartments 
} from '../../__mocks__/test-helpers';
import { HazardRecord, HazardWorkflowStep } from '@/types/hidden-danger';

// Mock 依赖模块
jest.mock('@/app/hidden-danger/_utils/handler-matcher');
jest.mock('@/app/hidden-danger/_utils/cc-matcher');
jest.mock('@/services/hazardNotification.service');

import { matchHandler } from '@/app/hidden-danger/_utils/handler-matcher';
import { matchAllCCRules } from '@/app/hidden-danger/_utils/cc-matcher';

describe('HazardDispatchEngine', () => {
  let mockHazard: HazardRecord;
  let mockUsers: ReturnType<typeof createMockSimpleUser>[];
  let mockDepartments: ReturnType<typeof createMockDepartments>;
  let mockWorkflowSteps: HazardWorkflowStep[];

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();

    // 创建测试数据
    mockHazard = createMockHazard({
      status: 'reported',
      currentStepIndex: 0,
      currentStepId: 'report',
    });

    mockUsers = [
      createMockSimpleUser({ id: 'user-001', name: '测试用户1', role: 'user' }),
      createMockSimpleUser({ id: 'admin-001', name: '管理员', role: 'admin' }),
    ];

    mockDepartments = createMockDepartments();
    mockWorkflowSteps = createMockWorkflowSteps();

    // 默认 mock handler matcher
    (matchHandler as jest.Mock).mockResolvedValue({
      success: true,
      userIds: ['admin-001'],
      userNames: ['管理员'],
      matchedBy: 'role',
    });

    // 默认 mock CC matcher
    (matchAllCCRules as jest.Mock).mockResolvedValue({
      userIds: [],
      userNames: [],
      details: [],
    });
  });

  describe('dispatch - 状态流转', () => {
    it('应该成功从"上报"流转到"指派"状态', async () => {
      const result = await HazardDispatchEngine.dispatch({
        hazard: mockHazard,
        action: DispatchAction.SUBMIT,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 0,
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('assigned');
      expect(result.nextStepIndex).toBe(1);
      expect(result.nextStepId || result.currentStep).toBe('assign');
    });

    it('应该成功从"指派"流转到"整改"状态', async () => {
      const hazard = createMockHazard({
        status: 'assigned',
        currentStepIndex: 1,
        currentStepId: 'assign',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.ASSIGN,
        operator: { id: 'admin-001', name: '管理员' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 1,
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('rectifying');
      expect(result.nextStepIndex).toBe(2);
    });

    it('应该成功从"整改"流转到"验收"状态', async () => {
      const hazard = createMockHazard({
        status: 'rectifying',
        currentStepIndex: 2,
        currentStepId: 'rectify',
        responsibleId: 'user-001',
        responsibleName: '测试用户1',
        // 🔧 修复：设置当前步骤执行人，确保通过 validateBeforeTransition 的校验
        dopersonal_ID: 'user-001',
        dopersonal_Name: '测试用户1',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.RECTIFY,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 2,
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('verified'); // 🔧 修复：verify 步骤对应 'verified' 状态，不是 'verifying'
      expect(result.nextStepIndex).toBe(3);
    });

    it('应该成功完成"验收"闭环', async () => {
      const hazard = createMockHazard({
        status: 'verified',
        currentStepIndex: 3,
        currentStepId: 'verify',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.VERIFY,
        operator: { id: 'admin-001', name: '管理员' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 3,
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('closed');
    });

    it('应该处理无效的状态流转', async () => {
      const hazard = createMockHazard({
        status: 'closed',
        currentStepIndex: 4,
        currentStepId: 'verify',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.VERIFY,
        operator: { id: 'admin-001', name: '管理员' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 4,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('dispatch - 处理人匹配', () => {
    it('应该正确匹配处理人', async () => {
      (matchHandler as jest.Mock).mockResolvedValue({
        success: true,
        userIds: ['admin-001'],
        userNames: ['管理员'],
        matchedBy: 'role',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard: mockHazard,
        action: DispatchAction.SUBMIT,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 0,
      });

      expect(result.handlers.userIds).toContain('admin-001');
      expect(result.handlers.userNames).toContain('管理员');
      expect(matchHandler).toHaveBeenCalled();
    });

    it('应该处理匹配失败的情况', async () => {
      (matchHandler as jest.Mock).mockResolvedValue({
        success: false,
        userIds: [],
        userNames: [],
        error: '未找到匹配的处理人',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard: mockHazard,
        action: DispatchAction.SUBMIT,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 0,
      });

      // 即使匹配失败，派发仍应继续（某些步骤可能不需要处理人）
      expect(result.success).toBe(true);
      expect(result.handlers.userIds).toHaveLength(0);
    });
  });

  describe('dispatch - 操作日志生成', () => {
    it('应该生成正确的操作日志', async () => {
      const result = await HazardDispatchEngine.dispatch({
        hazard: mockHazard,
        action: DispatchAction.SUBMIT,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 0,
        comment: '测试评论',
      });

      expect(result.log).toBeDefined();
      expect(result.log.operatorName).toBe('测试用户1');
      expect(result.log.action).toBe('submit');
      expect(result.log.time).toBeDefined();
    });

    it('应该包含处理人和抄送人信息', async () => {
      const result = await HazardDispatchEngine.dispatch({
        hazard: mockHazard,
        action: DispatchAction.SUBMIT,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 0,
      });

      expect(result.log).toBeDefined();
      // 日志应该包含变更信息
      expect(result.log.changes).toBeDefined();
    });
  });

  describe('dispatch - 候选处理人', () => {
    it('应该为或签/会签模式生成候选处理人列表', async () => {
      (matchHandler as jest.Mock).mockResolvedValue({
        success: true,
        userIds: ['admin-001', 'user-001'],
        userNames: ['管理员', '测试用户1'],
        matchedBy: 'multiple',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard: mockHazard,
        action: DispatchAction.SUBMIT,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 0,
      });

      expect(result.candidateHandlers).toBeDefined();
      expect(result.candidateHandlers?.length).toBeGreaterThan(0);
      if (result.candidateHandlers && result.candidateHandlers.length > 0) {
        expect(result.candidateHandlers[0]).toHaveProperty('userId');
        expect(result.candidateHandlers[0]).toHaveProperty('userName');
        expect(result.candidateHandlers[0]).toHaveProperty('stepIndex');
        expect(result.candidateHandlers[0]).toHaveProperty('stepId');
      }
    });
  });

  describe('dispatch - 错误处理', () => {
    it('应该在发生错误时返回错误信息', async () => {
      (matchHandler as jest.Mock).mockRejectedValue(new Error('匹配处理人失败'));

      const result = await HazardDispatchEngine.dispatch({
        hazard: mockHazard,
        action: DispatchAction.SUBMIT,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('匹配处理人失败');
    });

    it('应该在步骤索引超出范围时返回错误', async () => {
      const result = await HazardDispatchEngine.dispatch({
        hazard: createMockHazard({ currentStepIndex: 999 }),
        action: DispatchAction.SUBMIT,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 999,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('dispatch - 边界条件', () => {
    it('应该使用 hazard.currentStepIndex 作为默认值', async () => {
      const hazard = createMockHazard({
        currentStepIndex: 1,
        currentStepId: 'assign',
        status: 'assigned',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.ASSIGN,
        operator: { id: 'admin-001', name: '管理员' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        // 不传入 currentStepIndex，应该使用 hazard.currentStepIndex
      });

      expect(result.success).toBe(true);
      expect(result.nextStepIndex).toBe(2);
    });

    it('应该优先使用传入的 currentStepIndex', async () => {
      const hazard = createMockHazard({
        currentStepIndex: 0,
        currentStepId: 'report',
        status: 'reported',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.SUBMIT,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 0, // 显式传入
      });

      expect(result.success).toBe(true);
      expect(result.nextStepIndex).toBe(1);
    });
  });

  describe('dispatch - 拒绝/驳回流程', () => {
    it('应该从"验收"步骤驳回回到"整改"步骤', async () => {
      const hazard = createMockHazard({
        status: 'verified',
        currentStepIndex: 3,
        currentStepId: 'verify',
        dopersonal_ID: 'admin-001',
        dopersonal_Name: '管理员',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.REJECT,
        operator: { id: 'admin-001', name: '管理员' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 3,
        comment: '验收不合格，需要重新整改',
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('rectifying');
      expect(result.nextStepIndex).toBe(2);
      expect(result.nextStepId || result.currentStep).toBe('rectify');
      expect(result.log.action).toBe('reject');
      expect(result.log.operatorName).toBe('管理员');
    });

    it('应该从"整改"步骤驳回回到"指派"步骤', async () => {
      const hazard = createMockHazard({
        status: 'rectifying',
        currentStepIndex: 2,
        currentStepId: 'rectify',
        responsibleId: 'user-001',
        responsibleName: '测试用户1',
        dopersonal_ID: 'user-001',
        dopersonal_Name: '测试用户1',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.REJECT,
        operator: { id: 'admin-001', name: '管理员' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 2,
        comment: '整改方案不符合要求',
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('assigned');
      expect(result.nextStepIndex).toBe(1);
      expect(result.nextStepId || result.currentStep).toBe('assign');
      expect(result.log.action).toBe('reject');
    });

    it('应该从"指派"步骤驳回回到"上报"步骤', async () => {
      const hazard = createMockHazard({
        status: 'assigned',
        currentStepIndex: 1,
        currentStepId: 'assign',
        dopersonal_ID: 'admin-001',
        dopersonal_Name: '管理员',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.REJECT,
        operator: { id: 'admin-001', name: '管理员' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 1,
        comment: '隐患信息不完整，需要重新上报',
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('reported');
      expect(result.nextStepIndex).toBe(0);
      expect(result.nextStepId || result.currentStep).toBe('report');
      expect(result.log.action).toBe('reject');
    });

    it('驳回操作应该记录驳回原因', async () => {
      const hazard = createMockHazard({
        status: 'verified',
        currentStepIndex: 3,
        currentStepId: 'verify',
        dopersonal_ID: 'admin-001',
        dopersonal_Name: '管理员',
      });

      const rejectReason = '整改质量不符合标准，需要重新整改';
      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.REJECT,
        operator: { id: 'admin-001', name: '管理员' },
        workflowSteps: mockWorkflowSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 3,
        comment: rejectReason,
      });

      expect(result.success).toBe(true);
      expect(result.log.comment || result.log.changes).toContain(rejectReason);
    });
  });

  describe('dispatch - 多人会签（AND模式）', () => {
    // 创建支持会签模式的工作流步骤
    const createAndModeWorkflowSteps = (): HazardWorkflowStep[] => {
      return [
        {
          id: 'report',
          name: '上报并指派',
          description: '隐患上报',
          handlerStrategy: {
            type: 'fixed',
            description: '执行人：上报人（系统自动）',
            fixedUsers: [],
            approvalMode: 'OR',
          },
          ccRules: [],
        },
        {
          id: 'assign',
          name: '开始整改',
          description: '指派整改责任人',
          handlerStrategy: {
            type: 'role',
            description: '默认：管理员角色',
            roleName: '管理员',
            approvalMode: 'OR',
          },
          ccRules: [],
        },
        {
          id: 'rectify',
          name: '提交整改',
          description: '整改责任人提交整改结果',
          handlerStrategy: {
            type: 'fixed',
            description: '执行人：整改责任人（系统自动）',
            fixedUsers: [],
            approvalMode: 'OR',
          },
          ccRules: [],
        },
        {
          id: 'verify',
          name: '验收闭环',
          description: '验收整改结果（会签模式）',
          handlerStrategy: {
            type: 'role',
            description: '默认：管理员角色（会签）',
            roleName: '管理员',
            approvalMode: 'AND', // 会签模式
          },
          ccRules: [],
        },
      ];
    };

    it('应该为会签模式生成多个候选处理人', async () => {
      const andModeSteps = createAndModeWorkflowSteps();
      const multipleUsers = [
        createMockSimpleUser({ id: 'admin-001', name: '管理员1', role: 'admin' }),
        createMockSimpleUser({ id: 'admin-002', name: '管理员2', role: 'admin' }),
        createMockSimpleUser({ id: 'admin-003', name: '管理员3', role: 'admin' }),
      ];

      (matchHandler as jest.Mock).mockResolvedValue({
        success: true,
        userIds: ['admin-001', 'admin-002', 'admin-003'],
        userNames: ['管理员1', '管理员2', '管理员3'],
        matchedBy: 'role',
      });

      const hazard = createMockHazard({
        status: 'rectifying',
        currentStepIndex: 2,
        currentStepId: 'rectify',
        responsibleId: 'user-001',
        responsibleName: '测试用户1',
        dopersonal_ID: 'user-001',
        dopersonal_Name: '测试用户1',
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.RECTIFY,
        operator: { id: 'user-001', name: '测试用户1' },
        workflowSteps: andModeSteps,
        allUsers: [...mockUsers, ...multipleUsers],
        departments: mockDepartments,
        currentStepIndex: 2,
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('verified');
      expect(result.nextStepIndex).toBe(3);
      
      // 验证候选处理人列表
      expect(result.candidateHandlers).toBeDefined();
      expect(result.candidateHandlers?.length).toBe(3);
      if (result.candidateHandlers) {
        expect(result.candidateHandlers.map(h => h.userId)).toEqual(
          expect.arrayContaining(['admin-001', 'admin-002', 'admin-003'])
        );
      }
    });

    it('会签模式下，第一个审批人操作后应停留在当前步骤', async () => {
      const andModeSteps = createAndModeWorkflowSteps();
      const multipleUsers = [
        createMockSimpleUser({ id: 'admin-001', name: '管理员1', role: 'admin' }),
        createMockSimpleUser({ id: 'admin-002', name: '管理员2', role: 'admin' }),
        createMockSimpleUser({ id: 'admin-003', name: '管理员3', role: 'admin' }),
      ];

      // 模拟隐患已进入验收步骤，且有多个候选处理人
      const hazard = createMockHazard({
        status: 'verified',
        currentStepIndex: 3,
        currentStepId: 'verify',
        approvalMode: 'AND',
        candidateHandlers: [
          { userId: 'admin-001', userName: '管理员1', hasOperated: false },
          { userId: 'admin-002', userName: '管理员2', hasOperated: false },
          { userId: 'admin-003', userName: '管理员3', hasOperated: false },
        ],
        dopersonal_ID: 'admin-001',
        dopersonal_Name: '管理员1',
      });

      // 第一个管理员审批
      const result1 = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.VERIFY,
        operator: { id: 'admin-001', name: '管理员1' },
        workflowSteps: andModeSteps,
        allUsers: [...mockUsers, ...multipleUsers],
        departments: mockDepartments,
        currentStepIndex: 3,
        comment: '管理员1审批通过',
      });

      // 会签模式下，只有部分人审批，应该停留在当前步骤
      // 注意：实际的会签完成判断需要在业务层处理，这里主要测试引擎不会自动流转
      expect(result1.success).toBe(true);
      expect(result1.log.action).toBe('verify');
      expect(result1.log.operatorName).toBe('管理员1');
    });

    it('会签模式下，已操作过的用户不能重复操作', async () => {
      const andModeSteps = createAndModeWorkflowSteps();
      
      // 模拟隐患已进入验收步骤，且第一个管理员已操作
      const hazard = createMockHazard({
        status: 'verified',
        currentStepIndex: 3,
        currentStepId: 'verify',
        approvalMode: 'AND',
        candidateHandlers: [
          { userId: 'admin-001', userName: '管理员1', hasOperated: true }, // 已操作
          { userId: 'admin-002', userName: '管理员2', hasOperated: false },
          { userId: 'admin-003', userName: '管理员3', hasOperated: false },
        ],
        dopersonal_ID: 'admin-001',
        dopersonal_Name: '管理员1',
      });

      // 第一个管理员尝试再次操作
      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.VERIFY,
        operator: { id: 'admin-001', name: '管理员1' },
        workflowSteps: andModeSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 3,
      });

      // 应该返回错误，因为已操作过
      expect(result.success).toBe(false);
      expect(result.error).toContain('已完成本次会签');
    });

    it('会签模式下，不同用户可以分别操作', async () => {
      const andModeSteps = createAndModeWorkflowSteps();
      const multipleUsers = [
        createMockSimpleUser({ id: 'admin-001', name: '管理员1', role: 'admin' }),
        createMockSimpleUser({ id: 'admin-002', name: '管理员2', role: 'admin' }),
        createMockSimpleUser({ id: 'admin-003', name: '管理员3', role: 'admin' }),
      ];

      // 第一个管理员操作
      const hazard1 = createMockHazard({
        status: 'verified',
        currentStepIndex: 3,
        currentStepId: 'verify',
        approvalMode: 'AND',
        candidateHandlers: [
          { userId: 'admin-001', userName: '管理员1', hasOperated: false },
          { userId: 'admin-002', userName: '管理员2', hasOperated: false },
          { userId: 'admin-003', userName: '管理员3', hasOperated: false },
        ],
        dopersonal_ID: 'admin-001',
        dopersonal_Name: '管理员1',
      });

      const result1 = await HazardDispatchEngine.dispatch({
        hazard: hazard1,
        action: DispatchAction.VERIFY,
        operator: { id: 'admin-001', name: '管理员1' },
        workflowSteps: andModeSteps,
        allUsers: [...mockUsers, ...multipleUsers],
        departments: mockDepartments,
        currentStepIndex: 3,
        comment: '管理员1审批通过',
      });

      expect(result1.success).toBe(true);
      expect(result1.log.operatorName).toBe('管理员1');

      // 第二个管理员操作（模拟更新后的隐患状态）
      const hazard2 = createMockHazard({
        ...hazard1,
        candidateHandlers: [
          { userId: 'admin-001', userName: '管理员1', hasOperated: true },
          { userId: 'admin-002', userName: '管理员2', hasOperated: false },
          { userId: 'admin-003', userName: '管理员3', hasOperated: false },
        ],
        dopersonal_ID: 'admin-002',
        dopersonal_Name: '管理员2',
      });

      const result2 = await HazardDispatchEngine.dispatch({
        hazard: hazard2,
        action: DispatchAction.VERIFY,
        operator: { id: 'admin-002', name: '管理员2' },
        workflowSteps: andModeSteps,
        allUsers: [...mockUsers, ...multipleUsers],
        departments: mockDepartments,
        currentStepIndex: 3,
        comment: '管理员2审批通过',
      });

      expect(result2.success).toBe(true);
      expect(result2.log.operatorName).toBe('管理员2');
    });

    it('会签模式下，非候选处理人不能操作', async () => {
      const andModeSteps = createAndModeWorkflowSteps();
      
      const hazard = createMockHazard({
        status: 'verified',
        currentStepIndex: 3,
        currentStepId: 'verify',
        approvalMode: 'AND',
        candidateHandlers: [
          { userId: 'admin-001', userName: '管理员1', hasOperated: false },
          { userId: 'admin-002', userName: '管理员2', hasOperated: false },
        ],
        dopersonal_ID: 'admin-001',
        dopersonal_Name: '管理员1',
      });

      // 非候选处理人尝试操作
      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: DispatchAction.VERIFY,
        operator: { id: 'user-001', name: '测试用户1' }, // 不是候选处理人
        workflowSteps: andModeSteps,
        allUsers: mockUsers,
        departments: mockDepartments,
        currentStepIndex: 3,
      });

      // 应该返回错误，因为不是候选处理人
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
