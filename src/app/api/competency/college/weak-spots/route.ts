import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { getScope } from '@/lib/auth/scope'
import { getWeakSpots } from '@/services/competency/aggregate-insights'

export const dynamic = 'force-dynamic'

const MANAGERS = ['COLLEGE_HOD', 'COLLEGE_ADMIN', 'SUPER_ADMIN'] as const

/** Plan 026 — weak spots across the college (HODs: across their departments). */
export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGERS)
    const p = request.nextUrl.searchParams
    const orgId = p.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    const scope = await getScope(user, orgId)
    const batch = p.get('batch')
    const type = p.get('type') === 'SECTION' ? 'SECTION' : 'SKILL'
    return successResponse({ weakSpots: await getWeakSpots(scope, { batchYear: batch ? Number(batch) : null }, type) })
  } catch (error) {
    return errorResponse(error)
  }
}
