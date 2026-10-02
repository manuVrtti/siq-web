import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { scopeForRound } from '@/lib/auth/drive-scope'
import { roundUpdateSchema } from '@/lib/validators/mock-drive'
import { moveRound, removeRound, updateRound } from '@/services/mock-drives'

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

/** Edit a round's name / cutoff / schedule, or move it ({ move: 'up' | 'down' }). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; roundId: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { roundId } = await params
    const { scope, driveId } = await scopeForRound(user, roundId)
    const body = await request.json().catch(() => null)
    if (body?.move === 'up' || body?.move === 'down') {
      await moveRound(scope, roundId, body.move)
    } else {
      const parsed = roundUpdateSchema.safeParse(body)
      if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid round')
      await updateRound(scope, roundId, parsed.data)
    }
    await audit({ userId: user.id, action: 'drive.round', entityType: 'MockDrive', entityId: driveId, metadata: { orgId: scope.orgId, op: body?.move ? 'move' : 'edit' } })
    return successResponse({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; roundId: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { roundId } = await params
    const { scope, driveId } = await scopeForRound(user, roundId)
    await removeRound(scope, roundId)
    await audit({ userId: user.id, action: 'drive.round', entityType: 'MockDrive', entityId: driveId, metadata: { orgId: scope.orgId, op: 'remove' } })
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
