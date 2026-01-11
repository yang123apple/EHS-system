
import React from 'react';

export default function ArchivesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="flex-1 p-6 overflow-auto">
                {children}
            </div>
        </div>
    );
}
