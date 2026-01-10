'use client'

import { useState } from 'react'
import { ExtendedArchiveNode } from './ArchiveExplorer'
import { Tag } from '@prisma/client'
import { format } from 'date-fns'
import TagSelector from './TagSelector'
import { updateNodeMetadata, createTag } from '@/app/actions/archive'

interface FilePropertiesProps {
  node: ExtendedArchiveNode
  availableTags: Tag[]
  onClose: () => void
}

export default function FileProperties({ node, availableTags, onClose }: FilePropertiesProps) {
  const [expiryDate, setExpiryDate] = useState(node.expiryDate ? format(new Date(node.expiryDate), 'yyyy-MM-dd') : '')
  const [alertDays, setAlertDays] = useState(node.alertDays)

  // This state management is slightly simplified. In real app, we'd update optimistic UI or fetch fresh data.
  // For now, we rely on parent re-render or just local mutation + server action.

  const handleSave = async () => {
     await updateNodeMetadata(node.id, {
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        alertDays: Number(alertDays)
     })
     onClose()
  }

  const handleAddTag = async (tagId: string) => {
     const newTags = [...node.tags.map(t => t.id), tagId]
     await updateNodeMetadata(node.id, { tagIds: newTags })
  }

  const handleRemoveTag = async (tagId: string) => {
     const newTags = node.tags.map(t => t.id).filter(id => id !== tagId)
     await updateNodeMetadata(node.id, { tagIds: newTags })
  }

  const handleCreateTag = async (name: string, color: string) => {
     const newTag = await createTag(name, color)
     handleAddTag(newTag.id)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
       <div className="bg-white rounded-lg shadow-xl w-[400px] max-w-full overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b flex justify-between items-center bg-slate-50">
             <h3 className="font-semibold text-slate-800">Properties</h3>
             <button onClick={onClose} className="text-slate-400 hover:text-slate-600">Close</button>
          </div>

          <div className="p-4 space-y-4">
             <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Name</label>
                <div className="text-sm font-medium">{node.name}</div>
             </div>

             <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tags</label>
                <TagSelector
                   availableTags={availableTags}
                   selectedTags={node.tags}
                   onAddTag={handleAddTag}
                   onRemoveTag={handleRemoveTag}
                   onCreateTag={handleCreateTag}
                />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Expiry Date</label>
                   <input
                      type="date"
                      className="w-full text-sm border rounded px-2 py-1.5"
                      value={expiryDate}
                      onChange={e => setExpiryDate(e.target.value)}
                   />
                </div>
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Alert Before (Days)</label>
                   <input
                      type="number"
                      className="w-full text-sm border rounded px-2 py-1.5"
                      value={alertDays}
                      onChange={e => setAlertDays(Number(e.target.value))}
                   />
                </div>
             </div>

             <div className="text-xs text-slate-500 pt-2 border-t">
                Last updated: {format(new Date(node.updatedAt), 'yyyy-MM-dd HH:mm')}
             </div>
          </div>

          <div className="p-3 bg-slate-50 border-t flex justify-end gap-2">
             <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded">Cancel</button>
             <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save Changes</button>
          </div>
       </div>
    </div>
  )
}
