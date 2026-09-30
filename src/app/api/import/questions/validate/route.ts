import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { readImportUpload } from '@/lib/import/upload'
import { validateQuestionImport } from '@/services/import/question-import'

/**
 * Plan 020 — dry run. Parses + validates every row and reports errors.
 * Writes nothing.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { orgId, bytes } = await readImportUpload(request)
    return successResponse(await validateQuestionImport(orgId, bytes))
  } catch (error) {
    return errorResponse(error)
  }
}
