import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { PROFILE_SECTIONS, SECTION_SCHEMAS, type ProfileSection } from '@/lib/validators/profile'
import { computeCompleteness, getProfile, replaceSection } from '@/services/profile'

/**
 * Replace one repeating profile section (education, experience, projects,
 * achievements) with the full list sent. Own profile only.
 */

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, ctx: { params: Promise<{ section: string }> }) {
  try {
    const user = await requireAuth()
    const { section } = await ctx.params
    if (!PROFILE_SECTIONS.includes(section as ProfileSection)) throw new NotFoundError('Unknown section')

    const body = await request.json().catch(() => null)
    const parsed = SECTION_SCHEMAS[section as ProfileSection].safeParse(body?.items)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const where = typeof issue?.path[0] === 'number' ? `Item ${issue.path[0] + 1}: ` : ''
      throw new ValidationError(`${where}${issue?.message ?? 'Invalid entries'}`)
    }
    await replaceSection(user.id, section as ProfileSection, parsed.data)
    const full = await getProfile(user.id)
    return successResponse({ completeness: computeCompleteness(full) })
  } catch (error) {
    return errorResponse(error)
  }
}
