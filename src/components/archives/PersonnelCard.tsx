'use client';

import React from 'react';
import { User as UserIcon, FileText } from 'lucide-react';
import PersonnelDetailModal from './PersonnelDetailModal';

interface Personnel {
    id: string;
    username: string;
    name: string;
    avatar?: string;
    jobTitle?: string;
    department: string;
    fileCount: number;
    isActive?: boolean; // 🟢 在职状态
}

interface PersonnelCardProps {
    personnel: Personnel;
}

export default function PersonnelCard({ personnel }: PersonnelCardProps) {
    const [showDetail, setShowDetail] = React.useState(false);

    return (
        <>
            <div
                onClick={() => setShowDetail(true)}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${
                        personnel.isActive !== false 
                            ? 'bg-green-50' 
                            : 'bg-slate-100'
                    }`}>
                        {personnel.avatar ? (
                            <img
                                src={personnel.avatar}
                                alt={personnel.name}
                                className={`w-10 h-10 rounded-full object-cover ${
                                    personnel.isActive === false 
                                        ? 'grayscale opacity-60' 
                                        : ''
                                }`}
                            />
                        ) : (
                            <UserIcon 
                                size={24} 
                                className={
                                    personnel.isActive !== false 
                                        ? 'text-green-600' 
                                        : 'text-slate-400'
                                } 
                            />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900">{personnel.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">{personnel.username}</p>
                        {personnel.jobTitle && (
                            <p className="text-xs text-slate-400 mt-1">{personnel.jobTitle}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{personnel.department}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                            <FileText size={12} />
                            <span>档案文件: {personnel.fileCount}</span>
                        </div>
                    </div>
                </div>
            </div>

            <PersonnelDetailModal
                isOpen={showDetail}
                onClose={() => setShowDetail(false)}
                personnelId={personnel.id}
            />
        </>
    );
}

