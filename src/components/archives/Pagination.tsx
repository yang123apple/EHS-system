'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
    itemName?: string; // 项目名称，如"文件"、"设备"、"人员"
}

export default function Pagination({
    currentPage,
    totalPages,
    total,
    onPageChange,
    itemName = '项'
}: PaginationProps) {
    // 生成页码数组（最多显示7个页码）
    const getPageNumbers = () => {
        const pages: number[] = [];
        const maxVisible = 7;

        if (totalPages <= maxVisible) {
            // 如果总页数不超过7页，显示所有页码
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // 如果总页数超过7页，智能显示页码
            if (currentPage <= 4) {
                // 当前页在前4页，显示前7页
                for (let i = 1; i <= 7; i++) {
                    pages.push(i);
                }
            } else if (currentPage >= totalPages - 3) {
                // 当前页在后4页，显示后7页
                for (let i = totalPages - 6; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // 当前页在中间，显示当前页前后各3页
                for (let i = currentPage - 3; i <= currentPage + 3; i++) {
                    pages.push(i);
                }
            }
        }

        return pages;
    };

    const pageNumbers = getPageNumbers();

    // 计算当前页显示的项目范围（每页12项）
    const itemsPerPage = 12;
    const startIndex = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endIndex = Math.min(currentPage * itemsPerPage, total);

    // 如果没有数据，不显示分页
    if (total === 0) {
        return null;
    }

    return (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
            <div className="text-sm text-slate-500">
                共 <span className="font-medium text-slate-700">{total}</span> 个{itemName}，
                显示第 <span className="font-medium text-slate-700">{startIndex}</span> - 
                <span className="font-medium text-slate-700"> {endIndex}</span> 个
            </div>
            
            {totalPages > 0 && (
                <div className="flex items-center gap-2">
                    {/* 上一页按钮 */}
                    <button
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 
                            disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                            active:scale-95"
                        title="上一页"
                    >
                        <ChevronLeft size={18} className="text-slate-600" />
                    </button>

                    {/* 页码数字 */}
                    {totalPages > 1 && (
                        <div className="flex gap-1">
                            {pageNumbers.map((page) => (
                                <button
                                    key={page}
                                    onClick={() => onPageChange(page)}
                                    className={`
                                        min-w-[36px] px-3 py-1.5 rounded-lg font-medium text-sm
                                        transition-all duration-200 border
                                        ${currentPage === page
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 active:scale-95'
                                        }
                                    `}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 下一页按钮 */}
                    <button
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 
                            disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                            active:scale-95"
                        title="下一页"
                    >
                        <ChevronRight size={18} className="text-slate-600" />
                    </button>
                </div>
            )}
        </div>
    );
}

