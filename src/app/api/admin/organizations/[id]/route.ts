import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { updateOrganizationProfile } from '@/services/console'

/** Edit an organization's platform-owned profile (name, email domain, city, state). SUPER_ADMIN. */

export const dynamic = 'force-dynamic'
const schema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  domain: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  state: z.string().trim().max(80).nullable().optional(),
})

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const { id } = await ctx.params
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input')
    const org = await updateOrganizationProfile(actor, id, parsed.data)
    await audit({
      userId: actor.id,
      action: 'org.update',
      entityType: 'Organization',
      entityId: id,
      metadata: { orgId: id, fields: Object.keys(parsed.data) },
    })
    return successResponse({ org })
  } catch (error) {
    return errorResponse(error)
  }
}
