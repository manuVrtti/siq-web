import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { removeResume, saveResume } from '@/services/profile'

/** Upload (POST, multipart `file`) or remove (DELETE) your own résumé PDF. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) throw new ValidationError('Attach a PDF')
    const saved = await saveResume(user.id, { bytes: await file.arrayBuffer(), name: file.name, type: file.type })
    return successResponse({ fileName: saved.resumeFileName, uploadedAt: saved.resumeUploadedAt })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE() {
  try {
    const user = await requireAuth()
    await removeResume(user.id)
    return successResponse({ removed: true })
  } catch (error) {
    return errorResponse(error)
  }
}
