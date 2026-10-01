import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope } from '@/lib/auth/scope'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { getBatchPerformance } from '@/services/analytics/candidate-analytics'

/** Plan 019 — batch performance. Org derived from the batch row. */

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const user = await withRole(MANAGER_ROLES)
    const batch = await prisma.batch.findUnique({ where: { id }, select: { orgId: true } })
    if (!batch) throw new NotFoundError('Batch not found')
    const scope = await getScope(user, batch.orgId)
    return successResponse(await getBatchPerformance(scope, id))
  } catch (error) {
    return errorResponse(error)
  }
}
