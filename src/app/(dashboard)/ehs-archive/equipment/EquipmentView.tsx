'use client'

import { useState } from 'react'
import { Equipment } from '@prisma/client'
import { ExtendedArchiveNode } from '../_components/ArchiveExplorer'
import ArchiveExplorer from '../_components/ArchiveExplorer'
import { getArchiveTree } from '@/app/actions/archive'
import { Search, Database, ArrowLeft } from 'lucide-react'

export default function EquipmentView({ equipments }: { equipments: Equipment[] }) {
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [nodes, setNodes] = useState<ExtendedArchiveNode[]>([])
  const [loading, setLoading] = useState(false)

  const handleSelect = async (eq: Equipment) => {
    setSelectedEquipment(eq)
    setLoading(true)
    try {
      const data = await getArchiveTree('equipment', { equipmentId: eq.id })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNodes(data as any)
    } finally {
      setLoading(false)
    }
  }

  if (selectedEquipment) {
    return (
      <div className="flex flex-col h-full">
         <div className="h-12 border-b bg-white px-4 flex items-center gap-3">
            <button
              onClick={() => setSelectedEquipment(null)}
              className="p-1 hover:bg-slate-100 rounded-full"
            >
              <ArrowLeft size={20} className="text-slate-500" />
            </button>
            <span className="font-semibold text-slate-800">{selectedEquipment.name}</span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-500">{selectedEquipment.code || 'No Code'}</span>
         </div>
         <div className="flex-1 p-4 bg-slate-50">
            {loading ? (
              <div className="flex justify-center items-center h-full text-slate-400">Loading...</div>
            ) : (
              <ArchiveExplorer
                nodes={nodes}
                contextName={selectedEquipment.name}
              />
            )}
         </div>
      </div>
    )
  }

  return (
    <div className="p-6">
       <div className="mb-4 relative">
         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
         <input
           type="text"
           placeholder="Search equipment..."
           className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
         />
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {equipments.map(eq => (
            <div
              key={eq.id}
              onClick={() => handleSelect(eq)}
              className="group border hover:border-blue-300 hover:shadow-md rounded-xl p-4 cursor-pointer bg-white transition-all"
            >
               <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                     <Database size={24} />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${eq.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {eq.status}
                  </span>
               </div>
               <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 mb-1">{eq.name}</h3>
               <p className="text-sm text-slate-500">{eq.code || 'N/A'} • {eq.location || 'No Location'}</p>
            </div>
          ))}
       </div>
    </div>
  )
}
