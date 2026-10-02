import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { audit } from '@/services/audit'
import { scopeForDrive } from '@/lib/auth/drive-scope'
import { completeDrive } from '@/services/mock-drive-runtime'

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

/** Plan 024 — finish a drive after its last round; finalists are notified. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id } = await params
    const scope = await scopeForDrive(user, id)
    const res = await completeDrive(scope, id)
    await audit({ userId: user.id, action: 'drive.complete', entityType: 'MockDrive', entityId: id, metadata: { orgId: scope.orgId, ...res } })
    return successResponse(res)
  } catch (error) {
    return errorResponse(error)
  }
}
