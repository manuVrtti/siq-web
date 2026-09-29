import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { getBatchPerformance } from '@/services/analytics/candidate-analytics'

/** Plan 019 — batch performance. Org derived from the batch row. */

export const dynamic = 'force-dynamic'
const MANAGER = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const user = await withRole(MANAGER)
    const batch = await prisma.batch.findUnique({ where: { id }, select: { orgId: true } })
    if (!batch) throw new NotFoundError('Batch not found')
    await requireOrgAccess(user, batch.orgId)
    return successResponse(await getBatchPerformance(batch.orgId, id))
  } catch (error) {
    return errorResponse(error)
  }
}
