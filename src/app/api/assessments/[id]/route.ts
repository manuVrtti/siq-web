import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { ValidationError } from '@/lib/errors'
import { deleteAssessment, getAssessment, updateAssessment } from '@/services/assessments'
import { assessmentInputSchema } from '@/lib/validators/assessment'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id, 'view')
    return successResponse({ assessment: await getAssessment(orgId, id) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    const parsed = assessmentInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input')
    return successResponse({ assessment: await updateAssessment(orgId, id, parsed.data) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    await deleteAssessment(orgId, id)
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
