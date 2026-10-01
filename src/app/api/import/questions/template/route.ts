import { errorResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { XLSX_MIME, fileResponse } from '@/lib/import/xlsx-parser'
import { getQuestionTemplate } from '@/services/import/question-import'

/** Plan 020 — download the questions import template (.xlsx). Manager roles. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await withRole(['COLLEGE_ADMIN', 'COLLEGE_HOD', 'RECRUITER', 'SUPER_ADMIN'])
    return fileResponse(getQuestionTemplate(), 'SelectIQ question import template.xlsx', XLSX_MIME)
  } catch (error) {
    return errorResponse(error)
  }
}
