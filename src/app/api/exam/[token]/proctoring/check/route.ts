import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { requireSecureBrowser } from '@/lib/seb'
import { validateFile } from '@/lib/validators/file'
import { recordCheck } from '@/services/proctoring'

/**
 * Plan 018b — one random in-exam identity check: multipart
 * { matched, matchScore, faceCount, snapshot? }. Stored for staff review.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    requireSecureBrowser(request.headers)
    const user = await requireAuth()
    const form = await request.formData().catch(() => null)
    if (!form) throw new ValidationError('Invalid check')
    const faceCount = Number(form.get('faceCount'))
    if (!Number.isInteger(faceCount) || faceCount < 0 || faceCount > 10) throw new ValidationError('Invalid face count')
    const rawScore = form.get('matchScore')
    const matchScore = typeof rawScore === 'string' && rawScore !== '' ? Number(rawScore) : null
    if (matchScore !== null && !(matchScore >= 0 && matchScore <= 1)) throw new ValidationError('Invalid score')
    let snapshot: { buffer: Buffer; contentType: string } | null = null
    const file = form.get('snapshot')
    if (file instanceof File && file.size > 0) {
      const check = validateFile({ size: file.size, type: file.type }, 'proctoring')
      if (!check.valid) throw new ValidationError(check.error)
      snapshot = { buffer: Buffer.from(await file.arrayBuffer()), contentType: file.type }
    }
    const res = await recordCheck({ token, userId: user.id, matched: form.get('matched') === 'true', matchScore, faceCount, snapshot })
    return successResponse(res, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
