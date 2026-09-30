import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { updateOrganization } from '@/services/admin'
import { audit } from '@/services/audit'

/** Rename an org or set its email domain (self sign-up matching). SUPER_ADMIN. */

export const dynamic = 'force-dynamic'
const schema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  domain: z.string().trim().max(120).nullable().optional(),
})

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const { id } = await ctx.params
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input')
    const org = await updateOrganization(id, parsed.data)
    await audit({
      userId: actor.id,
      action: 'org.update',
      entityType: 'Organization',
      entityId: id,
      metadata: { name: org.name, domain: org.domain },
    })
    return successResponse({ org })
  } catch (error) {
    return errorResponse(error)
  }
}
