import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { scopeForRound } from '@/lib/auth/drive-scope'
import { evaluateRound } from '@/services/mock-drive-runtime'

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

/** Plan 024 — Closes the round: no-shows are eliminated; refused while answers await grading. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; roundId: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id, roundId } = await params
    const { scope, driveId, order } = await scopeForRound(user, roundId)
    if (driveId !== id) throw new ValidationError('Round doesn’t belong to this drive')
    const res = await evaluateRound(scope, driveId, order)
    await audit({ userId: user.id, action: 'drive.round.evaluate', entityType: 'MockDrive', entityId: driveId, metadata: { orgId: scope.orgId, order, ...res } })
    return successResponse(res)
  } catch (error) {
    return errorResponse(error)
  }
}
