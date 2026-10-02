import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { bulkTag } from '@/services/taxonomy'

/**
 * Plan 021 — tag many questions at once with one topic + skills (the
 * backfill queue for imported / older questions).
 */

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.orgId !== 'string') throw new ValidationError('orgId is required')
    await requireOrgAccess(user, body.orgId)
    if (typeof body.topicId !== 'string') throw new ValidationError('Choose a topic')
    const ids = Array.isArray(body.questionIds) ? body.questionIds.filter((x: unknown) => typeof x === 'string') : []
    const skills = Array.isArray(body.skillIds) ? body.skillIds.filter((x: unknown) => typeof x === 'string') : []
    if (ids.length === 0) throw new ValidationError('Select at least one question')
    if (ids.length > 200) throw new ValidationError('Tag at most 200 questions at a time')
    const tagged = await bulkTag(body.orgId, ids, body.topicId, skills)
    await audit({ userId: user.id, action: 'question.tag', entityType: 'Question', metadata: { orgId: body.orgId, count: tagged, topicId: body.topicId } })
    return successResponse({ tagged })
  } catch (error) {
    return errorResponse(error)
  }
}
