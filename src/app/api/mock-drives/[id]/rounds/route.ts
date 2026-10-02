import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { scopeForDrive } from '@/lib/auth/drive-scope'
import { roundInputSchema } from '@/lib/validators/mock-drive'
import { addRound } from '@/services/mock-drives'

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

/** Plan 023 — add a round (an existing test) to a drive. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id } = await params
    const scope = await scopeForDrive(user, id)
    const parsed = roundInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid round')
    const round = await addRound(scope, id, parsed.data)
    await audit({ userId: user.id, action: 'drive.round', entityType: 'MockDrive', entityId: id, metadata: { orgId: scope.orgId, op: 'add', order: round.order } })
    return successResponse({ round }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
