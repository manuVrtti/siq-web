import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { deleteSkill, updateSkill } from '@/services/taxonomy'

export const dynamic = 'force-dynamic'

const EDITORS = ['COLLEGE_ADMIN', 'SUPER_ADMIN'] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(EDITORS)
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body) throw new ValidationError('Nothing to update')
    const aliases = Array.isArray(body.aliases)
      ? body.aliases.filter((a: unknown): a is string => typeof a === 'string')
      : typeof body.aliases === 'string'
        ? body.aliases.split(',')
        : undefined
    const skill = await updateSkill(user, id, { name: typeof body.name === 'string' ? body.name : undefined, aliases })
    await audit({ userId: user.id, action: 'taxonomy.skill.update', entityType: 'SkillNode', entityId: id, metadata: { orgId: skill.orgId } })
    return successResponse({ skill })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(EDITORS)
    const { id } = await params
    await deleteSkill(user, id)
    await audit({ userId: user.id, action: 'taxonomy.skill.delete', entityType: 'SkillNode', entityId: id })
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
