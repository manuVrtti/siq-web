import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { ValidationError } from '@/lib/errors'
import { addSection } from '@/services/assessments'
import { sectionInputSchema } from '@/lib/validators/assessment'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    const parsed = sectionInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid section')
    const section = await addSection(orgId, id, parsed.data)
    return successResponse({ section }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
