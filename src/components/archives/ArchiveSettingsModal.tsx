'use client';

import React from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';

interface ArchiveSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ArchiveConfig {
    watermark: string;
    enterprise_types: string[];
    equipment_types: string[];
    personnel_types: string[];
}

export default function ArchiveSettingsModal({ isOpen, onClose }: ArchiveSettingsModalProps) {
    const [config, setConfig] = React.useState<ArchiveConfig | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [newType, setNewType] = React.useState({ enterprise: '', equipment: '', personnel: '' });

    React.useEffect(() => {
        if (isOpen) {
            loadConfig();
        }
    }, [isOpen]);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const res = await apiFetch('/api/archives/config');
            const data = await res.json();
            setConfig(data);
        } catch (e) {
            console.error('加载配置失败', e);
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async (key: string, value: any) => {
        try {
            setSaving(true);
            await apiFetch('/api/archives/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
        } catch (e) {
            console.error('保存失败', e);
            alert('保存失败');
        } finally {
            setSaving(false);
        }
    };

    const addType = async (category: 'enterprise' | 'equipment' | 'personnel') => {
        const typeName = newType[category].trim();
        if (!typeName || !config) return;

        const key = `${category}_types`;
        const currentTypes = config[`${category}_types`];
        if (currentTypes.includes(typeName)) {
            alert('该类型已存在');
            return;
        }

        const newTypes = [...currentTypes, typeName];
        await saveConfig(key, newTypes);
        setConfig({ ...config, [`${category}_types`]: newTypes });
        setNewType({ ...newType, [category]: '' });
    };

    const removeType = async (category: 'enterprise' | 'equipment' | 'personnel', typeName: string) => {
        if (!config) return;
        const key = `${category}_types`;
        const newTypes = config[`${category}_types`].filter(t => t !== typeName);
        await saveConfig(key, newTypes);
        setConfig({ ...config, [`${category}_types`]: newTypes });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900">档案库设置</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
                    {loading ? (
                        <div className="text-center py-8 text-slate-500">加载中...</div>
                    ) : config ? (
                        <>
                            {/* 水印设置 */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700">水印文字</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={config.watermark}
                                        onChange={(e) => setConfig({ ...config, watermark: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        placeholder="输入水印文字"
                                    />
                                    <button
                                        onClick={() => saveConfig('watermark', config.watermark)}
                                        disabled={saving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm"
                                    >
                                        <Save size={14} /> 保存
                                    </button>
                                </div>
                            </div>

                            {/* 企业文件类型库 */}
                            <TypeEditor
                                title="一企一档 - 文件类型库"
                                types={config.enterprise_types}
                                newValue={newType.enterprise}
                                onNewValueChange={(v) => setNewType({ ...newType, enterprise: v })}
                                onAdd={() => addType('enterprise')}
                                onRemove={(t) => removeType('enterprise', t)}
                            />

                            {/* 设备文件类型库 */}
                            <TypeEditor
                                title="一机一档 - 文件类型库"
                                types={config.equipment_types}
                                newValue={newType.equipment}
                                onNewValueChange={(v) => setNewType({ ...newType, equipment: v })}
                                onAdd={() => addType('equipment')}
                                onRemove={(t) => removeType('equipment', t)}
                            />

                            {/* 人员文件类型库 */}
                            <TypeEditor
                                title="一人一档 - 文件类型库"
                                types={config.personnel_types}
                                newValue={newType.personnel}
                                onNewValueChange={(v) => setNewType({ ...newType, personnel: v })}
                                onAdd={() => addType('personnel')}
                                onRemove={(t) => removeType('personnel', t)}
                            />
                        </>
                    ) : (
                        <div className="text-center py-8 text-red-500">加载配置失败</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TypeEditor({
    title,
    types,
    newValue,
    onNewValueChange,
    onAdd,
    onRemove
}: {
    title: string;
    types: string[];
    newValue: string;
    onNewValueChange: (v: string) => void;
    onAdd: () => void;
    onRemove: (t: string) => void;
}) {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">{title}</label>
            <div className="flex flex-wrap gap-2 mb-2">
                {types.map((type) => (
                    <span
                        key={type}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm group"
                    >
                        {type}
                        <button
                            onClick={() => onRemove(type)}
                            className="p-0.5 hover:bg-red-100 rounded opacity-50 group-hover:opacity-100"
                        >
                            <Trash2 size={12} className="text-red-500" />
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newValue}
                    onChange={(e) => onNewValueChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded text-sm"
                    placeholder="输入新类型名称"
                />
                <button
                    onClick={onAdd}
                    className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1 text-sm"
                >
                    <Plus size={14} /> 添加
                </button>
            </div>
        </div>
    );
}
