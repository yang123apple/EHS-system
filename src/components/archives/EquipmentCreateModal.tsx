'use client';

import React from 'react';
import { X, Save } from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';

interface EquipmentCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EquipmentCreateModal({ isOpen, onClose, onSuccess }: EquipmentCreateModalProps) {
    const [name, setName] = React.useState('');
    const [code, setCode] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [startDate, setStartDate] = React.useState('');
    const [expectedEndDate, setExpectedEndDate] = React.useState('');
    const [isSpecialEquip, setIsSpecialEquip] = React.useState(false);
    const [inspectionCycle, setInspectionCycle] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen) {
            // 重置表单
            setName('');
            setCode('');
            setDescription('');
            setStartDate('');
            setExpectedEndDate('');
            setIsSpecialEquip(false);
            setInspectionCycle('');
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!name || !code || !startDate) {
            alert('请填写设备名称、编号和启用时间');
            return;
        }

        if (isSpecialEquip && !inspectionCycle) {
            alert('特种设备必须填写定检周期');
            return;
        }

        setSaving(true);
        try {
            const res = await apiFetch('/api/archives/equipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    code,
                    description,
                    startDate,
                    expectedEndDate: expectedEndDate || null,
                    isSpecialEquip,
                    inspectionCycle: isSpecialEquip ? parseInt(inspectionCycle) : null
                })
            });

            if (res.ok) {
                onSuccess();
            } else {
                const error = await res.json();
                alert(error.error || '创建设备失败');
            }
        } catch (e) {
            console.error('创建设备失败', e);
            alert('创建设备失败，请重试');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
                    <h2 className="text-lg font-bold text-slate-900">添加设备</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">设备名称 *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                placeholder="请输入设备名称"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">设备编号 *</label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                placeholder="请输入设备编号"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">设备描述</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                            rows={2}
                            placeholder="可选，简要描述设备信息..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">设备启用时间 *</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">预计报废时间</label>
                            <input
                                type="date"
                                value={expectedEndDate}
                                onChange={(e) => setExpectedEndDate(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isSpecialEquip}
                                onChange={(e) => setIsSpecialEquip(e.target.checked)}
                                className="text-orange-600"
                            />
                            <span className="text-sm font-medium text-slate-700">是否为特种设备</span>
                        </label>
                    </div>

                    {isSpecialEquip && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">定检周期（月） *</label>
                            <input
                                type="number"
                                value={inspectionCycle}
                                onChange={(e) => setInspectionCycle(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                placeholder="请输入定检周期（月）"
                                min="1"
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 p-4 border-t border-slate-200 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
                    >
                        {saving ? '保存中...' : <><Save size={14} /> 保存</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

