import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { requireSecureBrowser } from '@/lib/seb'
import { validateFile } from '@/lib/validators/file'
import { getIdentityStatus, submitIdentityCheck } from '@/services/identity'

/**
 * Plan 018b — the pre-exam identity step (exam browser only, own token only).
 *   GET  → { required, done, outcome, idPhotoUrl } (short-lived signed URL)
 *   POST → multipart { snapshot, outcome, matchScore, attempts }
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    requireSecureBrowser(request.headers)
    const user = await requireAuth()
    return successResponse(await getIdentityStatus(token, user.id))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    requireSecureBrowser(request.headers)
    const user = await requireAuth()
    const form = await request.formData().catch(() => null)
    const file = form?.get('snapshot')
    if (!(file instanceof File) || file.size === 0) throw new ValidationError('A photo is required')
    const check = validateFile({ size: file.size, type: file.type }, 'proctoring')
    if (!check.valid) throw new ValidationError(check.error)
    const rawScore = form?.get('matchScore')
    const matchScore = typeof rawScore === 'string' && rawScore !== '' ? Number(rawScore) : null
    if (matchScore !== null && !Number.isFinite(matchScore)) throw new ValidationError('Invalid score')
    const res = await submitIdentityCheck({
      token,
      userId: user.id,
      snapshot: { buffer: Buffer.from(await file.arrayBuffer()), contentType: file.type },
      outcome: String(form?.get('outcome') ?? ''),
      matchScore,
      attempts: Number(form?.get('attempts') ?? 1),
    })
    return successResponse(res, res.existing ? 200 : 201)
  } catch (error) {
    return errorResponse(error)
  }
}
