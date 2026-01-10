'use client'

import { useState } from 'react'
import { ArchiveNode, Tag } from '@prisma/client'
import {
  Folder, File, ChevronRight, ChevronDown, MoreVertical,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

// Define extended type to include relations
export type ExtendedArchiveNode = ArchiveNode & {
  tags: Tag[]
  file: {
    fileType: string
    fileSize: number
  } | null
  children?: ExtendedArchiveNode[]
}

interface ArchiveExplorerProps {
  nodes: ExtendedArchiveNode[]
  rootType?: string
  contextName?: string
  onUpload?: (file: File, parentId: string | null) => void
  onDelete?: (id: string) => void
  onRename?: (id: string, name: string) => void
  onMove?: (id: string, newParentId: string | null) => void
}

export default function ArchiveExplorer({
  nodes,
  contextName
}: ArchiveExplorerProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // Filter nodes for the current view (flat list for now, tree logic needed)
  // For simplicity, let's assume 'nodes' is a flat list and we build the tree or filter here.
  // Actually, Server Action returned flat list.

  const getChildren = (parentId: string | null) => {
    return nodes.filter(n => n.parentId === parentId)
  }

  const currentNodes = getChildren(selectedFolderId)

  // Breadcrumbs logic
  const getBreadcrumbs = () => {
    const path = []
    let currentId = selectedFolderId
    while (currentId) {
      const node = nodes.find(n => n.id === currentId)
      if (node) {
        path.unshift(node)
        currentId = node.parentId
      } else {
        break
      }
    }
    return path
  }

  return (
    <div className="flex h-full border rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Left Sidebar: Tree */}
      <div className="w-64 border-r bg-slate-50 overflow-y-auto p-2">
         <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider px-2">
            {contextName || 'Folders'}
         </div>
         <TreeItem
            node={{ id: null, name: 'Root', isFolder: true } as unknown as ExtendedArchiveNode}
            nodes={nodes}
            selectedId={selectedFolderId}
            onSelect={setSelectedFolderId}
            level={0}
         />
      </div>

      {/* Right Content: File List */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar / Breadcrumbs */}
        <div className="h-12 border-b flex items-center px-4 gap-2 bg-white">
           <button
             onClick={() => setSelectedFolderId(null)}
             className={cn("text-sm hover:underline", !selectedFolderId && "font-bold")}
           >
             Root
           </button>
           {getBreadcrumbs().map(node => (
             <div key={node.id} className="flex items-center gap-2 text-sm">
               <ChevronRight size={14} className="text-slate-400" />
               <button
                 onClick={() => setSelectedFolderId(node.id)}
                 className={cn("hover:underline", selectedFolderId === node.id && "font-bold")}
               >
                 {node.name}
               </button>
             </div>
           ))}
        </div>

        {/* File Grid */}
        <div className="flex-1 overflow-y-auto p-4">
           {currentNodes.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
               <Folder size={48} strokeWidth={1} className="mb-2 opacity-50" />
               <p>Empty folder</p>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {currentNodes.map(node => (
               <FileCard key={node.id} node={node} onClick={() => {
                 if (node.isFolder) setSelectedFolderId(node.id)
               }} />
             ))}
           </div>
        </div>
      </div>
    </div>
  )
}

function TreeItem({
  node,
  nodes,
  selectedId,
  onSelect,
  level
}: {
  node: ExtendedArchiveNode | { id: null, name: string, isFolder: boolean },
  nodes: ExtendedArchiveNode[],
  selectedId: string | null,
  onSelect: (id: string | null) => void,
  level: number
}) {
  const [expanded, setExpanded] = useState(true)

  // Get children from the flat list
  const children = nodes.filter(n => n.parentId === node.id && n.isFolder)
  const isSelected = selectedId === node.id

  if (!node.isFolder && node.id !== null) return null

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-sm select-none transition-colors",
          isSelected ? "bg-blue-100 text-blue-700" : "hover:bg-slate-200 text-slate-700"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
         <div
           className="p-0.5 rounded hover:bg-slate-300"
           onClick={(e) => {
             e.stopPropagation()
             setExpanded(!expanded)
           }}
         >
           {children.length > 0 ? (
             expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
           ) : <div className="w-[14px]" />}
         </div>
         <Folder size={16} className={cn("fill-current", isSelected ? "text-blue-500" : "text-yellow-500")} />
         <span className="truncate">{node.name}</span>
      </div>

      {expanded && children.map(child => (
        <TreeItem
          key={child.id}
          node={child}
          nodes={nodes}
          selectedId={selectedId}
          onSelect={onSelect}
          level={level + 1}
        />
      ))}
    </div>
  )
}

function FileCard({ node, onClick }: { node: ExtendedArchiveNode, onClick: () => void }) {
  const isExpired = node.expiryDate && new Date(node.expiryDate) < new Date()
  const isNearExpiry = node.expiryDate && !isExpired &&
    (new Date(node.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24) < (node.alertDays || 30)

  return (
    <div
      onClick={onClick}
      className={cn(
        "group border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer bg-white relative",
        node.isFolder ? "border-slate-200" : "border-slate-100"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            node.isFolder ? "bg-yellow-50 text-yellow-600" : "bg-blue-50 text-blue-600"
          )}>
            {node.isFolder ? <Folder size={20} className="fill-current" /> : <File size={20} />}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-medium truncate text-slate-900 group-hover:text-blue-600">
              {node.name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-500">
               {node.isFolder ? (
                 <span>Folder</span>
               ) : (
                 <span>{node.file?.fileType || 'File'} • v{node.version}</span>
               )}
            </div>
          </div>
        </div>

        {/* Actions Button */}
        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-500">
          <MoreVertical size={16} />
        </button>
      </div>

      {/* Metadata Chips */}
      <div className="mt-3 flex flex-wrap gap-1">
        {node.tags.map(tag => (
          <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {tag.name}
          </span>
        ))}
        {node.expiryDate && (
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-1",
            isExpired ? "bg-red-50 text-red-700 border-red-200" :
            isNearExpiry ? "bg-orange-50 text-orange-700 border-orange-200" :
            "bg-green-50 text-green-700 border-green-200"
          )}>
            <Clock size={10} />
            {format(new Date(node.expiryDate), 'yyyy-MM-dd')}
          </span>
        )}
      </div>
    </div>
  )
}
