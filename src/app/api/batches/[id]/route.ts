import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { deleteBatch } from '@/services/candidates'

/**
 * Delete a batch. Only the grouping goes — candidates, their assignments and
 * results are untouched (BatchMember rows cascade). Org derived from the row.
 */

export const dynamic = 'force-dynamic'
const MANAGER = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const user = await withRole(MANAGER)
    const batch = await prisma.batch.findUnique({ where: { id }, select: { orgId: true } })
    if (!batch) throw new NotFoundError('Batch not found')
    await requireOrgAccess(user, batch.orgId)
    await deleteBatch(batch.orgId, id)
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
