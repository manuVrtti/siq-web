import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { deleteTopic, updateTopic } from '@/services/taxonomy'

/** Rename / delete one topic. Who may edit it is decided by the topic's own scope (service). */

export const dynamic = 'force-dynamic'

const EDITORS = ['COLLEGE_ADMIN', 'SUPER_ADMIN'] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(EDITORS)
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body) throw new ValidationError('Nothing to update')
    const topic = await updateTopic(user, id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: body.description === null || typeof body.description === 'string' ? body.description : undefined,
    })
    await audit({ userId: user.id, action: 'taxonomy.topic.update', entityType: 'TopicSection', entityId: id, metadata: { orgId: topic.orgId } })
    return successResponse({ topic })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(EDITORS)
    const { id } = await params
    await deleteTopic(user, id)
    await audit({ userId: user.id, action: 'taxonomy.topic.delete', entityType: 'TopicSection', entityId: id })
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
