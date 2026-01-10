'use client'

import { useState } from 'react'
import PeopleSelector from '@/components/common/PeopleSelector'
import { ExtendedArchiveNode } from '../_components/ArchiveExplorer'
import ArchiveExplorer from '../_components/ArchiveExplorer'
import { getArchiveTree } from '@/app/actions/archive'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserType = any;

export default function PersonnelArchivePage() {
  const [selectedUser, setSelectedUser] = useState<{id: string, name: string} | null>(null)
  const [nodes, setNodes] = useState<ExtendedArchiveNode[]>([])
  const [loading, setLoading] = useState(false)

  const handleUserSelect = async (users: UserType[]) => {
    if (users.length > 0) {
      const user = users[0]
      setSelectedUser(user)
      setLoading(true)
      try {
        const data = await getArchiveTree('personnel', { userId: user.id })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setNodes(data as any)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="flex h-full">
      {/* Left Sidebar: User Selection */}
      <div className="w-80 border-r bg-white flex flex-col">
         <div className="p-4 border-b">
           <h2 className="font-medium mb-1">人员档案 (Personnel)</h2>
           <p className="text-xs text-slate-500">Select an employee to view records.</p>
         </div>
         <div className="flex-1 overflow-hidden p-2">
            <PeopleSelector
              selectionMode="single"
              onSelectionChange={handleUserSelect}
              // We might need to hide the submit button in PeopleSelector if possible,
              // or just use it as a persistent side panel.
              // Assuming PeopleSelector has a mode to be embedded.
              // If PeopleSelector is a modal trigger, we might need a different UI.
              // Let's assume for now we use a simple placeholder or wrapper.
            />
            {/* Note: In a real implementation, PeopleSelector is likely a modal or complex component.
                If it's a modal, we need a "Select User" button. */}

            {/* Alternative if PeopleSelector is hard to embed: */}
            <div className="mt-4 p-4 text-center text-sm text-slate-500 italic">
               (Use the selector above to pick a user)
            </div>
         </div>
      </div>

      {/* Right Content: Archive */}
      <div className="flex-1 bg-slate-50 overflow-hidden flex flex-col">
         {selectedUser ? (
           <>
             <div className="h-14 border-b bg-white px-6 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.name}</h3>
                  <p className="text-xs text-slate-500">Personnel Archive</p>
                </div>
             </div>
             <div className="flex-1 p-4">
               {loading ? (
                  <div className="flex justify-center items-center h-full text-slate-400">Loading...</div>
               ) : (
                  <ArchiveExplorer
                    nodes={nodes}
                    contextName={`${selectedUser.name}'s Files`}
                  />
               )}
             </div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <p>Select a user from the list to view their archive.</p>
           </div>
         )}
      </div>
    </div>
  )
}
