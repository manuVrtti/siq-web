import { type NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { requireSecureBrowser } from '@/lib/seb'
import { validateFile } from '@/lib/validators/file'
import { recordFlag } from '@/services/proctoring'

/**
 * Plan 018 — record a single proctoring flag.
 *
 * Called by the client-side monitor whenever a face check or activity event
 * triggers. Two content types are accepted:
 *   - `multipart/form-data` when a snapshot image accompanies the flag
 *     (`assessment.storeSnapshots = true`)
 *   - `application/json` when no snapshot is attached (activity events, or
 *     when snapshots are disabled)
 *
 * SEB-gated + auth-gated; the service further verifies the caller owns the
 * assignment token, so a leaked token alone gets 403.
 */

export const dynamic = 'force-dynamic'

const FLAG_TYPES = [
  'NO_FACE',
  'MULTIPLE_FACES',
  'FACE_MISMATCH',
  'TAB_SWITCH',
  'FOCUS_LOSS',
  'FULLSCREEN_EXIT',
  'WINDOW_BLUR',
  'WEBCAM_DENIED',
] as const

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const

const flagSchema = z.object({
  type: z.enum(FLAG_TYPES),
  severity: z.enum(SEVERITIES).default('LOW'),
  similarity: z.number().min(-1).max(1).nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    requireSecureBrowser(request.headers)
    const user = await requireAuth()

    const contentType = request.headers.get('content-type') ?? ''
    let payload: unknown
    let snapshot: { buffer: Buffer; contentType: string } | null = null

    if (contentType.startsWith('multipart/form-data')) {
      const form = await request.formData()
      const raw = form.get('flag')
      if (typeof raw !== 'string') throw new ValidationError('flag field is required')
      payload = JSON.parse(raw)
      const file = form.get('snapshot')
      if (file instanceof File && file.size > 0) {
        const check = validateFile({ size: file.size, type: file.type }, 'proctoring')
        if (!check.valid) throw new ValidationError(check.error)
        snapshot = { buffer: Buffer.from(await file.arrayBuffer()), contentType: file.type }
      }
    } else {
      payload = await request.json().catch(() => null)
    }

    const parsed = flagSchema.safeParse(payload)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid flag payload')
    }

    const flag = await recordFlag({
      token,
      userId: user.id,
      type: parsed.data.type,
      severity: parsed.data.severity,
      similarity: parsed.data.similarity ?? null,
      metadata:
        parsed.data.metadata === undefined || parsed.data.metadata === null
          ? null
          : (parsed.data.metadata as Prisma.InputJsonValue),
      snapshot,
    })
    return successResponse({ flagId: flag.id })
  } catch (error) {
    return errorResponse(error)
  }
}
