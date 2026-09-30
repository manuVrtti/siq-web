import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { readImportUpload } from '@/lib/import/upload'
import { commitQuestionImport } from '@/services/import/question-import'
import { audit } from '@/services/audit'

/**
 * Plan 020 — commit. The client re-uploads the same file; the server parses
 * and validates it AGAIN and writes only the rows that pass. The preview the
 * client saw is never trusted as input.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { user, orgId, bytes } = await readImportUpload(request)
    const result = await commitQuestionImport(orgId, user.id, bytes)
    await audit({ userId: user.id, action: 'import.questions', entityType: 'Organization', entityId: orgId, metadata: result })
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
