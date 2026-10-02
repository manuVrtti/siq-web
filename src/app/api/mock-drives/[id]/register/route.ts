import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { registerStudent, withdrawStudent } from '@/services/mock-drive-registration'

/** Plan 023 — a student joins (POST) or leaves (DELETE) an open drive of their own college. */

export const dynamic = 'force-dynamic'

async function check(id: string) {
  const user = await withRole(['STUDENT'] as const)
  const d = await prisma.mockDrive.findUnique({ where: { id }, select: { orgId: true } })
  if (!d) throw new NotFoundError('Mock drive not found')
  await requireOrgAccess(user, d.orgId)
  return user
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await check(id)
    return successResponse({ registration: await registerStudent(id, user.id) }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await check(id)
    await withdrawStudent(id, user.id)
    return successResponse({ withdrawn: true })
  } catch (error) {
    return errorResponse(error)
  }
}
