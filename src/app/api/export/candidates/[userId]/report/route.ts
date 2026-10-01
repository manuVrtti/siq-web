import { type NextRequest } from 'next/server'

import { errorResponse } from '@/lib/api-response'
import { assertStudentsInScope, getScope } from '@/lib/auth/scope'
import { hasPermission } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/require-auth'
import { PERMISSIONS } from '@/constants/permissions'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { fileResponse } from '@/lib/import/xlsx-parser'
import { getReportData, renderCandidateReport } from '@/services/export/candidate-report'

/**
 * Plan 020 — one candidate's result as a PDF.
 *
 * Two callers:
 *   - the candidate themself → their own report, WITHOUT proctoring detail
 *   - a manager in the assessment's org → full report incl. proctoring
 * Anyone else gets 404 (never confirm another person's result exists).
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await ctx.params
    const assessmentId = request.nextUrl.searchParams.get('assessmentId')
    if (!assessmentId) throw new ValidationError('assessmentId is required')
    const user = await requireAuth()

    const data = await getReportData(userId, assessmentId)
    const self = user.id === userId
    // Managers: org guard (membership + suspension) and department scope —
    // an HOD only gets reports for students in departments they head.
    let manager = false
    if (!self && hasPermission(user, PERMISSIONS.VIEW_ORG_RESULTS)) {
      try {
        const scope = await getScope(user, data.assessment.orgId)
        await assertStudentsInScope(scope, [userId])
        manager = true
      } catch {
        manager = false
      }
    }
    if (!self && !manager) throw new NotFoundError('Result not found')

    const { filename, body } = await renderCandidateReport(data, { includeProctoring: manager })
    return fileResponse(body, filename, 'application/pdf')
  } catch (error) {
    return errorResponse(error)
  }
}
