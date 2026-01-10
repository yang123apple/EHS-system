'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Types
export type ArchiveRootType = 'enterprise' | 'equipment' | 'personnel' | 'generic'

export interface ArchiveContext {
  equipmentId?: string
  userId?: string
}

export async function getArchiveTree(
  rootType: ArchiveRootType,
  context?: ArchiveContext
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    rootType,
  }

  if (context?.equipmentId) where.equipmentId = context.equipmentId
  if (context?.userId) where.userId = context.userId

  // For 'enterprise', we might just want nodes with rootType='enterprise' and no equipment/user
  if (rootType === 'enterprise') {
     where.equipmentId = null
     where.userId = null
  }

  const nodes = await prisma.archiveNode.findMany({
    where,
    include: {
      tags: true,
      file: true,
    },
    orderBy: {
      isFolder: 'desc', // Folders first
    }
  })

  // Sort by name secondary
  nodes.sort((a, b) => {
    if (a.isFolder === b.isFolder) {
      return a.name.localeCompare(b.name)
    }
    return 0
  })

  return nodes
}

export async function createFolder(
  name: string,
  parentId: string | null,
  rootType: ArchiveRootType,
  context?: ArchiveContext
) {
  const node = await prisma.archiveNode.create({
    data: {
      name,
      isFolder: true,
      parentId,
      rootType,
      equipmentId: context?.equipmentId,
      userId: context?.userId,
    }
  })

  revalidatePath('/ehs-archive')
  return node
}

export async function createFileNode(
  name: string,
  fileMetadataId: string,
  parentId: string | null,
  rootType: ArchiveRootType,
  context?: ArchiveContext
) {
  const node = await prisma.archiveNode.create({
    data: {
      name,
      isFolder: false,
      fileId: fileMetadataId,
      parentId,
      rootType,
      equipmentId: context?.equipmentId,
      userId: context?.userId,
      version: 1
    }
  })

  // Create history entry
  await prisma.archiveHistory.create({
    data: {
      nodeId: node.id,
      version: 1,
      fileId: fileMetadataId,
      updatedBy: 'system', // TODO: Pass user ID
      changeLog: 'Initial upload'
    }
  })

  revalidatePath('/ehs-archive')
  return node
}

export async function renameNode(id: string, newName: string) {
  await prisma.archiveNode.update({
    where: { id },
    data: { name: newName }
  })
  revalidatePath('/ehs-archive')
}

export async function moveNode(id: string, newParentId: string | null) {
  await prisma.archiveNode.update({
    where: { id },
    data: { parentId: newParentId }
  })
  revalidatePath('/ehs-archive')
}

export async function deleteNode(id: string) {
  // Prisma doesn't support recursive delete for self-relations automatically unless configured in DB
  // But we can just try delete. If it has children, it might fail or we delete children first.
  // For now, let's assume we delete children.

  // Actually, we should check if it's a folder with content.
  const node = await prisma.archiveNode.findUnique({
    where: { id },
    include: { children: true }
  })

  if (!node) return

  if (node.children.length > 0) {
    throw new Error('Cannot delete non-empty folder')
  }

  await prisma.archiveNode.delete({
    where: { id }
  })
  revalidatePath('/ehs-archive')
}

// Metadata Actions

export async function updateNodeMetadata(
  id: string,
  data: {
    expiryDate?: Date | null,
    alertDays?: number,
    tagIds?: string[]
  }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {}
  if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate
  if (data.alertDays !== undefined) updateData.alertDays = data.alertDays

  if (data.tagIds) {
    updateData.tags = {
      set: data.tagIds.map(tagId => ({ id: tagId }))
    }
  }

  await prisma.archiveNode.update({
    where: { id },
    data: updateData
  })
  revalidatePath('/ehs-archive')
}

// Tag Actions

export async function getTags() {
  return await prisma.tag.findMany()
}

export async function createTag(name: string, color: string = 'blue') {
  const tag = await prisma.tag.create({
    data: { name, color }
  })
  revalidatePath('/ehs-archive')
  return tag
}

// Versioning

export async function createNewVersion(
  nodeId: string,
  fileMetadataId: string,
  userId: string
) {
  const node = await prisma.archiveNode.findUnique({ where: { id: nodeId } })
  if (!node) throw new Error('Node not found')

  const newVersion = node.version + 1

  // Update node
  await prisma.archiveNode.update({
    where: { id: nodeId },
    data: {
      fileId: fileMetadataId,
      version: newVersion
    }
  })

  // Add history
  await prisma.archiveHistory.create({
    data: {
      nodeId,
      version: newVersion,
      fileId: fileMetadataId,
      updatedBy: userId,
      changeLog: 'Version updated'
    }
  })

  revalidatePath('/ehs-archive')
}
