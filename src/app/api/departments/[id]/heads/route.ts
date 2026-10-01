import { type NextRequest } from 'next/server'

import { PERMISSIONS } from '@/constants/permissions'
import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withPermission } from '@/lib/auth/require-role'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { audit } from '@/services/audit'
import { assignHead, removeHead } from '@/services/departments'

/**
 * Assign (POST { email }) or remove (DELETE ?userId=) an HOD of a department.
 * College Admin / Super Admin only.
 */

export const dynamic = 'force-dynamic'

async function authorize(id: string) {
  const user = await withPermission(PERMISSIONS.MANAGE_OWN_ORG)
  const d = await prisma.department.findUnique({ where: { id }, select: { orgId: true } })
  if (!d) throw new NotFoundError('Department not found')
  await requireOrgAccess(user, d.orgId)
  return { user, orgId: d.orgId }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { user, orgId } = await authorize(id)
    const body = await request.json().catch(() => null)
    if (typeof body?.email !== 'string') throw new ValidationError('email is required')
    const res = await assignHead(orgId, id, body.email)
    await audit({ userId: user.id, action: 'department.heads', entityType: 'Department', entityId: id, metadata: { orgId, added: res.userId } })
    return successResponse(res, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { user, orgId } = await authorize(id)
    const userId = request.nextUrl.searchParams.get('userId')
    if (!userId) throw new ValidationError('userId is required')
    await removeHead(orgId, id, userId)
    await audit({ userId: user.id, action: 'department.heads', entityType: 'Department', entityId: id, metadata: { orgId, removed: userId } })
    return successResponse({ removed: true })
  } catch (error) {
    return errorResponse(error)
  }
}
