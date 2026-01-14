'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ArchiveSettingsModal from './ArchiveSettingsModal';

export default function SettingsButton() {
    const { user } = useAuth();
    const [showSettings, setShowSettings] = React.useState(false);

    // 只有管理员可见
    if (user?.role !== 'admin') {
        return null;
    }

    return (
        <>
            <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
                <Settings size={18} />
                <span>设置</span>
            </button>
            <ArchiveSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </>
    );
}

