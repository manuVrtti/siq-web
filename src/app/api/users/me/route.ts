import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/require-auth'
import { errorResponse, successResponse } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

/**
 * Plan 009 — current-user self-service.
 *
 *   GET   return the signed-in user's own record
 *   PATCH update the fields a user may change about themselves
 */

export const dynamic = 'force-dynamic'

// A user may edit only these. Notably NOT `role`, `email` or `firebaseUid` —
// those are set by the system / identity provider. Accepting `role` here would
// be a privilege-escalation hole.
const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  avatarUrl: z.string().url().max(2048).optional(),
})

export async function GET() {
  try {
    const user = await requireAuth()
    return successResponse({ user })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request')
    }
    if (Object.keys(parsed.data).length === 0) {
      throw new ValidationError('Nothing to update')
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
      },
    })

    return successResponse({ user: updated })
  } catch (error) {
    return errorResponse(error)
  }
}
