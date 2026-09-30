import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { publishAssessment } from '@/services/assessments'
import { audit } from '@/services/audit'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { user, orgId } = await authorizeAssessment(id)
    const assessment = await publishAssessment(orgId, id)
    await audit({ userId: user.id, action: 'assessment.publish', entityType: 'Assessment', entityId: id, metadata: { orgId } })
    return successResponse({ assessment })
  } catch (error) {
    return errorResponse(error)
  }
}
