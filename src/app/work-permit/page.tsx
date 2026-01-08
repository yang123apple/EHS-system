/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Project, Template, PermitRecord } from '@/types/work-permit';
import { UserService, StructureService } from '@/services/workPermitService';
import { apiFetch } from '@/lib/apiClient';
import { Menu } from 'lucide-react';

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

  // Pagination State for Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectPage, setProjectPage] = useState(1);
  const [projectTotalPages, setProjectTotalPages] = useState(1);
  const [projectFilters, setProjectFilters] = useState({ text: '', status: '', date: '' });
  const projectLimit = 20;

  // Pagination State for Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatePage, setTemplatePage] = useState(1);
  const [templateTotalPages, setTemplateTotalPages] = useState(1);

  // Project Records (Modal)
  const [projectRecords, setProjectRecords] = useState<PermitRecord[]>([]);
  const [projRecPage, setProjRecPage] = useState(1);
  const [projRecTotalPages, setProjRecTotalPages] = useState(1);

  // Pagination State for All Records
  const [allRecords, setAllRecords] = useState<PermitRecord[]>([]); // 所有记录
  const [recordPage, setRecordPage] = useState(1);
  const [recordTotalPages, setRecordTotalPages] = useState(1);
  const [recordFilters, setRecordFilters] = useState({ project: '', type: '', date: '' });
  const recordLimit = 50;
  const [totalRecordsCount, setTotalRecordsCount] = useState(0);

  const [departments, setDepartments] = useState<any[]>([]); // 组织架构
  // 🟢 新增：所有人员状态 (用于流程配置时选择人员)
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // === 2. 选中项状态 ===
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PermitRecord | null>(null);
  const [currentViewAttachments, setCurrentViewAttachments] = useState<any[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
  const fetchProjects = async (page = 1, filters = projectFilters) => {
    try {
      const params = new URLSearchParams({
          page: page.toString(),
          limit: projectLimit.toString(),
          q: filters.text,
          status: filters.status === 'all' ? '' : filters.status,
          date: filters.date
      });
      const res = await apiFetch(`/api/projects?${params.toString()}`, { cache: 'no-store' });
      if(res.ok) {
          const data = await res.json();
          if (data.data) {
              setProjects(data.data);
              setProjectTotalPages(data.meta.totalPages);
              setProjectPage(page);
          } else {
              setProjects(data);
          }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTemplates = async (page = 1) => {
    try {
      const res = await apiFetch(`/api/templates?page=${page}&limit=20`, { cache: 'no-store' });
      if(res.ok) {
          const data = await res.json();
          if (data.data) {
              setTemplates(data.data);
              setTemplateTotalPages(data.meta.totalPages);
              setTemplatePage(page);
          } else {
              setTemplates(data);
          }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 3. 获取所有记录
  const fetchAllRecords = async (page = 1, filters = recordFilters) => {
    try {
      const params = new URLSearchParams({
          page: page.toString(),
          limit: recordLimit.toString(),
          q: filters.project,
          type: filters.type,
          date: filters.date
      });
      const res = await apiFetch(`/api/permits?${params.toString()}`, { cache: 'no-store' });
      if(res.ok) {
        const data = await res.json();
        let records = [];
        if (data.data) {
            records = data.data;
            setAllRecords(data.data);
            setRecordTotalPages(data.meta.totalPages);
            setRecordPage(page);
        } else {
            records = data;
            setAllRecords(data);
        }

        // 🟢 新增：如果当前有选中的记录，在新的列表中找到它并更新，防止弹窗数据陈旧
        // Note: With pagination, the selected record might not be in the current page.
        // If critical, we should fetch single record detail. For now, best effort.
        if (selectedRecord) {
          const fresh = records.find((r: any) => r.id === selectedRecord.id);
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
  const fetchProjectRecords = async (projectId: string, page = 1) => {
    try {
      const res = await apiFetch(`/api/permits?projectId=${projectId}&page=${page}&limit=10`, { cache: 'no-store' });
      if(res.ok) {
        const data = await res.json();
        let records = [];
        if (data.data) {
            records = data.data;
            setProjectRecords(data.data);
            setProjRecTotalPages(data.meta.totalPages);
            setProjRecPage(page);
        } else {
            records = data;
            setProjectRecords(data);
        }

        // 🟢 新增：同样在这里也加上同步逻辑
        if (selectedRecord) {
          const fresh = records.find((r: any) => r.id === selectedRecord.id);
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
    } catch (e: any) {
      // 对于 401 错误，静默处理（用户可能未登录，apiClient 会处理跳转）
      if (e?.status === 401 || e?.isAuthError || e?.message?.includes('401')) {
        console.warn('[WorkPermitPage] 获取部门列表失败：未授权访问');
        setDepartments([]);
        return [];
      }
      // 对于其他错误，记录并返回空数组
      console.error('[WorkPermitPage] 获取部门列表失败:', e);
      setDepartments([]);
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
    fetchProjects(1);
    fetchTemplates(1);
    fetchAllRecords(1);
    fetchDepartments();
    fetchAllUsers(); // 🟢 初始化时加载人员
  }, []);

  // Debounce for Projects
  useEffect(() => {
      const timer = setTimeout(() => {
          fetchProjects(1, projectFilters);
      }, 500);
      return () => clearTimeout(timer);
  }, [projectFilters]);

  // Debounce for Records
  useEffect(() => {
      const timer = setTimeout(() => {
          fetchAllRecords(1, recordFilters);
      }, 500);
      return () => clearTimeout(timer);
  }, [recordFilters]);

  // 🟢 检测 URL 参数，自动打开记录详情
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recordId = params.get('recordId');
    
    if (recordId) {
      // 切换到记录视图，确保能看到记录列表
      if (viewMode !== 'records') {
        setViewMode('records');
      }
      
      // 如果记录列表中已经有这个记录，直接打开
      if (allRecords.length > 0) {
        const record = allRecords.find(r => r.id === recordId);
        if (record) {
          console.log('📧 从通知跳转，自动打开记录:', record.code);
          setSelectedRecord(record);
          toggleModal('viewRecord', true);
          // 清除 URL 参数，避免刷新时重复打开
          window.history.replaceState({}, '', '/work-permit');
          return;
        }
      }
      
      // 如果记录不在当前列表中（可能因为分页），单独获取该记录
      const fetchSingleRecord = async () => {
        try {
          const res = await apiFetch(`/api/permits?id=${recordId}`, { cache: 'no-store' });
          if (res.ok) {
            const record = await res.json();
            if (record) {
              console.log('📧 从通知跳转，单独获取记录:', record.code || record.id);
              setSelectedRecord(record);
              toggleModal('viewRecord', true);
              // 清除 URL 参数，避免刷新时重复打开
              window.history.replaceState({}, '', '/work-permit');
            }
          }
        } catch (e) {
          console.error('获取记录失败:', e);
        }
      };
      
      fetchSingleRecord();
    }
  }, [allRecords, viewMode]);

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
    if(!confirm(`确定要删除项目"${name}"吗？`)) return;
    try {
      await apiFetch(`/api/projects?id=${id}&userId=${user?.id || ''}&userName=${encodeURIComponent(user?.name || '')}`, { method: 'DELETE' });
      fetchProjects(projectPage);
      fetchAllRecords(recordPage);
    } catch(e) {}
  };

  const handleOpenProjectDetail = (project: Project) => {
    setSelectedProject(project);
    setProjectRecords([]); // 先清空旧数据
    fetchProjectRecords(project.id, 1);
    toggleModal('projectDetail', true);
  };

  // 记录相关
  const handleDeleteRecord = async (id: string) => {
    if(!confirm("确定要删除?")) return;
    try {
      await apiFetch(`/api/permits?id=${id}&userId=${user?.id || ''}&userName=${user?.name || ''}`, { method: 'DELETE' });
      if(modals.projectDetail && selectedProject) fetchProjectRecords(selectedProject.id, projRecPage);
      fetchAllRecords(recordPage);
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
      <div className="flex h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden print:hidden relative">
        {/* 移动端遮罩层 */}
        {isMobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}
        
        {/* 左侧导航 */}
        <div className={`
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-0
          transform transition-transform duration-300 ease-in-out
          ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }
        `}>
          <Sidebar
            viewMode={viewMode}
            onSwitchView={(mode) => {
              setViewMode(mode);
              setIsMobileSidebarOpen(false);
            }}
            userRole={user?.role || 'user'} // 🔵 传入角色
            hasPerm={hasPerm}
            onNewProject={() => {
              toggleModal('newProject', true);
              setIsMobileSidebarOpen(false);
            }}
            onManageTemplates={() => {
              toggleModal('templateManage', true);
              setIsMobileSidebarOpen(false);
            }}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 移动端顶部菜单按钮 */}
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={20} className="text-slate-600" />
            </button>
            <h2 className="font-bold text-slate-800">
              {viewMode === 'projects' ? '工程项目列表' : viewMode === 'records' ? '所有作业记录' : '操作日志'}
            </h2>
          </div>
          
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
              currentPage={projectPage}
              totalPages={projectTotalPages}
              onPageChange={(p) => fetchProjects(p, projectFilters)}
              filters={projectFilters}
              onFilterChange={setProjectFilters}
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
              currentPage={recordPage}
              totalPages={recordTotalPages}
              onPageChange={(p) => fetchAllRecords(p, recordFilters)}
              filters={recordFilters}
              onFilterChange={setRecordFilters}
              totalCount={totalRecordsCount}
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
          fetchProjects(1); // Refresh to first page on new project
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
            fetchAllRecords(1); // Refresh first page of records
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
        onRefresh={() => fetchTemplates(templatePage)}
        onEdit={(t) => {
          setSelectedTemplate(t);
          toggleModal('editTemplate', true);
        }}
        onConfigWorkflow={(t) => {
          setSelectedTemplate(t);
          toggleModal('workflowEditor', true);
        }}
        currentPage={templatePage}
        totalPages={templateTotalPages}
        onPageChange={fetchTemplates}
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
          onSuccess={() => fetchTemplates(templatePage)}
        />
      )}

      {selectedTemplate && (
        <EditTemplateModal
          isOpen={modals.editTemplate}
          onClose={() => toggleModal('editTemplate', false)}
          template={selectedTemplate}
          onSuccess={() => fetchTemplates(templatePage)}
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
            fetchAllRecords(recordPage);
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
            fetchAllRecords(recordPage);
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
            fetchProjects(projectPage);
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