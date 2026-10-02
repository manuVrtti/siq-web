import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { markRead } from '@/services/notifications/feed'

/** POST { keys: string[] } — marks the caller's own notifications read. */

export const dynamic = 'force-dynamic'

const body = z.object({ keys: z.array(z.string().min(1).max(200)).max(50) })

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const parsed = body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new ValidationError('Invalid keys')
    await markRead(user.id, parsed.data.keys)
    return successResponse(null)
  } catch (error) {
    return errorResponse(error)
  }
}
