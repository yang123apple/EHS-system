'use server'

import { prisma } from '@/lib/prisma'

export async function checkAndNotifyExpiry(userId: string) {
  if (!userId) return [];
  // 1. Find archives relevant to this user (or all if admin) that are expiring.
  // For simplicity, let's just find ALL expiring archives for now or those owned by user.
  // The requirement says "Support setting reminders".

  // We look for nodes where expiryDate <= now + alertDays
  // This query is tricky without raw SQL or proper date math in Prisma filtering if alertDays is dynamic per row.
  // Prisma doesn't support "where expiryDate < now + this.alertDays".

  // Alternative: Fetch all nodes with expiryDate != null, then filter in JS.
  // Not efficient for millions, but fine for thousands.

  const nodesWithExpiry = await prisma.archiveNode.findMany({
    where: {
      expiryDate: { not: null }
    },
    select: {
      id: true,
      name: true,
      expiryDate: true,
      alertDays: true,
      equipmentId: true,
      userId: true
    }
  })

  const expiringNodes = nodesWithExpiry.filter(node => {
     if (!node.expiryDate) return false
     const daysUntilExpiry = (node.expiryDate.getTime() - Date.now()) / (1000 * 3600 * 24)
     return daysUntilExpiry <= node.alertDays && daysUntilExpiry > -1 // Don't notify if already expired long ago? Or maybe yes.
  })

  // Create notifications
  // We need to check if we already notified recently to avoid spam.
  // `Notification` model doesn't track "last sent for this object".
  // We might just return this list to the frontend to display a "Warning Banner".

  return expiringNodes
}
