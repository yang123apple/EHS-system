'use client'

import { useState } from 'react'
import { Tag } from '@prisma/client'
import { X, Plus } from 'lucide-react'

interface TagSelectorProps {
  availableTags: Tag[]
  selectedTags: Tag[]
  onAddTag: (tagId: string) => void
  onRemoveTag: (tagId: string) => void
  onCreateTag?: (name: string, color: string) => void
}

export default function TagSelector({
  availableTags,
  selectedTags,
  onAddTag,
  onRemoveTag,
  onCreateTag
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredTags = availableTags.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedTags.some(st => st.id === t.id)
  )

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map(tag => (
          <span key={tag.id} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
            {tag.name}
            <button onClick={() => onRemoveTag(tag.id)} className="ml-1 text-blue-400 hover:text-blue-600">
              <X size={12} />
            </button>
          </span>
        ))}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center px-2 py-1 rounded text-xs border border-dashed border-slate-300 text-slate-500 hover:border-blue-300 hover:text-blue-500"
        >
          <Plus size={12} className="mr-1" /> Add Tag
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border p-2">
          <input
            type="text"
            placeholder="Search or create tag..."
            className="w-full text-xs p-2 border rounded mb-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="max-h-40 overflow-y-auto space-y-1">
             {filteredTags.map(tag => (
               <button
                 key={tag.id}
                 onClick={() => {
                   onAddTag(tag.id)
                   setIsOpen(false)
                   setSearchTerm('')
                 }}
                 className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 rounded flex items-center gap-2"
               >
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                 {tag.name}
               </button>
             ))}

             {filteredTags.length === 0 && searchTerm && (
               <button
                  onClick={() => {
                     if (onCreateTag) onCreateTag(searchTerm, 'blue')
                     setIsOpen(false)
                     setSearchTerm('')
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded"
               >
                 Create &quot;{searchTerm}&quot;
               </button>
             )}
          </div>
        </div>
      )}
    </div>
  )
}
