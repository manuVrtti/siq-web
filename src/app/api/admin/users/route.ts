import { NextResponse } from 'next/server'

import { withRole } from '@/lib/auth/require-role'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

/**
 * Plan 007 — worked example of role enforcement.
 *
 * Restricted to COLLEGE_ADMIN and SUPER_ADMIN. A STUDENT holding a perfectly
 * valid session gets 403 here, which is the distinction that matters: they are
 * authenticated, just not authorized.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Authenticates and authorizes in one call, so the handler can never
    // check a role on a user it failed to verify.
    await withRole(['COLLEGE_ADMIN', 'SUPER_ADMIN'])

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ users })
  } catch (error) {
    return handleApiError(error)
  }
}
