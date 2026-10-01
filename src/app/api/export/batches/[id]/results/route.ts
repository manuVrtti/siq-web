import { type NextRequest } from 'next/server'

import { errorResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope } from '@/lib/auth/scope'
import { NotFoundError } from '@/lib/errors'
import { XLSX_MIME, fileResponse } from '@/lib/import/xlsx-parser'
import { prisma } from '@/lib/prisma'
import { exportBatchResults } from '@/services/export/results-export'

/** Plan 020 — a batch's results across the org's assessments (.xlsx). */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const user = await withRole(MANAGER_ROLES)
    const batch = await prisma.batch.findUnique({ where: { id }, select: { orgId: true } })
    if (!batch) throw new NotFoundError('Batch not found')
    const scope = await getScope(user, batch.orgId)
    const { filename, body } = await exportBatchResults(scope, id)
    return fileResponse(body, filename, XLSX_MIME)
  } catch (error) {
    return errorResponse(error)
  }
}
