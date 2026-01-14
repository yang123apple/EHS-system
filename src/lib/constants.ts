// src/lib/constants.ts

export const SYSTEM_MODULES = [
  {
    key: 'work_permit',
    name: '作业许可系统',
    basePermission: 'access', // 基础权限：能访问该系统
    permissions: [
      { key: 'create_project', name: '新建工程' },
      { key: 'delete_project', name: '删除工程' },
      { key: 'adjust_schedule', name: '工期调整' },  
      { key: 'create_permit', name: '新建关联表单' },
      { key: 'delete_permit', name: '删除关联表单' },
      { key: 'upload_template', name: '上传模板' },
      { key: 'edit_template', name: '编辑模板' },
      { key: 'lock_template', name: '锁定模板' },
      { key: 'delete_template', name: '删除模板' },
      { key: 'approve_permit', name: '审批作业票' }, 
    ]
  },
  {
    key: 'hidden_danger',
    name: '隐患排查治理系统',
    basePermission: 'access', // 基础权限：能访问该系统
    permissions: [
      { key: 'report', name: '隐患上报' },
      { key: 'handle', name: '整改/验收隐患' },
      { key: 'assign', name: '指派责任人 (管理)' },
      { key: 'view_stats', name: '查看统计报表' },
      { key: 'manage_config', name: '配置基础数据 (Admin)' },
      { key: 'delete', name: '删除隐患记录' },
      { key: 'edit_cc_workflow', name: '隐患抄送编辑' },
    ]
  },
  {
    key: 'doc_sys',
    name: 'EHS文档管理系统',
    basePermission: 'access', // 基础权限：能访问该系统
    permissions: [
      { key: 'upload', name: '上传文件 (DOCX/PDF)' },
      { key: 'down_docx_l123', name: '下载 DOCX (1-3级体系文件)' },
      { key: 'down_docx_l4', name: '下载 DOCX (4级记录表格)' },
      { key: 'down_pdf', name: '下载 PDF 源文件' },
      { key: 'delete', name: '删除文件' },
      { key: 'edit', name: '编辑文件信息' },
      { key: 'edit_watermark', name: '编辑预览水印' }
    ]
  },
  {
    key: 'training',
    name: '培训管理系统',
    basePermission: 'access', // 基础权限：能访问该系统
    permissions: [
      { key: 'create_material', name: '创建培训资料' },
      { key: 'edit_material_self', name: '编辑培训资料（自己创建的）' },
      { key: 'edit_material_all', name: '编辑培训资料（所有人创建的）' },
      { key: 'delete_material_self', name: '删除培训资料（自己创建的）' },
      { key: 'delete_material_all', name: '删除培训资料（所有人创建的）' },
      { key: 'create_task', name: '创建培训任务' },
      { key: 'edit_task_self', name: '修改培训任务（自己创建的）' },
      { key: 'edit_task_all', name: '修改培训任务（所有人创建的）' },
      { key: 'delete_task_self', name: '删除培训任务（自己创建的）' },
      { key: 'delete_task_all', name: '删除培训任务（所有人创建的）' },
      { key: 'assign_task', name: '分配培训任务' },
      { key: 'view_stats', name: '查看培训统计' },
      { key: 'manage_exam_self', name: '管理考试试卷（自己创建的）' },
      { key: 'manage_exam_all', name: '管理考试试卷（所有人创建的）' },
      { key: 'review_exam', name: '审核考试结果' },
    ]
  },
  {
    key: 'archives',
    name: '档案库系统',
    basePermission: 'access', // 基础权限：能访问该系统
    permissions: [
      // 一企一档权限
      { key: 'enterprise_view', name: '查看一企一档库' },
      { key: 'enterprise_upload', name: '一企一档上传文件' },
      { key: 'enterprise_delete', name: '一企一档删除文件' },
      { key: 'enterprise_edit', name: '一企一档修改文件' },
      // 一机一档权限
      { key: 'equipment_view', name: '查看一机一档库' },
      { key: 'equipment_create', name: '一机一档新建设备' },
      { key: 'equipment_upload', name: '一机一档上传文件' },
      { key: 'equipment_delete', name: '一机一档删除设备' },
      { key: 'equipment_edit', name: '一机一档修改设备信息' },
      // 一人一档权限
      { key: 'personnel_view', name: '查看一人一档库' },
      { key: 'personnel_upload', name: '一人一档上传文件' },
      { key: 'personnel_delete', name: '一人一档删除文件' },
      // MSDS库权限
      { key: 'msds_view', name: '查看MSDS库' },
      { key: 'msds_upload', name: 'MSDS上传文件' },
      { key: 'msds_delete', name: 'MSDS删除文件' },
    ]
  }
];
