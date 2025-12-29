import { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';

interface Props {
  url: String;
  type: string;
  onProgress: (progress: number) => void; // 0-100
  onComplete: () => void;
}

export default function FileViewer({ url, type, onProgress, onComplete }: Props) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Video Handling
  useEffect(() => {
    if (type === 'video' && videoRef.current) {
      const video = videoRef.current;

      const handleTimeUpdate = () => {
        if (video.duration) {
          const percent = (video.currentTime / video.duration) * 100;
          onProgress(percent);

          // Rule: Last 30 seconds = pass
          if (video.duration - video.currentTime <= 30) {
            onComplete();
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
           onProgress(100);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [url, type]);

  // Scroll Handling for Docs (Bottom Detection)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
     if (type === 'docx' || type === 'pdf') {
         const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
         // Give some buffer (e.g., 50px)
         if (scrollHeight - scrollTop - clientHeight < 50) {
             onComplete();
         }

         const percent = (scrollTop / (scrollHeight - clientHeight)) * 100;
         onProgress(Math.min(percent, 100));
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
        <div className="w-full h-full relative" onScroll={handleScroll}>
            {/* Native Object tag is often better than iframe for PDF events, but iframe is safer cross-browser */}
            <iframe src={url as string} className="w-full h-full border-0" onLoad={() => onComplete()} />
            {/* Fallback overlay to detect completion if iframe blocks events?
                Actually, iframe scroll events are hard to capture.
                For MVP, we might just mark as complete if opened or rely on a "I have finished reading" button if iframe.
                Let's add a manual button as fallback.
             */}
        </div>
     );
  }

  if (type === 'docx') {
    return (
      <div className="w-full h-full overflow-y-auto bg-white p-8" onScroll={handleScroll}>
        {loading ? <div className="text-center py-10">加载文档中...</div> :
           <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
        }
      </div>
    );
  }

  if (type === 'pptx') {
      // Fallback for PPTX
      return (
          <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-lg text-slate-600">PPT幻灯片无法直接预览</div>
              <a href={url as string} target="_blank" download className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  下载查看
              </a>
              <button onClick={onComplete} className="text-sm text-slate-400 hover:text-slate-600 underline">
                  既然无法预览，点此标记为已读
              </button>
          </div>
      )
  }

  return <div>不支持的文件类型</div>;
}
