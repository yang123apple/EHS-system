'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getEquipments() {
  return await prisma.equipment.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

export async function createEquipment(data: {
  name: string
  code?: string
  type?: string
  location?: string
  status?: string
}) {
  const eq = await prisma.equipment.create({
    data
  })
  revalidatePath('/ehs-archive')
  return eq
}

export async function updateEquipment(
  id: string,
  data: {
    name?: string
    code?: string
    type?: string
    location?: string
    status?: string
  }
) {
  const eq = await prisma.equipment.update({
    where: { id },
    data
  })
  revalidatePath('/ehs-archive')
  return eq
}

export async function deleteEquipment(id: string) {
  // Check if it has archives?
  // Prisma will likely complain if we delete equipment with linked archives, unless we cascade.
  // Schema didn't specify cascade for equipment->archives.

  await prisma.equipment.delete({
    where: { id }
  })
  revalidatePath('/ehs-archive')
}
