import { type NextRequest } from 'next/server'

import { errorResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { XLSX_MIME, fileResponse } from '@/lib/import/xlsx-parser'
import { exportAssessmentAnalytics } from '@/services/export/analytics-export'

/** Plan 020 — analytics workbook. Same numbers as the analytics page. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    const { filename, body } = await exportAssessmentAnalytics(orgId, id)
    return fileResponse(body, filename, XLSX_MIME)
  } catch (error) {
    return errorResponse(error)
  }
}
