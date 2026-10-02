import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { scopeForDrive } from '@/lib/auth/drive-scope'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { setRoundProctoring } from '@/services/mock-drives'

/**
 * Plan 017b — proctoring for drive rounds: { all: true } or { roundIds: [] },
 * plus { enabled }. Rounds already opened are left as they are.
 */

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id } = await params
    const scope = await scopeForDrive(user, id)
    const body = await request.json().catch(() => null)
    if (typeof body?.enabled !== 'boolean') throw new ValidationError('enabled must be true or false')
    const ids = Array.isArray(body.roundIds) ? body.roundIds.filter((x: unknown): x is string => typeof x === 'string') : null
    if (!body.all && !ids?.length) throw new ValidationError('Choose rounds, or all')
    const res = await setRoundProctoring(scope, id, body.all ? 'ALL' : ids!, body.enabled)
    await audit({ userId: user.id, action: 'drive.round', entityType: 'MockDrive', entityId: id, metadata: { orgId: scope.orgId, op: 'proctoring', enabled: body.enabled, ...res } })
    return successResponse(res)
  } catch (error) {
    return errorResponse(error)
  }
}
