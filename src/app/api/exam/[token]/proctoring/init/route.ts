import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { requireSecureBrowser } from '@/lib/seb'
import { validateFile } from '@/lib/validators/file'
import { initSession } from '@/services/proctoring'

/**
 * Plan 018 — start a proctoring session and upload the reference photo.
 *
 * Called once at exam start (before the candidate hits Start Exam). Body is
 * `multipart/form-data` with a single `photo` field — a JPEG from the
 * candidate's webcam. The route:
 *   - checks the request is coming from SEB
 *   - checks the caller owns the assignment token
 *   - validates the photo against `FILE_LIMITS.proctoring`
 *   - creates the ProctoringSession + uploads to the private bucket
 *
 * Returns `{ sessionId }`. The reference-photo descriptor stays client-side.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    requireSecureBrowser(request.headers)
    const user = await requireAuth()

    // Plan 018b — no photo = activity-only session (test without camera proctoring).
    const isForm = (request.headers.get('content-type') ?? '').startsWith('multipart/form-data')
    const form = isForm ? await request.formData().catch(() => null) : null
    const photo = form?.get('photo')
    if (!(photo instanceof File)) {
      const result = await initSession({ token, userId: user.id })
      return successResponse({ sessionId: result.sessionId })
    }

    const check = validateFile({ size: photo.size, type: photo.type }, 'proctoring')
    if (!check.valid) throw new ValidationError(check.error)

    const buffer = Buffer.from(await photo.arrayBuffer())
    const result = await initSession({
      token,
      userId: user.id,
      photo: buffer,
      contentType: photo.type,
    })
    return successResponse({ sessionId: result.sessionId })
  } catch (error) {
    return errorResponse(error)
  }
}
