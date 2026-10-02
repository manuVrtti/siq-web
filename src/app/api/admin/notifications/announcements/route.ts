import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { createPlatformAnnouncement, listPlatformAnnouncements } from '@/services/notifications/announcements'

/** Platform-wide announcements (every college) — SUPER_ADMIN only. */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await withRole(['SUPER_ADMIN'])
    return successResponse({ announcements: await listPlatformAnnouncements() })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await withRole(['SUPER_ADMIN'])
    const created = await createPlatformAnnouncement(user.id, await req.json().catch(() => null))
    return successResponse({ announcement: created }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
