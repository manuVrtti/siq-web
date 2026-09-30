import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { readImportUpload } from '@/lib/import/upload'
import { commitCandidateImport } from '@/services/import/candidate-import'
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
    const result = await commitCandidateImport(orgId, bytes)
    await audit({ userId: user.id, action: 'import.candidates', entityType: 'Organization', entityId: orgId, metadata: result })
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
