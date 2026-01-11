'use client';

import React from 'react';
import { Settings, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import EquipmentDetailModal from './EquipmentDetailModal';

interface Equipment {
    id: string;
    name: string;
    code: string;
    description?: string;
    startDate: string;
    expectedEndDate?: string;
    isSpecialEquip: boolean;
    inspectionCycle?: number;
    lastInspection?: string;
    nextInspection?: string;
    status: string;
    _count?: { files: number };
}

interface EquipmentCardProps {
    equipment: Equipment;
    onUpdate?: () => void;
}

export default function EquipmentCard({ equipment, onUpdate }: EquipmentCardProps) {
    const [showDetail, setShowDetail] = React.useState(false);

    const isInspectionDue = equipment.nextInspection && new Date(equipment.nextInspection) <= new Date();

    return (
        <>
            <div
                onClick={() => setShowDetail(true)}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-50 rounded-lg shrink-0">
                        <Settings size={24} className="text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900 truncate">{equipment.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">编号: {equipment.code}</p>
                        {equipment.description && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{equipment.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {equipment.isSpecialEquip && (
                                <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded">
                                    特种设备
                                </span>
                            )}
                            {equipment.status === 'active' && (
                                <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded">
                                    使用中
                                </span>
                            )}
                            {isInspectionDue && (
                                <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    定检到期
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                            {equipment.nextInspection && (
                                <span className="flex items-center gap-1">
                                    <Calendar size={12} />
                                    下次定检: {format(new Date(equipment.nextInspection), 'yyyy-MM-dd')}
                                </span>
                            )}
                            <span>文件: {equipment._count?.files || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            <EquipmentDetailModal
                isOpen={showDetail}
                onClose={() => setShowDetail(false)}
                equipmentId={equipment.id}
                onUpdate={onUpdate}
            />
        </>
    );
}

