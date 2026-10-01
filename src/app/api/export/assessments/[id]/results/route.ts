import { type NextRequest } from 'next/server'

import { errorResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { XLSX_MIME, fileResponse } from '@/lib/import/xlsx-parser'
import { exportAssessmentResults } from '@/services/export/results-export'

/** Plan 020 — results as .xlsx. Manager + org derived from the assessment. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { scope } = await authorizeAssessment(id, 'view')
    const { filename, body } = await exportAssessmentResults(scope, id)
    return fileResponse(body, filename, XLSX_MIME)
  } catch (error) {
    return errorResponse(error)
  }
}
