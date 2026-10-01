import { type NextRequest } from 'next/server'

import { PERMISSIONS } from '@/constants/permissions'
import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withPermission } from '@/lib/auth/require-role'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { audit } from '@/services/audit'
import { deleteDepartment, updateDepartment } from '@/services/departments'

/** Rename / delete a department. Org derived from the row, never the client. */

export const dynamic = 'force-dynamic'

async function authorize(id: string) {
  const user = await withPermission(PERMISSIONS.MANAGE_OWN_ORG)
  const d = await prisma.department.findUnique({ where: { id }, select: { orgId: true } })
  if (!d) throw new NotFoundError('Department not found')
  await requireOrgAccess(user, d.orgId)
  return { user, orgId: d.orgId }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { user, orgId } = await authorize(id)
    const department = await updateDepartment(orgId, id, (await request.json().catch(() => null)) ?? {})
    await audit({ userId: user.id, action: 'department.update', entityType: 'Department', entityId: id, metadata: { orgId } })
    return successResponse({ department })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { user, orgId } = await authorize(id)
    await deleteDepartment(orgId, id)
    await audit({ userId: user.id, action: 'department.delete', entityType: 'Department', entityId: id, metadata: { orgId } })
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
