import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { deleteSection } from '@/services/assessments'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; sectionId: string }> },
) {
  try {
    const { id, sectionId } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    await deleteSection(orgId, sectionId)
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
