import 'server-only'

import { getScope } from '@/lib/auth/scope'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { CurrentUser } from '@/types/auth'

/** Plan 023 — the drive's college comes from the database, never the client. */
export async function scopeForDrive(user: CurrentUser, driveId: string) {
  const d = await prisma.mockDrive.findUnique({ where: { id: driveId }, select: { orgId: true } })
  if (!d) throw new NotFoundError('Mock drive not found')
  return getScope(user, d.orgId)
}

export async function scopeForRound(user: CurrentUser, roundId: string) {
  const r = await prisma.mockDriveRound.findUnique({ where: { id: roundId }, select: { order: true, driveId: true, drive: { select: { orgId: true } } } })
  if (!r) throw new NotFoundError('Round not found')
  return { scope: await getScope(user, r.drive.orgId), driveId: r.driveId, order: r.order }
}
