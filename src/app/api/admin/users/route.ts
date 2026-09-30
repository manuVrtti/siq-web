import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { listUsers } from '@/services/admin'

/**
 * Platform user list — SUPER_ADMIN only.
 *
 * Previously COLLEGE_ADMIN could call this too, and it returned the newest
 * users across EVERY college (a cross-tenant leak of names and emails). A
 * college admin's view of their own people is /api/candidates, which is
 * org-scoped.
 */

export const dynamic = 'force-dynamic'
const ROLES = ['STUDENT', 'COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest) {
  try {
    await withRole(['SUPER_ADMIN'])
    const p = request.nextUrl.searchParams
    const role = ROLES.find((r) => r === p.get('role'))
    return successResponse(
      await listUsers({
        q: p.get('q') || undefined,
        role,
        skip: Number(p.get('skip')) || 0,
        take: Number(p.get('take')) || 25,
      }),
    )
  } catch (error) {
    return errorResponse(error)
  }
}
