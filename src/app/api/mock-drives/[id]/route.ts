import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { scopeForDrive } from '@/lib/auth/drive-scope'
import { driveInputSchema } from '@/lib/validators/mock-drive'
import { deleteDrive, driveBlockers, getDrive, updateDrive } from '@/services/mock-drives'

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id } = await params
    const drive = await getDrive(await scopeForDrive(user, id), id)
    return successResponse({ drive, blockers: driveBlockers(drive) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id } = await params
    const scope = await scopeForDrive(user, id)
    const parsed = driveInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid drive')
    const drive = await updateDrive(scope, id, parsed.data)
    await audit({ userId: user.id, action: 'drive.update', entityType: 'MockDrive', entityId: id, metadata: { orgId: scope.orgId } })
    return successResponse({ drive })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id } = await params
    const scope = await scopeForDrive(user, id)
    await deleteDrive(scope, id)
    await audit({ userId: user.id, action: 'drive.delete', entityType: 'MockDrive', entityId: id, metadata: { orgId: scope.orgId } })
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
