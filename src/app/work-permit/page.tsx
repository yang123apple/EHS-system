"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Project, Template, PermitRecord } from '@/types/work-permit';
import { UserService, StructureService } from '@/services/workPermitService';

// === 组件引入 ===
import PrintStyle from '@/components/work-permit/PrintStyle';
import Sidebar from '@/components/work-permit/views/Sidebar';
import ProjectListView from '@/components/work-permit/views/ProjectListView';
import RecordListView from '@/components/work-permit/views/RecordListView';
import SystemLogView from '@/components/work-permit/views/SystemLogView'; // 🟢 导入新视图

// === 弹窗引入 (Modals) ===
import NewProjectModal from '@/components/work-permit/moduls/NewProjectModal';
import AddPermitModal from '@/components/work-permit/moduls/AddPermitModal';
import ProjectDetailModal from '@/components/work-permit/moduls/ProjectDetailModal';
import TemplateManageModal from '@/components/work-permit/moduls/TemplateManageModal';
import WorkflowEditorModal from '@/components/work-permit/moduls/WorkflowEditorModal';
import RecordDetailModal from '@/components/work-permit/moduls/RecordDetailModal';
import EditTemplateModal from '@/components/work-permit/moduls/EditTemplateModal';
import AdjustDateModal from '@/components/work-permit/moduls/AdjustDateModal';
import AttachmentViewModal from '@/components/work-permit/moduls/AttachmentViewModal';
import ApprovalModal from '@/components/work-permit/moduls/ApprovalModal';

export default function WorkPermitPage() {
  const { user } = useAuth();

  // === 1. 核心数据状态 ===
  // 🟢 修改状态类型，增加 'logs'
  const [viewMode, setViewMode] = useState<'projects' | 'records' | 'logs'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projectRecords, setProjectRecords] = useState<PermitRecord[]>([]); // 特定项目的记录
  const [allRecords, setAllRecords] = useState<PermitRecord[]>([]); // 所有记录
  const [departments, setDepartments] = useState<any[]>([]); // 组织架构
  // 🟢 新增：所有人员状态 (用于流程配置时选择人员)
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // === 2. 选中项状态 ===
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PermitRecord | null>(null);
  const [currentViewAttachments, setCurrentViewAttachments] = useState<any[]>([]);

  // === 3. 弹窗控制状态 (集中管理) ===
  const [modals, setModals] = useState({
    newProject: false,
    addPermit: false,
    projectDetail: false,
    templateManage: false,
    viewRecord: false,
    editTemplate: false,
    adjustDate: false,
    workflowEditor: false,
    approval: false,
    attachmentView: false,
  });

  // 辅助函数：简化弹窗开关
  const toggleModal = (key: keyof typeof modals, value: boolean) => {
    setModals(prev => ({ ...prev, [key]: value }));
  };

  // === 4. 权限辅助 ===
  const hasPerm = useCallback((permKey: string) => {
    if (user?.role === 'admin') return true;
    return user?.permissions?.['work_permit']?.includes(permKey);
  }, [user]);

  // === 5. 数据获取逻辑 ===
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' });
      if(res.ok) setProjects(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates', { cache: 'no-store' });
      if(res.ok) setTemplates(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  // 3. 获取所有记录
  const fetchAllRecords = async () => {
    try {
      const res = await fetch('/api/permits', { cache: 'no-store' });
      if(res.ok) {
        const data = await res.json();
        setAllRecords(data);
        // 🟢 新增：如果当前有选中的记录，在新的列表中找到它并更新，防止弹窗数据陈旧
        if (selectedRecord) {
          const fresh = data.find((r: any) => r.id === selectedRecord.id);
          // 如果找到了最新版，且确实有变化（比如日志变多了），就更新它
          if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedRecord)) {
            console.log("🔄 自动同步 selectedRecord 为最新数据");
            setSelectedRecord(fresh);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 4. 获取特定项目的记录
  const fetchProjectRecords = async (projectId: string) => {
    try {
      const res = await fetch(`/api/permits?projectId=${projectId}`, { cache: 'no-store' });
      if(res.ok) {
        const data = await res.json();
        setProjectRecords(data);
        // 🟢 新增：同样在这里也加上同步逻辑
        if (selectedRecord) {
          const fresh = data.find((r: any) => r.id === selectedRecord.id);
          if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedRecord)) {
            console.log("🔄 [项目视图] 自动同步 selectedRecord 为最新数据");
            setSelectedRecord(fresh);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 获取部门
  const fetchDepartments = async () => {
    try {
      const data = await StructureService.getDepartments();
      setDepartments(data);
      return data;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  // 🟢 新增：获取所有人员
  const fetchAllUsers = async () => {
    try {
      const data = await UserService.getAll();
      setAllUsers(data);
    } catch (e) {
      console.error("Fetch users failed", e);
    }
  };

  // 初始化
  useEffect(() => {
    fetchProjects();
    fetchTemplates();
    fetchAllRecords();
    fetchDepartments();
    fetchAllUsers(); // 🟢 初始化时加载人员
  }, []);

  // 🟢 检测 URL 参数，自动打开记录详情
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recordId = params.get('recordId');
    
    if (recordId && allRecords.length > 0) {
      const record = allRecords.find(r => r.id === recordId);
      if (record) {
        console.log('📧 从通知跳转，自动打开记录:', record.code);
        setSelectedRecord(record);
        toggleModal('viewRecord', true);
        // 清除 URL 参数，避免刷新时重复打开
        window.history.replaceState({}, '', '/work-permit');
      }
    }
  }, [allRecords]);

  // 防御性代码：检测外部脚本注入
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => { /* ... 检测逻辑 ... */ };
    const t = setTimeout(handler, 500);
    return () => clearTimeout(t);
  }, []);

  // === 6. 事件处理程序 (Handlers) ===
  // 项目相关
  const handleDeleteProject = async (id: string, name: string) => {
    if(!confirm(`确定要删除项目“${name}”吗？`)) return;
    try {
      await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
      fetchProjects();
      fetchAllRecords();
    } catch(e) {}
  };

  const handleOpenProjectDetail = (project: Project) => {
    setSelectedProject(project);
    setProjectRecords([]); // 先清空旧数据
    fetchProjectRecords(project.id);
    toggleModal('projectDetail', true);
  };

  // 记录相关
  const handleDeleteRecord = async (id: string) => {
    if(!confirm("确定要删除?")) return;
    try {
      await fetch(`/api/permits?id=${id}&userId=${user?.id || ''}&userName=${user?.name || ''}`, { method: 'DELETE' });
      if(modals.projectDetail && selectedProject) fetchProjectRecords(selectedProject.id);
      fetchAllRecords();
      // 如果正在查看该记录，关闭详情弹窗
      if (selectedRecord?.id === id) toggleModal('viewRecord', false);
    } catch(e) {}
  };

  // 附件查看
  const handleViewAttachments = (attachments: any[]) => {
    setCurrentViewAttachments(attachments);
    toggleModal('attachmentView', true);
  };

  return (
    <>
      <PrintStyle />
      <div className="flex h-screen bg-slate-50 overflow-hidden print:hidden">
        {/* 左侧导航 */}
        <Sidebar
          viewMode={viewMode}
          onSwitchView={setViewMode}
          userRole={user?.role || 'user'} // 🟢 传入角色
          hasPerm={hasPerm}
          onNewProject={() => toggleModal('newProject', true)}
          onManageTemplates={() => toggleModal('templateManage', true)}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 主视图区域 */}
          {viewMode === 'projects' ? (
            <ProjectListView
              projects={projects}
              hasPerm={hasPerm}
              onOpenDetail={handleOpenProjectDetail}
              onAdjustDate={(p) => {
                setSelectedProject(p);
                toggleModal('adjustDate', true);
              }}
              onNewPermit={(p) => {
                setSelectedProject(p);
                toggleModal('addPermit', true);
              }}
              onDeleteProject={handleDeleteProject}
            />
          ) : viewMode === 'records' ? (
            <RecordListView
              records={allRecords}
              hasPerm={hasPerm}
              onViewRecord={(r) => {
                setSelectedRecord(r);
                toggleModal('viewRecord', true);
              }}
              onDeleteRecord={handleDeleteRecord}
            />
          ) : (
            // 🟢 渲染日志视图 (双重保险：再次校验权限)
            <>
              {user?.role === 'admin' ? (
                <SystemLogView />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">无权访问</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* === 弹窗集合 (Modals) === */}
      <NewProjectModal
        isOpen={modals.newProject}
        onClose={() => toggleModal('newProject', false)}
        onSuccess={() => {
          fetchProjects();
          toggleModal('newProject', false);
        }}
      />

      {selectedProject && (
        <AddPermitModal
          isOpen={modals.addPermit}
          onClose={() => toggleModal('addPermit', false)}
          project={selectedProject}
          templates={templates}
          user={user}
          // 🟢 新增：传递 departments 和 allUsers 用于流程校验
          departments={departments}
          allUsers={allUsers}
          onSuccess={() => {
            if(modals.projectDetail) fetchProjectRecords(selectedProject.id);
            fetchAllRecords();
            toggleModal('addPermit', false);
          }}
        />
      )}

      {selectedProject && (
        <ProjectDetailModal
          isOpen={modals.projectDetail}
          onClose={() => toggleModal('projectDetail', false)}
          project={selectedProject}
          records={projectRecords}
          hasPerm={hasPerm}
          onViewRecord={(r) => {
            setSelectedRecord(r);
            toggleModal('viewRecord', true);
          }}
          onDeleteRecord={handleDeleteRecord}
        />
      )}

      <TemplateManageModal
        isOpen={modals.templateManage}
        onClose={() => toggleModal('templateManage', false)}
        templates={templates}
        hasPerm={hasPerm}
        onRefresh={fetchTemplates}
        onEdit={(t) => {
          setSelectedTemplate(t);
          toggleModal('editTemplate', true);
        }}
        onConfigWorkflow={(t) => {
          setSelectedTemplate(t);
          toggleModal('workflowEditor', true);
        }}
      />

      {selectedTemplate && (
        <WorkflowEditorModal
          isOpen={modals.workflowEditor}
          onClose={() => toggleModal('workflowEditor', false)}
          template={selectedTemplate}
          departments={departments}
          allUsers={allUsers}
          onRefreshDepts={() => {
            fetchDepartments();
            fetchAllUsers();
          }}
          onSuccess={fetchTemplates}
        />
      )}

      {selectedTemplate && (
        <EditTemplateModal
          isOpen={modals.editTemplate}
          onClose={() => toggleModal('editTemplate', false)}
          template={selectedTemplate}
          onSuccess={fetchTemplates}
          allTemplates={templates}
        />
      )}

      {selectedRecord && (
        <RecordDetailModal
          isOpen={modals.viewRecord}
          onClose={() => toggleModal('viewRecord', false)}
          record={selectedRecord}
          user={user}
          departments={departments}
          allUsers={allUsers}
          allTemplates={templates}
          onRefresh={() => {
            fetchAllRecords();
            if (selectedProject) fetchProjectRecords(selectedProject.id);
          }}
          onOpenApproval={() => toggleModal('approval', true)}
          onViewAttachments={handleViewAttachments}
        />
      )}

      {selectedRecord && (
        <ApprovalModal
          isOpen={modals.approval}
          onClose={() => toggleModal('approval', false)}
          record={selectedRecord}
          user={user}
          onSuccess={() => {
            toggleModal('approval', false);
            //toggleModal('viewRecord', false);
            fetchAllRecords();
            if (selectedProject) fetchProjectRecords(selectedProject.id);
          }}
        />
      )}

      {selectedProject && (
        <AdjustDateModal
          isOpen={modals.adjustDate}
          onClose={() => toggleModal('adjustDate', false)}
          project={selectedProject}
          onSuccess={() => {
            fetchProjects();
            toggleModal('adjustDate', false);
          }}
        />
      )}

      <AttachmentViewModal
        isOpen={modals.attachmentView}
        onClose={() => toggleModal('attachmentView', false)}
        attachments={currentViewAttachments}
      />
    </>
  );
}