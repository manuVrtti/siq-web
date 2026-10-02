import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { createSkill } from '@/services/taxonomy'

export const dynamic = 'force-dynamic'

const EDITORS = ['COLLEGE_ADMIN', 'SUPER_ADMIN'] as const

/** orgId null/absent = the platform spine (Super Admin only — enforced in the service). */
async function scopeOf(user: Awaited<ReturnType<typeof withRole>>, orgId: unknown) {
  if (orgId === null || orgId === undefined || orgId === '') return null
  if (typeof orgId !== 'string') throw new ValidationError('orgId must be a string')
  await requireOrgAccess(user, orgId)
  return orgId
}

const aliasesOf = (v: unknown) =>
  Array.isArray(v) ? v.filter((a): a is string => typeof a === 'string') : typeof v === 'string' ? v.split(',') : []

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(EDITORS)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.name !== 'string' || typeof body.topicId !== 'string') {
      throw new ValidationError('Topic and skill name are required')
    }
    const orgId = await scopeOf(user, body.orgId)
    const skill = await createSkill(user, orgId, { sectionId: body.topicId, name: body.name, aliases: aliasesOf(body.aliases) })
    await audit({ userId: user.id, action: 'taxonomy.skill.create', entityType: 'SkillNode', entityId: skill.id, metadata: { orgId, code: skill.code } })
    return successResponse({ skill }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
