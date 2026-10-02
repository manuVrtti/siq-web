import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { scopeForDrive } from '@/lib/auth/drive-scope'
import { DRIVE_STATUSES } from '@/lib/validators/mock-drive'
import { updateStatus } from '@/services/mock-drives'

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

/** Plan 023 — move a drive through its lifecycle (DRAFT → … → IN_PROGRESS; COMPLETED → ARCHIVED). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id } = await params
    const scope = await scopeForDrive(user, id)
    const body = await request.json().catch(() => null)
    const status = DRIVE_STATUSES.find((s) => s === body?.status)
    if (!status) throw new ValidationError('Unknown status')
    const drive = await updateStatus(scope, id, status)
    await audit({ userId: user.id, action: 'drive.status', entityType: 'MockDrive', entityId: id, metadata: { orgId: scope.orgId, status } })
    return successResponse({ drive })
  } catch (error) {
    return errorResponse(error)
  }
}
