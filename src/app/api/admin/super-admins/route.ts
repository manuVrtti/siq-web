import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { grantSuperAdmin } from '@/services/people'

/**
 * POST { email } — make an existing account a Super Admin. Revoking is a
 * normal role change (PATCH /api/admin/users/[id]), guarded so the
 * platform keeps at least one active Super Admin.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const body = await request.json().catch(() => null)
    if (typeof body?.email !== 'string') throw new ValidationError('email is required')
    const res = await grantSuperAdmin(actor, body.email)
    await audit({ userId: actor.id, action: 'superadmin.grant', entityType: 'User', entityId: res.userId, metadata: { from: res.from } })
    return successResponse(res, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
