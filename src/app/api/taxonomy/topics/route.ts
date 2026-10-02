import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { createTopic } from '@/services/taxonomy'

export const dynamic = 'force-dynamic'

const EDITORS = ['COLLEGE_ADMIN', 'SUPER_ADMIN'] as const

/** orgId null/absent = the platform spine (Super Admin only — enforced in the service). */
async function scopeOf(user: Awaited<ReturnType<typeof withRole>>, orgId: unknown) {
  if (orgId === null || orgId === undefined || orgId === '') return null
  if (typeof orgId !== 'string') throw new ValidationError('orgId must be a string')
  await requireOrgAccess(user, orgId)
  return orgId
}

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(EDITORS)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.name !== 'string') throw new ValidationError('Topic name is required')
    const orgId = await scopeOf(user, body.orgId)
    const topic = await createTopic(user, orgId, {
      name: body.name,
      code: typeof body.code === 'string' ? body.code : undefined,
      description: typeof body.description === 'string' ? body.description : null,
    })
    await audit({ userId: user.id, action: 'taxonomy.topic.create', entityType: 'TopicSection', entityId: topic.id, metadata: { orgId, code: topic.code } })
    return successResponse({ topic }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
