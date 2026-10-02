import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { getScope } from '@/lib/auth/scope'
import { driveInputSchema, DRIVE_STATUSES } from '@/lib/validators/mock-drive'
import { createDrive, listDrives } from '@/services/mock-drives'

/** Plan 023 — list / create mock drives of a college. */

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(STAFF)
    const p = request.nextUrl.searchParams
    const orgId = p.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    const scope = await getScope(user, orgId)
    const status = DRIVE_STATUSES.find((s) => s === p.get('status'))
    return successResponse({ drives: await listDrives(scope, status) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(STAFF)
    const body = await request.json().catch(() => null)
    if (typeof body?.orgId !== 'string') throw new ValidationError('orgId is required')
    const scope = await getScope(user, body.orgId)
    const parsed = driveInputSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid drive')
    const drive = await createDrive(scope, user.id, parsed.data)
    await audit({ userId: user.id, action: 'drive.create', entityType: 'MockDrive', entityId: drive.id, metadata: { orgId: body.orgId, mode: drive.mode } })
    return successResponse({ drive }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
