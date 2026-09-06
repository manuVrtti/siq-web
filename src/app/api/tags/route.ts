import { type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { tagInputSchema } from '@/lib/validators/question'

/**
 * Plan 011 — org-scoped tags for classifying questions.
 */

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)

    const tags = await prisma.tag.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    })
    return successResponse({ tags })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.orgId !== 'string') throw new ValidationError('orgId is required')
    await requireOrgAccess(user, body.orgId)

    const parsed = tagInputSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid tag')
    }

    try {
      const tag = await prisma.tag.create({
        data: { orgId: body.orgId, name: parsed.data.name, category: parsed.data.category ?? null },
      })
      return successResponse({ tag }, 201)
    } catch (e) {
      // Unique constraint on (orgId, name) — a tag with that name already exists.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ValidationError('A tag with that name already exists')
      }
      throw e
    }
  } catch (error) {
    return errorResponse(error)
  }
}
