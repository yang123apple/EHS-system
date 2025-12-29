import { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import Watermark from '@/components/common/Watermark';
import { useAuth } from '@/context/AuthContext';

interface Props {
  url: String;
  type: string;
  onProgress?: (progress: number) => void; // 0-100
  onComplete?: () => void;
}

export default function FileViewer({ url, type, onProgress, onComplete }: Props) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();

  // Video Handling
  useEffect(() => {
    if (type === 'video' && videoRef.current) {
      const video = videoRef.current;

      const handleTimeUpdate = () => {
        if (video.duration) {
          const percent = (video.currentTime / video.duration) * 100;
          onProgress?.(percent);

          // Rule: Last 30 seconds = pass
          if (video.duration - video.currentTime <= 30) {
            onComplete?.();
          }
        }
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [type, onProgress, onComplete]);

  // DOCX Handling
  useEffect(() => {
    if (type === 'docx') {
      setLoading(true);
      fetch(url as string)
        .then(res => res.arrayBuffer())
        .then(buffer => mammoth.convertToHtml({ arrayBuffer: buffer }))
        .then(result => {
           setHtmlContent(result.value);
           // Assume viewed if loaded for docs
           onProgress?.(100);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [url, type, onProgress]);

  // Scroll Handling for Docs (Bottom Detection)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
     if (type === 'docx' || type === 'pdf') {
         const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
         // Give some buffer (e.g., 50px)
         if (scrollHeight - scrollTop - clientHeight < 50) {
             onComplete?.();
         }

         const percent = (scrollTop / (scrollHeight - clientHeight)) * 100;
         onProgress?.(Math.min(percent, 100));
     }
  };

  if (type === 'video') {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
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

  if (type === 'pdf') {
     return (
        <div className="w-full h-full relative">
            <Watermark text={user?.name || '培训系统'} />
            <iframe 
              src={`${url as string}#toolbar=0&navpanes=0`} 
              className="w-full h-full border-0 relative z-10" 
            />
        </div>
     );
  }

  if (type === 'docx') {
    return (
      <div className="w-full h-full overflow-y-auto bg-white p-8 relative" onScroll={handleScroll}>
        <Watermark text={user?.name || '培训系统'} />
        {loading ? <div className="text-center py-10">加载文档中...</div> :
           <div className="prose max-w-none relative z-10" dangerouslySetInnerHTML={{ __html: htmlContent }} />
        }
      </div>
    );
  }

  return <div>不支持的文件类型</div>;
}
