import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { listPlatformTaxonomy, listTaxonomy } from '@/services/taxonomy'

/**
 * Plan 021 — topics + skills.
 *   ?orgId=…    platform spine + that college's additions (anyone who writes questions there)
 *   ?scope=platform   the shared spine only (Super Admin console)
 */

export const dynamic = 'force-dynamic'

const READERS = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(READERS)
    const p = request.nextUrl.searchParams
    if (p.get('scope') === 'platform') {
      if (user.role !== 'SUPER_ADMIN') throw new ValidationError('orgId is required')
      return successResponse({ topics: await listPlatformTaxonomy() })
    }
    const orgId = p.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)
    return successResponse({ topics: await listTaxonomy(orgId) })
  } catch (error) {
    return errorResponse(error)
  }
}
