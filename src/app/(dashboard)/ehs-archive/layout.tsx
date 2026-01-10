import { ReactNode } from 'react'
import { checkAndNotifyExpiry } from '@/app/actions/expiry-check'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default async function EHSArchiveLayout({
  children,
}: {
  children: ReactNode
}) {
  const expiringNodes = await checkAndNotifyExpiry('current-user-id') // TODO: Get actual user ID

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-6 py-4 flex items-center justify-between bg-white dark:bg-zinc-950">
        <h1 className="text-xl font-semibold">EHS 档案库系统</h1>
        <div className="flex items-center gap-4">
           {expiringNodes.length > 0 && (
             <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-sm border border-amber-200">
               <AlertCircle size={16} />
               <span>{expiringNodes.length} Documents Expiring Soon</span>
             </div>
           )}
           <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <Link href="/ehs-archive/enterprise" className="px-3 py-1 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all">
                Enterprise
              </Link>
              <Link href="/ehs-archive/equipment" className="px-3 py-1 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all">
                Equipment
              </Link>
              <Link href="/ehs-archive/personnel" className="px-3 py-1 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all">
                Personnel
              </Link>
           </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
