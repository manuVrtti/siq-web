import { NextResponse, type NextRequest } from 'next/server'

import { errorResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { NotFoundError } from '@/lib/errors'
import { canViewProfile, resumeDownloadUrl } from '@/services/profile'

/**
 * Download a candidate's résumé: redirects to a 2-minute signed URL on the
 * private bucket. The candidate, SUPER_ADMIN, or a manager sharing a college
 * with them; anyone else gets 404.
 */

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const viewer = await requireAuth()
    const { userId } = await ctx.params
    if (!(await canViewProfile(viewer, userId))) throw new NotFoundError('Not found')
    return NextResponse.redirect(await resumeDownloadUrl(userId), 302)
  } catch (error) {
    return errorResponse(error)
  }
}
