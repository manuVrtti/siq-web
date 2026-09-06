import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { ValidationError } from '@/lib/errors'
import { autoAssemble } from '@/services/assessments'
import { autoAssembleSchema } from '@/lib/validators/assessment'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.sectionId !== 'string') throw new ValidationError('sectionId is required')
    const parsed = autoAssembleSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid criteria')
    const added = await autoAssemble(orgId, body.sectionId, parsed.data)
    return successResponse({ added })
  } catch (error) {
    return errorResponse(error)
  }
}
