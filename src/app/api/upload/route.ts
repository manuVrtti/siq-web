import { type NextRequest } from 'next/server'

import { requireAuth } from '@/lib/auth/require-auth'
import { errorResponse, successResponse } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { uploadFile } from '@/lib/storage'
import { FILE_LIMITS, extensionForType, validateFile } from '@/lib/validators/file'

/**
 * Plan 009 — file upload.
 *
 * Security note: the client sends the file and a category, NOT a bucket or
 * path. The server derives the storage path from the authenticated user
 * (`avatars/{userId}/...`). If the client could name the path, one user could
 * overwrite another's avatar, or write into any bucket. The plan sketched a
 * client-supplied `bucket`/`path`; that is deliberately not implemented.
 *
 * Only `avatar` is accepted here for now. `orgLogo` needs an org selection plus
 * `requireOrgAccess`, which arrives with the org-settings UI (Plan 046).
 */

export const dynamic = 'force-dynamic'

// Cap the raw body defensively, before parsing, so a huge upload can't tie up
// the function. The per-category limit is checked again after parsing.
const MAX_BODY_BYTES = 6 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > MAX_BODY_BYTES) {
      throw new ValidationError('File too large')
    }

    const form = await request.formData().catch(() => null)
    if (!form) throw new ValidationError('Expected multipart form data')

    const category = form.get('category')
    if (category !== 'avatar') {
      throw new ValidationError('Unsupported upload category')
    }

    const file = form.get('file')
    if (!(file instanceof File)) throw new ValidationError('Missing file')

    // The real validation gate — client checks are advisory.
    const check = validateFile({ size: file.size, type: file.type }, 'avatar')
    if (!check.valid) throw new ValidationError(check.error)

    const ext = extensionForType(file.type)
    const path = `${user.id}/avatar.${ext}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { url } = await uploadFile(FILE_LIMITS.avatar.bucket, path, bytes, file.type)

    // Cache-bust: the path is stable (upsert), so the URL would otherwise be
    // served from cache with the old image after a replacement.
    const versionedUrl = `${url}?v=${Date.now()}`

    return successResponse({ url: versionedUrl })
  } catch (error) {
    return errorResponse(error)
  }
}
