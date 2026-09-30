import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { readImportUpload } from '@/lib/import/upload'
import { commitCandidateImport } from '@/services/import/candidate-import'

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
    const { orgId, bytes } = await readImportUpload(request)
    return successResponse(await commitCandidateImport(orgId, bytes))
  } catch (error) {
    return errorResponse(error)
  }
}
