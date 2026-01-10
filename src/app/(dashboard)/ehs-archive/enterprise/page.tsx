import { getArchiveTree } from '@/app/actions/archive'
import ArchiveExplorer from '../_components/ArchiveExplorer'

export default async function EnterpriseArchivePage() {
  const nodes = await getArchiveTree('enterprise')

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-white flex justify-between items-center">
        <div>
           <h2 className="text-lg font-medium">企业档案 (Enterprise Archive)</h2>
           <p className="text-sm text-slate-500">Manage enterprise-level documents like licenses and EIA reports.</p>
        </div>
        {/* Actions like Upload will be passed to ArchiveExplorer or handled via a context/modal */}
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          Upload Document
        </button>
      </div>

      <div className="flex-1 p-4 bg-slate-50 overflow-hidden">
        <ArchiveExplorer
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodes={nodes as any} // Type casting for simplicity due to server/client serialization
          contextName="Enterprise Folders"
        />
      </div>
    </div>
  )
}
