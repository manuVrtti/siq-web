import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { getPlatformOverview } from '@/services/analytics/org-analytics'

/** Plan 019 — platform-wide metrics. SUPER_ADMIN only (403 for everyone else). */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await withRole(['SUPER_ADMIN'])
    return successResponse(await getPlatformOverview())
  } catch (error) {
    return errorResponse(error)
  }
}
