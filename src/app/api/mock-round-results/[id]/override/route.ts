import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { getScope } from '@/lib/auth/scope'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { overrideOutcome } from '@/services/mock-drive-runtime'

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

/** Plan 024 — change one student's round outcome, with a reason (audited). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id } = await params
    const rr = await prisma.mockRoundResult.findUnique({ where: { id }, select: { round: { select: { drive: { select: { orgId: true } } } } } })
    if (!rr) throw new NotFoundError('Round result not found')
    const scope = await getScope(user, rr.round.drive.orgId)
    const body = await request.json().catch(() => null)
    if (body?.outcome !== 'SHORTLISTED' && body?.outcome !== 'ELIMINATED') throw new ValidationError('Outcome must be SHORTLISTED or ELIMINATED')
    const res = await overrideOutcome(scope, id, body.outcome, String(body.reason ?? ''), user.id)
    await audit({ userId: user.id, action: 'drive.override', entityType: 'MockDrive', entityId: res.driveId, metadata: { orgId: scope.orgId, student: res.userId, outcome: body.outcome, reason: String(body.reason).slice(0, 300) } })
    return successResponse({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
