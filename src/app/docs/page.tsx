"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { sanitizeHtml, sanitizeHighlightHtml } from '@/lib/htmlSanitizer';
// 移除客户端 mammoth 和 xlsx 导入，改为使用 API 路由在服务端处理
import { 
  Search, FileText, FolderOpen, Download, Trash2, Edit, Upload, 
  Eye, ArrowLeft, Filter, ChevronRight, CornerDownRight, MoreHorizontal,
  File as FileIcon, Sheet, RefreshCw, History, Clock, Calendar, Layers, Droplet, Activity
} from 'lucide-react';
import Link from 'next/link';
import Watermark from '@/components/common/Watermark';
import SystemLogModal from './_components/SystemLogModal';
import { apiFetch } from '@/lib/apiClient';
import { useDateRange } from '@/hooks/useDateRange';
import { nowISOString, toLocaleDateString, formatDateTime, setStartOfDay, setEndOfDay } from '@/utils/dateUtils';

interface HistoryRecord {
  id: string; type: 'docx' | 'xlsx' | 'pdf'; name: string; path: string; uploadTime: number; uploader: string;
}

interface DocFile {
  id: string; name: string; prefix: string; suffix: number; fullNum: string; level: number; parentId: string | null;
  dept: string; docxPath: string; pdfPath: string | null; type: 'docx' | 'pdf' | 'xlsx'; uploadTime: number;
  uploader?: string; history?: HistoryRecord[];
  searchText?: string;
}

export default function DocSystemPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination State (Root Level or Search)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;

  // Track loaded folders to avoid refetching
  const [loadedFolders, setLoadedFolders] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // === 筛选状态 ===
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState(''); // 新增：级别筛选
  // 使用日期范围 Hook 自动处理开始和结束日期的关联
  const { startDate, endDate, setStartDate, setEndDate, endDateMin } = useDateRange();
  const [isFilterOpen, setIsFilterOpen] = useState(false); // 🔴 新增：筛选抽屉状态
  
  const [allDepts, setAllDepts] = useState<string[]>([]);

  // 弹窗状态
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false); // 🔴 水印编辑弹窗
  const [showLogModal, setShowLogModal] = useState(false); // 🔴 操作日志弹窗
  
  const [uploadLevel, setUploadLevel] = useState(1);
  const [editLevel, setEditLevel] = useState(1);
  const [currentFile, setCurrentFile] = useState<DocFile | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [uploading, setUploading] = useState(false); // 上传状态
  const [showAllChildren, setShowAllChildren] = useState(false); // 是否显示所有下级文件
  
  // 🔴 水印配置状态
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [tempWatermarkText, setTempWatermarkText] = useState<string>('');
  const [watermarkIncludeUser, setWatermarkIncludeUser] = useState<boolean>(false);
  const [watermarkIncludeTime, setWatermarkIncludeTime] = useState<boolean>(false);
  const [tempWatermarkIncludeUser, setTempWatermarkIncludeUser] = useState<boolean>(false);
  const [tempWatermarkIncludeTime, setTempWatermarkIncludeTime] = useState<boolean>(false);
  
  const isAdmin = user?.role === 'admin';

  const hasPerm = (key: string) => {
    if (!user) return false;
    if (isAdmin) return true;
    return user.permissions['doc_sys']?.includes(key);
  };

  const canDownloadSource = (file: DocFile) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (file.level === 4) return user.permissions['doc_sys']?.includes('down_docx_l4');
    return user.permissions['doc_sys']?.includes('down_docx_l123');
  };

  useEffect(() => { 
    // 等待用户加载完成后再加载文件
    // user 为 null 时表示未登录或正在加载，不发送请求
    if (user) {
      loadFiles(1);
      loadWatermarkConfig(); // 🔴 加载水印配置
    } else {
      // 如果用户未登录，设置加载完成状态
      setLoading(false);
    }
  }, [user]);

  // 🔴 加载水印配置
  const loadWatermarkConfig = async () => {
    try {
      const res = await apiFetch('/api/docs/watermark');
      if (res.ok) {
        const data = await res.json();
        setWatermarkText(data.text || '');
        setWatermarkIncludeUser(data.includeUser || false);
        setWatermarkIncludeTime(data.includeTime || false);
      }
    } catch (error) {
      console.error('加载水印配置失败:', error);
    }
  };

  const loadFiles = async (pageNum = 1) => {
    // 如果用户未登录，不发送请求
    if (!user) {
      console.warn('用户未登录，跳过加载文件');
      setFiles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Default: load roots (parentId=null) with pagination
      const res = await apiFetch(`/api/docs?page=${pageNum}&limit=${limit}&parentId=null`);
      
      // 检查响应状态
      if (!res.ok) {
        let errorData;
        try {
          const text = await res.text();
          errorData = text ? JSON.parse(text) : { error: `HTTP ${res.status} 错误` };
        } catch (e) {
          errorData = { error: `HTTP ${res.status} 错误`, details: '无法解析错误响应' };
        }
        console.error('API请求失败:', res.status, errorData);
        
        // 如果是401错误，可能是用户未登录或session过期
        if (res.status === 401) {
          console.warn('认证失败，可能需要重新登录');
          // 可以选择清除本地存储并跳转到登录页
          localStorage.removeItem('ehs_user');
          // 不显示alert，避免打扰用户
        } else if (errorData.error) {
          alert(`加载文档失败: ${errorData.error}${errorData.details ? '\n' + errorData.details : ''}`);
        }
        setFiles([]);
        return;
      }

      const data = await res.json().catch((e) => {
        console.error('解析JSON失败:', e);
        return null;
      });

      if (!data) {
        console.error('API返回数据为空');
        setFiles([]);
        return;
      }

      if (data.data && Array.isArray(data.data)) {
          // If paging roots, we replace 'files' but we need to keep loaded children if we want to preserve state?
          // For simplicity, root pagination replaces root files. Children of expanded nodes might be lost if we reset `files`.
          // To do this robustly, we should merge.
          // But merging might duplicate.
          // Let's reset for root pagination change.
          setFiles(data.data);
          setTotalPages(data.meta?.totalPages || 1);
          setPage(pageNum);

          // Also fetch all depts for filter? (Might need separate API)
          // For now, extract from current page
          const depts = Array.from(new Set(data.data.map((f: DocFile) => f.dept))).filter(Boolean) as string[];
          setAllDepts(depts);
      } else if (Array.isArray(data)) {
          setFiles(data); // Fallback
      } else {
          console.error('Invalid data format from API:', data);
          setFiles([]); // 确保 files 始终是数组
      }
    } catch (e) { 
      console.error('Error loading files:', e); 
      setFiles([]); // 确保在错误情况下 files 也是数组
    } finally { setLoading(false); }
  };

  const fetchChildren = async (parentId: string, forceRefresh = false) => {
      if (!forceRefresh && loadedFolders.has(parentId)) return;
      
      // 如果用户未登录，不发送请求
      if (!user) {
        console.warn('用户未登录，跳过加载子文件');
        return;
      }
      
      try {
          const res = await apiFetch(`/api/docs?parentId=${parentId}`); // Fetch all children (no paging for subfolders for now)
          
          // 检查响应状态
          if (!res.ok) {
            // 如果是401错误，可能是用户未登录或session过期
            if (res.status === 401) {
              console.warn('认证失败，可能需要重新登录');
              localStorage.removeItem('ehs_user');
            } else {
              console.error('API请求失败:', res.status);
            }
            return;
          }

          const data = await res.json().catch((e) => {
            console.error('解析JSON失败:', e);
            return null;
          });

          if (!data) {
            console.error('API返回数据为空');
            return;
          }

          const newFiles = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []); // Handle paginated or list response
          
          setFiles(prev => {
              // 确保 prev 是数组
              if (!Array.isArray(prev)) {
                console.warn('prev is not an array, resetting to empty array');
                return newFiles;
              }
              
              // 如果强制刷新，先移除该父文件的所有子文件
              if (forceRefresh) {
                const filtered = prev.filter(f => f.parentId !== parentId);
                // 合并新文件，避免重复
                const ids = new Set(filtered.map(f => f.id));
                const uniqueNew = newFiles.filter((f: any) => !ids.has(f.id));
                return [...filtered, ...uniqueNew];
              } else {
                // 避免重复
                const ids = new Set(prev.map(f => f.id));
                const uniqueNew = newFiles.filter((f: any) => !ids.has(f.id));
                return [...prev, ...uniqueNew];
              }
          });
          
          setLoadedFolders(prev => new Set(prev).add(parentId));
      } catch(e) { 
        console.error('Error fetching children:', e); 
      }
  };

  const toggleFolder = (file: DocFile) => {
      const isExpanded = expandedFolders.has(file.id);
      if (isExpanded) {
          const next = new Set(expandedFolders);
          next.delete(file.id);
          setExpandedFolders(next);
      } else {
          setExpandedFolders(prev => new Set(prev).add(file.id));
          fetchChildren(file.id);
      }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // 防止重复提交
    if (uploading) return;
    
    const formData = new FormData(e.currentTarget);
    if (user) formData.append('uploader', user.username);
    // 只有当部门信息存在且不是 undefined 时才设置，避免 FormData 将 undefined 转换为字符串 "undefined"
    if (!isAdmin && user && user.department) {
      formData.set('dept', user.department);
    }

    const file = formData.get('file') as File;
    const level = parseInt(formData.get('level') as string);
    const prefix = formData.get('prefix') as string;
    const dept = formData.get('dept') as string;
    const parentId = formData.get('parentId') as string;

    if (level === 4) {
        if (!file.name.endsWith('.docx') && !file.name.endsWith('.xlsx')) return alert("4级文件支持 .docx 或 .xlsx");
    } else {
        if (!file.name.endsWith('.docx')) return alert("仅支持 .docx");
        if (!prefix) return alert("请输入前缀");
    }

    setUploading(true);
    try {
      const res = await apiFetch('/api/docs', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        const newDoc = data.doc || data;
        
        // 如果上传的文件有父文件，清除父文件的加载状态，以便重新加载子文件
        if (parentId && parentId !== '') {
          setLoadedFolders(prev => {
            const next = new Set(prev);
            next.delete(parentId);
            return next;
          });
          // 如果父文件已展开，强制重新加载其子文件
          if (expandedFolders.has(parentId)) {
            fetchChildren(parentId, true);
          } else {
            // 即使未展开，也将新文件添加到列表，这样展开时就能看到
            setFiles(prev => {
              if (!Array.isArray(prev)) return [newDoc];
              // 检查是否已存在（避免重复）
              if (prev.find(f => f.id === newDoc.id)) return prev;
              return [...prev, newDoc];
            });
          }
        } else {
          // 如果没有父文件（根文件），重新加载根文件列表
          loadFiles(page);
        }
        
        setShowUploadModal(false);
        alert('上传成功');

        // 🔴 记录系统日志
        try {
          await apiFetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'document_uploaded',
              targetType: 'document',
              targetId: data.id || 'unknown',
              userId: user?.id || 'system',
              userName: user?.name || '系统',
              details: `上传文档：${file.name}`,
              snapshot: {
                action: 'document_uploaded',
                operatorName: user?.name || '未知',
                operatedAt: nowISOString(),
                documentInfo: {
                  fileName: file.name,
                  level: level,
                  dept: dept,
                  prefix: prefix
                }
              }
            })
          });
        } catch (logErr) {
          console.error('日志记录失败:', logErr);
        }
      } 
      else { 
        const err = await res.json(); 
        alert(err.error || '上传失败'); 
      }
    } catch (err) { 
      console.error('上传错误:', err);
      alert('网络错误，请重试'); 
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此文档？')) return;
    
    // 获取待删除文件信息用于日志
    const fileToDelete = files.find(f => f.id === id);
    
    try {
      const res = await apiFetch(`/api/docs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadFiles();
        if (currentFile?.id === id) {
          setShowPreviewModal(false);
          setShowEditModal(false);
          setShowUpdateModal(false);
        }

        // 🔴 记录系统日志
        if (fileToDelete) {
          try {
            await apiFetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'document_deleted',
                targetType: 'document',
                targetId: id,
                userId: user?.id || 'system',
                userName: user?.name || '系统',
                details: `删除文档：${fileToDelete.fullNum} ${fileToDelete.name}`,
                snapshot: {
                  action: 'document_deleted',
                  operatorName: user?.name || '未知',
                  operatedAt: nowISOString(),
                  documentInfo: {
                    fullNum: fileToDelete.fullNum,
                    name: fileToDelete.name,
                    level: fileToDelete.level,
                    dept: fileToDelete.dept
                  }
                }
              })
            });
          } catch (logErr) {
            console.error('日志记录失败:', logErr);
          }
        }
      } 
      else { const d = await res.json(); alert(d.error || '删除失败'); }
    } catch (err) { alert('请求出错'); }
  };

  const handleDeleteHistory = async (docId: string, historyId: string) => {
    if (!confirm('确定永久删除此历史文件？')) return;
    
    // 获取历史记录信息用于日志
    const historyRecord = currentFile?.history?.find(h => h.id === historyId);
    
    try {
        const res = await apiFetch(`/api/docs/${docId}?historyId=${historyId}`, { method: 'DELETE' });
        if (res.ok) {
            alert('历史版本已删除');
            loadFiles(); 
            if (currentFile && currentFile.id === docId) {
                const updatedHistory = currentFile.history?.filter(h => h.id !== historyId);
                setCurrentFile({ ...currentFile, history: updatedHistory });
            }

            // 🔴 记录系统日志
            if (historyRecord) {
              try {
                await apiFetch('/api/logs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'document_history_deleted',
                    targetType: 'document',
                    targetId: docId,
                    userId: user?.id || 'system',
                    userName: user?.name || '系统',
                    details: `删除历史版本：${historyRecord.name}`,
                    snapshot: {
                      action: 'document_history_deleted',
                      operatorName: user?.name || '未知',
                      operatedAt: nowISOString(),
                      documentInfo: {
                        fullNum: currentFile?.fullNum,
                        name: currentFile?.name,
                        level: currentFile?.level,
                        dept: currentFile?.dept
                      },
                      historyInfo: {
                        name: historyRecord.name,
                        type: historyRecord.type,
                        uploadTime: historyRecord.uploadTime
                      }
                    }
                  })
                });
              } catch (logErr) {
                console.error('日志记录失败:', logErr);
              }
            }
        } else alert('删除失败');
    } catch (e) { alert('网络错误'); }
  };

  const handleDownloadUrl = (url: string, filename: string) => {
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDownload = (file: DocFile, type: 'source' | 'pdf') => {
    if (type === 'source') {
        if (!canDownloadSource(file)) return alert('无权下载此源文件');
        const ext = file.type === 'xlsx' ? 'xlsx' : 'docx';
        handleDownloadUrl(file.docxPath, `${file.fullNum}_${file.name}.${ext}`);
    } else if (type === 'pdf') {
        if (!hasPerm('down_pdf')) return alert('无权下载 PDF');
        if (!file.pdfPath) return alert('PDF 不存在');
        handleDownloadUrl(file.pdfPath, `${file.fullNum}_${file.name}.pdf`);
    }
  };

  const handleUpdateVersion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentFile) return;
    
    const formData = new FormData(e.currentTarget);
    if (user) formData.append('uploader', user.username);
    const newFile = formData.get('mainFile') as File;
    
    // 保存更新前的状态
    const fileId = currentFile.id;
    const wasExpanded = expandedFolders.has(fileId);
    const isRootFile = !currentFile.parentId;
    
    try {
        const res = await apiFetch(`/api/docs/${currentFile.id}`, { method: 'PUT', body: formData });
        if (res.ok) {
          setShowUpdateModal(false);
          
          // 如果是根文件，清除其加载和展开状态，然后重新加载
          if (isRootFile) {
            setLoadedFolders(prev => {
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            });
            setExpandedFolders(prev => {
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            });
            await loadFiles();
            // 如果之前是展开的，重新展开（需要等待 files 更新后再展开）
            if (wasExpanded) {
              setTimeout(() => {
                setExpandedFolders(prev => new Set(prev).add(fileId));
                fetchChildren(fileId, true);
              }, 100);
            }
          } else {
            // 非根文件，清除加载状态并强制刷新子文件
            setLoadedFolders(prev => {
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            });
            if (wasExpanded) {
              await fetchChildren(fileId, true);
            }
          }
          
          alert('更新成功');

          // 🔴 记录系统日志
          try {
            await apiFetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'document_version_updated',
                targetType: 'document',
                targetId: currentFile.id,
                userId: user?.id || 'system',
                userName: user?.name || '系统',
                details: `更新文档版本：${currentFile.fullNum} ${currentFile.name}`,
                snapshot: {
                  action: 'document_version_updated',
                  operatorName: user?.name || '未知',
                  operatedAt: nowISOString(),
                  documentInfo: {
                    fullNum: currentFile.fullNum,
                    name: currentFile.name,
                    level: currentFile.level,
                    dept: currentFile.dept
                  },
                  updateInfo: {
                    newFileName: newFile?.name || '未知'
                  }
                }
              })
            });
          } catch (logErr) {
            console.error('日志记录失败:', logErr);
          }
        } else alert('更新失败');
    } catch (e) { alert('网络错误'); }
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentFile) return;
    
    const formData = new FormData(e.currentTarget);
    if (!isAdmin) formData.set('dept', currentFile.dept);
    if (formData.get('parentId') === currentFile.id) return alert("上级不能是自己");
    
    const newName = formData.get('name') as string;
    const newLevel = parseInt(formData.get('level') as string);
    const newDept = formData.get('dept') as string;
    const newParentId = formData.get('parentId') as string;
    const finalParentId = newParentId === '' ? null : newParentId;
    
    // 保存修改前的状态
    const wasExpanded = expandedFolders.has(currentFile.id);
    const oldParentId = currentFile.parentId;
    const fileId = currentFile.id;
    
    try {
        const res = await apiFetch(`/api/docs/${currentFile.id}`, { method: 'PUT', body: formData });
        if (res.ok) {
          const updatedDocData = await res.json();
          const updatedDoc = updatedDocData.doc || updatedDocData;
          
          setShowEditModal(false);
          
          // 如果修改的是根文件（parentId 为 null），需要重新加载根文件列表（因为有分页）
          if (!oldParentId && !finalParentId) {
            // 清除根文件的加载和展开状态
            setLoadedFolders(prev => {
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            });
            setExpandedFolders(prev => {
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            });
            await loadFiles();
            // 如果之前是展开的，重新展开（需要等待 files 更新后再展开）
            if (wasExpanded) {
              setTimeout(() => {
                setExpandedFolders(prev => new Set(prev).add(fileId));
                fetchChildren(fileId, true);
              }, 100);
            }
            // 如果正在预览该文件，也需要更新 currentFile
            if (currentFile && currentFile.id === fileId) {
              // 重新获取最新的文件信息（包含历史记录）
              try {
                const fileRes = await apiFetch(`/api/docs/${fileId}`);
                if (fileRes.ok) {
                  const latestFile = await fileRes.json();
                  setCurrentFile(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      name: latestFile.name || prev.name,
                      level: latestFile.level !== undefined ? latestFile.level : prev.level,
                      dept: latestFile.dept || prev.dept,
                      parentId: latestFile.parentId !== undefined ? latestFile.parentId : prev.parentId,
                      fullNum: latestFile.fullNum || prev.fullNum,
                      prefix: latestFile.prefix || prev.prefix,
                      suffix: latestFile.suffix !== undefined ? latestFile.suffix : prev.suffix,
                      pdfPath: latestFile.pdfPath !== undefined ? latestFile.pdfPath : prev.pdfPath,
                      history: latestFile.history || prev.history
                    };
                  });
                }
              } catch (e) {
                console.error('更新预览文件状态失败:', e);
              }
            }
          } else {
            // 直接更新 files 数组中被修改的文件对象，而不是完全重新加载
            setFiles(prev => {
              if (!Array.isArray(prev)) return prev;
              return prev.map(f => {
                if (f.id === fileId) {
                  // 更新文件对象，保持其他属性不变，包括 pdfPath
                  return {
                    ...f,
                    name: updatedDoc.name || f.name,
                    level: updatedDoc.level !== undefined ? updatedDoc.level : f.level,
                    dept: updatedDoc.dept || f.dept,
                    parentId: finalParentId !== null ? finalParentId : f.parentId,
                    fullNum: updatedDoc.fullNum || f.fullNum,
                    prefix: updatedDoc.prefix || f.prefix,
                    suffix: updatedDoc.suffix !== undefined ? updatedDoc.suffix : f.suffix,
                    pdfPath: updatedDoc.pdfPath !== undefined ? updatedDoc.pdfPath : f.pdfPath,
                  };
                }
                return f;
              });
            });
            
            // 如果正在预览该文件，也需要更新 currentFile
            if (currentFile && currentFile.id === fileId) {
              const oldPdfPath = currentFile.pdfPath;
              const newPdfPath = updatedDoc.pdfPath !== undefined ? updatedDoc.pdfPath : currentFile.pdfPath;
              
              setCurrentFile(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  name: updatedDoc.name || prev.name,
                  level: updatedDoc.level !== undefined ? updatedDoc.level : prev.level,
                  dept: updatedDoc.dept || prev.dept,
                  parentId: finalParentId !== null ? finalParentId : prev.parentId,
                  fullNum: updatedDoc.fullNum || prev.fullNum,
                  prefix: updatedDoc.prefix || prev.prefix,
                  suffix: updatedDoc.suffix !== undefined ? updatedDoc.suffix : prev.suffix,
                  pdfPath: newPdfPath,
                };
              });
              
              // 如果上传了PDF（PDF路径发生了变化），还需要重新获取历史记录
              if (newPdfPath && newPdfPath !== oldPdfPath) {
                try {
                  const fileRes = await apiFetch(`/api/docs/${fileId}`);
                  if (fileRes.ok) {
                    const latestFile = await fileRes.json();
                    setCurrentFile(prev => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        pdfPath: latestFile.pdfPath || prev.pdfPath,
                        history: latestFile.history || prev.history
                      };
                    });
                  }
                } catch (e) {
                  console.error('更新预览文件历史记录失败:', e);
                }
              }
            }
            
            // 无论 parentId 是否改变，都需要清除当前文件的加载状态和展开状态
            // 这样可以确保下次点击时能正常加载子文件，避免状态不一致
            setLoadedFolders(prev => {
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            });
            
            // 清除当前文件的展开状态，用户需要重新点击才能展开
            // 这样可以避免状态不一致导致的问题
            setExpandedFolders(prev => {
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            });
            
            // 如果 parentId 改变了，需要清除相关状态
            if (oldParentId !== finalParentId) {
              // 清除旧父文件和新父文件的加载状态
              setLoadedFolders(prev => {
                const next = new Set(prev);
                if (oldParentId) next.delete(oldParentId);
                if (finalParentId) next.delete(finalParentId);
                return next;
              });
              
              // 如果文件移动到了新的父文件下，且新父文件是展开的，需要重新加载新父文件的子文件
              if (finalParentId && expandedFolders.has(finalParentId)) {
                await fetchChildren(finalParentId, true);
              }
              
              // 如果旧父文件之前是展开的，需要重新加载旧父文件的子文件（因为文件已经移走了）
              if (oldParentId && expandedFolders.has(oldParentId)) {
                await fetchChildren(oldParentId, true);
              }
            }
          }
          
          alert('修改成功');

          // 🔴 记录系统日志
          try {
            await apiFetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'document_info_updated',
                targetType: 'document',
                targetId: currentFile.id,
                userId: user?.id || 'system',
                userName: user?.name || '系统',
                details: `修改文档信息：${currentFile.fullNum} ${currentFile.name}`,
                snapshot: {
                  action: 'document_info_updated',
                  operatorName: user?.name || '未知',
                  operatedAt: nowISOString(),
                  documentInfo: {
                    fullNum: currentFile.fullNum,
                    oldName: currentFile.name,
                    newName: newName,
                    oldLevel: currentFile.level,
                    newLevel: newLevel,
                    oldDept: currentFile.dept,
                    newDept: newDept
                  }
                }
              })
            });
          } catch (logErr) {
            console.error('日志记录失败:', logErr);
          }
        } else alert('保存失败');
    } catch (err) { alert('网络错误'); }
  };

  const handlePreview = async (file: DocFile) => {
    setCurrentFile(file); setShowPreviewModal(true); setPreviewHtml('<div class="text-center p-4">正在解析...</div>');
    setShowAllChildren(false); // 重置为不显示全部状态
    
    // 如果该文件的子文件还没有被加载，自动加载子文件（只有非4级文件可能有子文件）
    if (file.level < 4 && !loadedFolders.has(file.id)) {
      fetchChildren(file.id);
    }
    
    try {
        // 使用 API 路由在服务端处理文件转换，避免在客户端导入 Node 模块
        if (file.type === 'xlsx') {
            // Excel 文件使用专门的转换 API
            const res = await apiFetch(`/api/docs/convert-excel?url=${encodeURIComponent(file.docxPath)}`, {
                cache: 'no-store' // Next.js 16: 明确指定不缓存
            });
            const data = await res.json();
            if (data.html) {
                // 🔒 清理 HTML 内容，防止 XSS 攻击
                const cleanedHtml = sanitizeHtml(data.html);
                setPreviewHtml(`<style>#excel-preview-table { border-collapse: collapse; width: 100%; } #excel-preview-table td, #excel-preview-table th { border: 1px solid #ddd; padding: 8px; font-size: 14px; } #excel-preview-table tr:nth-child(even) { background-color: #f9f9f9; }</style>${cleanedHtml}`);
            } else {
                setPreviewHtml('<div class="text-red-500">Excel 解析失败</div>');
            }
        } else if (file.type === 'docx') {
            // DOCX 文件使用转换 API
            const res = await apiFetch(`/api/docs/convert?url=${encodeURIComponent(file.docxPath)}`, {
                cache: 'no-store' // Next.js 16: 明确指定不缓存
            });
            const data = await res.json();
            // 🔒 清理 HTML 内容，防止 XSS 攻击
            setPreviewHtml(sanitizeHtml(data.html || '<p>空内容</p>'));
        } else { 
            setPreviewHtml('<div class="text-center p-8 text-slate-400">不支持预览</div>'); 
        }
    } catch (err) { 
        console.error('文件预览失败:', err);
        setPreviewHtml('<div class="text-red-500">解析失败，请重试</div>'); 
    }
  };

  const highlightText = (text: string | undefined, keyword: string) => {
    if (!text || !keyword) return null;
    const lowerText = text.toLowerCase();
    const lowerKey = keyword.toLowerCase();
    const index = lowerText.indexOf(lowerKey);
    if (index === -1) return null;
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + keyword.length + 50);
    let snippet = text.substring(start, end);
    // 转义 HTML 特殊字符，防止 XSS
    snippet = snippet.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    // 转义关键字中的特殊字符，用于正则表达式
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');
    const highlighted = snippet.replace(regex, '<span class="bg-yellow-200 font-bold text-slate-900">$1</span>');
    // 🔒 清理高亮 HTML，只保留基本格式化标签
    return sanitizeHighlightHtml(highlighted);
  };

  const renderFileItem = (file: DocFile, depth: number, recursive: boolean, highlightContent?: string | null) => {
    const isFolder = file.level < 4; // Assuming < 4 are folders/categories
    const isExpanded = expandedFolders.has(file.id);

    return (
    <div key={file.id}>
        <div className={`flex flex-col bg-white p-3 md:p-3 rounded-lg border border-slate-200 hover:shadow-sm hover:border-blue-300 transition-all group ${depth > 0 && !highlightContent ? 'ml-3 md:ml-8 relative' : ''}`}>
            {depth > 0 && !highlightContent && <div className="absolute -left-2 md:-left-6 top-1/2 -translate-y-1/2 w-2 md:w-4 h-px bg-slate-300"></div>}
            <div className="flex items-start justify-between gap-2">
                {/* 左侧：图标 + 文件信息 */}
                <div className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => isFolder ? toggleFolder(file) : handlePreview(file)}>
                    {/* 文件图标 */}
                    <div className={`p-1.5 md:p-2 rounded-lg shrink-0 ${file.level === 1 ? 'bg-blue-100 text-blue-600' : file.level === 4 ? ((file.type || 'docx') === 'xlsx' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600') : 'bg-slate-100 text-slate-600'}`}>
                        {file.level === 1 ? <FolderOpen size={16} className="md:w-5 md:h-5" /> : (file.type || 'docx') === 'xlsx' ? <Sheet size={16} className="md:w-5 md:h-5" /> : file.level === 4 ? <FileIcon size={16} className="md:w-5 md:h-5" /> : <FileText size={16} className="md:w-5 md:h-5" />}
                    </div>
                    
                    {/* 文件信息 */}
                    <div className="flex-1 min-w-0">
                        {/* 编号（独立一行，移动端更醒目） */}
                        <div className="mb-1">
                            <span className="inline-block text-[10px] md:text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">
                                {file.fullNum || '无编号'}
                            </span>
                        </div>
                        
                        {/* 文件名（允许换行） */}
                        <div className="mb-1.5">
                            <span className="text-sm md:text-base font-medium text-slate-800 leading-snug break-words group-hover:text-blue-600">
                                {file.name || '未命名文档'}
                            </span>
                            {/* 文件类型标签 */}
                            <div className="inline-flex items-center gap-1 ml-2">
                                {file.type === 'xlsx' && <span className="text-[9px] md:text-[10px] bg-green-50 text-green-600 border border-green-200 px-1 py-0.5 rounded font-semibold">XLSX</span>}
                                {file.pdfPath && <span className="text-[9px] md:text-[10px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5 rounded font-semibold">PDF</span>}
                            </div>
                        </div>
                        
                        {/* 元信息（允许换行） */}
                        <div className="text-[11px] md:text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-flex items-center bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                                {file.level}级
                            </span>
                            <span className="break-all max-w-[150px] md:max-w-none">
                                {file.dept || '未设置'}
                            </span>
                            <span className="hidden sm:inline text-slate-300">•</span>
                            <span className="whitespace-nowrap">
                                {toLocaleDateString(file.uploadTime, 'zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* 右侧：操作按钮 */}
                {/* 移动端：竖向排列，始终可见 */}
                <div className="flex md:hidden flex-col gap-1 shrink-0">
                    <button 
                        title="预览" 
                        onClick={(e) => { e.stopPropagation(); handlePreview(file); }} 
                        className="p-2 hover:bg-blue-50 rounded text-slate-600 hover:text-blue-600 active:bg-blue-100 transition-colors"
                    >
                        <Eye size={16} />
                    </button>
                    {canDownloadSource(file) && (
                        <button 
                            title={`下载 ${(file.type || 'docx').toUpperCase()}`} 
                            onClick={(e) => { e.stopPropagation(); handleDownload(file, 'source'); }} 
                            className={`p-2 rounded transition-colors ${file.type === 'xlsx' ? 'hover:bg-green-50 text-green-600 active:bg-green-100' : 'hover:bg-blue-50 text-blue-600 active:bg-blue-100'}`}
                        >
                            <Download size={16} />
                        </button>
                    )}
                </div>
                
                {/* 桌面端：横向排列，悬停显示 */}
                <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button title="预览" onClick={() => handlePreview(file)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><Eye size={16} /></button>
                    {canDownloadSource(file) && <button title={`下载 ${(file.type || 'docx').toUpperCase()}`} onClick={() => handleDownload(file, 'source')} className={`p-1.5 rounded font-bold text-xs flex items-center gap-1 ${file.type === 'xlsx' ? 'hover:bg-green-50 hover:text-green-600' : 'hover:bg-blue-50 hover:text-blue-600 text-slate-500'}`}><Download size={14} /> {file.type === 'xlsx' ? 'E' : 'W'}</button>}
                    {hasPerm('upload') && <button title="更新" onClick={() => { setCurrentFile(file); setShowUpdateModal(true); }} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded text-slate-500"><RefreshCw size={16} /></button>}
                    {hasPerm('edit') && <button title="编辑" onClick={() => { setCurrentFile(file); setEditLevel(file.level); setShowEditModal(true); }} className="p-1.5 hover:bg-orange-50 hover:text-orange-600 rounded text-slate-500"><Edit size={16} /></button>}
                    {hasPerm('delete') && <button title="删除" onClick={() => handleDelete(file.id)} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-500"><Trash2 size={16} /></button>}
                </div>
            </div>
            
            {/* 搜索高亮内容 */}
            {highlightContent && (
                <div className="mt-3 ml-0 md:ml-11 p-2.5 bg-yellow-50 rounded text-xs text-slate-600 border border-yellow-200">
                    <div className="flex gap-1.5">
                        <span className="font-bold text-yellow-700 shrink-0">匹配:</span>
                        <span className="break-words" dangerouslySetInnerHTML={{ __html: `...${highlightContent}...` }} />
                    </div>
                </div>
            )}
        </div>
        {recursive && isExpanded && renderTree(file.id, depth + 1)}
    </div>
  )};

  const renderTree = (parentId: string | null, depth: number = 0) => {
    // 确保 files 是数组
    if (!Array.isArray(files)) {
      console.error('files is not an array:', files);
      return <div className="text-center py-20 text-slate-400">数据加载错误</div>;
    }

    // === 核心逻辑修改：是否处于"筛选/搜索模式" ===
    const isFiltering = !!(searchTerm || deptFilter || levelFilter || startDate || endDate);

    // 1. 筛选/搜索模式：扁平化展示所有匹配项 (包含 4级文件)
    if (isFiltering) {
        if (depth > 0) return null; // 只渲染一次
        
        let filtered = files;

        // 应用所有筛选条件
        if (deptFilter) filtered = filtered.filter(f => f.dept === deptFilter);
        if (levelFilter) filtered = filtered.filter(f => f.level === parseInt(levelFilter));
        // 开始时间设置为当天的 00:00:00，结束时间设置为当天的 23:59:59.999
        if (startDate) {
          const start = setStartOfDay(startDate);
          filtered = filtered.filter(f => f.uploadTime >= start.getTime());
        }
        if (endDate) {
          const end = setEndOfDay(endDate);
          filtered = filtered.filter(f => f.uploadTime <= end.getTime());
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            const nameMatches = filtered.filter(f => f.name.toLowerCase().includes(lowerTerm) || f.fullNum.includes(lowerTerm));
            const contentMatches = filtered.filter(f => {
                if (nameMatches.find(n => n.id === f.id)) return false;
                if (!f.searchText) return false;
                return f.searchText.toLowerCase().includes(lowerTerm);
            });

            if (nameMatches.length === 0 && contentMatches.length === 0) return <div className="text-center py-20 text-slate-400">无搜索结果</div>;

            return (
                <div className="space-y-4">
                    {nameMatches.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">文件名匹配 ({nameMatches.length})</h3>
                            {nameMatches.map(f => renderFileItem(f, 0, false, null))}
                        </div>
                    )}
                    {contentMatches.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">全文内容匹配 ({contentMatches.length})</h3>
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">Markdown/Text</span>
                            </div>
                            {contentMatches.map(f => {
                                const snippet = highlightText(f.searchText, searchTerm);
                                return renderFileItem(f, 0, false, snippet);
                            })}
                        </div>
                    )}
                </div>
            );
        }

        // 如果没有关键词，仅有筛选条件，直接渲染列表
        if (filtered.length === 0) return <div className="text-center py-20 text-slate-400">暂无匹配文件</div>;
        return <div className="space-y-2">{filtered.map(f => renderFileItem(f, 0, false, null))}</div>;
    }

    // 2. 默认模式：树状展示 (隐藏 4级文件)
    let levelFiles = files.filter(f => f.parentId === parentId);
    
    // 关键点：默认树状图中，过滤掉 4级文件
    levelFiles = levelFiles.filter(f => f.level !== 4);

    levelFiles.sort((a, b) => a.level - b.level);
    if (levelFiles.length === 0 && depth === 0) return <div className="text-center py-20 text-slate-400">暂无文档</div>;
    return <div className="space-y-2">{levelFiles.map(file => <div key={file.id}>{renderFileItem(file, depth, true)}</div>)}</div>;
  };

  const getBreadcrumbs = (file: DocFile) => {
    const chain = []; let currentId = file.parentId; let safe = 0;
    while (currentId && safe < 10) { const parent = files.find(f => f.id === currentId); if (parent) { chain.unshift(parent); currentId = parent.parentId; } else break; safe++; }
    return chain;
  };
  const getChildrenPreview = (file: DocFile) => files.filter(f => f.parentId === file.id);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between mb-3 md:mb-6 shrink-0 px-2 md:px-0">
         <div className="flex items-center gap-2 md:gap-4">
           <Link href="/dashboard" className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full text-slate-500">
             <ArrowLeft size={20} className="md:hidden" />
             <ArrowLeft size={24} className="hidden md:block" />
           </Link>
           <div>
             <h1 className="text-lg md:text-2xl font-bold text-slate-900">文档管理系统</h1>
             <p className="text-xs md:text-sm text-slate-500 hidden sm:block">EHS 体系文件库</p>
           </div>
         </div>
         
         {/* 🔴 水印编辑按钮 - 全局设置 */}
         {hasPerm('edit_watermark') && (
           <button 
             onClick={() => {
               setTempWatermarkText(watermarkText);
               setTempWatermarkIncludeUser(watermarkIncludeUser);
               setTempWatermarkIncludeTime(watermarkIncludeTime);
               setShowWatermarkModal(true);
             }}
             className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
             title="编辑全局水印"
           >
             <Droplet size={18} className="md:w-5 md:h-5" />
             <span className="hidden md:inline text-sm font-medium">水印设置</span>
           </button>
         )}
      </div>

      {/* 🔴 移动端搜索和筛选触发条 */}
      <div className="flex gap-2 mb-3 px-2 md:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="搜索文档名称..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-hytzer-blue focus:border-transparent shadow-sm"
          />
        </div>
        <button 
          onClick={() => setIsFilterOpen(true)}
          className="p-2.5 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 active:bg-slate-100 shadow-sm shrink-0"
        >
          <Filter size={20} />
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 gap-3 md:gap-6 overflow-hidden px-2 md:px-0">
         {/* 🔴 侧边栏改为抽屉式 */}
         <div className={`
           fixed inset-0 z-[60] md:relative md:z-auto
           ${isFilterOpen ? 'block' : 'hidden md:block'}
         `}>
           {/* 遮罩层 (仅移动端) */}
           <div 
             className="absolute inset-0 bg-black/40 md:hidden" 
             onClick={() => setIsFilterOpen(false)}
           />
           
           {/* 抽屉内容 */}
           <div className={`
             absolute right-0 top-0 bottom-0 w-80 md:relative md:w-80
             bg-white rounded-l-xl md:rounded-xl shadow-2xl md:shadow-sm 
             border-l md:border border-slate-200 
             p-5 flex flex-col gap-6 overflow-y-auto
             ${isFilterOpen ? 'animate-in slide-in-from-right duration-300' : ''}
           `}>
             {/* 移动端关闭按钮 */}
             <button 
               onClick={() => setIsFilterOpen(false)}
               className="md:hidden absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-500"
             >
               ✕
             </button>

             <h3 className="text-lg font-bold text-slate-900 md:hidden">筛选条件</h3>
             
             {/* 1. 桌面端搜索 (移动端隐藏) */}
             <div className="relative hidden md:block">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
               <input 
                 type="text" 
                 placeholder="搜索..." 
                 value={searchTerm} 
                 onChange={e => setSearchTerm(e.target.value)} 
                 className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-hytzer-blue" 
               />
             </div>
             
             {/* 2. 部门筛选 */}
             <div>
               <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                 <Filter size={14} /> 部门筛选
               </label>
               <select 
                 value={deptFilter} 
                 onChange={e => {
                   setDeptFilter(e.target.value);
                   setIsFilterOpen(false); // 🔴 选择后自动关闭抽屉
                 }} 
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-hytzer-blue"
               >
                 <option value="">全部部门</option>
                 {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
               </select>
             </div>
             
             {/* 3. 级别筛选 */}
             <div>
               <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                 <Layers size={14} /> 文件级别
               </label>
               <select 
                 value={levelFilter} 
                 onChange={e => {
                   setLevelFilter(e.target.value);
                   setIsFilterOpen(false); // 🔴 选择后自动关闭抽屉
                 }} 
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-hytzer-blue"
               >
                 <option value="">全部级别</option>
                 {[1, 2, 3, 4].map(l => <option key={l} value={l}>{l}级文件</option>)}
               </select>
             </div>

             {/* 4. 时间筛选 */}
             <div>
               <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                 <Calendar size={14} /> 发布时间
               </label>
               <div className="flex flex-col gap-2">
                 <input 
                   type="date" 
                   value={startDate} 
                   onChange={e => setStartDate(e.target.value)} 
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-hytzer-blue" 
                 />
                 <div className="text-center text-slate-400 text-xs">至</div>
                 <input 
                   type="date" 
                   value={endDate} 
                   onChange={e => setEndDate(e.target.value)}
                   min={endDateMin}
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-hytzer-blue" 
                 />
               </div>
             </div>

             {/* 清空筛选按钮 */}
             {(deptFilter || levelFilter || startDate || endDate) && (
               <button
                 onClick={() => {
                   setDeptFilter('');
                   setLevelFilter('');
                   setStartDate('');
                   setEndDate('');
                   setIsFilterOpen(false);
                 }}
                 className="w-full py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
               >
                 清空筛选
               </button>
             )}

             <div className="border-t border-slate-100 my-2"></div>

             {/* 🔴 操作日志按钮 (仅 admin 可见) */}
             {isAdmin && (
               <button
                 onClick={() => {
                   setShowLogModal(true);
                   setIsFilterOpen(false);
                 }}
                 className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 rounded-lg hover:from-purple-100 hover:to-indigo-100 transition-all border border-purple-200 font-medium"
               >
                 <Activity size={18} />
                 查看操作日志
               </button>
             )}

             {/* 上传按钮 (桌面端显示) */}
             {hasPerm('upload') ? (
               <button 
                 onClick={() => { 
                   setShowUploadModal(true); 
                   setUploadLevel(1); 
                   setIsFilterOpen(false); // 🔴 打开上传弹窗后关闭抽屉
                 }} 
                 className="hidden md:flex w-full bg-hytzer-blue text-white py-3 rounded-lg items-center justify-center gap-2 hover:bg-blue-600 shadow-lg shadow-blue-500/20 font-medium"
               >
                 <Upload size={18} /> 上传文件
               </button>
             ) : (
               <div className="hidden md:block p-4 bg-slate-50 text-slate-400 text-sm text-center rounded-lg border border-dashed">
                 暂无上传权限
               </div>
             )}
           </div>
         </div>
         {/* 内容区域 */}
         <div className="flex-1 bg-slate-50/50 rounded-lg md:rounded-xl border border-slate-200 p-3 md:p-6 overflow-y-auto custom-scrollbar flex flex-col">
           <div className="flex-1">
               {loading ? <div className="text-center py-10 text-sm">加载中...</div> : renderTree(null)}
           </div>

           {/* Pagination Controls (Only for Root/List) */}
           {!searchTerm && !startDate && !deptFilter && totalPages > 1 && (
               <div className="mt-4 flex justify-center items-center gap-4">
                   <button
                      onClick={() => loadFiles(page - 1)}
                      disabled={page === 1}
                      className="px-3 py-1 bg-white border rounded disabled:opacity-50 hover:bg-slate-50 text-sm"
                   >
                       上一页
                   </button>
                   <span className="text-sm text-slate-600">第 {page} 页 / 共 {totalPages} 页</span>
                   <button
                      onClick={() => loadFiles(page + 1)}
                      disabled={page === totalPages}
                      className="px-3 py-1 bg-white border rounded disabled:opacity-50 hover:bg-slate-50 text-sm"
                   >
                       下一页
                   </button>
               </div>
           )}
         </div>
      </div>

      {/* 🔴 悬浮上传按钮 (仅移动端) */}
      {hasPerm('upload') && (
        <button
          onClick={() => { 
            setShowUploadModal(true); 
            setUploadLevel(1); 
          }}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-hytzer-blue text-white rounded-full shadow-2xl hover:bg-blue-600 active:scale-95 transition-transform flex items-center justify-center z-50"
        >
          <Upload size={24} />
        </button>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-3 md:p-0">
            <div className="bg-white rounded-xl w-full max-w-md p-4 md:p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold mb-4">上传新文档</h3>
                <form onSubmit={handleUpload} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">级别</label>
                            <select name="level" value={uploadLevel} onChange={(e) => setUploadLevel(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg outline-none">
                                {[1,2,3,4].map(l => <option key={l} value={l}>{l}级</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">部门</label>
                            <input name="dept" type="text" required defaultValue={user?.department} readOnly={!isAdmin} className={`w-full px-3 py-2 border rounded-lg outline-none ${!isAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} />
                        </div>
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">源文件 *</label><input name="file" type="file" accept={uploadLevel === 4 ? ".docx,.xlsx" : ".docx"} required className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/><p className="text-xs text-slate-400 mt-1">{uploadLevel === 4 ? '支持 .docx 或 .xlsx' : '仅支持 .docx'}</p></div>
                    {uploadLevel < 4 ? (<div><label className="block text-sm font-medium text-slate-700 mb-1">前缀编号</label><input name="prefix" type="text" placeholder="ESH-XF" required className="w-full px-3 py-2 border rounded-lg outline-none uppercase" /></div>) : (<div className="p-3 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-100"><strong>4级文件模式：</strong><br/>无需输入前缀，编号将自动继承自“上级文件”。<br/>例如：上级 ESH-001 &rarr; 本文件 ESH-001-001</div>)}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">上级文件 {uploadLevel === 4 && <span className="text-red-500">*</span>}</label>
                        <select name="parentId" required={uploadLevel === 4} className="w-full px-3 py-2 border rounded-lg outline-none">
                            <option value="">-- 无 --</option>
                            {files.filter(f => f.level === uploadLevel - 1).map(f => <option key={f.id} value={f.id}>[{f.fullNum}] {f.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                      <button 
                        type="button" 
                        onClick={() => setShowUploadModal(false)} 
                        disabled={uploading}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        取消
                      </button>
                      <button 
                        type="submit" 
                        disabled={uploading}
                        className="px-4 py-2 bg-hytzer-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {uploading ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            上传中...
                          </>
                        ) : (
                          '提交'
                        )}
                      </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && currentFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-fade-in">
                <h3 className="text-lg font-bold mb-4">修改文件信息</h3>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded text-sm text-slate-500 mb-4 border border-slate-200">当前编号: <strong>{currentFile.fullNum || '无编号'}</strong> (自动生成，不可修改)</div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">文件名称</label><input name="name" type="text" required defaultValue={currentFile.name || ''} className="w-full px-3 py-2 border rounded-lg outline-none" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">级别</label>
                            <select name="level" value={editLevel} onChange={(e) => setEditLevel(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg outline-none">
                                {[1,2,3,4].map(l => <option key={l} value={l}>{l}级</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">部门</label>
                            <input name="dept" type="text" required defaultValue={currentFile.dept || ''} readOnly={!isAdmin} className={`w-full px-3 py-2 border rounded-lg outline-none ${!isAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">上级文件</label>
                        <select name="parentId" defaultValue={currentFile.parentId || ''} className="w-full px-3 py-2 border rounded-lg outline-none bg-yellow-50">
                            <option value="">-- 设为根文件 --</option>
                            {files.filter(f => f.level === editLevel - 1 && f.id !== currentFile!.id).map(f => <option key={f.id} value={f.id}>[{f.fullNum}] {f.name}</option>)}
                        </select>
                    </div>
                    <div className="pt-4 border-t border-slate-100"><label className="block text-sm font-medium text-slate-700 mb-1">更新 PDF 附件 (旧 PDF 将移入历史)</label><input name="pdfFile" type="file" accept=".pdf" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-red-50 file:text-red-700 hover:file:bg-red-100"/>{currentFile.pdfPath && <p className="text-xs text-green-600 mt-1">✓ 当前已包含 PDF 副本</p>}</div>
                    <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-hytzer-blue text-white rounded-lg hover:bg-blue-600">保存修改</button></div>
                </form>
            </div>
        </div>
      )}

      {/* Update Version Modal & Preview Modal 保持不变 */}
      {showUpdateModal && currentFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
                <h3 className="text-lg font-bold mb-2">更新文档版本</h3>
                <p className="text-sm text-slate-500 mb-4">上传新文件将覆盖当前版本，旧文件将自动存入“历史文件清单”。</p>
                <form onSubmit={handleUpdateVersion} className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 border border-slate-200">正在更新: <strong>{currentFile.fullNum || '无编号'} {currentFile.name || '未命名文档'}</strong></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">新源文件 *</label><input name="mainFile" type="file" accept={currentFile.level === 4 ? ".docx,.xlsx" : ".docx"} required className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/><p className="text-xs text-slate-400 mt-1">当前类型: {currentFile.type || 'docx'}。{currentFile.level === 4 ? '支持更新为 .docx 或 .xlsx' : '仅支持 .docx'}</p></div>
                    <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setShowUpdateModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">确认更新</button></div>
                </form>
            </div>
        </div>
      )}

      {showPreviewModal && currentFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg md:rounded-xl w-full max-w-5xl h-[95vh] md:h-[90vh] flex flex-col shadow-2xl animate-fade-in">
            <div className="p-4 border-b flex justify-between items-start bg-slate-50 rounded-t-xl">
                <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><span className="bg-slate-200 px-1 rounded">ROOT</span>{getBreadcrumbs(currentFile).map(p => <div key={p.id} className="flex items-center gap-2"><ChevronRight size={10} /><span className="hover:text-blue-600 cursor-pointer" onClick={() => handlePreview(p)}>{p.name || '未命名'}</span></div>)}</div>
                    <div className="flex items-center gap-2"><h3 className="text-lg font-bold text-slate-900">{currentFile.name || '未命名文档'}</h3><span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{currentFile.fullNum || '无编号'}</span>{currentFile.type === 'xlsx' && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded border border-green-200">EXCEL</span>}</div>
                </div>
                <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">❌</button>
            </div>
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-3 md:p-8 bg-slate-100">
                    <div className={`bg-white shadow-sm p-4 md:p-10 min-h-full mx-auto relative ${currentFile.type === 'xlsx' ? 'max-w-full overflow-x-auto' : 'max-w-3xl prose prose-slate prose-sm md:prose'}`}>
                        <div 
                          className="select-none"
                          dangerouslySetInnerHTML={{ __html: previewHtml }}
                          onCopy={(e) => e.preventDefault()}
                          onContextMenu={(e) => e.preventDefault()}
                          style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
                        />
                        {/* 🔴 水印层 - 仅覆盖预览文件内容区域 */}
                        {(watermarkText || watermarkIncludeUser || watermarkIncludeTime) && (
                          <Watermark 
                            text={watermarkText} 
                            relative={true}
                            includeUser={watermarkIncludeUser}
                            includeTime={watermarkIncludeTime}
                            user={user}
                          />
                        )}
                    </div>
                </div>
                <div className="w-full md:w-72 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-3 md:p-4 overflow-y-auto shrink-0 flex flex-col gap-4 md:gap-6 max-h-[30vh] md:max-h-none">
                    <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><CornerDownRight size={14} /> 下级关联文件</h4>
                        <div className="space-y-2">
                            {(() => {
                                const children = getChildrenPreview(currentFile);
                                const displayCount = showAllChildren ? children.length : 3;
                                return children.slice(0, displayCount).map(child => (
                                    <div key={child.id} onClick={() => handlePreview(child)} className="p-2 border border-slate-100 rounded hover:bg-blue-50 cursor-pointer">
                                        <div className="text-xs text-slate-500">{child.fullNum || '无编号'}</div>
                                        <div className="text-sm font-medium text-slate-800 truncate">{child.name || '未命名文档'}</div>
                                    </div>
                                ));
                            })()}
                            {getChildrenPreview(currentFile).length === 0 && <p className="text-xs text-slate-400 py-2 text-center">无下级文件</p>}
                            {getChildrenPreview(currentFile).length > 3 && (
                                <div className="text-center pt-2">
                                    <button 
                                        onClick={() => setShowAllChildren(!showAllChildren)}
                                        className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1 w-full"
                                    >
                                        <MoreHorizontal size={12} /> {showAllChildren ? '收起' : '查看全部'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-2">下载当前版本</h4>
                        <div className="space-y-2">
                            {(() => {
                                const canDownloadSrc = canDownloadSource(currentFile);
                                const canDownloadPdf = hasPerm('down_pdf') && currentFile.pdfPath;
                                const hasPdf = !!currentFile.pdfPath;
                                
                                // 如果两个都无权下载，合并显示
                                if (!canDownloadSrc && !canDownloadPdf && hasPdf) {
                                    return <div className="text-xs text-slate-400 px-3 py-1">您无权下载</div>;
                                }
                                
                                // 分别显示各个下载选项
                                return (
                                    <>
                                        {canDownloadSrc ? (
                                            <button onClick={() => handleDownload(currentFile, 'source')} className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${currentFile.type === 'xlsx' ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                                                <Download size={14} /> 源文件 ({(currentFile.type || 'docx').toUpperCase()})
                                            </button>
                                        ) : (
                                            <div className="text-xs text-slate-400 px-3 py-1">您无权下载源文件</div>
                                        )}
                                        {canDownloadPdf ? (
                                            <button onClick={() => handleDownload(currentFile, 'pdf')} className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded text-sm hover:bg-red-100">
                                                <Download size={14} /> 副本 (PDF)
                                            </button>
                                        ) : hasPdf ? (
                                            <div className="text-xs text-slate-400 px-3 py-1">您无权下载 PDF 副本</div>
                                        ) : (
                                            <div className="text-xs text-slate-400 px-3 py-1">PDF 副本未上传</div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><History size={14} /> 历史文件清单</h4>
                        {currentFile.history && currentFile.history.length > 0 ? (
                            <div className="space-y-3">
                                {currentFile.history.map((h, idx) => (
                                    <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-100 text-xs">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium text-slate-700 truncate w-32" title={h.name}>{h.name}</span>
                                            <span className="text-slate-400 bg-white px-1 rounded border uppercase">{h.type}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-slate-400 mb-2"><Clock size={10} /> {toLocaleDateString(h.uploadTime)}</div>
                                        <div className="flex justify-end gap-2">
                                            {((h.type === 'pdf' && hasPerm('down_pdf')) || (h.type !== 'pdf' && canDownloadSource(currentFile))) && (<button onClick={() => handleDownloadUrl(h.path, h.name)} className="text-blue-600 hover:underline flex items-center gap-1"><Download size={12} /> 下载</button>)}
                                            {hasPerm('delete') && (<button onClick={() => handleDeleteHistory(currentFile.id, h.id)} className="text-red-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={12} /> 删除</button>)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (<p className="text-xs text-slate-400 py-2 text-center">暂无历史版本</p>)}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 系统操作日志弹窗 */}
      <SystemLogModal 
        isOpen={showLogModal} 
        onClose={() => setShowLogModal(false)} 
      />

      {/* 🔴 水印编辑弹窗 */}
      {showWatermarkModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-3 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="p-4 md:p-6 border-b bg-slate-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Droplet size={20} className="text-blue-600" />
                编辑预览水印
              </h3>
              <p className="text-sm text-slate-500 mt-1">设置文档预览时的水印文字</p>
            </div>
            
            <div className="p-4 md:p-6 space-y-4">
              {/* 输入框 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  水印文字
                </label>
                <input
                  type="text"
                  value={tempWatermarkText}
                  onChange={(e) => setTempWatermarkText(e.target.value)}
                  placeholder="例如：机密文件 · 请勿外传"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  maxLength={50}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-slate-400">
                    留空则不显示水印
                  </p>
                  <p className="text-xs text-slate-400">
                    {tempWatermarkText.length}/50
                  </p>
                </div>
              </div>

              {/* 🔴 动态选项 */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  动态信息选项
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempWatermarkIncludeUser}
                      onChange={(e) => setTempWatermarkIncludeUser(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">包含用户名及用户ID</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempWatermarkIncludeTime}
                      onChange={(e) => setTempWatermarkIncludeTime(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">包含当前系统时间</span>
                  </label>
                </div>
              </div>

              {/* 预览区域 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  效果预览
                </label>
                <div className="relative bg-slate-100 rounded-lg p-8 min-h-[200px] border-2 border-dashed border-slate-300 overflow-hidden">
                  {(tempWatermarkText || tempWatermarkIncludeUser || tempWatermarkIncludeTime) && (
                    <Watermark 
                      text={tempWatermarkText} 
                      relative={true}
                      includeUser={tempWatermarkIncludeUser}
                      includeTime={tempWatermarkIncludeTime}
                      user={user}
                    />
                  )}
                  <div className="relative z-10 bg-white p-6 rounded shadow-sm">
                    <h4 className="text-base font-bold text-slate-900 mb-2">示例文档标题</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      这是一段示例文本，用于展示水印效果。水印将以半透明的方式平铺在整个文档背景上，不影响内容阅读。
                    </p>
                    <div className="mt-3 flex gap-2">
                      <div className="h-2 bg-slate-200 rounded flex-1"></div>
                      <div className="h-2 bg-slate-200 rounded flex-1"></div>
                      <div className="h-2 bg-slate-200 rounded w-20"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 提示信息 */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs text-blue-800 flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">💡</span>
                  <span>
                    水印仅在预览界面显示，不会影响实际文件下载内容。建议使用简短文字以获得最佳显示效果。
                  </span>
                </p>
              </div>
            </div>

            {/* 按钮区域 */}
            <div className="p-4 md:p-6 border-t bg-slate-50 rounded-b-xl flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowWatermarkModal(false);
                  setTempWatermarkText(watermarkText); // 恢复原值
                  setTempWatermarkIncludeUser(watermarkIncludeUser);
                  setTempWatermarkIncludeTime(watermarkIncludeTime);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await apiFetch('/api/docs/watermark', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        text: tempWatermarkText,
                        includeUser: tempWatermarkIncludeUser,
                        includeTime: tempWatermarkIncludeTime
                      })
                    });
                    
                    if (res.ok) {
                      setWatermarkText(tempWatermarkText);
                      setWatermarkIncludeUser(tempWatermarkIncludeUser);
                      setWatermarkIncludeTime(tempWatermarkIncludeTime);
                      setShowWatermarkModal(false);
                      alert('水印设置已保存');
                    } else {
                      alert('保存失败，请重试');
                    }
                  } catch (error) {
                    console.error('保存水印配置失败:', error);
                    alert('保存失败，请重试');
                  }
                }}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Droplet size={16} />
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
