import { errorResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { XLSX_MIME, fileResponse } from '@/lib/import/xlsx-parser'
import { getCandidateTemplate } from '@/services/import/candidate-import'

/** Plan 020 — download the candidates import template (.xlsx). Manager roles. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await withRole(['COLLEGE_ADMIN', 'COLLEGE_HOD', 'RECRUITER', 'SUPER_ADMIN'])
    return fileResponse(getCandidateTemplate(), 'SelectIQ candidate import template.xlsx', XLSX_MIME)
  } catch (error) {
    return errorResponse(error)
  }
}
