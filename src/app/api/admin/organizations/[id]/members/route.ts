import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { removeMember } from '@/services/admin'
import { audit } from '@/services/audit'
import { addMemberByEmail } from '@/services/organizations'

/** Add (POST) or remove (DELETE ?userId=) an org member. SUPER_ADMIN, audited. */

export const dynamic = 'force-dynamic'
const schema = z.object({ email: z.string().trim().email('Enter a valid email'), role: z.enum(['ADMIN', 'MEMBER']) })

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const { id } = await ctx.params
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input')
    const m = await addMemberByEmail(id, parsed.data.email, parsed.data.role)
    await audit({
      userId: actor.id,
      action: 'org.member.add',
      entityType: 'Organization',
      entityId: id,
      metadata: { userId: m.userId, role: m.role },
    })
    return successResponse({ member: m }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const { id } = await ctx.params
    const userId = request.nextUrl.searchParams.get('userId')
    if (!userId) throw new ValidationError('userId is required')
    await removeMember(id, userId)
    await audit({ userId: actor.id, action: 'org.member.remove', entityType: 'Organization', entityId: id, metadata: { userId } })
    return successResponse({ removed: true })
  } catch (error) {
    return errorResponse(error)
  }
}
