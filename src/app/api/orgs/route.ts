import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { getUserOrgs } from '@/lib/auth/org-access'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { createOrganization } from '@/services/organizations'

/**
 * Plan T01 — organizations.
 *
 *   GET  list the orgs the caller belongs to (any authenticated user)
 *   POST create an organization (SUPER_ADMIN only), seating the creator as its
 *        first admin unless another admin id is given
 */

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(2).max(40),
  type: z.enum(['COLLEGE', 'COMPANY']),
  adminUserId: z.string().optional(),
})

export async function GET() {
  try {
    const user = await requireAuth()
    const orgs = await getUserOrgs(user.id)
    return successResponse({ orgs })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Only platform staff can create tenants.
    const user = await withRole(['SUPER_ADMIN'])

    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input')
    }

    const org = await createOrganization({
      name: parsed.data.name,
      slug: parsed.data.slug,
      type: parsed.data.type,
      adminUserId: parsed.data.adminUserId ?? user.id,
    })

    return successResponse({ org }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
