/**
 * EHS 系统审计日志类型定义
 * 
 * 本文件定义了整个审计系统的 TypeScript 类型，确保日志记录的类型安全
 */

// ============ 模块枚举 ============
export enum LogModule {
  /** 隐患管理系统 */
  HAZARD = 'HAZARD',
  /** 作业许可证系统 */
  WORK_PERMIT = 'WORK_PERMIT',
  /** 培训管理系统 */
  TRAINING = 'TRAINING',
  /** 文档管理系统 */
  DOCUMENT = 'DOCUMENT',
  /** 用户管理 */
  USER = 'USER',
  /** 认证授权（登录/登出） */
  AUTH = 'AUTH',
  /** 组织架构管理 */
  ORGANIZATION = 'ORGANIZATION',
  /** 系统设置 */
  SYSTEM = 'SYSTEM',
  /** 通知中心 */
  NOTIFICATION = 'NOTIFICATION',
  /** 档案库管理 */
  ARCHIVE = 'ARCHIVE',
}

// ============ 操作类型枚举 ============
export enum LogAction {
  /** 创建 */
  CREATE = 'CREATE',
  /** 更新 */
  UPDATE = 'UPDATE',
  /** 删除 */
  DELETE = 'DELETE',
  /** 审批通过 */
  APPROVE = 'APPROVE',
  /** 审批驳回 */
  REJECT = 'REJECT',
  /** 提交 */
  SUBMIT = 'SUBMIT',
  /** 分配 */
  ASSIGN = 'ASSIGN',
  /** 导出 */
  EXPORT = 'EXPORT',
  /** 导入 */
  IMPORT = 'IMPORT',
  /** 登录 */
  LOGIN = 'LOGIN',
  /** 登出 */
  LOGOUT = 'LOGOUT',
  /** 查看 */
  VIEW = 'VIEW',
  /** 下载 */
  DOWNLOAD = 'DOWNLOAD',
  /** 上传 */
  UPLOAD = 'UPLOAD',
  /** 配置 */
  CONFIG = 'CONFIG',
  /** 归档 */
  ARCHIVE = 'ARCHIVE',
  /** 恢复 */
  RESTORE = 'RESTORE',
}

// ============ 业务角色枚举 ============
export enum BusinessRole {
  /** 上报人 */
  REPORTER = 'REPORTER',
  /** 整改人 */
  RECTIFIER = 'RECTIFIER',
  /** 验收人 */
  VERIFIER = 'VERIFIER',
  /** 审批人 */
  APPROVER = 'APPROVER',
  /** 抄送人 */
  CC_RECEIVER = 'CC_RECEIVER',
  /** 培训发布者 */
  TRAINER = 'TRAINER',
  /** 培训学员 */
  TRAINEE = 'TRAINEE',
  /** 系统管理员 */
  ADMIN = 'ADMIN',
  /** 作业申请人 */
  APPLICANT = 'APPLICANT',
  /** 作业负责人 */
  WORK_LEADER = 'WORK_LEADER',
  /** 安全监护人 */
  SAFETY_SUPERVISOR = 'SAFETY_SUPERVISOR',
}

// ============ 业务编码常量 ============
/**
 * 业务编码注册表
 * 
 * 格式：{MODULE}_{ACTION}_{SERIAL}
 * 例如：HD_CRT_001 表示 隐患(Hazard)_创建(Create)_序号001
 */
export const BusinessActionRegistry = {
  // ========== 隐患管理 ==========
  HAZARD: {
    CREATE: 'HD_CRT_001',              // 创建隐患
    UPDATE: 'HD_UPD_002',              // 更新隐患信息
    DELETE: 'HD_DEL_003',              // 删除隐患
    ASSIGN: 'HD_ASG_004',              // 分配整改责任人
    SUBMIT_RECTIFY: 'HD_RCT_005',      // 提交整改
    VERIFY_PASS: 'HD_VFY_006',         // 验收通过
    VERIFY_REJECT: 'HD_VRJ_007',       // 验收驳回
    EXPORT: 'HD_EXP_008',              // 导出隐患数据
    IMPORT: 'HD_IMP_009',              // 导入隐患数据
    ARCHIVE: 'HD_ARC_010',             // 归档隐患
    UPDATE_RISK_LEVEL: 'HD_URL_011',   // 更新风险等级
    ADD_PHOTO: 'HD_APH_012',           // 添加照片
    UPDATE_DEADLINE: 'HD_UDL_013',     // 更新整改期限
  },
  
  // ========== 作业许可证 ==========
  WORK_PERMIT: {
    CREATE: 'WP_CRT_001',              // 创建作业票
    UPDATE: 'WP_UPD_002',              // 更新作业票
    DELETE: 'WP_DEL_003',              // 删除作业票
    SUBMIT: 'WP_SBM_004',              // 提交审批
    APPROVE: 'WP_APV_005',             // 审批通过
    REJECT: 'WP_RJT_006',              // 审批驳回
    CLOSE: 'WP_CLS_007',               // 关闭作业票
    EXPORT: 'WP_EXP_008',              // 导出作业票
    PRINT: 'WP_PRT_009',               // 打印作业票
    UPDATE_TEMPLATE: 'WP_UTM_010',     // 更新模板
    CONFIG_WORKFLOW: 'WP_CFW_011',     // 配置工作流
  },
  
  // ========== 培训管理 ==========
  TRAINING: {
    CREATE_MATERIAL: 'TR_CTM_001',     // 创建培训材料
    UPDATE_MATERIAL: 'TR_UTM_002',     // 更新培训材料
    DELETE_MATERIAL: 'TR_DTM_003',     // 删除培训材料
    CREATE_TASK: 'TR_CTK_004',         // 创建培训任务
    UPDATE_TASK: 'TR_UTK_005',         // 更新培训任务
    DELETE_TASK: 'TR_DTK_006',         // 删除培训任务
    ASSIGN_TASK: 'TR_ATK_007',         // 分配培训任务
    COMPLETE_TASK: 'TR_CPL_008',       // 完成培训
    PASS_EXAM: 'TR_EXP_009',           // 考试通过
    FAIL_EXAM: 'TR_EXF_010',           // 考试失败
    EXPORT_RECORD: 'TR_EXR_011',       // 导出培训记录
  },
  
  // ========== 文档管理 ==========
  DOCUMENT: {
    CREATE: 'DOC_CRT_001',             // 创建文档
    UPDATE: 'DOC_UPD_002',             // 更新文档
    DELETE: 'DOC_DEL_003',             // 删除文档
    UPLOAD: 'DOC_UPL_004',             // 上传文档
    DOWNLOAD: 'DOC_DWN_005',           // 下载文档
    MOVE: 'DOC_MOV_006',               // 移动文档
    VERSION_CONTROL: 'DOC_VER_007',    // 版本控制
    EXPORT: 'DOC_EXP_008',             // 导出文档树
  },
  
  // ========== 用户管理 ==========
  USER: {
    CREATE: 'USR_CRT_001',             // 创建用户
    UPDATE: 'USR_UPD_002',             // 更新用户信息
    DELETE: 'USR_DEL_003',             // 删除用户
    LOGIN: 'USR_LGN_004',              // 用户登录
    LOGOUT: 'USR_LGO_005',             // 用户登出
    CHANGE_PASSWORD: 'USR_CPW_006',    // 修改密码
    RESET_PASSWORD: 'USR_RPW_007',     // 重置密码
    UPDATE_ROLE: 'USR_URL_008',        // 更新角色
    UPDATE_DEPT: 'USR_UDT_009',        // 更新部门
    EXPORT: 'USR_EXP_010',             // 导出用户
    IMPORT: 'USR_IMP_011',             // 导入用户
  },
  
  // ========== 组织架构 ==========
  ORGANIZATION: {
    CREATE_DEPT: 'ORG_CRT_001',        // 创建部门
    UPDATE_DEPT: 'ORG_UPD_002',        // 更新部门
    DELETE_DEPT: 'ORG_DEL_003',        // 删除部门
    MOVE_DEPT: 'ORG_MOV_004',          // 移动部门
    ASSIGN_MANAGER: 'ORG_ASM_005',     // 分配部门负责人
    EXPORT: 'ORG_EXP_006',             // 导出组织架构
    IMPORT: 'ORG_IMP_007',             // 导入组织架构
  },
  
  // ========== 系统设置 ==========
  SYSTEM: {
    UPDATE_CONFIG: 'SYS_CFG_001',      // 更新系统配置
    UPDATE_WORKFLOW: 'SYS_WFL_002',    // 更新工作流配置
    BACKUP: 'SYS_BKP_003',             // 数据备份
    RESTORE: 'SYS_RST_004',            // 数据恢复
    CLEAR_CACHE: 'SYS_CCH_005',        // 清除缓存
    UPDATE_TEMPLATE: 'SYS_UTM_006',    // 更新模板
    ENABLE_FEATURE: 'SYS_EFT_007',     // 启用功能
    DISABLE_FEATURE: 'SYS_DFT_008',    // 禁用功能
  },
  
  // ========== 通知中心 ==========
  NOTIFICATION: {
    SEND: 'NTF_SND_001',               // 发送通知
    READ: 'NTF_RED_002',               // 已读通知
    DELETE: 'NTF_DEL_003',             // 删除通知
    BATCH_SEND: 'NTF_BSN_004',         // 批量发送
    UPDATE_TEMPLATE: 'NTF_UTM_005',    // 更新通知模板
  },
  
  // ========== 档案库管理 ==========
  ARCHIVE: {
    UPLOAD_ENTERPRISE: 'ARC_UPE_001',  // 上传企业档案
    UPLOAD_EQUIPMENT: 'ARC_UPD_002',    // 上传设备档案
    UPLOAD_PERSONNEL: 'ARC_UPP_003',    // 上传人员档案
    DELETE_FILE: 'ARC_DEL_004',         // 删除档案文件
    CREATE_EQUIPMENT: 'ARC_CRT_005',    // 创建设备
    UPDATE_EQUIPMENT: 'ARC_UPD_006',    // 更新设备信息
    UPDATE_CONFIG: 'ARC_CFG_007',       // 更新档案配置
    VIEW_FILE: 'ARC_VEW_008',           // 查看档案文件
    DOWNLOAD_FILE: 'ARC_DWN_009',       // 下载档案文件
  },
} as const;

// ============ 辅助类型 ============
/**
 * 获取业务编码的辅助类型
 */
export type BusinessCode = typeof BusinessActionRegistry[keyof typeof BusinessActionRegistry][keyof typeof BusinessActionRegistry[keyof typeof BusinessActionRegistry]];

/**
 * 客户端环境信息
 */
export interface ClientInfo {
  /** IP 地址 */
  ip?: string;
  /** 浏览器 User Agent */
  userAgent?: string;
  /** 设备类型 (mobile, tablet, desktop) */
  device?: string;
  /** 浏览器名称和版本 */
  browser?: string;
  /** 操作系统 */
  os?: string;
  /** 地理位置（可选） */
  location?: string;
}

/**
 * 字段差异对象
 */
export interface FieldDiff {
  /** 修改前的值 */
  old: any;
  /** 修改后的值 */
  new: any;
}

/**
 * 差异对比结果
 */
export type DiffResult = Record<string, FieldDiff>;

/**
 * 操作人信息
 */
export interface OperatorInfo {
  /** 用户ID */
  id: string;
  /** 用户姓名 */
  name: string;
  /** 用户角色 */
  role: string;
  /** 部门ID */
  departmentId?: string;
  /** 部门名称 */
  departmentName?: string;
  /** 职位 */
  jobTitle?: string;
}

/**
 * 日志记录参数接口
 */
export interface LogRecordParams {
  /** 所属模块 */
  module: LogModule;
  /** 操作类型 */
  action: LogAction;
  /** 业务编码（自动从 BusinessActionRegistry 获取，也可手动指定） */
  businessCode?: BusinessCode | string;
  /** 业务对象ID（使用业务编号，如 HZ-2024-001，而非数据库ID） */
  businessId?: string;
  /** 业务对象类型 */
  targetType?: string;
  /** 业务对象描述 */
  targetLabel?: string;
  /** 业务对象链接 */
  targetLink?: string;
  /** 操作前的数据（用于生成 diff） */
  oldData?: any;
  /** 操作后的数据（用于生成 snapshot 和 diff） */
  newData?: any;
  /** 操作人信息（如果能从 Session 获取则可选） */
  operator?: OperatorInfo;
  /** 用户在本次操作中的业务角色 */
  businessRole?: BusinessRole | string;
  /** Request 对象（用于提取 IP/UA） */
  request?: Request;
  /** 自定义描述 */
  description?: string;
  /** 额外的客户端信息 */
  clientInfo?: Partial<ClientInfo>;
}

/**
 * 日志查询过滤器
 */
export interface LogQueryFilter {
  /** 模块 */
  module?: LogModule | LogModule[];
  /** 操作类型 */
  action?: LogAction | LogAction[];
  /** 用户ID */
  userId?: string;
  /** 业务对象ID */
  targetId?: string;
  /** 业务对象类型 */
  targetType?: string;
  /** 开始时间 */
  startDate?: Date;
  /** 结束时间 */
  endDate?: Date;
  /** 关键字搜索 */
  keyword?: string;
  /** 分页：页码 */
  page?: number;
  /** 分页：每页数量 */
  pageSize?: number;
}
