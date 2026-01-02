"use client";
import { useState, useRef, useEffect } from 'react';
import Watermark from '@/components/common/Watermark';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { sanitizeHtml } from '@/lib/htmlSanitizer';

interface Props {
  url: String;
  type: string;
  onProgress?: (progress: number) => void; // 0-100
  onComplete?: () => void;
  isExamRequired?: boolean; // 是否有考试要求
  onStartExam?: () => void; // 开始考试回调
}

export default function FileViewer({ url, type, onProgress, onComplete, isExamRequired, onStartExam }: Props) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user } = useAuth();
  
  // 🔴 水印配置状态
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true);
  const [watermarkIncludeUser, setWatermarkIncludeUser] = useState<boolean>(false);
  const [watermarkIncludeTime, setWatermarkIncludeTime] = useState<boolean>(false);
  
  // 🔴 加载水印配置
  useEffect(() => {
    apiFetch('/api/training/settings')
      .then(res => res.json())
      .then(data => {
        setWatermarkText(data.watermarkText || '');
        setWatermarkEnabled(data.watermarkEnabled !== false);
        setWatermarkIncludeUser(data.watermarkIncludeUser || false);
        setWatermarkIncludeTime(data.watermarkIncludeTime || false);
      })
      .catch(err => console.error('加载水印配置失败:', err));
  }, []);

  // Video Handling
  useEffect(() => {
    if (type === 'video' && videoRef.current) {
      const video = videoRef.current;

      const handleTimeUpdate = () => {
        if (video.duration) {
          const percent = (video.currentTime / video.duration) * 100;
          onProgress?.(percent);

          // Rule: 95% watched = pass
          if (percent >= 95) {
            onComplete?.();
          }
        }
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [type, onProgress, onComplete]);

  // DOCX Handling - 使用 API 路由在服务端处理，避免在客户端导入 Node 模块
  useEffect(() => {
    if (type === 'docx') {
      setLoading(true);
      // 使用 API 路由在服务端处理 DOCX 转换
      apiFetch(`/api/docs/convert?url=${encodeURIComponent(url as string)}`, {
        cache: 'no-store' // Next.js 16: 明确指定不缓存
      })
        .then(res => res.json())
        .then(data => {
           // 🔒 清理 HTML 内容，防止 XSS 攻击
           setHtmlContent(sanitizeHtml(data.html || ''));
           // Assume viewed if loaded for docs
           onProgress?.(100);
        })
        .catch(err => {
          console.error('DOCX 转换失败:', err);
          setHtmlContent('<div class="text-red-500">文档加载失败，请重试</div>');
        })
        .finally(() => setLoading(false));
    }
  }, [url, type, onProgress]);

  // Scroll Handling for Docs (Bottom Detection)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
     if (type === 'docx') {
         const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
         // Give some buffer (e.g., 50px)
         // 浏览到最后一页 (scrolled to bottom)
         if (scrollHeight - scrollTop - clientHeight < 50) {
             onComplete?.();
         }

         const percent = (scrollTop / (scrollHeight - clientHeight)) * 100;
         onProgress?.(Math.min(percent, 100));
     }
  };

  // PDF错误处理和文件存在性检查
  useEffect(() => {
    if (type === 'pdf') {
      // 检查文件是否存在
      const checkFileExists = async () => {
        try {
          const filePath = url.startsWith('/') ? url : `/${url}`;
          const res = await apiFetch(`/api/files/check?path=${encodeURIComponent(filePath)}`);
          const data = await res.json();
          
          if (!data.exists) {
            setPdfError('文件不存在，可能已被删除或路径错误');
          } else if (!data.isFile) {
            setPdfError('路径指向的不是文件');
          } else {
            setPdfError(null);
          }
        } catch (err) {
          console.error('检查文件存在性失败:', err);
          // 不设置错误，让iframe尝试加载，如果失败会触发onError
        }
      };

      checkFileExists();

      if (iframeRef.current) {
        const iframe = iframeRef.current;
        
        const handleLoad = () => {
          // 检查iframe是否成功加载
          try {
            // 如果iframe的contentDocument不可访问（跨域），无法直接检查
            // 但可以通过检查iframe的src是否改变来判断
            setPdfError(null);
          } catch (e) {
            // 跨域限制，无法检查内容
          }
        };

        const handleError = () => {
          setPdfError('文件加载失败，文件可能不存在或已损坏');
        };

        iframe.addEventListener('load', handleLoad);
        iframe.addEventListener('error', handleError);

        return () => {
          iframe.removeEventListener('load', handleLoad);
          iframe.removeEventListener('error', handleError);
        };
      }
    }
  }, [type, url]);

  if (type === 'video') {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center relative">
        {watermarkEnabled && (watermarkText || watermarkIncludeUser || watermarkIncludeTime) && (
          <Watermark 
            text={watermarkText} 
            relative={true}
            includeUser={watermarkIncludeUser}
            includeTime={watermarkIncludeTime}
            user={user}
          />
        )}
        <video
            ref={videoRef}
            src={url as string}
            controls
            className="max-h-full max-w-full"
            controlsList="nodownload"
        />
      </div>
    );
  }

  // PDF滚动检测处理（注意：PDF在iframe中可能无法直接检测，主要依赖手动确认）
  const handlePdfScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (type === 'pdf') {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      // 检测是否滚动到底部（允许50px的误差）
      if (scrollHeight - scrollTop - clientHeight < 50) {
        onComplete?.();
      }
      
      // 计算进度
      const percent = (scrollHeight - clientHeight > 0) 
        ? (scrollTop / (scrollHeight - clientHeight)) * 100 
        : 0;
      onProgress?.(Math.min(percent, 100));
    }
  };

  if (type === 'pdf') {
     // 构建PDF URL，确保正确处理URL编码
     const pdfUrl = url.startsWith('/') 
       ? `${url}#toolbar=0&navpanes=0`
       : `/${url}#toolbar=0&navpanes=0`;
     
     return (
        <div className="w-full h-full relative flex flex-col">
            {watermarkEnabled && (watermarkText || watermarkIncludeUser || watermarkIncludeTime) && (
              <Watermark 
                text={watermarkText} 
                relative={true}
                includeUser={watermarkIncludeUser}
                includeTime={watermarkIncludeTime}
                user={user}
              />
            )}
            {pdfError ? (
              <div className="flex-1 flex items-center justify-center bg-slate-100">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                  <div className="text-red-500 text-xl font-bold mb-4">⚠️ 文件加载失败</div>
                  <div className="text-slate-600 mb-4">{pdfError}</div>
                  <div className="text-sm text-slate-500 mb-4">
                    文件路径: <code className="bg-slate-100 px-2 py-1 rounded text-xs break-all">{url}</code>
                  </div>
                  <button 
                    onClick={() => {
                      setPdfError(null);
                      if (iframeRef.current) {
                        iframeRef.current.src = pdfUrl;
                      }
                    }} 
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    重试
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-auto" onScroll={handlePdfScroll}>
                  <iframe 
                    ref={iframeRef}
                    src={pdfUrl} 
                    className="w-full h-full border-0"
                    onError={() => setPdfError('文件加载失败，文件可能不存在或已损坏')}
                  />
                </div>
                {/* PDF阅读完成确认按钮（因为iframe中无法直接检测滚动到底部） */}
                <div className="bg-slate-800 text-white p-2 text-center text-xs">
                    请阅读完文档内容后点击确认
                    <button 
                      onClick={() => {
                        // 先更新进度到100%
                        onProgress?.(100);
                        
                        // 如果有考试要求，触发开始考试回调
                        if (isExamRequired && onStartExam) {
                          setTimeout(() => {
                            onStartExam();
                          }, 100);
                        } else {
                          // 没有考试要求，触发完成回调（会显示完成覆盖层并标记为已学习）
                          setTimeout(() => {
                            onComplete?.();
                          }, 100);
                        }
                      }} 
                      className="ml-4 bg-blue-600 px-3 py-1 rounded hover:bg-blue-500 font-medium transition-colors"
                    >
                      {isExamRequired ? '我已阅读完毕，开始考试' : '我已阅读完毕'}
                    </button>
                </div>
              </>
            )}
        </div>
     );
  }

  if (type === 'docx') {
    return (
      <div className="w-full h-full overflow-y-auto bg-white p-8 relative" onScroll={handleScroll}>
        {watermarkEnabled && (watermarkText || watermarkIncludeUser || watermarkIncludeTime) && (
          <Watermark 
            text={watermarkText} 
            relative={true}
            includeUser={watermarkIncludeUser}
            includeTime={watermarkIncludeTime}
            user={user}
          />
        )}
        {loading ? <div className="text-center py-10">加载文档中...</div> :
           <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
        }
      </div>
    );
  }

  return <div>不支持的文件类型</div>;
}
