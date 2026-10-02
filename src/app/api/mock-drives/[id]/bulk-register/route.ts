import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { scopeForDrive } from '@/lib/auth/drive-scope'
import { bulkRegister } from '@/services/mock-drive-registration'

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

/** Plan 023 — enrol students ({ userIds } or { all: true } for everyone eligible). Ineligible ones are skipped. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id } = await params
    const scope = await scopeForDrive(user, id)
    const body = await request.json().catch(() => null)
    const ids = Array.isArray(body?.userIds) ? body.userIds.filter((x: unknown): x is string => typeof x === 'string') : null
    if (!body?.all && !ids?.length) throw new ValidationError('Choose students, or enrol everyone eligible')
    if (ids && ids.length > 5000) throw new ValidationError('At most 5,000 students at a time')
    const res = await bulkRegister(scope, id, body?.all ? 'ALL_ELIGIBLE' : ids!)
    await audit({ userId: user.id, action: 'drive.register', entityType: 'MockDrive', entityId: id, metadata: { orgId: scope.orgId, ...res } })
    return successResponse(res)
  } catch (error) {
    return errorResponse(error)
  }
}
