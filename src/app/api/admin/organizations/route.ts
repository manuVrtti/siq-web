import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { onboardOrganization } from '@/services/console'

/**
 * Onboard an organization in one step: the org, its first College Admins
 * and its departments. SUPER_ADMIN only, audited. This is the single path
 * for creating organizations.
 */

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(40),
  type: z.enum(['COLLEGE', 'COMPANY']),
  domain: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  state: z.string().trim().max(80).nullable().optional(),
  adminEmails: z.array(z.string().trim().max(200)).max(10).default([]),
  departments: z.array(z.object({ code: z.string().max(12), name: z.string().max(100) })).max(60).default([]),
})

export async function POST(request: NextRequest) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid details')
    const res = await onboardOrganization(actor, parsed.data)
    await audit({
      userId: actor.id,
      action: 'org.create',
      entityType: 'Organization',
      entityId: res.org.id,
      metadata: {
        orgId: res.org.id,
        slug: res.org.slug,
        type: parsed.data.type,
        admins: res.admins.filter((a) => a.ok).length,
        departments: res.departments,
      },
    })
    return successResponse(res, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
