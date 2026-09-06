import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { addToBatch, removeFromBatch } from '@/services/candidates'

export const dynamic = 'force-dynamic'
const MANAGER = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

/** Derives the batch's org, then authorises the caller for it. */
async function authorizeForBatch(batchId: string) {
  const user = await withRole(MANAGER)
  const b = await prisma.batch.findUnique({ where: { id: batchId }, select: { orgId: true } })
  if (!b) throw new NotFoundError('Batch not found')
  await requireOrgAccess(user, b.orgId)
  return { orgId: b.orgId }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeForBatch(id)
    const body = await request.json().catch(() => null)
    const userIds: unknown = body?.userIds
    if (!Array.isArray(userIds) || userIds.some((x) => typeof x !== 'string')) {
      throw new ValidationError('userIds must be an array of ids')
    }
    await addToBatch(orgId, id, userIds as string[])
    return successResponse({ added: userIds.length })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeForBatch(id)
    const userId = request.nextUrl.searchParams.get('userId')
    if (!userId) throw new ValidationError('userId is required')
    await removeFromBatch(orgId, id, userId)
    return successResponse({ removed: true })
  } catch (error) {
    return errorResponse(error)
  }
}
