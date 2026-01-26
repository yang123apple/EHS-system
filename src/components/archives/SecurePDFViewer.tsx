'use client';

import React, { useRef, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

interface SecurePDFViewerProps {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string;
    fileName?: string;
}

export default function SecurePDFViewer({ isOpen, onClose, pdfUrl, fileName = 'PDF文档' }: SecurePDFViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [rotation, setRotation] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 配置 PDF.js worker - 在组件内动态设置
    useEffect(() => {
        if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }
    }, []);

    // 加载 PDF 文档
    useEffect(() => {
        if (!isOpen || !pdfUrl) return;

        let isMounted = true;
        setLoading(true);
        setError(null);

        const loadPDF = async () => {
            try {
                const loadingTask = pdfjsLib.getDocument(pdfUrl);
                const pdf = await loadingTask.promise;

                if (isMounted) {
                    setPdfDoc(pdf);
                    setTotalPages(pdf.numPages);
                    setCurrentPage(1);
                    setLoading(false);
                }
            } catch (err) {
                console.error('PDF 加载失败:', err);
                if (isMounted) {
                    setError('PDF 加载失败，请稍后重试');
                    setLoading(false);
                }
            }
        };

        loadPDF();

        return () => {
            isMounted = false;
            if (pdfDoc) {
                pdfDoc.destroy();
            }
        };
    }, [isOpen, pdfUrl]);

    // 渲染当前页
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current) return;

        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(currentPage);
                const canvas = canvasRef.current;
                if (!canvas) return;

                const context = canvas.getContext('2d');
                if (!context) return;

                const viewport = page.getViewport({ scale, rotation });

                // 设置 canvas 尺寸
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // 渲染 PDF 页面到 canvas
                const renderContext = {
                    canvas,
                    viewport: viewport,
                };

                await page.render(renderContext).promise;
            } catch (err) {
                console.error('页面渲染失败:', err);
                setError('页面渲染失败');
            }
        };

        renderPage();
    }, [pdfDoc, currentPage, scale, rotation]);

    // 禁用右键菜单
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        return false;
    };

    // 禁用拖拽保存
    const handleDragStart = (e: React.DragEvent) => {
        e.preventDefault();
        return false;
    };

    // 页面导航
    const goToPage = (pageNum: number) => {
        if (pageNum >= 1 && pageNum <= totalPages) {
            setCurrentPage(pageNum);
        }
    };

    const nextPage = () => goToPage(currentPage + 1);
    const prevPage = () => goToPage(currentPage - 1);

    // 缩放控制
    const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
    const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

    // 旋转控制
    const rotate = () => setRotation(prev => (prev + 90) % 360);

    // 键盘导航
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowLeft':
                case 'PageUp':
                    e.preventDefault();
                    prevPage();
                    break;
                case 'ArrowRight':
                case 'PageDown':
                    e.preventDefault();
                    nextPage();
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    zoomIn();
                    break;
                case '-':
                    e.preventDefault();
                    zoomOut();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentPage, totalPages]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
            {/* 顶部工具栏 */}
            <div className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-white font-medium truncate max-w-md" title={fileName}>
                        {fileName}
                    </h2>
                    {totalPages > 0 && (
                        <span className="text-slate-400 text-sm">
                            共 {totalPages} 页
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* 缩放控制 */}
                    <button
                        onClick={zoomOut}
                        className="p-2 hover:bg-slate-800 rounded-lg text-white"
                        title="缩小 (-)"
                    >
                        <ZoomOut size={18} />
                    </button>
                    <span className="text-white text-sm min-w-[60px] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={zoomIn}
                        className="p-2 hover:bg-slate-800 rounded-lg text-white"
                        title="放大 (+)"
                    >
                        <ZoomIn size={18} />
                    </button>

                    {/* 旋转控制 */}
                    <button
                        onClick={rotate}
                        className="p-2 hover:bg-slate-800 rounded-lg text-white ml-2"
                        title="旋转"
                    >
                        <RotateCw size={18} />
                    </button>

                    {/* 关闭按钮 */}
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg text-white ml-2"
                        title="关闭 (ESC)"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* PDF 内容区域 */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto bg-slate-800 flex items-start justify-center p-8"
                onContextMenu={handleContextMenu}
                onDragStart={handleDragStart}
            >
                {loading && (
                    <div className="text-white text-center py-20">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
                        <p className="mt-4">加载中...</p>
                    </div>
                )}

                {error && (
                    <div className="text-white text-center py-20">
                        <p className="text-red-400 text-lg">{error}</p>
                        <button
                            onClick={onClose}
                            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
                        >
                            关闭
                        </button>
                    </div>
                )}

                {!loading && !error && (
                    <canvas
                        ref={canvasRef}
                        className="shadow-2xl bg-white"
                        onContextMenu={handleContextMenu}
                        onDragStart={handleDragStart}
                        style={{
                            cursor: 'default',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            msUserSelect: 'none',
                            MozUserSelect: 'none'
                        }}
                    />
                )}
            </div>

            {/* 底部导航栏 */}
            {totalPages > 0 && (
                <div className="bg-slate-900 border-t border-slate-700 px-4 py-3 flex items-center justify-center gap-4">
                    <button
                        onClick={prevPage}
                        disabled={currentPage === 1}
                        className="p-2 hover:bg-slate-800 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        title="上一页 (←)"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={currentPage}
                            onChange={(e) => {
                                const num = parseInt(e.target.value);
                                if (!isNaN(num)) goToPage(num);
                            }}
                            min={1}
                            max={totalPages}
                            className="w-16 px-2 py-1 bg-slate-800 text-white text-center rounded border border-slate-700 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-slate-400">/ {totalPages}</span>
                    </div>

                    <button
                        onClick={nextPage}
                        disabled={currentPage === totalPages}
                        className="p-2 hover:bg-slate-800 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        title="下一页 (→)"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}

            {/* 防止选择的样式 */}
            <style jsx global>{`
                .pdf-viewer-container * {
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                    user-select: none;
                }
            `}</style>
        </div>
    );
}
